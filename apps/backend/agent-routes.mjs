import { createHash, randomUUID } from "node:crypto"
import { userFor } from "./learning-routes.mjs"
import { appendIntegrityRecord } from "./integrity-chain.mjs"

const MAX_MESSAGE_LENGTH = 8000
const DEFAULT_AGENT = {
  agentId: "default_learning_agent",
  agentName: "学习伙伴",
  provider: "fallback",
  promptVersionId: null,
  promptVersion: "fallback-v1",
  systemPrompt: "你是课程学习助教。回答必须基于当前课程上下文，先澄清问题，再给出可执行的下一步。",
  openingMessage: "你好，我会结合当前课程和步骤帮你分析问题。",
  outputFormat: "markdown",
  knowledgeScopeId: null,
}

function invalid(reply, error, status = 400, extra = {}) {
  return reply.code(status).send({ error, ...extra })
}

function cleanId(value, max = 128) {
  const text = String(value ?? "").trim()
  return /^[a-zA-Z0-9:_-]{1,128}$/.test(text) ? text.slice(0, max) : ""
}

function cleanText(value, max = MAX_MESSAGE_LENGTH) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max)
}

function resolveLocale(request) {
  const candidate = String(
    request.body?.locale ||
    request.query?.locale ||
    request.headers["x-app-locale"] ||
    request.headers["accept-language"] ||
    "",
  ).toLowerCase()
  return candidate.startsWith("en") ? "en" : "zh"
}

function jsonValue(value, fallback = {}) {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return typeof value === "object" ? value : fallback
}

async function ownedAgentContext(db, userId, trackId, routeStepId) {
  const [rows] = await db.execute(
    `SELECT t.id track_id, t.current_path_id path_id, n.id route_step_id,
            n.course_id, n.module_id, n.title_snapshot course_title,
            c.title canonical_course_title, c.summary course_summary
     FROM learning_tracks t
     JOIN learning_path_nodes n ON n.path_id=t.current_path_id
     JOIN courses c ON c.id=n.course_id
     WHERE t.id=? AND t.user_id=? AND n.id=? AND t.status<>'ARCHIVED'
     LIMIT 1`,
    [trackId, userId, routeStepId],
  )
  return rows[0] ?? null
}

async function defaultAgentContext(db, userId, stageId) {
  const [rows] = await db.execute(
    `SELECT t.id track_id, t.current_path_id path_id, n.id route_step_id,
            n.course_id, n.module_id, n.title_snapshot course_title,
            c.title canonical_course_title, c.summary course_summary
     FROM learning_tracks t
     JOIN learning_path_nodes n ON n.path_id=t.current_path_id
     JOIN courses c ON c.id=n.course_id
     WHERE t.user_id=? AND t.status<>'ARCHIVED' AND t.current_path_id IS NOT NULL
     ORDER BY
       t.updated_at DESC,
       CASE n.status
         WHEN 'AVAILABLE' THEN 0
         WHEN 'IN_PROGRESS' THEN 1
         WHEN 'LOCKED' THEN 2
         WHEN 'COMPLETED' THEN 3
         ELSE 4
       END,
       n.learning_level ASC,
       n.sort_order ASC,
       n.created_at ASC
     LIMIT 1`,
    [userId],
  )
  const context = rows[0] ?? null
  if (context) context.stage_id = stageId
  return context
}

async function resolveAgent(db, context, stageId) {
  const [bindings] = await db.execute(
    `SELECT b.agent_id, b.prompt_version_id, b.knowledge_scope_id,
            p.agent_key, p.name agent_name, p.provider,
            v.prompt_version, v.system_prompt, v.opening_message, v.output_format
     FROM agent_course_bindings b
     JOIN agent_profiles p ON p.id=b.agent_id AND p.status='ACTIVE'
     LEFT JOIN agent_prompt_versions v ON v.id=b.prompt_version_id AND v.status='ACTIVE'
     WHERE b.status='ACTIVE'
       AND (b.course_id IS NULL OR b.course_id=?)
       AND (b.module_id IS NULL OR b.module_id=?)
       AND (b.stage_id IS NULL OR b.stage_id=?)
     ORDER BY
       (b.course_id IS NOT NULL) DESC,
       (b.stage_id IS NOT NULL) DESC,
       (b.module_id IS NOT NULL) DESC,
       b.priority DESC,
       b.created_at DESC
     LIMIT 1`,
    [context.course_id, context.module_id, stageId || null],
  )
  const match = bindings[0]
  if (!match) return DEFAULT_AGENT
  return {
    agentId: match.agent_id,
    agentName: match.agent_name,
    provider: match.provider,
    promptVersionId: match.prompt_version_id,
    promptVersion: match.prompt_version ?? "unversioned",
    systemPrompt: match.system_prompt ?? DEFAULT_AGENT.systemPrompt,
    openingMessage: match.opening_message ?? DEFAULT_AGENT.openingMessage,
    outputFormat: match.output_format ?? "markdown",
    knowledgeScopeId: match.knowledge_scope_id,
  }
}

