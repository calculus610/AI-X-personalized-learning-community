"use client"

import { FormEvent, useEffect, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  GitBranch,
  Languages,
  Loader2,
  LockKeyhole,
  Sparkles,
} from "lucide-react"
import {
  clearPlatformSession,
  getPlatformUserIdentity,
  getPlatformUserLabel,
  loginToOriginalPlatform,
  PLATFORM_AUTH_EVENT,
  readPlatformSession,
  refreshPlatformSessionUser,
  registerOnOriginalPlatform,
  type PlatformSession,
} from "@/lib/platform-auth"
import { LearningMap } from "./learning-map/learning-map"
import { GlobalLearningAgent } from "./learning-map/global-learning-agent"
import { StudentActivityTracker } from "./telemetry/student-activity-tracker"
import { readInitialLocale, writeLocale, type Locale } from "@/lib/bilingual-ui"

type AuthErrorKind = "password_mismatch" | "invalid_credentials" | "username_taken" | "invalid_account" | "network" | "unknown"

function classifyAuthError(failure: unknown, mode: "login" | "register"): AuthErrorKind {
  const raw = failure instanceof Error ? failure.message : String(failure ?? "")
  const normalized = raw.toLowerCase()
  if (/passwords? do not match|两次.*密码.*不一致/.test(normalized)) return "password_mismatch"
  if (/already exists|already registered|username.*taken|duplicate|账号.*存在|用户名.*存在/.test(normalized)) return "username_taken"
  if (/invalid credential|incorrect password|unauthorized|用户名或密码|账号或密码/.test(normalized)) return "invalid_credentials"
  if (/username|account name|账号名称|用户名/.test(normalized) && /invalid|至少|长度|字符|格式/.test(normalized)) return "invalid_account"
  if (/failed to fetch|network|timeout|timed out|fetch failed|网络|超时/.test(normalized)) return "network"
  return mode === "login" ? "invalid_credentials" : "unknown"
}

function authErrorMessage(locale: Locale, kind: AuthErrorKind) {
  const messages: Record<AuthErrorKind, Record<Locale, string>> = {
    password_mismatch: { zh: "两次输入的密码不一致。", en: "The passwords do not match." },
    invalid_credentials: { zh: "用户名或密码不正确，请检查后重试。", en: "The username or password is incorrect. Please try again." },
    username_taken: { zh: "这个账号名称已被使用，请换一个名称。", en: "This account name is already in use. Choose another one." },
    invalid_account: { zh: "账号名称不符合要求，请检查长度和字符。", en: "The account name is invalid. Check its length and characters." },
    network: { zh: "暂时无法连接登录服务，请稍后重试。", en: "The sign-in service is temporarily unavailable. Please try again later." },
    unknown: { zh: "注册失败，请检查账号信息后重试。", en: "Registration failed. Check your account details and try again." },
  }
  return messages[kind][locale]
}

