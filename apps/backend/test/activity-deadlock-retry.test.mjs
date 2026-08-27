import test from "node:test"
import assert from "node:assert/strict"
import { executeActivityBatch } from "../activity-routes.mjs"

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function event(eventId, sessionId = "session-1") {
  return {
    eventId,
    sessionId,
    tabId: "tab-1",
    eventName: "click",
    pagePath: "/personalized-secure",
    trackId: null,
    routeStepId: null,
    lessonId: null,
    stepId: null,
    componentId: "test-component",
    actionTarget: "test-target",
    elementType: "button",
    normalizedX: 0.5,
    normalizedY: 0.5,
    viewportWidth: 1280,
    viewportHeight: 720,
    scrollX: 0,
    scrollY: 0,
    isVisible: true,
    isFocused: true,
    isIdle: false,
    clientOccurredAt: new Date("2026-08-12T00:00:00.000Z"),
    activeMs: 100,
    idleMs: 0,
    payload: {},
  }
}

function deadlock(overrides = {}) {
  return Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK", errno: 1213, sqlState: "40001" }, overrides)
}

class ActivityTransactionDb {
  constructor(options = {}) {
    this.state = {
      sessions: options.sessions || {},
      raw: options.raw || [],
      integrity: options.integrity || [],
      globalHead: options.globalHead || { sequence: 0, hash: null },
    }
    this.failures = options.failures || []
    this.onRollback = options.onRollback || null
    this.connections = 0
    this.begins = 0
    this.commits = 0
    this.rollbacks = 0
    this.releases = 0
    this.rawInsertAttempts = []
  }

  async getConnection() {
    const db = this
    const connectionAttempt = ++db.connections
    let working = null
    let failureThrown = false
    let headReads = 0
    return {
      async beginTransaction() {
        db.begins += 1
        working = clone(db.state)
      },
      async execute(sql, params = []) {
        if (sql.includes("INSERT IGNORE INTO user_activity_sessions")) {
          const key = `${params[1]}:${params[0]}`
          working.sessions[key] ||= { sequence: 0, hash: null }
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("SELECT id FROM user_raw_interaction_events")) {
          const found = working.raw.find((item) => item.userId === params[0] && item.clientEventId === params[1])
          return [found ? [{ id: found.id }] : []]
        }
        if (sql.includes("SELECT last_sequence, last_event_hash FROM user_activity_sessions")) {
          const head = working.sessions[`${params[0]}:${params[1]}`]
          return [[{ last_sequence: head.sequence, last_event_hash: head.hash }]]
        }
        if (sql.includes("INSERT INTO user_raw_interaction_events")) {
          const inserted = {
            id: params[0], userId: params[1], clientEventId: params[2], sessionId: params[3],
            sequence: params[5], previousHash: params[26], hash: params[27],
          }
          db.rawInsertAttempts.push({ attempt: connectionAttempt, ...inserted })
          working.raw.push(inserted)
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("INSERT IGNORE INTO event_integrity_heads")) return [{ affectedRows: 0 }]
        if (sql.includes("SELECT id,event_hash,sequence_no FROM event_integrity_records")) {
          const found = working.integrity.find((item) => item.sourceType === params[0] && item.sourceId === params[1])
          return [found ? [{ id: found.id, event_hash: found.hash, sequence_no: found.sequence }] : []]
        }
        if (sql.includes("SELECT last_sequence,last_event_hash FROM event_integrity_heads")) {
          const failure = db.failures[connectionAttempt - 1]
          headReads += 1
          if (failure && !failureThrown && headReads === (failure.throwOnHeadRead || 1)) {
            failureThrown = true
            throw failure
          }
          return [[{ last_sequence: working.globalHead.sequence, last_event_hash: working.globalHead.hash }]]
        }
        if (sql.includes("INSERT INTO event_integrity_records")) {
          working.integrity.push({
            id: params[0], userId: params[1], sequence: params[2], sourceType: params[3], sourceId: params[4],
            canonicalJson: params[5], previousHash: params[6], hash: params[7], occurredAt: params[8],
          })
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("UPDATE event_integrity_heads")) {
          working.globalHead = { sequence: params[0], hash: params[1] }
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("UPDATE user_activity_sessions SET")) {
          working.sessions[`${params[6]}:${params[7]}`] = { sequence: params[0], hash: params[1] }
          return [{ affectedRows: 1 }]
        }
        throw new Error(`unexpected_sql:${sql}`)
      },
      async commit() {
        db.commits += 1
        db.state = working
        working = null
      },
      async rollback() {
        db.rollbacks += 1
        working = null
        db.onRollback?.(connectionAttempt, db.state)
      },
      release() {
        db.releases += 1
      },
    }
  }
}

const noWait = async () => {}

test("normal batch uses one transaction without retry", async () => {
  const db = new ActivityTransactionDb()
  const results = await executeActivityBatch(db, "user-1", [event("event-1"), event("event-2")], { waitForRetry: noWait })

  assert.equal(results.length, 2)
  assert.equal(db.connections, 1)
  assert.equal(db.begins, 1)
  assert.equal(db.commits, 1)
  assert.equal(db.rollbacks, 0)
  assert.equal(db.releases, 1)
  assert.equal(db.state.raw.length, 2)
  assert.equal(db.state.integrity.length, 2)
})

