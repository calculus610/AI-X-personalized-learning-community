import { randomUUID } from "node:crypto"
import { userFor } from "./learning-routes.mjs"

function invalid(reply, error, status = 400) { return reply.code(status).send({ error }) }
function text(value) { return String(value ?? "").replace(/\s+/g, " ").trim() }

export function registerMemoryRoutes(app, db) {
  app.get("/v1/memory/search", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const query = text(String(request.query?.q || "")).slice(0, 200)
    if (!query || query.length < 2) return invalid(reply, "query_too_short")
    const limit = Math.min(30, Math.max(1, Number(request.query?.limit) || 10))
    const scopeType = text(request.query?.scopeType).slice(0, 64) || null
    const conditions = ["m.content IS NOT NULL", "c.user_id=?"]
    const params = [user.id]
    if (scopeType) { conditions.push("c.scope_type=?"); params.push(scopeType) }
    const ftQuery = query.split(/\s+/).filter(Boolean).map(w => `+${w}`).join(" ")
    conditions.push("MATCH(m.content) AGAINST(? IN BOOLEAN MODE)")
    params.push(ftQuery)
    const [rows] = await db.execute(
      `SELECT c.id AS conversation_id, c.scope_type, c.scope_ref, m.id AS message_id, m.role,
              LEFT(m.content, 800) AS content_snippet, m.created_at,
              MATCH(m.content) AGAINST(? IN BOOLEAN MODE) AS relevance
       FROM memory_messages m JOIN memory_conversations c ON c.id=m.conversation_id
       WHERE ${conditions.join(" AND ")} ORDER BY relevance DESC, m.created_at DESC LIMIT ${Number(limit)}`,
      [ftQuery, ...params],
    )
    return { query, total: rows.length, items: rows.map(r => ({ conversationId: r.conversation_id, scopeType: r.scope_type, scopeRef: r.scope_ref, messageId: r.message_id, role: r.role, snippet: r.content_snippet, relevance: r.relevance !== null ? Math.round(Number(r.relevance) * 100) / 100 : 0, createdAt: new Date(r.created_at).toISOString() })) }
  })

  app.get("/v1/memory/stats", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [[cc], [mc]] = await Promise.all([
      db.execute("SELECT COUNT(*) total FROM memory_conversations WHERE user_id=?", [user.id]),
      db.execute("SELECT COUNT(*) total FROM memory_messages m JOIN memory_conversations c ON c.id=m.conversation_id WHERE c.user_id=?", [user.id]),
    ])
    return { totalConversations: Number(cc[0]?.total ?? 0), totalMessages: Number(mc[0]?.total ?? 0) }
  })

  app.post("/v1/memory/ingest", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const content = text(String(request.body?.content || "")).slice(0, 8000)
    if (!content) return invalid(reply, "content_required")
    const scopeType = text(request.body?.scopeType || "manual").slice(0, 64)
    const cid = randomUUID(), mid = randomUUID()
    await db.execute(`INSERT INTO memory_conversations (id, user_id, scope_type, scope_ref, metadata_json) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at=CURRENT_TIMESTAMP(3)`, [cid, user.id, scopeType, user.id, JSON.stringify({ source: "manual_ingest" })])
    await db.execute(`INSERT INTO memory_messages (id, conversation_id, role, content, metadata_json) VALUES (?, ?, ?, ?, ?)`, [mid, cid, "system", content, JSON.stringify({ source: "manual_ingest" })])
    return reply.code(201).send({ ok: true, conversationId: cid, messageId: mid })
  })
}