function PlatformLogin({ onSuccess, locale, onToggleLocale }: { onSuccess: (session: PlatformSession) => void; locale: Locale; onToggleLocale: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<AuthErrorKind | null>(null)
  const [authMode, setAuthMode] = useState<"login" | "register">("login")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      const username = String(form.get("username") ?? "").trim()
      const password = String(form.get("password") ?? "")
      if (authMode === "register") {
        const confirmPassword = String(form.get("confirmPassword") ?? "")
        if (password !== confirmPassword) throw new Error("passwords do not match")
        onSuccess(await registerOnOriginalPlatform({
          username,
          password,
        }))
      } else {
        onSuccess(await loginToOriginalPlatform(username, password))
      }
    } catch (failure) {
      setError(classifyAuthError(failure, authMode))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="platform-login-screen" data-locale={locale}>
      <button type="button" className="language-toggle login-language-toggle" onClick={onToggleLocale} aria-label={locale === "en" ? "Switch to Chinese" : "切换到英文"}>
        <Languages /> {locale === "zh" ? "EN" : "中"}
      </button>
      <div className="login-knowledge-map" aria-hidden="true">
        <svg className="login-map-lines" viewBox="0 0 1440 900" preserveAspectRatio="none">
          <defs>
            <linearGradient id="login-route-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5d34d0" stopOpacity="0" />
              <stop offset="0.35" stopColor="#ff006e" stopOpacity="0.9" />
              <stop offset="0.7" stopColor="#00f0ff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c7ff68" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g>
            <path className="base" d="M720 414 C545 458 342 592 158 682" />
            <path className="base" d="M720 414 C618 568 575 688 454 760" />
            <path className="base" d="M720 414 C678 300 678 196 690 128" />
            <path className="base" d="M720 414 C824 538 906 655 1014 716" />
            <path className="base" d="M720 414 C880 286 1088 152 1245 116" />
            <path className="base" d="M720 414 C866 394 1014 418 1144 442" />
            <path className="base" d="M720 414 C528 346 312 300 112 342" />
            <path className="flow" d="M112 342 C312 300 528 346 720 414 C866 394 1014 418 1144 442" />
            <path className="flow" d="M158 682 C342 592 545 458 720 414 C824 538 906 655 1014 716" />
            <circle cx="720" cy="414" r="3.2" />
            <circle cx="158" cy="682" r="2.5" />
            <circle cx="690" cy="128" r="2.5" />
            <circle cx="1144" cy="442" r="2.5" />
          </g>
        </svg>
        <span className="login-map-node is-hub">{locale === "en" ? "A question I want to understand" : "一个想弄明白的问题"}</span>
        <span className="login-map-node node-esp32">ESP32</span>
        <span className="login-map-node node-circuit">{locale === "en" ? "Electronic circuits" : "电子电路"}</span>
        <span className="login-map-node node-eval">{locale === "en" ? "Evaluate and select AI models" : "评测与选择 AI 模型"}</span>
        <span className="login-map-node node-agent">{locale === "en" ? "Build a desktop Agent" : "做一个桌面 Agent"}</span>
        <span className="login-map-node node-cad">{locale === "en" ? "Generate CAD from language" : "自然语言生成 CAD"}</span>
        <span className="login-map-node node-robot">{locale === "en" ? "Build a showcase robot" : "做一个可展示的机器人"}</span>
        <span className="login-map-node node-sensor">{locale === "en" ? "Sensors" : "传感器"}</span>
      </div>

      <div className="platform-login-layout">
        <section className="login-introduction">
          <p className="login-kicker">{locale === "en" ? "AI+X · PERSONALIZED LEARNING SPACE" : "AI+X · 个性化学习空间"}</p>
          <h1>
            <span className="login-title-opening">{locale === "en" ? "Learning " : "学习，"}</span>
            <span className="login-title-focus">{locale === "en" ? <>does not have to start with a <span className="login-title-index">catalog.</span></> : <>不必从<span className="login-title-index">目录</span>开始。</>}</span>
          </h1>
          <p className="login-description">
            <span>{locale === "en" ? "Start with a question you genuinely want to understand." : "从一个真正想弄明白的问题出发。"}</span>
            <span>{locale === "en" ? "Courses, projects and progress reconnect around your goal." : "课程、项目与学习进度，会围绕你的目标重新连接。"}</span>
          </p>
          <div className="login-journey" aria-label={locale === "en" ? "Learning flow after sign-in" : "登录后的学习流程"}>
            <strong>{locale === "en" ? "Continue after sign-in" : "登录后继续"}</strong>
            <ArrowRight />
            <span>{locale === "en" ? "Choose interests" : "选择兴趣"}</span>
            <ArrowRight />
            <span>{locale === "en" ? "Connect courses" : "连接课程"}</span>
            <ArrowRight />
            <span>{locale === "en" ? "Generate a route" : "生成路径"}</span>
          </div>
          <div className="login-capabilities">
            <article><i>01</i><span><GitBranch /></span><strong>{locale === "en" ? "Start with a question" : "从问题出发"}</strong><small>{locale === "en" ? "Find what you truly want to understand" : "先找到真正想弄明白的事"}</small></article>
            <article><i>02</i><span><BrainCircuit /></span><strong>{locale === "en" ? "Answer through projects" : "在项目里回答"}</strong><small>{locale === "en" ? "Turn knowledge into practice" : "让知识在实践中发生"}</small></article>
            <article><i>03</i><span><BookOpen /></span><strong>{locale === "en" ? "See the next step" : "看见下一步"}</strong><small>{locale === "en" ? "Keep routes, progress and unlocks clear" : "路径、进度与解锁状态始终清晰"}</small></article>
          </div>
        </section>

        <section className="platform-login-card">
          <header>
            <span><LockKeyhole /></span>
            <div><small>{locale === "en" ? (authMode === "login" ? "Welcome back" : "Create account") : (authMode === "login" ? "欢迎回来" : "创建账号")}</small><h2>{locale === "en" ? (authMode === "login" ? "Continue your exploration" : "Create your learning space") : (authMode === "login" ? "继续上次的探索" : "创建学习空间")}</h2></div>
          </header>
          <p>{locale === "en" ? (authMode === "login" ? "Sign in to continue your courses, projects and learning progress." : "Choose an account name and password to create your personalized learning space.") : (authMode === "login" ? "使用个性化学习平台账号登录，继续你的课程、项目与学习进度。" : "使用一个账号名称和密码，创建你的个性化学习空间。")}</p>
          <div className="platform-auth-tabs" role="tablist" aria-label={locale === "en" ? "Account actions" : "账号操作"}>
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setError(null) }}>{locale === "en" ? "Sign in" : "登录"}</button>
            <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setError(null) }}>{locale === "en" ? "Register" : "注册"}</button>
          </div>
          <form onSubmit={submit}>
            <label>
              <span>{locale === "en" ? (authMode === "register" ? "Account name" : "Username") : (authMode === "register" ? "账号名称" : "用户名")}</span>
              <input name="username" autoComplete="username" required autoFocus />
            </label>
            <label>
              <span>{locale === "en" ? "Password" : "密码"}</span>
              <input name="password" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} required />
            </label>
            {authMode === "register" && (
              <label>
                <span>{locale === "en" ? "Confirm password" : "确认密码"}</span>
                <input name="confirmPassword" type="password" autoComplete="new-password" required />
              </label>
            )}
            {error && <p className="platform-login-error" role="alert">{authErrorMessage(locale, error)}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="spin" /> : <Sparkles />}
              {locale === "en" ? (submitting ? (authMode === "login" ? "Signing in…" : "Creating account…") : (authMode === "login" ? "Continue learning" : "Register and enter")) : (submitting ? (authMode === "login" ? "正在进入…" : "正在创建账号…") : (authMode === "login" ? "继续学习" : "注册并进入"))}
              {!submitting && <ArrowRight />}
            </button>
          </form>
          <footer>{locale === "en" ? "Authentication is handled independently by the learning platform. This page does not store your password." : "账号验证由个性化学习平台独立完成，本页不会保存密码。"}</footer>
        </section>
      </div>
    </main>
  )
}

