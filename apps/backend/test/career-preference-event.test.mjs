import { createHash } from "node:crypto"
import test from "node:test"
import assert from "node:assert/strict"
import { updateCareerPreference } from "../career-routes.mjs"

class TransactionDb {
  constructor(initialCareerId = null, options = {}) {
    this.profileExists = options.profileExists ?? true
    this.profile = initialCareerId
    this.profileUpdateCount = 0
    this.events = []
    this.integrity = []
    this.head = { sequence: 0, hash: null }
    this.failOn = options.failOn ?? null
    this.lockTail = Promise.resolve()
    this.rollbacks = 0
  }

  async getConnection() {
    const db = this
    let snapshot = null
    let releaseProfileLock = null
    return {
      async beginTransaction() {
        snapshot = {
          profileExists: db.profileExists,
          profile: db.profile,
          profileUpdateCount: db.profileUpdateCount,
          events: db.events.slice(),
          integrity: db.integrity.slice(),
          head: { ...db.head },
        }
      },
      async execute(sql, params = []) {
        if (sql.includes("INSERT IGNORE INTO user_profiles")) {
          if (!db.profileExists) {
            db.profileExists = true
            db.profile = null
          }
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("SELECT primary_career_id FROM user_profiles") && sql.includes("FOR UPDATE")) {
          const previousLock = db.lockTail
          db.lockTail = new Promise((resolve) => { releaseProfileLock = resolve })
          await previousLock
          return [[{ primary_career_id: db.profile }]]
        }
        if (sql.includes("UPDATE user_profiles")) {
          db.profile = params[0]
          db.profileUpdateCount += 1
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("INSERT INTO user_learning_events")) {
          if (db.failOn === "semantic") throw new Error("semantic_insert_failed")
          db.events.push({ id: params[0], userId: params[1], eventName: "career_preference_changed", payload: JSON.parse(params[2]), occurredAt: params[3] })
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("INSERT IGNORE INTO event_integrity_heads")) return [{ affectedRows: 1 }]
        if (sql.includes("SELECT id,event_hash,sequence_no FROM event_integrity_records")) {
          const found = db.integrity.find((item) => item.sourceType === params[0] && item.sourceId === params[1])
          return [found ? [{ id: found.id, event_hash: found.hash, sequence_no: found.sequence }] : []]
        }
        if (sql.includes("SELECT last_sequence,last_event_hash FROM event_integrity_heads")) {
          return [[{ last_sequence: db.head.sequence, last_event_hash: db.head.hash }]]
        }
        if (sql.includes("INSERT INTO event_integrity_records")) {
          if (db.failOn === "integrity") throw new Error("integrity_insert_failed")
          db.integrity.push({
            id: params[0], userId: params[1], sequence: params[2], sourceType: params[3], sourceId: params[4],
            canonicalJson: params[5], previousHash: params[6], hash: params[7], occurredAt: params[8],
          })
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("UPDATE event_integrity_heads")) {
          db.head = { sequence: params[0], hash: params[1] }
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("SELECT primary_career_id, career_preference_updated_at")) {
          return [[{ primary_career_id: db.profile, career_preference_updated_at: new Date(1700000000000 + db.profileUpdateCount) }]]
        }
        throw new Error(`unexpected_sql:${sql}`)
      },
      async commit() {
        releaseProfileLock?.()
        releaseProfileLock = null
      },
      async rollback() {
        db.rollbacks += 1
        if (snapshot) {
          db.profileExists = snapshot.profileExists
          db.profile = snapshot.profile
          db.profileUpdateCount = snapshot.profileUpdateCount
          db.events = snapshot.events
          db.integrity = snapshot.integrity
          db.head = snapshot.head
        }
        releaseProfileLock?.()
        releaseProfileLock = null
      },
      release() {},
    }
  }
}

test("first career selection writes profile, semantic event and integrity record", async () => {
  const db = new TransactionDb(null, { profileExists: false })
  await updateCareerPreference(db, "user-1", "career-a")

  assert.equal(db.profile, "career-a")
  assert.equal(db.events.length, 1)
  assert.deepEqual(db.events[0].payload, {
    previousCareerId: null,
    careerId: "career-a",
    source: "profile_career_preference_patch",
  })
  assert.equal(db.integrity.length, 1)
  const integrity = db.integrity[0]
  const canonical = JSON.parse(integrity.canonicalJson)
  assert.equal(integrity.sourceType, "learning")
  assert.equal(integrity.sourceId, db.events[0].id)
  assert.deepEqual(canonical.payload, {
    careerId: "career-a",
    eventName: "career_preference_changed",
    previousCareerId: null,
    source: "profile_career_preference_patch",
  })
  assert.equal(integrity.hash, createHash("sha256").update(`GENESIS|${integrity.canonicalJson}`, "utf8").digest("hex"))
})

test("career switch records the previous and new career", async () => {
  const db = new TransactionDb("career-a")
  await updateCareerPreference(db, "user-1", "career-b")

  assert.equal(db.profile, "career-b")
  assert.deepEqual(db.events.map((event) => event.payload), [{
    previousCareerId: "career-a",
    careerId: "career-b",
    source: "profile_career_preference_patch",
  }])
  assert.equal(db.integrity.length, 1)
})

test("same-state PATCH refreshes profile timestamp without creating history", async () => {
  const db = new TransactionDb("career-b")
  await updateCareerPreference(db, "user-1", "career-b")
  await updateCareerPreference(db, "user-1", "career-b")

  assert.equal(db.profile, "career-b")
  assert.equal(db.profileUpdateCount, 2)
  assert.equal(db.events.length, 0)
  assert.equal(db.integrity.length, 0)
})

test("semantic insert failure rolls back the profile update", async () => {
  const db = new TransactionDb("career-a", { failOn: "semantic" })
  await assert.rejects(updateCareerPreference(db, "user-1", "career-b"), /semantic_insert_failed/)

  assert.equal(db.profile, "career-a")
  assert.equal(db.events.length, 0)
  assert.equal(db.integrity.length, 0)
  assert.equal(db.rollbacks, 1)
})

test("integrity append failure rolls back profile and semantic event", async () => {
  const db = new TransactionDb("career-a", { failOn: "integrity" })
  await assert.rejects(updateCareerPreference(db, "user-1", "career-b"), /integrity_insert_failed/)

  assert.equal(db.profile, "career-a")
  assert.equal(db.events.length, 0)
  assert.equal(db.integrity.length, 0)
  assert.equal(db.rollbacks, 1)
})

test("concurrent career changes serialize previousCareerId history", async () => {
  const db = new TransactionDb("career-a")
  await Promise.all([
    updateCareerPreference(db, "user-1", "career-b"),
    updateCareerPreference(db, "user-1", "career-c"),
  ])

  assert.equal(db.events.length, 2)
  assert.equal(db.integrity.length, 2)
  let expectedPrevious = "career-a"
  for (const event of db.events) {
    assert.equal(event.payload.previousCareerId, expectedPrevious)
    expectedPrevious = event.payload.careerId
  }
  assert.equal(db.profile, expectedPrevious)
})
