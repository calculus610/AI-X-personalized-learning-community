import test from "node:test"
import assert from "node:assert/strict"
import { registerCareerRoutes } from "../career-routes.mjs"

class Reply {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.payload = undefined
  }

  code(statusCode) {
    this.statusCode = statusCode
    return this
  }

  header(name, value) {
    this.headers[name.toLowerCase()] = value
    return this
  }

  send(payload) {
    this.payload = payload
    return payload
  }
}

function setup(profileRow, options = {}) {
  const handlers = new Map()
  const calls = []
  const app = {
    get(path, handler) { handlers.set(`GET ${path}`, handler) },
    patch(path, handler) { handlers.set(`PATCH ${path}`, handler) },
    post(path, handler) { handlers.set(`POST ${path}`, handler) },
  }
  const db = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (!sql.startsWith("SELECT primary_career_id, career_preference_updated_at FROM user_profiles")) {
        throw new Error(`unexpected_write_or_query:${sql}`)
      }
      return [profileRow ? [profileRow] : []]
    },
  }
  registerCareerRoutes(app, db)
  const request = {
    user: { sub: "user-1" },
    async jwtVerify() {
      if (options.invalidJwt) throw new Error("invalid_token")
    },
  }
  return { handler: handlers.get("GET /v1/profile/career-preference"), request, reply: new Reply(), calls }
}

test("career preference GET returns an existing catalog career", async () => {
  const savedAt = new Date("2026-08-12T01:23:45.678Z")
  const context = setup({ primary_career_id: "machine-learning-engineer", career_preference_updated_at: savedAt })

  const result = await context.handler(context.request, context.reply)

  assert.deepEqual(result, {
    primaryCareerId: "machine-learning-engineer",
    careerPreferenceUpdatedAt: savedAt.toISOString(),
    status: "selected",
  })
  assert.equal(context.reply.headers["cache-control"], "no-store")
})

test("career preference GET treats a NULL career as not selected", async () => {
  const context = setup({ primary_career_id: null, career_preference_updated_at: null })

  const result = await context.handler(context.request, context.reply)

  assert.deepEqual(result, {
    primaryCareerId: null,
    careerPreferenceUpdatedAt: null,
    status: "not_selected",
  })
})

test("career preference GET treats a missing profile row as not selected", async () => {
  const context = setup(null)

  const result = await context.handler(context.request, context.reply)

  assert.deepEqual(result, {
    primaryCareerId: null,
    careerPreferenceUpdatedAt: null,
    status: "not_selected",
  })
})

test("career preference GET reports a saved career missing from the catalog", async () => {
  const context = setup({ primary_career_id: "retired-career", career_preference_updated_at: null })

  const result = await context.handler(context.request, context.reply)

  assert.deepEqual(result, {
    primaryCareerId: "retired-career",
    careerPreferenceUpdatedAt: null,
    status: "unavailable",
  })
})

test("career preference GET rejects an invalid JWT without querying profile data", async () => {
  const context = setup({ primary_career_id: "machine-learning-engineer" }, { invalidJwt: true })

  await context.handler(context.request, context.reply)

  assert.equal(context.reply.statusCode, 401)
  assert.deepEqual(context.reply.payload, { error: "unauthorized" })
  assert.equal(context.calls.length, 0)
  assert.equal(context.reply.headers["cache-control"], "no-store")
})

test("career preference GET is a single pure read", async () => {
  const context = setup({ primary_career_id: "machine-learning-engineer", career_preference_updated_at: null })

  await context.handler(context.request, context.reply)

  assert.equal(context.calls.length, 1)
  assert.match(context.calls[0].sql, /^SELECT primary_career_id, career_preference_updated_at FROM user_profiles/)
  assert.deepEqual(context.calls[0].params, ["user-1"])
  assert.doesNotMatch(context.calls[0].sql, /FOR UPDATE|\bINSERT\b|\bUPDATE\b|\bDELETE\b|user_learning_events|event_integrity_records/i)
})
