import { createHash, randomUUID } from "node:crypto"
import { userFor } from "./learning-routes.mjs"
import { appendIntegrityRecord } from "./integrity-chain.mjs"
import { INTEREST_IDS } from "./interest-catalog.mjs"

const MAX_EVIDENCE_BYTES = 12 * 1024 * 1024
const EVENT_NAMES = new Set([
  "route_generated", "route_opened", "route_interest_selected", "route_step_opened", "route_completed", "course_completed", "step_opened", "step_completed",
  "checklist_updated", "support_mode_selected", "evidence_uploaded", "quiz_started",
  "quiz_submitted", "agent_message", "help_requested", "profile_viewed",
  "video_opened", "resource_opened", "timeline_opened", "language_changed", "logout",
])

const EVENT_LABELS = {
  route_generated: "生成学习路径",
  route_opened: "进入学习路径",
  route_interest_selected: "选择兴趣气泡",
  route_step_opened: "打开路径课程",
  route_completed: "完成整条路径",
  course_completed: "完成课程",
  step_opened: "打开课程步骤",
  step_completed: "完成课程步骤",
  checklist_updated: "更新过程清单",
  support_mode_selected: "选择学习模式",
  evidence_uploaded: "上传证据文件",
  quiz_started: "开始测评",
  quiz_submitted: "提交测评",
  agent_message: "学习伙伴对话",
  help_requested: "展开排错/求助",
  profile_viewed: "查看数字分身",
  video_opened: "打开视频资源",
  resource_opened: "打开课程资源",
  timeline_opened: "查看证据链",
  language_changed: "切换语言",
  logout: "退出登录",
  agent_opened: "打开学习伙伴",
  agent_message_sent: "发送 Agent 问题",
  agent_reply_succeeded: "Agent 回复成功",
  agent_reply_failed: "Agent 回复失败",
  agent_generation_stopped: "停止 Agent 生成",
  agent_reply_copied: "复制 Agent 回复",
}

function invalid(reply, error, status = 400, extra = {}) {
  return reply.code(status).send({ error, ...extra })
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

function jsonValue(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return typeof value === "object" ? value : fallback
}

function eventLabel(eventName) {
  return EVENT_LABELS[eventName] ?? eventName
}

function safeLimit(value, fallback = 200, max = 500) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

function uniqueStrings(value, limit = 200) {
  return [...new Set(Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && /^[a-zA-Z0-9_-]{1,180}$/.test(item))
    : [])].slice(0, limit)
}

function uniquePositiveIntegers(value, limit = 500) {
  return [...new Set(Array.isArray(value)
    ? value.filter((item) => Number.isInteger(item) && item > 0)
    : [])].slice(0, limit)
}

function checklistValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).slice(0, 500).map(([key, items]) => [
    String(key).slice(0, 128),
    uniquePositiveIntegers(items, 500),
  ]))
}