export function PlatformLoginGate({ initialLocale = "zh" }: { initialLocale?: Locale }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<PlatformSession | null>(null)
  const [recoveringSession, setRecoveringSession] = useState(false)
  const [locale, setLocale] = useState<Locale>(initialLocale)

  function toggleLocale() {
    const next = locale === "zh" ? "en" : "zh"
    setLocale(next)
    writeLocale(next)
    window.dispatchEvent(new CustomEvent("personalized-secure:locale-change", { detail: next }))
  }

  useEffect(() => {
    const browserLocale = readInitialLocale()
    if (browserLocale !== locale) {
      setLocale(browserLocale)
      writeLocale(browserLocale)
    }
    // The server-provided cookie is the hydration boundary; localStorage is
    // retained only to migrate visitors who selected a language before the
    // cookie-backed implementation was introduced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!session || getPlatformUserIdentity(session.user)) return
    let active = true
    setRecoveringSession(true)
    refreshPlatformSessionUser(session.token)
      .then((recovered) => {
        if (active) setSession(recovered)
      })
      .catch(() => {
        if (!active) return
        clearPlatformSession()
        setSession(null)
      })
      .finally(() => {
        if (active) setRecoveringSession(false)
      })
    return () => { active = false }
  }, [session])

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN"
    document.title = locale === "en" ? "AI+X Personalized Learning" : "AI+X 个性化学习"
  }, [locale])

  useEffect(() => {
    const sync = () => {
      setSession(readPlatformSession())
      setReady(true)
    }
    sync()
    window.addEventListener(PLATFORM_AUTH_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(PLATFORM_AUTH_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  if (!ready || (session && !getPlatformUserIdentity(session.user))) {
    return <><main className="platform-session-loading" data-locale={locale}><Loader2 className="spin" /><span>{locale === "en" ? "Loading your session…" : "正在读取登录状态…"}</span></main><GlobalLearningAgent locale={locale} identity="loading" /></>
  }
  if (!session) return <><PlatformLogin onSuccess={setSession} locale={locale} onToggleLocale={toggleLocale} /><GlobalLearningAgent locale={locale} identity="guest" /></>
  const userId = getPlatformUserIdentity(session.user)
  if (!userId) return null

  return <>
    <StudentActivityTracker token={session.token} />
    <LearningMap token={session.token} userId={userId} userLabel={getPlatformUserLabel(session.user)} onLogout={clearPlatformSession} locale={locale} onToggleLocale={toggleLocale} />
    <GlobalLearningAgent locale={locale} identity={userId} />
  </>
}
