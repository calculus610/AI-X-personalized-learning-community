"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Loader2,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react"
import type { Locale } from "@/lib/bilingual-ui"
import { containsChinese } from "@/lib/localized-learning-content"
import type { SupportMode } from "@/lib/course-executor-contract"
import {
  chatWithLearningAgent,
  createLearningAgentSession,
  recordLearningAgentCopy,
  stopLearningAgentSession,
  type LearningAgentSession,
} from "@/lib/personalization-api"

export type LearningAgentContext = {
  trackId: string
  routeStepId: string
  courseId: string | null
  stageId: string | null
  stepTitle: string | null
  routeTitle: string
  routeKind: "course" | "project"
  mode: SupportMode | null
}

export type LearningAgentHelpRequest = {
  id: number
  message: string
}

type AgentMessage = {
  id: string
  role: "user" | "agent"
  text: string
  agentLabel?: string
}

function cleanAgentAnswer(raw: string) {
  const source = raw.trim().replace(/^```(?:json|markdown|md)?\s*/i, "").replace(/```\s*$/i, "")
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    for (const key of ["answer", "reply", "content", "message", "text"]) {
      if (typeof parsed[key] === "string" && parsed[key]) return String(parsed[key]).trim()
    }
  } catch {
    // The provider can return plain text.
  }
  return source
}

function inlineMarkdown(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
  )
}

function AgentMarkdown({ value }: { value: string }) {
  const lines = value.split(/\r?\n/)
  const nodes: React.ReactNode[] = []
  let list: Array<{ text: string; ordered: boolean }> = []
  const flush = () => {
    if (!list.length) return
    const ordered = list[0].ordered
    const Tag = ordered ? "ol" : "ul"
    nodes.push(<Tag key={`list-${nodes.length}`}>{list.map((item, index) => <li key={index}>{inlineMarkdown(item.text)}</li>)}</Tag>)
    list = []
  }
  lines.forEach((line, index) => {
    const item = line.match(/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/)
    if (item) { list.push({ text: item[3], ordered: Boolean(item[2]) }); return }
    flush()
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) { const Tag = `h${Math.min(4, heading[1].length + 2)}` as "h3" | "h4"; nodes.push(<Tag key={index}>{inlineMarkdown(heading[2])}</Tag>); return }
    if (line.trim()) nodes.push(<p key={index}>{inlineMarkdown(line)}</p>)
  })
  flush()
  return <div className="agent-markdown">{nodes}</div>
}

function contextKey(context: LearningAgentContext | null) {
  if (!context) return ""
  return [
    context.trackId,
    context.routeStepId,
    context.courseId ?? "course",
    context.stageId ?? "course",
    context.mode ?? "unset",
  ].join(":")
}

function forceLanguage(locale: Locale, message: string) {
  if (locale === "zh") return message
  return [
    "[Language requirement]",
    "Answer in English only. Do not include Chinese in the student-facing answer.",
    "",
    message,
  ].join("\n")
}