function cleanFileName(value) {
  return String(value || "evidence").replace(/[\\/\r\n\"]/g, "_").slice(0, 220)
}

async function ownedTrack(db, userId, trackId) {
  const [rows] = await db.execute(
    "SELECT id, current_path_id FROM learning_tracks WHERE id=? AND user_id=? LIMIT 1",
    [trackId, userId],
  )
  return rows[0] ?? null
}

async function ownedNode(db, userId, trackId, routeStepId) {
  const [rows] = await db.execute(
    `SELECT t.id track_id, t.current_path_id, n.id route_step_id, n.course_id, c.lesson_id
     FROM learning_tracks t
     JOIN learning_path_nodes n ON n.path_id=t.current_path_id
     JOIN courses c ON c.id=n.course_id
     WHERE t.id=? AND t.user_id=? AND n.id=? LIMIT 1`,
    [trackId, userId, routeStepId],
  )
  return rows[0] ?? null
}

async function evidenceByStep(db, userId, trackId, routeStepId) {
  const [rows] = await db.execute(
    `SELECT id, step_id, file_name, mime_type, file_size, uploaded_at
     FROM user_evidence_files
     WHERE user_id=? AND track_id=? AND route_step_id=?
     ORDER BY uploaded_at, id`,
    [userId, trackId, routeStepId],
  )
  const grouped = {}
  for (const row of rows) {
    const key = String(row.step_id)
    const records = grouped[key] ?? []
    records.push({
      id: row.id,
      stepId: Number(row.step_id),
      fileName: row.file_name,
      fileType: row.mime_type ?? "application/octet-stream",
      fileSize: Number(row.file_size),
      uploadedAt: new Date(row.uploaded_at).toISOString(),
    })
    grouped[key] = records
  }
  return grouped
}

export function registerUserDataRoutes(app, db, objectStore) {
  app.post("/v1/i18n/translate", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const locale = resolveLocale(request)
    const texts = Array.isArray(request.body?.texts)
      ? request.body.texts.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 30)
      : []
    if (!texts.length) return { translations: {} }
    if (locale !== "en") return { translations: Object.fromEntries(texts.map((item) => [item, item])) }
    const safeTexts = texts.map((item) => item.slice(0, 300))
    const deepseekKey = process.env.DEEPSEEK_API_KEY || ""
    if (!deepseekKey) return { translations: {} }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 18000)
      const dsResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.1,
          max_tokens: 2500,
          messages: [
            {
              role: "system",
              content: [
                "Translate UI text from Simplified Chinese to concise natural English.",
                "Return JSON only in the form {\"translations\":{\"source\":\"translation\"}}.",
                "Keep code, IDs, API names, hardware model names, percentages, numbers, and proper nouns unchanged.",
                "Do not add explanations. Do not translate user-entered free text beyond the provided strings.",
              ].join("\n"),
            },
            { role: "user", content: JSON.stringify({ texts: safeTexts }) },
          ],
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!dsResp.ok) return { translations: {} }
      const data = await dsResp.json()
      const raw = String(data.choices?.[0]?.message?.content || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
      const parsed = JSON.parse(raw)
      const result = parsed?.translations && typeof parsed.translations === "object" ? parsed.translations : {}
      const translations = {}
      for (const item of safeTexts) {
        const translated = String(result[item] || "").trim()
        if (translated && translated !== item) translations[item] = translated.slice(0, 500)
      }
      return { translations }
    } catch {
      return { translations: {} }
    }
  })

  app.get("/v1/progress/:trackId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const track = await ownedTrack(db, user.id, request.params.trackId)
    if (!track) return invalid(reply, "track_not_found", 404)
    const [rows] = await db.execute(
      `SELECT active_step_index, completed_step_ids, updated_at
       FROM user_route_progress WHERE user_id=? AND track_id=? LIMIT 1`,
      [user.id, track.id],
    )
    const row = rows[0]
    if (!row) {
      return {
        routeId: track.id,
        activeStepIndex: 0,
        completedStepIds: [],
        updatedAt: null,
      }
    }
    return {
      routeId: track.id,
      activeStepIndex: Number(row.active_step_index),
      completedStepIds: uniqueStrings(jsonValue(row.completed_step_ids, [])),
      updatedAt: new Date(row.updated_at).toISOString(),
    }
  })

  app.patch("/v1/progress/:trackId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const track = await ownedTrack(db, user.id, request.params.trackId)
    if (!track) return invalid(reply, "track_not_found", 404)
    const activeStepIndex = Number(request.body?.activeStepIndex)
    const completedStepIds = uniqueStrings(request.body?.completedStepIds)
    if (!Number.isInteger(activeStepIndex) || activeStepIndex < 0) return invalid(reply, "active_step_index_invalid")
    const [nodes] = await db.execute(
      "SELECT id FROM learning_path_nodes WHERE path_id=? ORDER BY learning_level, sort_order",
      [track.current_path_id],
    )
    const allowed = new Set(nodes.map((item) => item.id))
    if (activeStepIndex >= Math.max(1, nodes.length)) return invalid(reply, "active_step_index_invalid")
    if (completedStepIds.some((id) => !allowed.has(id))) return invalid(reply, "route_step_not_owned", 403)
    await db.execute(
      `INSERT INTO user_route_progress
       (user_id, track_id, active_step_index, completed_step_ids)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE active_step_index=VALUES(active_step_index),
         completed_step_ids=VALUES(completed_step_ids)`,
      [user.id, track.id, activeStepIndex, JSON.stringify(completedStepIds)],
    )
    const [rows] = await db.execute(
      "SELECT updated_at FROM user_route_progress WHERE user_id=? AND track_id=?",
      [user.id, track.id],
    )
    return {
      routeId: track.id,
      activeStepIndex,
      completedStepIds,
      updatedAt: new Date(rows[0].updated_at).toISOString(),
    }
  })

  app.get("/v1/tracks/:trackId/nodes/:routeStepId/progress", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const node = await ownedNode(db, user.id, request.params.trackId, request.params.routeStepId)
    if (!node) return invalid(reply, "route_step_not_found", 404)
    const [rows] = await db.execute(
      `SELECT lesson_id, support_mode, active_course_step_index, completed_course_step_ids,
              checklist_by_step, stuck_step_ids, updated_at
       FROM user_course_progress
       WHERE user_id=? AND track_id=? AND route_step_id=? LIMIT 1`,
      [user.id, node.track_id, node.route_step_id],
    )
    const row = rows[0]
    if (!row) {
      return {
        routeId: node.track_id,
        routeStepId: node.route_step_id,
        lessonId: Number(node.lesson_id),
        supportMode: null,
        activeCourseStepIndex: 0,
        completedCourseStepIds: [],
        checklistByStep: {},
        evidenceByStep: {},
        stuckStepIds: [],
        updatedAt: null,
      }
    }
    return {
      routeId: node.track_id,
      routeStepId: node.route_step_id,
      lessonId: Number(row.lesson_id),
      supportMode: row.support_mode,
      activeCourseStepIndex: Number(row.active_course_step_index),
      completedCourseStepIds: uniquePositiveIntegers(jsonValue(row.completed_course_step_ids, [])),
      checklistByStep: checklistValue(jsonValue(row.checklist_by_step, {})),
      evidenceByStep: await evidenceByStep(db, user.id, node.track_id, node.route_step_id),
      stuckStepIds: uniquePositiveIntegers(jsonValue(row.stuck_step_ids, [])),
      updatedAt: new Date(row.updated_at).toISOString(),
    }
  })

  app.patch("/v1/tracks/:trackId/nodes/:routeStepId/progress", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const node = await ownedNode(db, user.id, request.params.trackId, request.params.routeStepId)
    if (!node) return invalid(reply, "route_step_not_found", 404)
    const supportMode = request.body?.supportMode ?? null
    const activeCourseStepIndex = Number(request.body?.activeCourseStepIndex)
    const completedCourseStepIds = uniquePositiveIntegers(request.body?.completedCourseStepIds)
    const checklistByStep = checklistValue(request.body?.checklistByStep)
    const stuckStepIds = uniquePositiveIntegers(request.body?.stuckStepIds)
    if (![null, "guided", "self_directed"].includes(supportMode)
      || !Number.isInteger(activeCourseStepIndex) || activeCourseStepIndex < 0) {
      return invalid(reply, "course_progress_invalid")
    }
    if (request.body?.lessonId !== undefined && Number(request.body.lessonId) !== Number(node.lesson_id)) {
      return invalid(reply, "lesson_not_owned", 403)
    }
    await db.execute(
      `INSERT INTO user_course_progress
       (user_id, track_id, route_step_id, course_id, lesson_id, support_mode,
        active_course_step_index, completed_course_step_ids, checklist_by_step, stuck_step_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE support_mode=VALUES(support_mode),
         active_course_step_index=VALUES(active_course_step_index),
         completed_course_step_ids=VALUES(completed_course_step_ids),
         checklist_by_step=VALUES(checklist_by_step), stuck_step_ids=VALUES(stuck_step_ids)`,
      [user.id, node.track_id, node.route_step_id, node.course_id, Number(node.lesson_id),
        supportMode, activeCourseStepIndex, JSON.stringify(completedCourseStepIds),
        JSON.stringify(checklistByStep), JSON.stringify(stuckStepIds)],
    )
    const [rows] = await db.execute(
      `SELECT updated_at FROM user_course_progress
       WHERE user_id=? AND track_id=? AND route_step_id=?`,
      [user.id, node.track_id, node.route_step_id],
    )
    return {
      routeId: node.track_id,
      routeStepId: node.route_step_id,
      lessonId: Number(node.lesson_id),
      supportMode,
      activeCourseStepIndex,
      completedCourseStepIds,
      checklistByStep,
      evidenceByStep: await evidenceByStep(db, user.id, node.track_id, node.route_step_id),
      stuckStepIds,
      updatedAt: new Date(rows[0].updated_at).toISOString(),
    }
  })

  app.post("/v1/events", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const body = request.body ?? {}
    if (!EVENT_NAMES.has(body.eventType)) return invalid(reply, "event_type_invalid")
    const trackId = typeof body.routeId === "string" ? body.routeId : null
    const routeStepId = typeof body.routeStepId === "string" ? body.routeStepId : null
    let node = null
    if (routeStepId) {
      if (!trackId) return invalid(reply, "track_required_for_route_step")
      node = await ownedNode(db, user.id, trackId, routeStepId)
      if (!node) return invalid(reply, "route_step_not_owned", 403)
    } else if (trackId && !(await ownedTrack(db, user.id, trackId))) {
      return invalid(reply, "track_not_owned", 403)
    }
    if (node && body.lessonId !== undefined && Number(body.lessonId) !== Number(node.lesson_id)) {
      return invalid(reply, "lesson_not_owned", 403)
    }
    const clientEventId = typeof body.eventId === "string" ? body.eventId.slice(0, 128) : null
    const id = randomUUID()
    const [result] = await db.execute(
      `INSERT IGNORE INTO user_learning_events
       (id, user_id, client_event_id, session_id, track_id, route_step_id, lesson_id,
        step_id, event_name, payload_json, client_occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, clientEventId, String(body.sessionId ?? "").slice(0, 128) || null,
        trackId, routeStepId, body.lessonId ? Number(body.lessonId) : null,
        body.stepId ? Number(body.stepId) : null, body.eventType,
        JSON.stringify(body.payload && typeof body.payload === "object" ? body.payload : {}),
        body.clientOccurredAt ? new Date(body.clientOccurredAt) : null],
    )
    let integritySourceId = result.affectedRows ? id : null
    if (!integritySourceId && clientEventId) {
      const [existing] = await db.execute(
        "SELECT id FROM user_learning_events WHERE user_id=? AND client_event_id=? LIMIT 1",
        [user.id, clientEventId],
      )
      integritySourceId = existing[0]?.id ?? null
    }
    if (integritySourceId) {
      await appendIntegrityRecord(db, {
        userId: user.id, sourceType: "learning", sourceId: integritySourceId,
        occurredAt: body.clientOccurredAt ? new Date(body.clientOccurredAt) : new Date(),
        payload: { eventName: body.eventType, sessionId: String(body.sessionId ?? "").slice(0,128) || null, trackId, routeStepId, lessonId: body.lessonId || null, stepId: body.stepId || null },
      })
    }
    return reply.code(result.affectedRows ? 201 : 200).send({
      ok: true,
      eventId: clientEventId ?? id,
      duplicate: !result.affectedRows,
    })
  })

  app.get("/v1/timeline", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const trackId = typeof request.query?.routeId === "string" && request.query.routeId ? request.query.routeId : null
    const routeStepId = typeof request.query?.routeStepId === "string" && request.query.routeStepId ? request.query.routeStepId : null
    const limit = safeLimit(request.query?.limit)
    if (routeStepId && !trackId) return invalid(reply, "track_required_for_route_step")
    if (routeStepId) {
      const node = await ownedNode(db, user.id, trackId, routeStepId)
      if (!node) return invalid(reply, "route_step_not_owned", 403)
    } else if (trackId && !(await ownedTrack(db, user.id, trackId))) {
      return invalid(reply, "track_not_owned", 403)
    }

    const filterValues = [user.id]
    let eventFilter = "e.user_id=?"
    let evidenceFilter = "f.user_id=?"
    let agentFilter = "ae.user_id=?"
    if (trackId) {
      eventFilter += " AND e.track_id=?"
      evidenceFilter += " AND f.track_id=?"
      agentFilter += " AND s.track_id=?"
      filterValues.push(trackId)
    }
    if (routeStepId) {
      eventFilter += " AND e.route_step_id=?"
      evidenceFilter += " AND f.route_step_id=?"
      agentFilter += " AND s.route_step_id=?"
      filterValues.push(routeStepId)
    }

    const [processRows] = await db.execute(
      `SELECT e.id, e.client_event_id, e.session_id, e.track_id, e.route_step_id,
              e.lesson_id, e.step_id, e.event_name, e.payload_json, e.client_occurred_at,
              e.occurred_at, n.course_id, n.title_snapshot
       FROM user_learning_events e
       LEFT JOIN learning_path_nodes n ON n.id=e.route_step_id
       WHERE ${eventFilter}
       ORDER BY e.occurred_at DESC, e.id DESC
       LIMIT ?`,
      [...filterValues, limit],
    )
    const [evidenceRows] = await db.execute(
      `SELECT f.id, f.track_id, f.route_step_id, f.course_id, f.lesson_id, f.step_id,
              f.file_name, f.mime_type, f.file_size, f.sha256, f.storage_status,
              f.uploaded_at, n.title_snapshot
       FROM user_evidence_files f
       LEFT JOIN learning_path_nodes n ON n.id=f.route_step_id
       WHERE ${evidenceFilter}
       ORDER BY f.uploaded_at DESC, f.id DESC
       LIMIT ?`,
      [...filterValues, limit],
    )
    const [agentRows] = await db.execute(
      `SELECT ae.id, ae.session_id, ae.event_name, ae.payload_json, ae.occurred_at,
              s.track_id, s.route_step_id, s.course_id, s.module_id, s.stage_id,
              n.title_snapshot
       FROM agent_events ae
       JOIN agent_sessions s ON s.id=ae.session_id
       LEFT JOIN learning_path_nodes n ON n.id=s.route_step_id
       WHERE ${agentFilter}
       ORDER BY ae.occurred_at DESC, ae.id DESC
       LIMIT ?`,
      [...filterValues, limit],
    )

    const events = [
      ...processRows.map((row) => ({
        id: row.id,
        source: "process",
        eventName: row.event_name,
        eventLabel: eventLabel(row.event_name),
        occurredAt: new Date(row.occurred_at).toISOString(),
        clientOccurredAt: row.client_occurred_at ? new Date(row.client_occurred_at).toISOString() : null,
        trackId: row.track_id,
        routeStepId: row.route_step_id,
        courseId: row.course_id ?? null,
        lessonId: row.lesson_id === null ? null : Number(row.lesson_id),
        stepId: row.step_id === null ? null : Number(row.step_id),
        title: row.title_snapshot ?? null,
        detail: null,
        payload: jsonValue(row.payload_json, {}),
      })),
      ...evidenceRows.map((row) => ({
        id: row.id,
        source: "evidence",
        eventName: "evidence_file_stored",
        eventLabel: "证据文件入库",
        occurredAt: new Date(row.uploaded_at).toISOString(),
        clientOccurredAt: null,
        trackId: row.track_id,
        routeStepId: row.route_step_id,
        courseId: row.course_id,
        lessonId: Number(row.lesson_id),
        stepId: Number(row.step_id),
        title: row.title_snapshot ?? null,
        detail: row.file_name,
        payload: {
          fileName: row.file_name,
          mimeType: row.mime_type,
          fileSize: Number(row.file_size),
          sha256: row.sha256,
          storageStatus: row.storage_status,
        },
      })),
      ...agentRows.map((row) => ({
        id: row.id,
        source: "agent",
        eventName: row.event_name,
        eventLabel: eventLabel(row.event_name),
        occurredAt: new Date(row.occurred_at).toISOString(),
        clientOccurredAt: null,
        trackId: row.track_id,
        routeStepId: row.route_step_id,
        courseId: row.course_id,
        lessonId: null,
        stepId: null,
        title: row.title_snapshot ?? null,
        detail: row.stage_id ?? null,
        payload: jsonValue(row.payload_json, {}),
      })),
    ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, limit)

    return {
      events,
      generatedAt: new Date().toISOString(),
    }
  })



  app.get("/v1/digital-teacher/context", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [userRows, quizRows, masteryRows, recRows, eventAggRows, recentEventRows, agentRows] = await Promise.all([
      db.execute("SELECT username, display_name FROM users WHERE id=? LIMIT 1", [user.id]).then(([rows]) => rows),
      db.execute(
        `SELECT qs.id, qs.title, qs.phase_id, qs.report_json, qs.submitted_at,
                qa.score, qa.total, qa.detail_json
         FROM adaptive_quiz_sessions qs
         LEFT JOIN adaptive_quiz_attempts qa
           ON qa.user_id=qs.user_id AND qa.track_id=qs.track_id AND qa.route_step_id=qs.route_step_id
         WHERE qs.user_id=? AND qs.status='SUBMITTED'
         ORDER BY qs.submitted_at DESC, qs.created_at DESC LIMIT 8`, [user.id],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT knowledge_point_label, score, evidence_count, updated_at
         FROM adaptive_knowledge_mastery
         WHERE user_id=? ORDER BY score ASC, evidence_count DESC LIMIT 12`, [user.id],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT ar.track_id, ar.route_step_id, ar.recommendation_json, ar.updated_at, n.title_snapshot
         FROM adaptive_recommendations ar
         LEFT JOIN learning_path_nodes n ON n.id=ar.route_step_id
         WHERE ar.user_id=? ORDER BY ar.updated_at DESC LIMIT 8`, [user.id],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT COUNT(*) total,
                SUM(event_name='help_requested') help_requests,
                SUM(event_name='step_completed') step_completions,
                SUM(event_name='checklist_updated') checklist_updates,
                SUM(event_name='quiz_submitted') quiz_submissions,
                SUM(event_name='route_step_opened') route_step_opened,
                MAX(occurred_at) last_event_at
         FROM user_learning_events WHERE user_id=? AND occurred_at>=?`, [user.id, since],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT event_name, payload_json, occurred_at, route_step_id, step_id
         FROM user_learning_events
         WHERE user_id=? ORDER BY occurred_at DESC LIMIT 12`, [user.id],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT i.role, LEFT(COALESCE(m.content_summary, m.content), 220) content, m.created_at
         FROM agent_messages_index i
         JOIN memory_messages m ON m.id=i.memory_message_id
         WHERE i.user_id=? AND i.status='SUCCEEDED' AND i.role IN ('user','assistant')
         ORDER BY m.created_at DESC LIMIT 12`, [user.id],
      ).then(([rows]) => rows),
    ])

    const learnerName = userRows[0]?.display_name || userRows[0]?.username || "当前学习者"
    const latestQuiz = quizRows[0] || null
    const latestPercent = latestQuiz && latestQuiz.total ? Math.round(Number(latestQuiz.score || 0) / Number(latestQuiz.total) * 100) : null
    const latestReport = latestQuiz ? jsonValue(latestQuiz.report_json, {}) : {}
    const weakTags = [
      ...(Array.isArray(latestReport.weak_tags) ? latestReport.weak_tags : []),
      ...(Array.isArray(latestReport.weakTags) ? latestReport.weakTags : []),
    ].filter(Boolean).slice(0, 8)
    const weakKnowledge = masteryRows.filter((row) => Number(row.score) < 0.6).map((row) => ({
      label: row.knowledge_point_label,
      score: Math.round(Number(row.score) * 100),
      evidenceCount: Number(row.evidence_count || 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }))
    const recentRecommendations = recRows.map((row) => {
      const rec = jsonValue(row.recommendation_json, {})
      return {
        trackId: row.track_id,
        routeStepId: row.route_step_id,
        title: row.title_snapshot || null,
        supportLevel: rec.supportLevel || "standard",
        reason: rec.reason || "根据最近学习证据生成。",
        weakTags: Array.isArray(rec.weakTags) ? rec.weakTags : [],
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      }
    })
    const latestRecommendation = recentRecommendations[0] || null
    const eventAgg = eventAggRows[0] || {}
    const recentAgentQuestions = agentRows.filter((row) => row.role === "user").map((row) => ({
      text: String(row.content || "").replace(/\s+/g, " ").trim(),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })).slice(0, 5)
    const recentEvents = recentEventRows.map((row) => ({
      eventName: row.event_name,
      stepId: row.step_id === null ? null : Number(row.step_id),
      routeStepId: row.route_step_id,
      occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
      payload: jsonValue(row.payload_json, {}),
    }))

    const notifications = []
    if (latestQuiz && latestPercent !== null) {
      if (latestPercent < 60) {
        notifications.push({
          id: "quiz-low-score",
          priority: "high",
          type: "quiz_review",
          title: "需要先复盘最近 Quiz",
          summary: `最近一次 Quiz 得分 ${latestPercent}%，建议先处理错题再继续。`,
          detail: weakTags.length ? `优先关注：${weakTags.slice(0, 4).join("、")}。` : "最近 Quiz 分数偏低，建议查看错题解析。",
          evidence: ["最近 Quiz 结果", "错题解析"],
          actionLabel: "查看诊断",
        })
      } else if (latestPercent < 85) {
        notifications.push({
          id: "quiz-mid-score",
          priority: "medium",
          type: "quiz_review",
          title: "本轮掌握基本达标",
          summary: `最近一次 Quiz 得分 ${latestPercent}%，可以继续，但建议保留错题复盘。`,
          detail: weakTags.length ? `仍需留意：${weakTags.slice(0, 3).join("、")}。` : "建议用一次简短回顾巩固关键步骤。",
          evidence: ["最近 Quiz 结果", "错题解析"],
          actionLabel: "查看诊断",
        })
      }
    }
    if (weakKnowledge.length) {
      notifications.push({
        id: "weak-knowledge",
        priority: "high",
        type: "review_due",
        title: "有知识点需要巩固",
        summary: `${weakKnowledge[0].label} 当前掌握度约 ${weakKnowledge[0].score}%。`,
        detail: `薄弱知识点：${weakKnowledge.slice(0, 4).map((item) => `${item.label} ${item.score}%`).join("；")}。`,
        evidence: ["知识点掌握记录"],
        actionLabel: "查看薄弱点",
      })
    }

    const reviewCandidates = []
    if (latestQuiz?.submitted_at) {
      const hours = Math.floor((Date.now() - new Date(latestQuiz.submitted_at).getTime()) / (60 * 60 * 1000))
      if (Number.isFinite(hours) && hours >= 20) {
        reviewCandidates.push({
          label: latestQuiz.title || "最近 Quiz",
          hours,
          reason: hours >= 72 ? "已超过 3 天，适合做一次回忆式复盘。" : "已接近 1 天，适合做一次短复习。",
        })
      }
    }
    for (const item of weakKnowledge.slice(0, 3)) {
      if (!item.updatedAt) continue
      const hours = Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / (60 * 60 * 1000))
      if (Number.isFinite(hours) && hours >= 20) {
        reviewCandidates.push({
          label: item.label,
          hours,
          reason: hours >= 72 ? "薄弱点已经间隔较久，需要重新唤醒。" : "薄弱点进入 1 天复习窗口。",
        })
      }
    }
    if (reviewCandidates.length) {
      const due = reviewCandidates.sort((a, b) => b.hours - a.hours)[0]
      notifications.push({
        id: "spaced-review",
        priority: due.hours >= 72 ? "high" : "medium",
        type: "spaced_review",
        title: "建议安排一次间隔复习",
        summary: `${due.label} 距上次学习约 ${due.hours} 小时。`,
        detail: `按艾宾浩斯式间隔复习思路，现在适合用 3-5 分钟重新回忆关键步骤。${due.reason}`,
        evidence: ["最近 Quiz 结果", "知识点掌握记录", "学习行为记录"],
        actionLabel: "查看复习建议",
      })
    }
    if (latestRecommendation) {
      const levelLabel = latestRecommendation.supportLevel === "detailed" ? "详细层" : latestRecommendation.supportLevel === "brief" ? "简略层" : "标准层"
      notifications.push({
        id: "step-level",
        priority: latestRecommendation.supportLevel === "detailed" ? "medium" : "low",
        type: "step_layer",
        title: `当前 Step 推荐为${levelLabel}`,
        summary: latestRecommendation.reason,
        detail: latestRecommendation.title ? `关联课程：${latestRecommendation.title}` : latestRecommendation.reason,
        evidence: ["Step 分层记录", "知识点掌握记录"],
        actionLabel: "查看依据",
      })
    }
    if (Number(eventAgg.help_requests || 0) >= 2) {
      notifications.push({
        id: "help-pattern",
        priority: "medium",
        type: "learning_habit",
        title: "最近求助次数较多",
        summary: `近 7 天记录到 ${Number(eventAgg.help_requests || 0)} 次求助或排错行为。`,
        detail: "这通常说明当前内容需要更明确的排查顺序，建议优先使用详细 Step。",
        evidence: ["学习行为记录"],
        actionLabel: "查看行为证据",
      })
    }
    if (recentAgentQuestions.length) {
      notifications.push({
        id: "agent-followup",
        priority: "low",
        type: "agent_memory",
        title: "最近对话已纳入学习判断",
        summary: `最近问题：${recentAgentQuestions[0].text.slice(0, 42)}${recentAgentQuestions[0].text.length > 42 ? "…" : ""}`,
        detail: "导师会把 Agent 提问主题与 Quiz 错题、Step 分层一起参考。",
        evidence: ["最近 Agent 对话记录"],
        actionLabel: "查看对话依据",
      })
    }
    if (!notifications.length) {
      notifications.push({
        id: "steady-state",
        priority: "low",
        type: "summary",
        title: "当前没有高风险提醒",
        summary: "继续完成课程、Quiz 和检查清单后，导师会自动更新判断。",
        detail: "目前可用证据不足以触发强提醒。",
        evidence: ["学习行为记录", "最近 Quiz 结果"],
        actionLabel: "查看详情",
      })
    }

    const priorityRank = { high: 3, medium: 2, low: 1 }
    const sortedNotifications = notifications.sort((a, b) => (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)).slice(0, 5)
    return {
      learner: { id: user.id, name: learnerName },
      generatedAt: new Date().toISOString(),
      notifications: sortedNotifications,
      summary: {
        currentStepLevel: latestRecommendation?.supportLevel || "standard",
        currentStepReason: latestRecommendation?.reason || "暂无明确 Step 分层推荐。",
        latestQuiz: latestQuiz ? {
          id: latestQuiz.id,
          title: latestQuiz.title,
          score: latestQuiz.score === null ? null : Number(latestQuiz.score),
          total: latestQuiz.total === null ? null : Number(latestQuiz.total),
          scorePercent: latestPercent,
          weakTags,
          submittedAt: latestQuiz.submitted_at ? new Date(latestQuiz.submitted_at).toISOString() : null,
        } : null,
        weakKnowledge,
        eventSummary7d: {
          total: Number(eventAgg.total || 0),
          helpRequests: Number(eventAgg.help_requests || 0),
          stepCompletions: Number(eventAgg.step_completions || 0),
          checklistUpdates: Number(eventAgg.checklist_updates || 0),
          quizSubmissions: Number(eventAgg.quiz_submissions || 0),
          routeStepOpened: Number(eventAgg.route_step_opened || 0),
          lastEventAt: eventAgg.last_event_at ? new Date(eventAgg.last_event_at).toISOString() : null,
        },
        recentAgentQuestions,
        recentEvents,
        recentRecommendations,
      },
    }
  })

  app.get("/v1/profile/me", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [userRows, profileRows, masteryRows, attemptRows, progressRows, eventRows, evidenceRows] = await Promise.all([
      db.execute("SELECT username, display_name, created_at, updated_at FROM users WHERE id=? LIMIT 1", [user.id]).then(([rows]) => rows),
      db.execute("SELECT * FROM user_profiles WHERE user_id=? LIMIT 1", [user.id]).then(([rows]) => rows),
      db.execute("SELECT * FROM adaptive_knowledge_mastery WHERE user_id=? ORDER BY evidence_count DESC, score", [user.id]).then(([rows]) => rows),
      db.execute("SELECT COUNT(*) count, AVG(score/NULLIF(total,0)*100) average_score FROM adaptive_quiz_attempts WHERE user_id=?", [user.id]).then(([rows]) => rows),
      db.execute("SELECT completed_course_step_ids, checklist_by_step FROM user_course_progress WHERE user_id=?", [user.id]).then(([rows]) => rows),
      db.execute(
        `SELECT COUNT(*) total,
          SUM(event_name='help_requested') help_requests,
          SUM(event_name='step_completed') step_completions,
          SUM(event_name='evidence_uploaded') evidence_uploads
         FROM user_learning_events WHERE user_id=?`, [user.id],
      ).then(([rows]) => rows),
      db.execute("SELECT COUNT(*) count FROM user_evidence_files WHERE user_id=?", [user.id]).then(([rows]) => rows),
    ])
    const dbUser = userRows[0] ?? {}
    const profile = profileRows[0] ?? {}
    const mastery = masteryRows.map((row) => {
      const score = Number(row.score)
      return {
        knowledgePointId: row.knowledge_point_id,
        knowledgePointLabel: row.knowledge_point_label,
        score,
        evidenceCount: Number(row.evidence_count),
        level: score >= 0.8 ? "strong" : score >= 0.5 ? "developing" : "weak",
        updatedAt: new Date(row.updated_at).toISOString(),
      }
    })
    const completedCourseSteps = progressRows.reduce(
      (sum, row) => sum + uniquePositiveIntegers(jsonValue(row.completed_course_step_ids, [])).length,
      0,
    )
    const checkedItems = progressRows.reduce(
      (sum, row) => sum + Object.values(checklistValue(jsonValue(row.checklist_by_step, {})))
        .reduce((count, items) => count + items.length, 0),
      0,
    )
    const quizAttempts = Number(attemptRows[0]?.count ?? 0)
    const weakKnowledgePoints = mastery.filter((item) => item.score < 0.5).slice(0, 12)
    return {
      learnerId: user.id,
      displayName: dbUser.display_name ?? dbUser.username ?? "当前用户",
      aspiration: profile.aspiration ?? "",
      desiredSkills: profile.desired_skills ?? "",
      futureIdentity: profile.future_identity ?? "",
      selectedInterestIds: uniqueStrings(jsonValue(profile.selected_interest_ids, [])),
      primaryCareerId: profile.primary_career_id ?? null,
      careerPreferenceUpdatedAt: profile.career_preference_updated_at ? new Date(profile.career_preference_updated_at).toISOString() : null,
      createdAt: new Date(profile.created_at ?? dbUser.created_at ?? Date.now()).toISOString(),
      updatedAt: new Date(profile.updated_at ?? dbUser.updated_at ?? Date.now()).toISOString(),
      mastery,
      weakKnowledgePoints,
      dimensions: [],
      evidenceSummary: {
        completedCourseSteps,
        checkedItems,
        evidenceFiles: Number(evidenceRows[0]?.count ?? 0),
        quizAttempts,
      },
      interactionSummary: {
        total: Number(eventRows[0]?.total ?? 0),
        agentInteractions: 0,
        helpRequests: Number(eventRows[0]?.help_requests ?? 0),
        stepCompletions: Number(eventRows[0]?.step_completions ?? 0),
        evidenceUploads: Number(eventRows[0]?.evidence_uploads ?? 0),
      },
      averageQuizScore: quizAttempts ? Number(attemptRows[0]?.average_score ?? 0) : null,
      profileLevel: mastery.length ? "已有学习证据" : "初始状态",
      recommendations: weakKnowledgePoints.length
        ? weakKnowledgePoints.slice(0, 2).map((item) => `优先巩固“${item.knowledgePointLabel}”。`)
        : ["完成课程步骤与测验后，系统会生成基于真实证据的建议。"],
    }
  })

  app.patch("/v1/profile/me", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const body = request.body ?? {}
    const selectedInterestIds = uniqueStrings(body.selectedInterestIds, 20)
    await db.execute(
      `INSERT INTO user_profiles
       (user_id, aspiration, desired_skills, future_identity, selected_interest_ids)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE aspiration=VALUES(aspiration),
         desired_skills=VALUES(desired_skills), future_identity=VALUES(future_identity),
         selected_interest_ids=VALUES(selected_interest_ids)`,
      [user.id, String(body.aspiration ?? "").slice(0, 4000),
        String(body.desiredSkills ?? "").slice(0, 4000),
        String(body.futureIdentity ?? "").slice(0, 4000),
        JSON.stringify(selectedInterestIds)],
    )
    return { ok: true }
  })

  app.patch("/v1/profile/interests", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const value = request.body?.selectedInterestIds
    if (!Array.isArray(value)) return invalid(reply, "selected_interest_ids_must_be_array")
    if (value.some((item) => typeof item !== "string")) return invalid(reply, "invalid_interest_id")
    const selectedInterestIds = [...new Set(value)]
    if (selectedInterestIds.length > INTEREST_IDS.size) return invalid(reply, "selected_interest_count_invalid", 400, { limit: INTEREST_IDS.size })
    const invalidIds = selectedInterestIds.filter((id) => !INTEREST_IDS.has(id))
    if (invalidIds.length) return invalid(reply, "invalid_interest_id", 400, { invalidInterestIds: invalidIds })
    await db.execute(
      `INSERT INTO user_profiles (user_id, aspiration, desired_skills, future_identity, selected_interest_ids)
       VALUES (?, '', '', '', ?)
       ON DUPLICATE KEY UPDATE selected_interest_ids=VALUES(selected_interest_ids)`,
      [user.id, JSON.stringify(selectedInterestIds)],
    )
    return { selectedInterestIds }
  })

  app.post("/v1/profile/digital-twin", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const deepseekKey = process.env.DEEPSEEK_API_KEY || ""
    const [agentRows, quizRows, masteryRows, profileRow] = await Promise.all([
      db.execute(
        `SELECT m.content, m.role, s.stage_id
         FROM agent_messages_index i
         JOIN agent_sessions s ON s.id = i.session_id
         JOIN memory_messages m ON m.id = i.memory_message_id
         WHERE i.user_id = ? AND i.role IN ('user','assistant') AND i.status = 'SUCCEEDED'
         ORDER BY m.created_at DESC LIMIT 20`, [user.id],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT qs.report_json, qa.score, qa.total FROM adaptive_quiz_sessions qs
         JOIN adaptive_quiz_attempts qa ON qa.user_id=qs.user_id AND qa.route_step_id=qs.route_step_id AND qa.track_id=qs.track_id
         WHERE qs.user_id = ? AND qs.status='SUBMITTED' AND qs.report_json IS NOT NULL
         ORDER BY qs.submitted_at DESC LIMIT 5`, [user.id],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT knowledge_point_label, score FROM adaptive_knowledge_mastery
         WHERE user_id = ? ORDER BY score ASC LIMIT 8`, [user.id],
      ).then(([rows]) => rows),
      db.execute(
        "SELECT aspiration, desired_skills, future_identity FROM user_profiles WHERE user_id=? LIMIT 1", [user.id],
      ).then(([rows]) => rows),
    ])

    // Build context for DeepSeek
    const agentConvo = agentRows.map((row) =>
      `${row.role === "user" ? "学生" : "Agent"}：${String(row.content || "").slice(0, 200)}`
    ).join("\n") || "暂无对话记录"
    const quizInfo = quizRows.map((row, i) => {
      const report = jsonValue(row.report_json, {})
      return `Quiz${i+1}: ${row.score}/${row.total}分, 薄弱标签: ${(report.weak_tags || []).join(",") || "无"}`
    }).join("\n") || "暂无Quiz记录"
    const weakInfo = masteryRows.map((row) =>
      `${row.knowledge_point_label}(掌握度${Math.round(row.score * 100)}%)`
    ).join(", ") || "暂无薄弱点"

    // Search memory for conversations related to weak points
    let memoryContext = "暂无相关记忆"
    const weakLabels = masteryRows.slice(0, 3).map(r => r.knowledge_point_label).filter(Boolean)
    if (weakLabels.length) {
      const searchTerms = weakLabels.join(" ")
      try {
        const [memRows] = await db.execute(
          `SELECT m.role, LEFT(m.content, 300) content_snippet, m.created_at
           FROM memory_messages m
           JOIN memory_conversations c ON c.id=m.conversation_id
           WHERE c.user_id=? AND m.content IS NOT NULL
             AND MATCH(m.content) AGAINST(? IN BOOLEAN MODE)
           ORDER BY m.created_at DESC LIMIT 5`,
          [user.id, weakLabels.map(w => `+${w.split(/\s+/)[0] || w}`).join(" ")],
        )
        if (memRows.length) {
          memoryContext = memRows.map(r =>
            `[${r.role}] ${(r.content_snippet || "").slice(0, 200)}`
          ).join("\n")
        }
      } catch { /* FULLTEXT may fail on short terms, silently ignore */ }
    }
    const profile = profileRow[0] ?? {}
    const aspiration = profile.aspiration || "未填写"
    const desired = profile.desired_skills || "未填写"
    const identity = profile.future_identity || "未填写"

    const systemPrompt = `你是一位教师型 AI 学习导师。你必须基于学生的真实学习数据给出清晰、克制、可执行的学习诊断，不要扮演学生本人。用Markdown格式，包含：
1. **学习概览** — 一两句话概括这个学生的当前状态
2. **对话行为分析** — 从Agent对话中分析学生的关注点、学习风格
3. **Quiz表现诊断** — 分析强项和薄弱点
4. **与梦想的差距** — 对比学生填写的梦想/目标(${aspiration} / ${desired} / ${identity})与当前水平
5. **下一步建议** — 具体可操作的学习建议(2-3条)
用中文回复，语气温暖鼓励，不超过600字。`

    const userPrompt = `以下是我的学习数据：

【我的梦想】${aspiration}；想学的技能：${desired}；想成为：${identity}

【近期Agent对话】
${agentConvo}

【Quiz成绩】
${quizInfo}

【知识点掌握度】
${weakInfo}

【与薄弱点相关的历史记忆】
${memoryContext}

请以教师口吻生成我的学习导师诊断。`

    let twinText
    if (deepseekKey) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)
        const dsResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 1200,
            temperature: 0.7,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (dsResp.ok) {
          const dsData = await dsResp.json()
          twinText = dsData.choices?.[0]?.message?.content?.trim() || ""
        }
        if (!twinText) throw new Error("DeepSeek returned empty response")
      } catch (err) {
        // Fallback to rule-based generation
        twinText = `## 学习数字分身\n\n> *AI 生成暂时不可用（${(err).message?.slice(0, 60) || "未知错误"}），以下为规则生成版本。*\n\n`
      }
    }

    // Fallback: rule-based if no API key or API failed
    if (!twinText || twinText.startsWith("## 学习数字分身\n\n> *AI")) {
      const agentSummary = agentRows.slice(0, 10).map((row) =>
        `${row.role === "user" ? "问" : "答"}：${String(row.content || "").slice(0, 120)}`
      ).join("；")
      const quizSummary = quizRows.map((row, i) => {
        const report = jsonValue(row.report_json, {})
        return `Quiz${i+1}：${row.score}/${row.total}分，薄弱：${(report.weak_tags || []).slice(0,3).join("、") || "无"}`
      }).join("；")
      const weakSummary = masteryRows.map((row) =>
        `${row.knowledge_point_label}(${Math.round(row.score * 100)}%)`
      ).join("、")
      twinText = (twinText || "") + [
        `**近期对话摘要**：${agentSummary || "暂无Agent对话记录"}`,
        `**Quiz 表现**：${quizSummary || "暂无Quiz记录"}`,
        `**待巩固知识点**：${weakSummary || "暂无薄弱点"}`,
        `*生成时间：${new Date().toISOString()}*`,
      ].join("\n\n")
    }

    const convId = randomUUID()
    const msgId = randomUUID()
    await db.execute(
      `INSERT INTO memory_conversations (id, user_id, scope_type, scope_ref, metadata_json)
       VALUES (?, ?, 'digital_twin', ?, ?)
       ON DUPLICATE KEY UPDATE updated_at=CURRENT_TIMESTAMP(3)`,
      [convId, user.id, user.id, JSON.stringify({ source: deepseekKey ? "deepseek" : "rule", generatedAt: new Date().toISOString() })],
    )
    await db.execute(
      `INSERT INTO memory_messages (id, conversation_id, role, content, metadata_json)
       VALUES (?, ?, 'system', ?, ?)`,
      [msgId, convId, twinText, JSON.stringify({
        agentMessageCount: agentRows.length,
        quizCount: quizRows.length,
        weakPointCount: masteryRows.length,
        generatedAt: new Date().toISOString(),
        model: deepseekKey ? "deepseek-chat" : "rule-based",
      })],
    )
    return {
      ok: true,
      conversationId: convId,
      messageId: msgId,
      twin: twinText,
    }
  })

  app.get("/v1/profile/digital-twin", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [convRows] = await db.execute(
      `SELECT id FROM memory_conversations
       WHERE user_id=? AND scope_type='digital_twin'
       ORDER BY updated_at DESC LIMIT 1`, [user.id],
    )
    if (!convRows[0]) {
      return { twin: null, message: "尚未生成数字分身。请先完成一些课程和 Quiz，系统会自动生成。" }
    }
    const [msgRows] = await db.execute(
      `SELECT id, content, metadata_json, created_at FROM memory_messages
       WHERE conversation_id=? AND role='system'
       ORDER BY created_at DESC LIMIT 1`, [convRows[0].id],
    )
    if (!msgRows[0]) {
      return { twin: null, message: "数字分身数据异常，请重新生成。" }
    }
    const [agentCountRows] = await db.execute(
      "SELECT COUNT(*) total FROM agent_messages_index WHERE user_id=?", [user.id],
    )
    const [quizCountRows] = await db.execute(
      "SELECT COUNT(*) total, AVG(score/NULLIF(total,0)*100) avg_score FROM adaptive_quiz_attempts WHERE user_id=?", [user.id],
    )
    const [masteryRows] = await db.execute(
      "SELECT knowledge_point_label, score FROM adaptive_knowledge_mastery WHERE user_id=? AND score < 0.6 ORDER BY score ASC LIMIT 5", [user.id],
    )
    return {
      conversationId: convRows[0].id,
      twin: {
        messageId: msgRows[0].id,
        content: msgRows[0].content,
        metadata: jsonValue(msgRows[0].metadata_json, {}),
        createdAt: new Date(msgRows[0].created_at).toISOString(),
      },
      liveSummary: {
        agentInteractions: Number(agentCountRows[0]?.total ?? 0),
        quizCount: Number(quizCountRows[0]?.total ?? 0),
        averageQuizScore: quizCountRows[0]?.avg_score ? Math.round(Number(quizCountRows[0].avg_score)) : null,
        weakPoints: masteryRows.map((row) => ({
          label: row.knowledge_point_label,
          score: Math.round(Number(row.score) * 100),
        })),
      },
    }
  })

  app.post("/v1/profile/digital-twin/chat", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const locale = resolveLocale(request)
    const message = String(request.body?.message || "").trim()
    if (!message) return reply.code(400).send({ error: "message_required" })
    const deepseekKey = process.env.DEEPSEEK_API_KEY || ""
    if (!deepseekKey) return reply.code(503).send({
      error: "deepseek_not_configured",
      message: locale === "en"
        ? "The language model is not configured. The mentor can show structured diagnostics, but free-form chat is unavailable."
        : "当前未配置大模型，学习导师可展示结构化诊断，但暂不能进行自由对话。",
    })

    // Gather learning context — enhanced with quiz review data
    const [agentRows, quizRows, masteryRows, profileRow, lastWrongReport] = await Promise.all([
      db.execute(
        "SELECT m.content, m.role FROM agent_messages_index i JOIN agent_sessions s ON s.id=i.session_id JOIN memory_messages m ON m.id=i.memory_message_id WHERE i.user_id=? AND i.role IN ('user','assistant') AND i.status='SUCCEEDED' ORDER BY m.created_at DESC LIMIT 8", [user.id],
      ).then(([rows]) => rows),
      db.execute(
        "SELECT qs.title, qa.score, qa.total FROM adaptive_quiz_sessions qs LEFT JOIN adaptive_quiz_attempts qa ON qa.id=qs.id WHERE qs.user_id=? AND qs.status='SUBMITTED' ORDER BY qs.submitted_at DESC LIMIT 5", [user.id],
      ).then(([rows]) => rows),
      db.execute(
        "SELECT knowledge_point_label, score FROM adaptive_knowledge_mastery WHERE user_id=? ORDER BY score ASC LIMIT 8", [user.id],
      ).then(([rows]) => rows),
      db.execute(
        "SELECT aspiration, desired_skills, future_identity FROM user_profiles WHERE user_id=? LIMIT 1", [user.id],
      ).then(([rows]) => rows),
      db.execute(
        "SELECT report_json FROM adaptive_quiz_sessions WHERE user_id=? AND status='SUBMITTED' ORDER BY submitted_at DESC LIMIT 1", [user.id],
      ).then(([rows]) => rows),
    ])

    const profile = profileRow[0] ?? {}
    const noneText = locale === "en" ? "None" : "无"
    const agentCtx = agentRows.map((r) => `${r.role === "user" ? (locale === "en" ? "Learner" : "学生") : "Agent"}: ${String(r.content).slice(0, 100)}`).join("\n") || noneText
    const quizCtx = quizRows.map((r, i) => {
      const t = String(r.title || "").replace(/^[a-z_]+[\s·\-]+/, "").slice(0, 30)
      return locale === "en" ? `Quiz ${i+1} "${t}" ${r.score}/${r.total}` : `Quiz${i+1}「${t}」${r.score}/${r.total}分`
    }).join(locale === "en" ? "; " : "；") || noneText

    // Detailed wrong-question review from last quiz
    let wrongDetail = locale === "en" ? "No wrong-answer record yet" : "暂无错题记录"
    const lr = lastWrongReport[0]?.report_json
    if (lr) {
      try {
        const report = typeof lr === "string" ? JSON.parse(lr) : lr
        const wrongs = (report?.items || []).filter(item => !item.correct)
        if (wrongs.length) {
          wrongDetail = wrongs.slice(0, 5).map((w, i) =>
            locale === "en"
              ? `${i+1}. [${w.knowledgePointLabel || "knowledge point"}] ${String(w.stem).slice(0, 60)} -> learner chose ${Array.isArray(w.userAnswer) ? w.userAnswer.join(",") : w.userAnswer}; correct answer ${Array.isArray(w.correctAnswer) ? w.correctAnswer.join(",") : w.correctAnswer}. ${String(w.analysis || "").slice(0, 80)}`
              : `${i+1}. [${w.knowledgePointLabel || "知识点"}] ${String(w.stem).slice(0, 60)} → 选${Array.isArray(w.userAnswer) ? w.userAnswer.join(",") : w.userAnswer}，正解${Array.isArray(w.correctAnswer) ? w.correctAnswer.join(",") : w.correctAnswer}。${String(w.analysis || "").slice(0, 80)}`
          ).join("\n")
        }
      } catch(e) {}
    }

    const weakCtx = masteryRows.map((r) => `${r.knowledge_point_label}(${Math.round(r.score * 100)}%)`).join(", ") || noneText

    const systemPrompt = locale === "en"
      ? `You are an AI learning mentor speaking as a warm, practical teacher.
Use the learner's Quiz results, wrong answers, Agent conversations, Step granularity, and learning records. Never expose backend table names, API names, hash-chain fields, database structures, or internal implementation details.

Language rule: answer entirely in English. Do not mix Chinese, except for unavoidable course names, code, API names, hardware model names, or proper nouns.

Response rules:
1. Start with the main judgment in one short sentence.
2. Explain the evidence in student-friendly language.
3. Give 1-3 concrete next actions.
4. Use Markdown. Bold the key point. Use a real table only when it improves clarity.
5. If the learner asks for practice, provide exactly 3 objective questions with answers and explanations.
6. Keep the answer concise unless the learner asks for details.

Learner context:
- Goal: ${profile.aspiration || "Not provided"}
- Skills to improve: ${profile.desired_skills || "Not provided"}
- Recent Agent conversation: ${agentCtx}
- Quiz records: ${quizCtx}
- Weak knowledge points: ${weakCtx}
- Recent wrong answers:
${wrongDetail}`
      : `你是一位教师型 AI 学习导师，语气温和、清晰、具体。
你可以参考学生的 Quiz、错题、Agent 提问、Step 分层和学习记录，但绝不能把后端表名、接口名、哈希链字段、数据库结构或内部实现细节暴露给用户。

语言规则：只使用简体中文。除代码、API 名称、硬件型号和专有名词外，不要夹杂英文。

回答规则：
1. 先用一句话给出核心判断。
2. 再用学生能看懂的话解释依据。
3. 给出 1-3 个具体下一步。
4. 使用 Markdown；重点用加粗；只有确实更清楚时才用表格。
5. 如果用户要巩固题，给 3 道客观题，并附答案和解析。
6. 除非用户要求展开，否则保持简洁。

学生数据摘要：
- 目标：${profile.aspiration || "暂未填写"}
- 想提升：${profile.desired_skills || "暂未填写"}
- 最近 Agent 对话：${agentCtx}
- Quiz 记录：${quizCtx}
- 薄弱知识点：${weakCtx}
- 最近 Quiz 错题：
${wrongDetail}`

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25000)
      const dsResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const dsData = await dsResp.json()
      const answer = dsData.choices?.[0]?.message?.content?.trim() || ""
      if (!answer) throw new Error("empty response")

      const convId = randomUUID()
      const msgId = randomUUID()
      await db.execute(
        "INSERT INTO memory_conversations (id, user_id, scope_type, scope_ref, metadata_json) VALUES (?, ?, 'digital_twin_chat', ?, ?) ON DUPLICATE KEY UPDATE updated_at=CURRENT_TIMESTAMP(3)",
        [convId, user.id, user.id, JSON.stringify({ source: "deepseek_chat" })],
      )
      await db.execute(
        "INSERT INTO memory_messages (id, conversation_id, role, content, metadata_json) VALUES (?, ?, ?, ?, ?)",
        [msgId, convId, "user", message, JSON.stringify({})],
      )
      const replyMsgId = randomUUID()
      await db.execute(
        "INSERT INTO memory_messages (id, conversation_id, role, content, metadata_json) VALUES (?, ?, 'assistant', ?, ?)",
        [replyMsgId, convId, answer, JSON.stringify({ model: "deepseek-chat" })],
      )

      return { answer, conversationId: convId }
    } catch (err) {
      return reply.code(502).send({ error: "deepseek_call_failed", detail: String(err.message).slice(0, 200) })
    }
  })


  app.post("/v1/evidence", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const fields = {}
    let upload = null
    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          const chunks = []
          let size = 0
          for await (const chunk of part.file) {
            size += chunk.length
            if (size > MAX_EVIDENCE_BYTES) return invalid(reply, "file_too_large", 413)
            chunks.push(chunk)
          }
          upload = {
            buffer: Buffer.concat(chunks),
            fileName: cleanFileName(part.filename),
            mimeType: String(part.mimetype || "application/octet-stream").slice(0, 190),
          }
        } else {
          fields[part.fieldname] = part.value
        }
      }
    } catch (error) {
      if (error?.code === "FST_REQ_FILE_TOO_LARGE") return invalid(reply, "file_too_large", 413)
      throw error
    }
    if (!upload) return invalid(reply, "file_required")
    const trackId = String(fields.routeId ?? "")
    const routeStepId = String(fields.routeStepId ?? "")
    const node = await ownedNode(db, user.id, trackId, routeStepId)
    if (!node) return invalid(reply, "route_step_not_owned", 403)
    const lessonId = Number(fields.lessonId)
    const stepId = Number(fields.stepId)
    if (!Number.isInteger(stepId) || stepId <= 0 || lessonId !== Number(node.lesson_id)) {
      return invalid(reply, "evidence_context_not_owned", 403)
    }
    const id = randomUUID()
    const sha256 = createHash("sha256").update(upload.buffer).digest("hex")
    const objectKey = `users/${user.id}/evidence/${trackId}/${routeStepId}/${id}-${upload.fileName}`
    await objectStore.client.putObject(
      objectStore.bucket,
      objectKey,
      upload.buffer,
      upload.buffer.length,
      { "Content-Type": upload.mimeType },
    )
    try {
      await db.execute(
        `INSERT INTO user_evidence_files
         (id, user_id, track_id, route_step_id, course_id, lesson_id, step_id,
          file_name, mime_type, file_size, sha256, object_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, user.id, trackId, routeStepId, node.course_id, lessonId, stepId,
          upload.fileName, upload.mimeType, upload.buffer.length, sha256, objectKey],
      )
    } catch (error) {
      await objectStore.client.removeObject(objectStore.bucket, objectKey).catch(() => undefined)
      throw error
    }
    await appendIntegrityRecord(db, {
      userId: user.id, sourceType: "evidence", sourceId: id, occurredAt: new Date(),
      payload: { trackId, routeStepId, courseId: node.course_id, lessonId, stepId, fileName: upload.fileName, mimeType: upload.mimeType, fileSize: upload.buffer.length, sha256 },
    })
    return reply.code(201).send({
      id,
      stepId,
      fileName: upload.fileName,
      fileType: upload.mimeType,
      fileSize: upload.buffer.length,
      uploadedAt: new Date().toISOString(),
    })
  })



  app.post("/v1/teacher-learning-plans", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    await db.execute(`CREATE TABLE IF NOT EXISTS teacher_learning_plans (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      focus_label VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      plan_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_teacher_learning_plans_user_created (user_id, created_at),
      INDEX idx_teacher_learning_plans_user_status (user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    const body = request.body || {}
    const id = randomUUID()
    const plan = {
      sourceTaskId: String(body.sourceTaskId || '').slice(0, 128),
      title: String(body.title || '间隔复习计划').slice(0, 255),
      focusLabel: String(body.focusLabel || body.focus || '当前复习重点').slice(0, 255),
      rows: Array.isArray(body.rows) ? body.rows.slice(0, 12) : [],
      basis: Array.isArray(body.basis) ? body.basis.slice(0, 8) : [],
      createdAt: new Date().toISOString(),
    }
    await db.execute(
      `INSERT INTO teacher_learning_plans (id, user_id, title, focus_label, status, plan_json)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [id, user.id, plan.title, plan.focusLabel, JSON.stringify(plan)],
    )
    await appendIntegrityRecord(db, {
      userId: user.id, sourceType: 'teacher_learning_plan', sourceId: id, occurredAt: new Date(),
      payload: { title: plan.title, focusLabel: plan.focusLabel, rows: plan.rows.length },
    }).catch(() => undefined)
    return reply.code(201).send({ id, status: 'active', ...plan })
  })

  app.get("/v1/teacher-learning-plans", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    await db.execute(`CREATE TABLE IF NOT EXISTS teacher_learning_plans (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      focus_label VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      plan_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_teacher_learning_plans_user_created (user_id, created_at),
      INDEX idx_teacher_learning_plans_user_status (user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    const limit = safeLimit(request.query?.limit, 5, 20)
    const [rows] = await db.execute(
      `SELECT id, title, focus_label, status, plan_json, created_at, updated_at
       FROM teacher_learning_plans WHERE user_id=? ORDER BY created_at DESC LIMIT ${Number(limit)}`,
      [user.id],
    )
    return { items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      focusLabel: row.focus_label,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      ...jsonValue(row.plan_json, {}),
    })) }
  })

  app.post("/v1/teacher-task-attempts", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    await db.execute(`CREATE TABLE IF NOT EXISTS teacher_task_attempts (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      task_type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      label VARCHAR(255) NULL,
      score INT UNSIGNED NOT NULL DEFAULT 0,
      total INT UNSIGNED NOT NULL DEFAULT 0,
      detail_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_teacher_task_attempts_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    const body = request.body || {}
    const id = randomUUID()
    const detail = {
      taskId: String(body.taskId || "").slice(0, 128),
      taskType: String(body.taskType || "teacher_task").slice(0, 64),
      label: String(body.label || body.title || "答题记录").slice(0, 255),
      score: Math.max(0, Number(body.score) || 0),
      total: Math.max(0, Number(body.total) || 0),
      questions: Array.isArray(body.questions) ? body.questions.slice(0, 20) : [],
      createdAt: new Date().toISOString(),
    }
    await db.execute(
      `INSERT INTO teacher_task_attempts (id, user_id, task_type, title, label, score, total, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, detail.taskType, String(body.title || body.label || "数字导师答题").slice(0,255), detail.label, detail.score, detail.total, JSON.stringify(detail)],
    )
    await appendIntegrityRecord(db, {
      userId: user.id, sourceType: "teacher_task_attempt", sourceId: id, occurredAt: new Date(),
      payload: { taskType: detail.taskType, label: detail.label, score: detail.score, total: detail.total },
    }).catch(() => undefined)
    return reply.code(201).send({ id, ...detail })
  })

  app.get("/v1/teacher-task-attempts", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    await db.execute(`CREATE TABLE IF NOT EXISTS teacher_task_attempts (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      task_type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      label VARCHAR(255) NULL,
      score INT UNSIGNED NOT NULL DEFAULT 0,
      total INT UNSIGNED NOT NULL DEFAULT 0,
      detail_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_teacher_task_attempts_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
    const limit = safeLimit(request.query?.limit, 20, 50)
    const [rows] = await db.execute(
      `SELECT id, task_type, title, label, score, total, detail_json, created_at
       FROM teacher_task_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT ${Number(limit)}`,
      [user.id],
    )
    return { items: rows.map((row) => ({
      id: row.id,
      taskType: row.task_type,
      title: row.title,
      label: row.label,
      score: Number(row.score),
      total: Number(row.total),
      createdAt: new Date(row.created_at).toISOString(),
      ...jsonValue(row.detail_json, {}),
    })) }
  })

  app.get("/v1/evidence/:evidenceId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute(
      `SELECT file_name, mime_type, object_key, storage_status
       FROM user_evidence_files WHERE id=? AND user_id=? LIMIT 1`,
      [request.params.evidenceId, user.id],
    )
    const row = rows[0]
    if (!row || row.storage_status !== "STORED" || !row.object_key) {
      return invalid(reply, "evidence_not_found", 404)
    }
    try {
      const stream = await objectStore.client.getObject(objectStore.bucket, row.object_key)
      reply.header("content-type", row.mime_type || "application/octet-stream")
      reply.header("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`)
      reply.header("cache-control", "private, no-store")
      return reply.send(stream)
    } catch {
      return invalid(reply, "evidence_object_unavailable", 404)
    }
  })
}