async function writeBusinessEvent(db, userId, sessionId, eventName, payload = {}) {
  const id = randomUUID()
  await db.execute(
    `INSERT INTO agent_events (id, user_id, session_id, event_name, payload_json, occurred_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [id, userId, sessionId, eventName, JSON.stringify(payload)],
  )
  await appendIntegrityRecord(db, { userId, sourceType: "agent_event", sourceId: id, occurredAt: new Date(), payload: { sessionId, eventName, ...payload } })
}

async function ensureMemoryConversation(memoryDb, conversationId, userId, context, agent) {
  await memoryDb.execute(
    `INSERT INTO memory_conversations
     (id, user_id, scope_type, scope_ref, metadata_json, created_at, updated_at)
     VALUES (?, ?, 'agent_course_session', ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE updated_at=UTC_TIMESTAMP(3)`,
    [conversationId, userId, context.route_step_id, JSON.stringify({
      track_id: context.track_id,
      path_id: context.path_id,
      course_id: context.course_id,
      module_id: context.module_id,
      stage_id: context.stage_id,
      agent_id: agent.agentId,
      prompt_version_id: agent.promptVersionId,
    })],
  )
}

async function writeMemoryMessage(memoryDb, conversationId, role, content, metadata = {}) {
  const id = randomUUID()
  const summary = content.length > 500 ? `${content.slice(0, 497)}...` : content
  await memoryDb.execute(
    `INSERT INTO memory_messages
     (id, conversation_id, role, content, content_summary, metadata_json, created_at, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
    [id, conversationId, role, content, summary, JSON.stringify(metadata)],
  )
  return id
}

async function readConversationMessages(memoryDb, conversationId) {
  const [messages] = await memoryDb.execute(
    `SELECT id, role, content, created_at
     FROM memory_messages
     WHERE conversation_id=?
     ORDER BY created_at, id`,
    [conversationId],
  )
  return messages.map((item) => ({
    message_id: item.id,
    role: item.role,
    text: item.content,
    created_at: new Date(item.created_at).toISOString(),
  }))
}

async function writeMessageIndex(db, input) {
  const id = randomUUID()
  await db.execute(
    `INSERT INTO agent_messages_index
     (id, session_id, user_id, role, memory_message_id, provider_message_id, status, token_count,
      created_at, started_at, finished_at, failed_at, stopped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), ?, ?, ?, ?)`,
    [
      id,
      input.sessionId,
      input.userId,
      input.role,
      input.memoryMessageId,
      input.providerMessageId ?? null,
      input.status ?? "STORED",
      input.tokenCount ?? null,
      input.startedAt ?? null,
      input.finishedAt ?? null,
      input.failedAt ?? null,
      input.stoppedAt ?? null,
    ],
  )
  return id
}

function fallbackAnswer({ message, context, agent }) {
  if (context.locale === "en") {
    return {
      provider: "fallback",
      answer: [
        `I received your question: "${message}".`,
        "",
        `The matched assistant is "${agent.agentName}", and the current course is "${context.canonical_course_title || context.course_title}".`,
        "",
        "The HiAgent endpoint or APP key is not fully available in Secure API right now, so this is the backend Agent gateway fallback response. The conversation, user question, reply, course context, and server timestamp have still been stored through the formal evidence-chain path.",
      ].join("\n"),
      providerConversationId: null,
      providerMessageId: null,
    }
  }
  return {
    provider: "fallback",
    answer: [
      `我已经收到你的问题：“${message}”。`,
      "",
      `当前匹配的是「${agent.agentName}」，课程是「${context.canonical_course_title || context.course_title}」。`,
      "",
      "现在 HiAgent 接口或 APP Key 还没有在 Secure API 中完整配置，所以这是后端 Agent 网关的占位回复。对话会话、用户问题、回复、课程上下文和服务端时间戳已经按正式链路入库。",
    ].join("\n"),
    providerConversationId: null,
    providerMessageId: null,
  }
}

function phaseKeyForContext(context) {
  const source = [
    context.stage_id,
    context.course_id,
    context.module_id,
    context.course_title,
    context.canonical_course_title,
    context.course_summary,
  ].map((item) => String(item || "")).join(" ").toLowerCase()
  if (/build-smart-car|智能小车|desk-companion|m5stack|项目路演|机器人创造营/.test(source)) return "phase5"
  if (/embodied_projects|touch-interface|multi-actuator|ai-device-linkage|embodied-collaboration|触觉|触摸|反馈|多执行器|舵机|电机|联动控制|具身执行/.test(source)) return "phase34"
  if (/embedded_perception|ultrasonic|camera-vision|audio-edge-ai|edge-ai-training|multimodal-edge-ai|环境感知|感知|摄像头|图像识别|edge impulse|语音识别|传感器融合/.test(source)) return "phase34"
  if (/ai_manufacturing|ai-cad|blender|laser|uv|cam-toolpath|manufacturing-quality|新型硬件|3d打印|增材|激光|cnc|cam|arduino/.test(source)) return "phase2"
  if (/ai_agent|model-evaluation|agent-handoff|desktop-agent|device-gateway|国产人工智能|大模型|agent|prompt|esp32|云边协同|3d建模/.test(source)) return "phase1"
  if (source.includes("phase1") || source.includes("phase_1")) return "phase1"
  if (source.includes("phase2") || source.includes("phase_2")) return "phase2"
  if (source.includes("phase3") || source.includes("phase_3")
    || source.includes("phase4") || source.includes("phase_4")) return "phase34"
  if (source.includes("phase5") || source.includes("phase_5")) return "phase5"
  if (/电子|电路|硬件|边缘|传感|sensor|circuit|hardware|edge/.test(source)) return "phase34"
  if (/国产\s*ai|ai\s*应用|大模型|提示词|prompt|llm|模型/.test(source)) return "phase1"
  if (/机械|结构|运动|机器人|执行器|mechanical|robot|actuator/.test(source)) return "phase5"
  return ""
}

function appKeyForContext(env, context) {
  const phaseKey = phaseKeyForContext(context)
  if (phaseKey && env.hiAgentAppKeys?.[phaseKey]) return env.hiAgentAppKeys[phaseKey]
  return env.agentAppKey || ""
}

function stageLabelForContext(context) {
  const stage = String(context.stage_id || "").toLowerCase()
  if (stage.includes("phase3")) return "Phase 3 基础项目：环境感知"
  if (stage.includes("phase4")) return "Phase 4 进阶项目：触觉反馈集成"
  if (stage.includes("phase5")) return "Phase 5 创新项目：具身智能控制"
  if (stage.includes("phase2")) return "Phase 2 新型硬件设计"
  if (stage.includes("phase1")) return "Phase 1 国产人工智能技术基础"
  const phaseKey = phaseKeyForContext(context)
  if (phaseKey === "phase34") return "Phase 3/4 共用学习伙伴"
  if (phaseKey === "phase5") return "Phase 5 创新项目：具身智能控制"
  if (phaseKey === "phase2") return "Phase 2 新型硬件设计"
  if (phaseKey === "phase1") return "Phase 1 国产人工智能技术基础"
  return "当前课程"
}

function queryWithLearningContext(context, message) {
  const courseTitle = context.canonical_course_title || context.course_title || context.course_id
  const stageLabel = stageLabelForContext(context)
  const locale = context.locale === "en" ? "en" : "zh"
  const languageRule = locale === "en"
    ? "Output language: English only. Do not mix Chinese in explanations, headings, greetings, or summaries. Keep code, API names, hardware model names, and proper nouns unchanged."
    : "输出语言：只使用简体中文。除代码、API 名称、硬件型号和专有名词外，不要夹杂英文。"
  return [
    languageRule,
    ``,
    `【当前学习上下文】`,
    `阶段：${stageLabel}`,
    `课程：${courseTitle}`,
    `课程ID：${context.course_id}`,
    `模块ID：${context.module_id}`,
    ``,
    `请严格以以上阶段和课程身份回答。若阶段是 Phase 3，请不要自称 Phase 4；若阶段是 Phase 4，请不要自称 Phase 3。`,
    `回答对象是学生，请使用“你”来说明，语气清楚、鼓励、可执行。`,
    ``,
    `【学生问题】`,
    message,
  ].join("\n")
}

async function callAgentProvider(env, agent, context, message, allowConversationRetry = true) {
  const endpoint = String(env.agentProviderUrl || "").replace(/\/$/, "")
  const appKey = appKeyForContext(env, context)
  if (!endpoint || !appKey) return fallbackAnswer({ message, context, agent })

  const externalUserId = `secure_user_${context.user_id}`
  let providerConversationId = context.provider_conversation_id?.trim()
  if (!providerConversationId) {
    const createResponse = await fetch(`${endpoint}/create_conversation`, {
      method: "POST",
      headers: {
        "Apikey": appKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        AppKey: appKey,
        Inputs: {
          student_id: String(context.user_id),
          track_id: String(context.track_id),
          path_id: String(context.path_id),
          route_step_id: String(context.route_step_id),
          course_id: String(context.course_id),
          module_id: String(context.module_id),
          stage_id: String(context.stage_id || ""),
          phase_code: phaseKeyForContext(context) || "",
          locale: context.locale === "en" ? "en-US" : "zh-CN",
          language: context.locale === "en" ? "English" : "Simplified Chinese",
        },
        UserID: externalUserId,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    const rawCreate = await createResponse.text()
    let createPayload
    try { createPayload = JSON.parse(rawCreate) } catch {
      throw new Error(`hiagent_create_invalid_json:${createResponse.status}`)
    }
    const upstreamError = createPayload?.ResponseMetadata?.Error
    if (!createResponse.ok || upstreamError) {
      throw new Error(`${upstreamError?.Code || `HTTP_${createResponse.status}`}:${upstreamError?.Message || "hiagent_create_failed"}`)
    }
    providerConversationId = createPayload?.Conversation?.AppConversationID?.trim()
    if (!providerConversationId) throw new Error("hiagent_conversation_id_missing")
  }

  const response = await fetch(`${endpoint}/chat_query_v2`, {
    method: "POST",
    headers: {
      "Apikey": appKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      AppKey: appKey,
      AppConversationID: providerConversationId,
      Query: queryWithLearningContext(context, message),
      ResponseMode: "blocking",
      UserID: externalUserId,
    }),
    signal: AbortSignal.timeout(90_000),
  })
  const raw = await response.text()
  let payload
  try { payload = JSON.parse(raw) } catch {
    throw new Error(`hiagent_chat_invalid_json:${response.status}`)
  }
  const upstreamError = payload?.ResponseMetadata?.Error
  if (!response.ok || upstreamError) {
    const code = String(upstreamError?.Code || `HTTP_${response.status}`)
    const detail = String(upstreamError?.Message || "hiagent_chat_failed")
    if (allowConversationRetry && providerConversationId && /AppConversationID is invalid/i.test(detail)) {
      return callAgentProvider(env, agent, { ...context, provider_conversation_id: null }, message, false)
    }
    throw new Error(`${code}:${detail}`)
  }
  const answer = cleanText(payload.answer ?? payload.reply ?? payload.content ?? payload.message ?? payload.choices?.[0]?.message?.content, 20000)
  if (!answer) throw new Error("hiagent_answer_missing")
  return {
    provider: `hiagent_${phaseKeyForContext(context) || "default"}`,
    answer,
    providerConversationId,
    providerMessageId: payload.id?.trim() || null,
  }
}

export function registerAgentRoutes(app, db, memoryDb, env = {}) {
  app.post("/v1/agent/sessions", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const trackId = cleanId(request.body?.trackId ?? request.body?.routeId, 64)
    const routeStepId = cleanId(request.body?.routeStepId, 64)
    const stageId = cleanId(request.body?.stageId, 128) || null
    const locale = resolveLocale(request)
    const context = trackId && routeStepId
      ? await ownedAgentContext(db, user.id, trackId, routeStepId)
      : await defaultAgentContext(db, user.id, stageId)
    if (!context) return invalid(reply, "route_step_not_found", 404)
    context.stage_id = stageId
    context.locale = locale
    const agent = await resolveAgent(db, context, stageId)
    const [existingSessions] = await db.execute(
      `SELECT id, conversation_id
       FROM agent_sessions
       WHERE user_id=? AND track_id=? AND route_step_id=? AND COALESCE(stage_id, '')=COALESCE(?, '')
         AND locale_code=?
         AND status='ACTIVE'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [user.id, context.track_id, context.route_step_id, stageId, locale],
    )
    const existing = existingSessions[0]
    if (existing) {
      await writeBusinessEvent(db, user.id, existing.id, "agent_opened", { stage_id: stageId, agent_id: agent.agentId, restored: true })
      return {
        session_id: existing.id,
        conversation_id: existing.conversation_id,
        agent: {
          agent_id: agent.agentId,
          agent_name: agent.agentName,
          prompt_version: agent.promptVersion,
          opening_message: agent.openingMessage,
          output_format: agent.outputFormat,
        },
        messages: await readConversationMessages(memoryDb, existing.conversation_id),
      }
    }
    const conversationId = randomUUID()
    await ensureMemoryConversation(memoryDb, conversationId, user.id, context, agent)
    const sessionId = randomUUID()
    await db.execute(
      `INSERT INTO agent_sessions
       (id, conversation_id, user_id, track_id, path_id, route_step_id, course_id, module_id,
        stage_id, locale_code, agent_id, prompt_version_id, knowledge_scope_id, status,
        created_at, updated_at, client_sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE',
        UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), ?)`,
      [sessionId, conversationId, user.id, context.track_id, context.path_id, context.route_step_id,
      context.course_id, context.module_id, stageId, locale, agent.agentId, agent.promptVersionId,
      agent.knowledgeScopeId, request.body?.clientSentAt ? new Date(request.body.clientSentAt) : null],
    )
    await writeBusinessEvent(db, user.id, sessionId, "agent_opened", { stage_id: stageId, agent_id: agent.agentId })
    return reply.code(201).send({
      session_id: sessionId,
      conversation_id: conversationId,
      agent: {
        agent_id: agent.agentId,
        agent_name: agent.agentName,
        prompt_version: agent.promptVersion,
        opening_message: agent.openingMessage,
        output_format: agent.outputFormat,
      },
      messages: [],
    })
  })

  app.get("/v1/agent/sessions/:sessionId/messages", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [sessions] = await db.execute(
      "SELECT id, conversation_id FROM agent_sessions WHERE id=? AND user_id=? LIMIT 1",
      [request.params.sessionId, user.id],
    )
    const session = sessions[0]
    if (!session) return invalid(reply, "agent_session_not_found", 404)
    return {
      session_id: session.id,
      conversation_id: session.conversation_id,
      messages: await readConversationMessages(memoryDb, session.conversation_id),
    }
  })

  app.post("/v1/agent/sessions/:sessionId/messages", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const message = cleanText(request.body?.message)
    const locale = resolveLocale(request)
    if (!message) return invalid(reply, "message_required")
    const [sessions] = await db.execute(
      `SELECT s.*, c.title canonical_course_title, n.title_snapshot course_title
       FROM agent_sessions s
       JOIN courses c ON c.id=s.course_id
       JOIN learning_path_nodes n ON n.id=s.route_step_id
       WHERE s.id=? AND s.user_id=? AND s.status='ACTIVE' AND s.locale_code=?
       LIMIT 1`,
      [request.params.sessionId, user.id, locale],
    )
    const session = sessions[0]
    if (!session) return invalid(reply, "agent_session_not_found", 404)
    const context = {
      track_id: session.track_id,
      path_id: session.path_id,
      route_step_id: session.route_step_id,
      course_id: session.course_id,
      module_id: session.module_id,
      stage_id: session.stage_id,
      locale,
      user_id: user.id,
      provider_conversation_id: session.provider_conversation_id,
      canonical_course_title: session.canonical_course_title,
      course_title: session.course_title,
    }
    const agent = {
      agentId: session.agent_id,
      agentName: DEFAULT_AGENT.agentName,
      promptVersionId: session.prompt_version_id,
      knowledgeScopeId: session.knowledge_scope_id,
      ...await resolveAgent(db, context, session.stage_id),
    }

    const userMemoryId = await writeMemoryMessage(memoryDb, session.conversation_id, "user", message, {
      source: "secure_api",
      session_id: session.id,
      stage_id: session.stage_id,
    })
    const userMessageId = await writeMessageIndex(db, {
      sessionId: session.id,
      userId: user.id,
      role: "user",
      memoryMessageId: userMemoryId,
      status: "STORED",
      tokenCount: Math.ceil(message.length / 4),
    })
    await appendIntegrityRecord(db, { userId: user.id, sourceType: "agent_message", sourceId: userMessageId, occurredAt: new Date(), payload: { sessionId: session.id, role: "user", memoryMessageId: userMemoryId, contentSha256: createHash("sha256").update(message).digest("hex") } })
    await writeBusinessEvent(db, user.id, session.id, "agent_message_sent", { message_id: userMessageId })

    const startedAt = new Date()
    await db.execute("UPDATE agent_sessions SET started_at=?, updated_at=UTC_TIMESTAMP(3) WHERE id=?", [startedAt, session.id])
    try {
      const providerResult = await callAgentProvider(env, agent, context, message)
      if (providerResult.providerConversationId && providerResult.providerConversationId !== session.provider_conversation_id) {
        await db.execute(
          "UPDATE agent_sessions SET provider_conversation_id=?, updated_at=UTC_TIMESTAMP(3) WHERE id=?",
          [providerResult.providerConversationId, session.id],
        )
      }
      const assistantMemoryId = await writeMemoryMessage(memoryDb, session.conversation_id, "assistant", providerResult.answer, {
        source: "agent_provider",
        session_id: session.id,
        stage_id: session.stage_id,
        agent_id: agent.agentId,
        prompt_version_id: agent.promptVersionId,
        provider: providerResult.provider,
        provider_conversation_id: providerResult.providerConversationId,
        provider_message_id: providerResult.providerMessageId,
      })
      const finishedAt = new Date()
      const assistantMessageId = await writeMessageIndex(db, {
        sessionId: session.id,
        userId: user.id,
        role: "assistant",
        memoryMessageId: assistantMemoryId,
        providerMessageId: providerResult.providerMessageId,
        status: "SUCCEEDED",
        tokenCount: Math.ceil(providerResult.answer.length / 4),
        startedAt,
        finishedAt,
      })
      await appendIntegrityRecord(db, { userId: user.id, sourceType: "agent_message", sourceId: assistantMessageId, occurredAt: finishedAt, payload: { sessionId: session.id, role: "assistant", memoryMessageId: assistantMemoryId, contentSha256: createHash("sha256").update(providerResult.answer).digest("hex") } })
      await db.execute("UPDATE agent_sessions SET finished_at=?, updated_at=UTC_TIMESTAMP(3) WHERE id=?", [finishedAt, session.id])
      await writeBusinessEvent(db, user.id, session.id, "agent_reply_succeeded", { message_id: assistantMessageId })
      return {
        message_id: assistantMessageId,
        user_message_id: userMessageId,
        conversation_id: session.conversation_id,
        provider_conversation_id: providerResult.providerConversationId,
        provider_message_id: providerResult.providerMessageId,
        answer: providerResult.answer,
        provider: providerResult.provider,
        routed_agent_id: agent.agentId,
        server_received_at: startedAt.toISOString(),
        server_finished_at: finishedAt.toISOString(),
      }
    } catch (error) {
      const failedAt = new Date()
      await db.execute("UPDATE agent_sessions SET failed_at=?, updated_at=UTC_TIMESTAMP(3) WHERE id=?", [failedAt, session.id])
      await writeBusinessEvent(db, user.id, session.id, "agent_reply_failed", { error: error?.message ?? "unknown_error" })
      return invalid(reply, "agent_reply_failed", 502)
    }
  })

  app.post("/v1/agent/sessions/:sessionId/stop", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const stoppedAt = new Date()
    const [result] = await db.execute(
      "UPDATE agent_sessions SET status='STOPPED', stopped_at=?, updated_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?",
      [stoppedAt, request.params.sessionId, user.id],
    )
    if (!result.affectedRows) return invalid(reply, "agent_session_not_found", 404)
    await writeBusinessEvent(db, user.id, request.params.sessionId, "agent_generation_stopped")
    return { ok: true, stopped_at: stoppedAt.toISOString() }
  })

  app.post("/v1/agent/messages/:messageId/copy", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute(
      `SELECT m.id, m.session_id FROM agent_messages_index m
       JOIN agent_sessions s ON s.id=m.session_id
       WHERE m.id=? AND s.user_id=? LIMIT 1`,
      [request.params.messageId, user.id],
    )
    const message = rows[0]
    if (!message) return invalid(reply, "agent_message_not_found", 404)
    await writeBusinessEvent(db, user.id, message.session_id, "agent_reply_copied", { message_id: message.id })
    return { ok: true }
  })
}