export function UnifiedLearningAgent({
  context,
  helpRequest,
  locale,
}: {
  context: LearningAgentContext | null
  helpRequest?: LearningAgentHelpRequest | null
  locale: Locale
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [session, setSession] = useState<LearningAgentSession | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [sessionContextKey, setSessionContextKey] = useState("")
  const [error, setError] = useState("")
  const sequence = useRef(0)
  const scrollAnchor = useRef<HTMLDivElement>(null)
  const handledHelpRequest = useRef<number | null>(null)
  const activeContextKey = useMemo(() => `${contextKey(context)}:${locale}`, [context, locale])
  const agentName = locale === "en" ? "Learning partner" : (session?.agent.agent_name ?? "学习伙伴")

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ block: "nearest" })
  }, [messages, sending])

  useEffect(() => {
    let cancelled = false
    setMessages([])
    setSession(null)
    setSessionContextKey("")
    setError("")
    if (!context) return
    setLoadingSession(true)
    createLearningAgentSession({
      trackId: context.trackId,
      routeStepId: context.routeStepId,
      stageId: context.stageId,
      locale,
    })
      .then((created) => {
        if (cancelled) return
        setSession(created)
        setSessionContextKey(activeContextKey)
        setMessages(created.messages.filter((message) => message.role !== "assistant" || (locale === "en" ? !containsChinese(message.text) : containsChinese(message.text))).map((message) => ({
          id: String(message.message_id),
          role: message.role === "assistant" ? "agent" : "user",
          text: message.text,
          agentLabel: created.agent.agent_name,
        })))
      })
      .catch((failure) => {
        if (!cancelled) setError((failure as Error).message || (locale === "en" ? "Agent initialization failed." : "Agent 初始化失败。"))
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false)
      })
    return () => { cancelled = true }
  // activeContextKey contains course, stage, mode and locale. Depending on the
  // object identity here caused a fresh session on every parent render and let
  // an older course session appear after a fast course/language switch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContextKey])

  const activeSession = sessionContextKey === activeContextKey ? session : null

  useEffect(() => {
    if (!helpRequest || !context || !session || sending || handledHelpRequest.current === helpRequest.id) return
    handledHelpRequest.current = helpRequest.id
    setOpen(true)
    setDraft("")
    void sendMessage(helpRequest.message)
    // The request id is the action boundary; conversation updates must not resend it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, helpRequest, sending, session])

  async function sendMessage(message: string) {
    if (!message || !context || !session || sending) return
    sequence.current += 1
    setMessages((current) => [...current, { id: `user-${sequence.current}`, role: "user", text: message }])
    setSending(true)
    setError("")
    const localizedMessage = forceLanguage(locale, message)
    const outgoingMessage = context.mode === "self_directed"
      ? `${locale === "en" ? "[Self-directed mode: only give hints when I ask. Do not force the task into steps.]" : "[自主挑战模式：只在我请求时给提示，不要强制拆成步骤。]"} ${localizedMessage}`
      : localizedMessage
    try {
      const response = await chatWithLearningAgent({
        sessionId: session.session_id,
        message: outgoingMessage,
        locale,
      })
      sequence.current += 1
      setMessages((current) => [...current, {
        id: String(response.message_id || `agent-${sequence.current}`),
        role: "agent",
        text: cleanAgentAnswer(response.answer),
        agentLabel: session.agent.agent_name,
      }])
    } catch (sendFailure) {
      const raw = (sendFailure as Error).message
      if (/401|unauthorized|invalid_token/i.test(raw)) {
        setError(locale === "en" ? "Your login has expired. Please log in again." : "登录状态已过期，请重新登录。")
      } else if (/agent_session_not_found|route_step_not_found/i.test(raw)) {
        setError(locale === "en" ? "The current course context changed. Refresh and try again." : "当前课程上下文已变化，请刷新后重试。")
      } else {
        setError(locale === "en" ? "The Agent did not return a result. Please try again later." : "Agent 暂时没有返回结果，请稍后重试。")
      }
    } finally {
      setSending(false)
    }
  }

  async function stopGenerating() {
    if (!session || !sending) return
    try {
      await stopLearningAgentSession(session.session_id)
    } catch {
      // Some providers cannot cancel an in-flight request, but the server still records the stop attempt when possible.
    } finally {
      setSending(false)
    }
  }

  function sendDraft() {
    const message = draft.trim()
    if (!message || !context || !session || sending) return
    setDraft("")
    void sendMessage(message)
  }

  async function copyAgentMessage(message: AgentMessage) {
    try {
      await navigator.clipboard?.writeText(message.text)
    } catch {
      // The audit event is still useful when browser clipboard permission is denied.
    }
    await recordLearningAgentCopy(message.id)
  }

  return (
    <>
      <button className="unified-agent-fab" type="button" onClick={() => setOpen(true)} aria-label={locale === "en" ? "Open learning partner" : "打开学习伙伴"}>
        <Bot />
        <span>{locale === "en" ? "Learning partner" : "学习伙伴"}</span>
        {context && <i />}
      </button>

      {open && (
        <section className="unified-agent-panel" aria-label={locale === "en" ? "Learning partner" : "学习伙伴"}>
          <header>
            <span><Bot /></span>
            <div>
              <strong>{locale === "en" ? "Learning partner" : "学习伙伴"}</strong>
              <small>{loadingSession ? (locale === "en" ? "Matching the current course Agent" : "正在匹配当前课程 Agent") : `${agentName} · ${locale === "en" ? "matched by backend" : "后端已匹配"}`}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={locale === "en" ? "Close learning partner" : "关闭学习伙伴"}><X /></button>
          </header>

          {context && (
            <div className="agent-context-strip">
              <Sparkles />
              <span>
                <small>{context.mode === "self_directed" ? (locale === "en" ? "Self-directed" : "自主挑战") : (locale === "en" ? "Guided" : "带着学")}</small>
                <strong>{context.stepTitle || context.routeTitle}</strong>
              </span>
            </div>
          )}

          <div className="unified-agent-messages" aria-live="polite">
            {!context && (
              <div className="agent-empty"><Bot /><strong>{locale === "en" ? "Enter a learning item first" : "先进入一项学习内容"}</strong><p>{locale === "en" ? "I will match the correct course Agent from the backend." : "我会从后端自动匹配对应课程 Agent。"}</p></div>
            )}
            {context && loadingSession && (
              <div className="agent-typing"><Loader2 className="spin" />{locale === "en" ? "Initializing course Agent" : "正在初始化课程 Agent"}</div>
            )}
            {context && !loadingSession && activeSession && messages.length === 0 && (
              <div className="agent-empty"><CheckCircle2 /><strong>{locale === "en" ? "Ask me about the current course when you get stuck." : activeSession.agent.opening_message}</strong><p>{locale === "en" ? "Type your question below. I will answer using the current course, stage and route context." : "在下方输入问题，我会结合当前课程、阶段和路径回答。"}</p></div>
            )}
            {messages.map((message) => (
              <article key={message.id} className={message.role}>
                <span>{message.role === "user" ? (locale === "en" ? "Me" : "我") : agentName}</span>
                <AgentMarkdown value={message.text} />
                {message.role === "agent" && (
                  <button type="button" onClick={() => void copyAgentMessage(message)} aria-label={locale === "en" ? "Copy reply" : "复制回复"}>
                    <Clipboard />
                  </button>
                )}
              </article>
            ))}
            {sending && <div className="agent-typing"><Loader2 className="spin" />{locale === "en" ? `${agentName} is replying` : `${agentName}正在回答`}</div>}
            <div ref={scrollAnchor} />
          </div>
          {error && <p className="agent-error" role="alert">{error}</p>}
          <form className="agent-composer" onSubmit={(event) => { event.preventDefault(); sendDraft() }}>
            <textarea
              value={draft}
              maxLength={4000}
              rows={2}
              disabled={!context || !activeSession || loadingSession || sending}
              placeholder={context ? (locale === "en" ? "Type your question…" : "输入你的问题…") : (locale === "en" ? "Enter a learning item before asking" : "进入一项学习内容后即可提问")}
              aria-label={locale === "en" ? "Question to ask" : "输入要咨询的问题"}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  sendDraft()
                }
              }}
            />
            {sending ? (
              <button type="button" onClick={stopGenerating} aria-label={locale === "en" ? "Stop generation" : "停止生成"}>
                <Square />
              </button>
            ) : (
              <button type="submit" disabled={!context || !activeSession || loadingSession || !draft.trim()} aria-label={locale === "en" ? "Send question" : "发送问题"}>
                <Send />
              </button>
            )}
          </form>
        </section>
      )}
    </>
  )
}
