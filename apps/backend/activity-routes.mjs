import { createHash, randomUUID } from "node:crypto"
import { userFor } from "./learning-routes.mjs"
import { appendIntegrityOnConnection } from "./integrity-chain.mjs"

const ALLOWED_EVENTS = new Set([
  "click", "heartbeat", "session_started", "session_ended", "page_entered", "page_left",
  "window_focused", "window_blurred", "visibility_changed", "idle_started", "idle_ended",
])

const ACTIVITY_TRANSACTION_ATTEMPTS = 3

function isRetryableTransactionConflict(error) {
  return error?.code === "ER_LOCK_DEADLOCK" || error?.errno === 1213 || error?.sqlState === "40001"
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelay(attempt) {
  return 25 * attempt + Math.floor(Math.random() * 25)
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

function safeText(value, max = 128) {
  return typeof value === "string" ? value.replace(/[\r\n]/g, " ").slice(0, max) : null
}

function safeInt(value, min = -2147483648, max = 2147483647) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : null
}

function safeCoordinate(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null
}

function cleanEvent(body) {
  const eventName = safeText(body.eventName, 64)
  if (!ALLOWED_EVENTS.has(eventName)) throw new Error("activity_event_invalid")
  const sessionId = safeText(body.sessionId)
  const eventId = safeText(body.eventId)
  if (!sessionId || !eventId) throw new Error("activity_identity_invalid")
  const pagePath = safeText(body.pagePath, 500) || "/"
  if (/\?|#/.test(pagePath)) throw new Error("activity_page_path_invalid")
  return {
    eventId, sessionId, tabId: safeText(body.tabId), eventName, pagePath,
    trackId: safeText(body.trackId, 36), routeStepId: safeText(body.routeStepId, 36),
    lessonId: safeInt(body.lessonId, 1, Number.MAX_SAFE_INTEGER), stepId: safeInt(body.stepId, 1, Number.MAX_SAFE_INTEGER),
    componentId: safeText(body.componentId), actionTarget: safeText(body.actionTarget),
    elementType: safeText(body.elementType, 48), normalizedX: safeCoordinate(body.normalizedX),
    normalizedY: safeCoordinate(body.normalizedY), viewportWidth: safeInt(body.viewportWidth, 0, 100000),
    viewportHeight: safeInt(body.viewportHeight, 0, 100000), scrollX: safeInt(body.scrollX), scrollY: safeInt(body.scrollY),
    isVisible: body.isVisible !== false, isFocused: body.isFocused !== false, isIdle: body.isIdle === true,
    clientOccurredAt: body.clientOccurredAt ? new Date(body.clientOccurredAt) : null,
    activeMs: safeInt(body.activeMs, 0, Number.MAX_SAFE_INTEGER) || 0,
    idleMs: safeInt(body.idleMs, 0, Number.MAX_SAFE_INTEGER) || 0,
    payload: body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {},
  }
}

async function insertOne(connection, userId, event) {
  await connection.execute(
    `INSERT IGNORE INTO user_activity_sessions
     (id, user_id, tab_id, client_started_at) VALUES (?, ?, ?, ?)` ,
    [event.sessionId, userId, event.tabId, event.clientOccurredAt],
  )
  const [duplicate] = await connection.execute(
    "SELECT id FROM user_raw_interaction_events WHERE user_id=? AND client_event_id=? LIMIT 1",
    [userId, event.eventId],
  )
  if (duplicate[0]) return { id: duplicate[0].id, duplicate: true }
  const [heads] = await connection.execute(
    "SELECT last_sequence, last_event_hash FROM user_activity_sessions WHERE user_id=? AND id=? FOR UPDATE",
    [userId, event.sessionId],
  )
  const sequence = Number(heads[0]?.last_sequence || 0) + 1
  const previousHash = heads[0]?.last_event_hash || null
  const canonical = JSON.stringify(stable({ userId, sequence, previousHash, ...event, clientOccurredAt: event.clientOccurredAt?.toISOString() || null }))
  const eventHash = createHash("sha256").update(canonical, "utf8").digest("hex")
  const id = randomUUID()
  await connection.execute(
    `INSERT INTO user_raw_interaction_events
     (id,user_id,client_event_id,session_id,tab_id,sequence_no,event_name,page_path,track_id,route_step_id,
      lesson_id,step_id,component_id,action_target,element_type,normalized_x,normalized_y,viewport_width,viewport_height,
      scroll_x,scroll_y,is_visible,is_focused,is_idle,payload_json,client_occurred_at,previous_event_hash,event_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,userId,event.eventId,event.sessionId,event.tabId,sequence,event.eventName,event.pagePath,event.trackId,event.routeStepId,
      event.lessonId,event.stepId,event.componentId,event.actionTarget,event.elementType,event.normalizedX,event.normalizedY,
      event.viewportWidth,event.viewportHeight,event.scrollX,event.scrollY,event.isVisible,event.isFocused,event.isIdle,
      JSON.stringify(event.payload),event.clientOccurredAt,previousHash,eventHash],
  )
  await appendIntegrityOnConnection(connection, {
    userId, sourceType: "raw_interaction", sourceId: id,
    occurredAt: event.clientOccurredAt,
    payload: { eventName: event.eventName, sessionId: event.sessionId, sequence, pagePath: event.pagePath, context: { trackId: event.trackId, routeStepId: event.routeStepId, lessonId: event.lessonId, stepId: event.stepId } },
  })
  const ended = event.eventName === "session_ended" || event.eventName === "page_left"
  await connection.execute(
    `UPDATE user_activity_sessions SET last_sequence=?,last_event_hash=?,last_seen_at=UTC_TIMESTAMP(3),
     active_ms=GREATEST(active_ms,?),idle_ms=GREATEST(idle_ms,?),status=?,ended_at=IF(?,UTC_TIMESTAMP(3),ended_at)
     WHERE user_id=? AND id=?`,
    [sequence,eventHash,event.activeMs,event.idleMs,ended ? "ENDED" : "ACTIVE",ended,userId,event.sessionId],
  )
  return { id, duplicate: false, sequence, eventHash }
}

export async function executeActivityBatch(db, userId, events, options = {}) {
  const waitForRetry = options.waitForRetry || wait
  let lastError = null

  for (let attempt = 1; attempt <= ACTIVITY_TRANSACTION_ATTEMPTS; attempt += 1) {
    const connection = await db.getConnection()
    let transactionStarted = false
    let shouldRetry = false
    try {
      await connection.beginTransaction()
      transactionStarted = true
      const results = []
      for (const event of events) results.push(await insertOne(connection, userId, event))
      await connection.commit()
      transactionStarted = false
      return results
    } catch (error) {
      lastError = error
      if (transactionStarted) {
        try { await connection.rollback() } catch {}
        transactionStarted = false
      }
      shouldRetry = isRetryableTransactionConflict(error) && attempt < ACTIVITY_TRANSACTION_ATTEMPTS
      if (!shouldRetry) throw error
    } finally {
      connection.release()
    }
    await waitForRetry(retryDelay(attempt))
  }

  throw lastError
}

export function registerActivityRoutes(app, db) {
  app.post("/v1/activity-events/batch", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const items = Array.isArray(request.body?.events) ? request.body.events.slice(0, 100) : []
    if (!items.length) return reply.code(400).send({ error: "activity_events_required" })
    let events
    try { events = items.map(cleanEvent) } catch (error) { return reply.code(400).send({ error: error.message }) }
    const results = await executeActivityBatch(db, user.id, events)
    return reply.code(201).send({ ok: true, accepted: results.length, results })
  })
}
