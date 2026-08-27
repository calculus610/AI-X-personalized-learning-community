import { createHash, randomUUID } from "node:crypto"

function jsonValue(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value === "string") { try { return JSON.parse(value) } catch { return fallback } }
  return typeof value === "object" ? value : fallback
}

function iso(value) { return value ? new Date(value).toISOString() : null }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

async function adminFor(request, reply, db) {
  try { await request.jwtVerify() } catch { reply.code(401).send({ error: "unauthorized" }); return null }
  const [rows] = await db.execute("SELECT id,username,display_name,role,status FROM users WHERE id=? LIMIT 1", [request.user.sub])
  const user = rows[0]
  if (!user || user.status !== "active" || user.role !== "admin") {
    reply.code(403).send({ error: "admin_required" }); return null
  }
  return user
}

async function audit(db, adminId, targetUserId, actionName, request, payload = {}) {
  await db.execute(
    "INSERT INTO admin_audit_events (id,admin_user_id,target_user_id,action_name,request_id,payload_json) VALUES (?,?,?,?,?,?)",
    [randomUUID(), adminId, targetUserId || null, actionName, request.id || null, JSON.stringify(payload)],
  )
}

function bounds(query) {
  const to = query?.to ? new Date(query.to) : new Date()
  const from = query?.from ? new Date(query.from) : new Date(to.getTime() - 7 * 86400000)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) throw new Error("time_range_invalid")
  if (to.getTime() - from.getTime() > 366 * 86400000) throw new Error("time_range_too_large")
  return { from, to }
}

async function loadMemoryMessages(memoryDb, ids) {
  const result = new Map()
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200)
    if (!chunk.length) continue
    const placeholders = chunk.map(() => "?").join(",")
    const [rows] = await memoryDb.execute(
      `SELECT id,conversation_id,role,content,content_summary,metadata_json,created_at FROM memory_messages WHERE id IN (${placeholders})`, chunk,
    )
    for (const row of rows) result.set(row.id, row)
  }
  return result
}