test("first deadlock rolls back and retries the complete batch on a new connection", async () => {
  const delayedDeadlock = deadlock({ throwOnHeadRead: 2 })
  const db = new ActivityTransactionDb({ failures: [delayedDeadlock] })
  const delays = []
  const results = await executeActivityBatch(db, "user-1", [event("event-1"), event("event-2")], {
    waitForRetry: async (ms) => delays.push(ms),
  })

  assert.equal(results.length, 2)
  assert.equal(db.connections, 2)
  assert.equal(db.begins, 2)
  assert.equal(db.rollbacks, 1)
  assert.equal(db.commits, 1)
  assert.equal(db.releases, 2)
  assert.equal(delays.length, 1)
  assert.ok(delays[0] >= 25 && delays[0] < 50)
  assert.deepEqual(db.state.raw.map((item) => item.clientEventId), ["event-1", "event-2"])
  assert.equal(db.state.integrity.length, 2)
  assert.equal(db.rawInsertAttempts.filter((item) => item.attempt === 1).length, 2)
})

test("two transient deadlocks succeed on the third total attempt", async () => {
  const errnoOnly = Object.assign(new Error("deadlock_errno"), { errno: 1213 })
  const sqlStateOnly = Object.assign(new Error("serialization"), { sqlState: "40001" })
  const db = new ActivityTransactionDb({ failures: [errnoOnly, sqlStateOnly] })
  const delays = []

  await executeActivityBatch(db, "user-1", [event("event-1")], { waitForRetry: async (ms) => delays.push(ms) })

  assert.equal(db.connections, 3)
  assert.equal(db.rollbacks, 2)
  assert.equal(db.commits, 1)
  assert.equal(db.releases, 3)
  assert.equal(db.state.raw.length, 1)
  assert.equal(delays.length, 2)
  assert.ok(delays[0] >= 25 && delays[0] < 50)
  assert.ok(delays[1] >= 50 && delays[1] < 75)
})

test("three deadlocks exhaust retries without a partial commit", async () => {
  const db = new ActivityTransactionDb({ failures: [deadlock(), deadlock(), deadlock()] })

  await assert.rejects(
    executeActivityBatch(db, "user-1", [event("event-1"), event("event-2")], { waitForRetry: noWait }),
    (error) => error.code === "ER_LOCK_DEADLOCK",
  )

  assert.equal(db.connections, 3)
  assert.equal(db.rollbacks, 3)
  assert.equal(db.commits, 0)
  assert.equal(db.releases, 3)
  assert.equal(db.state.raw.length, 0)
  assert.equal(db.state.integrity.length, 0)
})

test("non-retryable SQL error fails after one rolled-back attempt", async () => {
  const sqlError = Object.assign(new Error("syntax error"), { code: "ER_PARSE_ERROR", errno: 1064, sqlState: "42000" })
  const db = new ActivityTransactionDb({ failures: [sqlError] })

  await assert.rejects(
    executeActivityBatch(db, "user-1", [event("event-1")], { waitForRetry: noWait }),
    (error) => error === sqlError,
  )

  assert.equal(db.connections, 1)
  assert.equal(db.rollbacks, 1)
  assert.equal(db.commits, 0)
  assert.equal(db.releases, 1)
})

test("retry re-reads session and global heads before recalculating hashes", async () => {
  const db = new ActivityTransactionDb({
    sessions: { "user-1:session-1": { sequence: 2, hash: "session-old" } },
    globalHead: { sequence: 4, hash: "global-old" },
    failures: [deadlock()],
    onRollback(attempt, state) {
      if (attempt !== 1) return
      state.sessions["user-1:session-1"] = { sequence: 7, hash: "session-new" }
      state.globalHead = { sequence: 9, hash: "global-new" }
    },
  })

  await executeActivityBatch(db, "user-1", [event("event-1")], { waitForRetry: noWait })

  assert.deepEqual(db.rawInsertAttempts.map((item) => [item.attempt, item.sequence, item.previousHash]), [
    [1, 3, "session-old"],
    [2, 8, "session-new"],
  ])
  assert.notEqual(db.rawInsertAttempts[0].hash, db.rawInsertAttempts[1].hash)
  assert.equal(db.state.sessions["user-1:session-1"].sequence, 8)
  assert.equal(db.state.integrity[0].sequence, 10)
  assert.equal(db.state.integrity[0].previousHash, "global-new")
  assert.equal(JSON.parse(db.state.integrity[0].canonicalJson).sequence, 10)
})

test("existing client event remains idempotent after retry support", async () => {
  const db = new ActivityTransactionDb()
  await executeActivityBatch(db, "user-1", [event("event-1")], { waitForRetry: noWait })
  const second = await executeActivityBatch(db, "user-1", [event("event-1")], { waitForRetry: noWait })

  assert.equal(second[0].duplicate, true)
  assert.equal(db.state.raw.length, 1)
  assert.equal(db.state.integrity.length, 1)
  assert.equal(db.state.globalHead.sequence, 1)
  assert.equal(db.commits, 2)
})
