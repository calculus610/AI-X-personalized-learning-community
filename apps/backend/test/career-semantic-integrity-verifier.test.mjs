import { createHash } from "node:crypto"
import test from "node:test"
import assert from "node:assert/strict"
import { verifyIntegrityChain } from "../admin-routes.mjs"

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

function eventFixture(options = {}) {
  const id = options.id ?? "event-1"
  const eventName = options.eventName ?? "career_preference_changed"
  const semanticPayload = {
    previousCareerId: "career-a",
    careerId: "career-b",
    source: "profile_career_preference_patch",
    ...(options.semanticPayload ?? {}),
  }
  const canonicalPayload = stable({
    userId: "user-1",
    sequence: 1,
    sourceType: "learning",
    sourceId: id,
    occurredAt: "2026-08-12T00:00:00.000Z",
    payload: {
      eventName: "career_preference_changed",
      previousCareerId: "career-a",
      careerId: "career-b",
      source: "profile_career_preference_patch",
      ...(options.integrityPayload ?? {}),
    },
  })
  const canonicalJson = JSON.stringify(canonicalPayload)
  const hash = createHash("sha256").update(`GENESIS|${canonicalJson}`, "utf8").digest("hex")
  return {
    id,
    source: options.eventSource ?? "learning",
    eventName,
    payload: semanticPayload,
    integrity: {
      sequence: 1,
      sourceType: options.integritySourceType ?? "learning",
      sourceId: options.integritySourceId ?? id,
      previousHash: null,
      hash,
      canonicalPayload,
    },
  }
}

const mismatchFields = (result) => result.issues
  .filter((issue) => issue.reason === "career_semantic_payload_mismatch")
  .map((issue) => issue.mismatchField)

test("matching career semantic and canonical payload stays valid", () => {
  const result = verifyIntegrityChain([eventFixture()])
  assert.equal(result.valid, true)
  assert.deepEqual(result.issues, [])
})

test("matching first selection preserves null previousCareerId semantics", () => {
  const result = verifyIntegrityChain([eventFixture({
    semanticPayload: { previousCareerId: null },
    integrityPayload: { previousCareerId: null },
  })])
  assert.equal(result.valid, true)
  assert.deepEqual(result.issues, [])
})

test("tampered semantic careerId is invalid", () => {
  const result = verifyIntegrityChain([eventFixture({ semanticPayload: { careerId: "career-c" } })])
  assert.equal(result.valid, false)
  assert.deepEqual(mismatchFields(result), ["careerId"])
})

test("tampered semantic previousCareerId is invalid", () => {
  const result = verifyIntegrityChain([eventFixture({ semanticPayload: { previousCareerId: "career-x" } })])
  assert.equal(result.valid, false)
  assert.deepEqual(mismatchFields(result), ["previousCareerId"])
})

test("tampered semantic source is invalid", () => {
  const result = verifyIntegrityChain([eventFixture({ semanticPayload: { source: "other_source" } })])
  assert.equal(result.valid, false)
  assert.deepEqual(mismatchFields(result), ["source"])
})

test("tampered semantic event name is invalid when canonical remains career event", () => {
  const result = verifyIntegrityChain([eventFixture({ eventName: "route_opened" })])
  assert.equal(result.valid, false)
  assert.deepEqual(mismatchFields(result), ["eventName"])
})

test("tampered integrity canonical without a new hash keeps existing hash mismatch detection", () => {
  const event = eventFixture()
  event.integrity.canonicalPayload.payload.careerId = "career-c"
  const result = verifyIntegrityChain([event])
  assert.equal(result.valid, false)
  assert.ok(result.issues.some((issue) => issue.reason === "event_hash_mismatch"))
})

test("non-career learning event retains existing verifier behavior", () => {
  const event = eventFixture({
    eventName: "route_opened",
    semanticPayload: { careerId: "different-semantic-value" },
    integrityPayload: { eventName: "route_opened", careerId: "different-integrity-value" },
  })
  const result = verifyIntegrityChain([event])
  assert.equal(result.valid, true)
  assert.deepEqual(result.issues, [])
})

test("career cross-check requires the linked learning source identity", () => {
  const result = verifyIntegrityChain([eventFixture({ integritySourceId: "other-event" })])
  assert.equal(result.valid, false)
  assert.deepEqual(mismatchFields(result), ["integritySourceId"])
  const issue = result.issues[0]
  assert.equal(issue.sequence, 1)
  assert.equal(issue.sourceId, "other-event")
  assert.equal(issue.eventName, "career_preference_changed")
})

test("unchained career event remains unchecked instead of becoming invalid", () => {
  const event = eventFixture()
  event.integrity = null
  const result = verifyIntegrityChain([event])
  assert.equal(result.valid, true)
  assert.equal(result.complete, false)
  assert.equal(result.uncheckedEvents, 1)
  assert.deepEqual(result.issues, [])
})