export async function buildTimeline(db, memoryDb, userId, from, to, limit, includeAgentContent) {
  const common = [userId, from, to]
  const safeLimit = Math.min(50000, Math.max(1, Number.parseInt(limit, 10) || 50000))
  const [rawRows] = await db.execute(
    `SELECT * FROM user_raw_interaction_events WHERE user_id=? AND occurred_at BETWEEN ? AND ?
     ORDER BY occurred_at,id LIMIT ${safeLimit}`, common,
  )
  const [semanticRows] = await db.execute(
    `SELECT * FROM user_learning_events WHERE user_id=? AND occurred_at BETWEEN ? AND ?
     ORDER BY occurred_at,id LIMIT ${safeLimit}`, common,
  )
  const [evidenceRows] = await db.execute(
    `SELECT * FROM user_evidence_files WHERE user_id=? AND uploaded_at BETWEEN ? AND ?
     ORDER BY uploaded_at,id LIMIT ${safeLimit}`, common,
  )
  const [agentEventRows] = await db.execute(
    `SELECT ae.*,s.track_id,s.route_step_id,s.course_id,s.module_id,s.stage_id,s.agent_id
     FROM agent_events ae JOIN agent_sessions s ON s.id=ae.session_id
     WHERE ae.user_id=? AND ae.occurred_at BETWEEN ? AND ? ORDER BY ae.occurred_at,ae.id LIMIT ${safeLimit}`, common,
  )
  const [agentMessageRows] = includeAgentContent ? await db.execute(
    `SELECT mi.*,s.track_id,s.route_step_id,s.course_id,s.module_id,s.stage_id,s.agent_id,s.conversation_id
     FROM agent_messages_index mi JOIN agent_sessions s ON s.id=mi.session_id
     WHERE mi.user_id=? AND mi.created_at BETWEEN ? AND ? ORDER BY mi.created_at,mi.id LIMIT ${safeLimit}`, common,
  ) : [[]]
  const [integrityRows] = await db.execute(
    `SELECT sequence_no,source_type,source_id,canonical_payload_json,previous_event_hash,event_hash,occurred_at
     FROM event_integrity_records WHERE user_id=? AND occurred_at BETWEEN ? AND ? ORDER BY sequence_no LIMIT ${safeLimit}`, common,
  )
  const integrityBySource = new Map(integrityRows.map((row) => [`${row.source_type}:${row.source_id}`, {
    sequence: Number(row.sequence_no), sourceType: row.source_type, sourceId: row.source_id,
    previousHash: row.previous_event_hash, hash: row.event_hash,
    canonicalPayload: jsonValue(row.canonical_payload_json), occurredAt: iso(row.occurred_at),
  }]))
  const memory = await loadMemoryMessages(memoryDb, agentMessageRows.map((row) => row.memory_message_id))

  const events = [
    ...rawRows.map((row) => ({
      id: row.id, source: "raw_interaction", eventName: row.event_name, occurredAt: iso(row.occurred_at),
      clientOccurredAt: iso(row.client_occurred_at), sessionId: row.session_id, sequence: Number(row.sequence_no),
      context: { pagePath: row.page_path, trackId: row.track_id, routeStepId: row.route_step_id, lessonId: row.lesson_id == null ? null : Number(row.lesson_id), stepId: row.step_id == null ? null : Number(row.step_id) },
      interaction: { componentId: row.component_id, actionTarget: row.action_target, elementType: row.element_type,
        normalizedX: row.normalized_x == null ? null : Number(row.normalized_x), normalizedY: row.normalized_y == null ? null : Number(row.normalized_y),
        viewport: [row.viewport_width, row.viewport_height], scroll: [row.scroll_x,row.scroll_y], visible: Boolean(row.is_visible), focused: Boolean(row.is_focused), idle: Boolean(row.is_idle) },
      payload: jsonValue(row.payload_json), rawSessionIntegrity: { previousHash: row.previous_event_hash, hash: row.event_hash, schemaVersion: Number(row.schema_version) },
    })),
    ...semanticRows.map((row) => ({
      id: row.id, source: "learning", eventName: row.event_name, occurredAt: iso(row.occurred_at), clientOccurredAt: iso(row.client_occurred_at), sessionId: row.session_id,
      context: { trackId: row.track_id, routeStepId: row.route_step_id, lessonId: row.lesson_id == null ? null : Number(row.lesson_id), stepId: row.step_id == null ? null : Number(row.step_id) }, payload: jsonValue(row.payload_json),
    })),
    ...evidenceRows.map((row) => ({
      id: row.id, source: "evidence", eventName: "evidence_file_stored", occurredAt: iso(row.uploaded_at),
      context: { trackId: row.track_id, routeStepId: row.route_step_id, courseId: row.course_id, lessonId: Number(row.lesson_id), stepId: Number(row.step_id) },
      evidence: { fileName: row.file_name, mimeType: row.mime_type, fileSize: Number(row.file_size), sha256: row.sha256, storageStatus: row.storage_status },
    })),
    ...agentEventRows.map((row) => ({
      id: row.id, source: "agent_event", eventName: row.event_name, occurredAt: iso(row.occurred_at), sessionId: row.session_id,
      context: { trackId: row.track_id, routeStepId: row.route_step_id, courseId: row.course_id, moduleId: row.module_id, stageId: row.stage_id, agentId: row.agent_id }, payload: jsonValue(row.payload_json),
    })),
    ...agentMessageRows.map((row) => {
      const message = memory.get(row.memory_message_id)
      return { id: row.id, source: "agent_message", eventName: row.role === "user" ? "agent_question" : "agent_answer", occurredAt: iso(message?.created_at || row.created_at), sessionId: row.session_id,
        context: { trackId: row.track_id, routeStepId: row.route_step_id, courseId: row.course_id, moduleId: row.module_id, stageId: row.stage_id, agentId: row.agent_id },
        message: { role: row.role, content: message?.content ?? null, contentSummary: message?.content_summary ?? null, status: row.status, memoryMessageId: row.memory_message_id },
      }
    }),
  ].sort((a,b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)).slice(0, safeLimit)
  for (const event of events) event.integrity = integrityBySource.get(`${event.source}:${event.id}`) || null
  let previous = null
  for (const event of events) {
    event.sincePreviousMs = previous ? Math.max(0, Date.parse(event.occurredAt) - Date.parse(previous.occurredAt)) : 0
    event.noiseClassification = null
    if (event.source === "raw_interaction") {
      if (event.eventName === "heartbeat") event.noiseClassification = "periodic_heartbeat"
      else if (["window_focused","window_blurred","visibility_changed"].includes(event.eventName)) event.noiseClassification = "browser_state_transition"
      else if (["idle_started","idle_ended"].includes(event.eventName)) event.noiseClassification = "derived_activity_state"
      else if (event.eventName === "click" && !event.interaction?.actionTarget && !event.interaction?.componentId) event.noiseClassification = "unlabelled_click"
      else if (event.eventName === "click" && previous?.eventName === "click" && event.sincePreviousMs < 350
        && event.interaction?.actionTarget === previous.interaction?.actionTarget) event.noiseClassification = "possible_repeat_click"
    }
    previous = event
  }
  return events
}

const CAREER_PREFERENCE_CHANGED = "career_preference_changed"

function careerSemanticIntegrityIssues(event, integrity) {
  const canonical = jsonValue(integrity.canonicalPayload, {})
  const semanticPayload = jsonValue(event.payload, {})
  const protectedPayload = jsonValue(canonical.payload, {})
  if (event.eventName !== CAREER_PREFERENCE_CHANGED && protectedPayload.eventName !== CAREER_PREFERENCE_CHANGED) return []

  const issues = []
  const mismatch = (field) => issues.push({
    eventId: event.id,
    reason: "career_semantic_payload_mismatch",
    sequence: integrity.sequence,
    sourceId: integrity.sourceId ?? event.id,
    eventName: CAREER_PREFERENCE_CHANGED,
    mismatchField: field,
  })

  if (event.source !== "learning") mismatch("eventSource")
  if (integrity.sourceType !== "learning") mismatch("integritySourceType")
  if (integrity.sourceId !== event.id) mismatch("integritySourceId")
  if (canonical.sourceType !== "learning") mismatch("canonicalSourceType")
  if (canonical.sourceId !== event.id) mismatch("canonicalSourceId")
  if (event.eventName !== protectedPayload.eventName) mismatch("eventName")
  for (const field of ["previousCareerId", "careerId", "source"]) {
    if (semanticPayload[field] !== protectedPayload[field]) mismatch(field)
  }
  return issues
}

export function verifyIntegrityChain(events) {
  const chained = events.filter((event) => event.integrity).sort((a,b) => a.integrity.sequence - b.integrity.sequence)
  const issues = []
  for (let index = 0; index < chained.length; index += 1) {
    const event = chained[index], integrity = event.integrity
    const canonicalJson = JSON.stringify(stable(integrity.canonicalPayload))
    const expected = createHash("sha256").update(`${integrity.previousHash || "GENESIS"}|${canonicalJson}`, "utf8").digest("hex")
    if (expected !== integrity.hash) issues.push({ eventId: event.id, reason: "event_hash_mismatch" })
    issues.push(...careerSemanticIntegrityIssues(event, integrity))
    if (index > 0 && integrity.sequence === chained[index - 1].integrity.sequence + 1 && integrity.previousHash !== chained[index - 1].integrity.hash) {
      issues.push({ eventId: event.id, reason: "chain_link_mismatch" })
    }
  }
  const uncheckedEvents = events.length - chained.length
  return {
    totalEvents: events.length,
    checkedEvents: chained.length,
    uncheckedEvents,
    coveragePercent: events.length ? Number(((chained.length / events.length) * 100).toFixed(2)) : 100,
    valid: issues.length === 0,
    complete: uncheckedEvents === 0 && issues.length === 0,
    issues,
  }
}

export function registerAdminRoutes(app, db, memoryDb) {
  app.get("/admin/users", async (request, reply) => {
    const admin = await adminFor(request, reply, db); if (!admin) return
    const limit = Math.min(200, Math.max(1, Number(request.query?.limit) || 50))
    const search = String(request.query?.search || "").slice(0,64)
    const [rows] = await db.execute(
      `SELECT id,username,display_name,role,status,created_at,last_login_at FROM users
       WHERE role='student' AND (?='' OR username LIKE CONCAT('%',?,'%') OR display_name LIKE CONCAT('%',?,'%'))
       ORDER BY created_at DESC LIMIT ?`, [search,search,search,limit],
    )
    await audit(db, admin.id, null, "admin_list_students", request, { search, limit })
    return { users: rows.map((row) => ({ ...row, created_at: iso(row.created_at), last_login_at: iso(row.last_login_at) })) }
  })

  app.get("/admin/users/:userId/timeline", async (request, reply) => {
    const admin = await adminFor(request, reply, db); if (!admin) return
    let range; try { range = bounds(request.query) } catch (error) { return reply.code(400).send({ error: error.message }) }
    const limit = Math.min(5000, Math.max(1, Number(request.query?.limit) || 1000))
    const events = await buildTimeline(db, memoryDb, request.params.userId, range.from, range.to, limit, false)
    await audit(db, admin.id, request.params.userId, "admin_view_timeline", request, { from: range.from, to: range.to, limit })
    return { userId: request.params.userId, range: { from: range.from.toISOString(), to: range.to.toISOString() }, events, integrity: verifyIntegrityChain(events) }
  })

  app.get("/admin/users/:userId/timeline/export", async (request, reply) => {
    const admin = await adminFor(request, reply, db); if (!admin) return
    let range; try { range = bounds(request.query) } catch (error) { return reply.code(400).send({ error: error.message }) }
    const limit = Math.min(50000, Math.max(1, Number(request.query?.limit) || 20000))
    const [users] = await db.execute("SELECT id,username,display_name,status,created_at FROM users WHERE id=? AND role='student' LIMIT 1", [request.params.userId])
    if (!users[0]) return reply.code(404).send({ error: "student_not_found" })
    const events = await buildTimeline(db, memoryDb, request.params.userId, range.from, range.to, limit, true)
    const exportedAt = new Date().toISOString()
    const body = { schemaVersion: "1.0", exportedAt, retentionPolicy: "2 years", student: users[0], range: { from: range.from.toISOString(), to: range.to.toISOString() }, integrity: verifyIntegrityChain(events), events }
    const digest = createHash("sha256").update(JSON.stringify(body)).digest("hex")
    await audit(db, admin.id, request.params.userId, "admin_export_timeline_json", request, { from: range.from, to: range.to, limit, eventCount: events.length, sha256: digest })
    reply.header("Content-Disposition", `attachment; filename=student-${request.params.userId}-timeline.json`)
    return { ...body, exportSha256: digest }
  })
}
