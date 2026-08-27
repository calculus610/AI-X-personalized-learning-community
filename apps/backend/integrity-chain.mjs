import { createHash, randomUUID } from "node:crypto"

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  if (value instanceof Date) return value.toISOString()
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

export async function appendIntegrityOnConnection(connection, { userId, sourceType, sourceId, payload, occurredAt }) {
  await connection.execute("INSERT IGNORE INTO event_integrity_heads (user_id) VALUES (?)", [userId])
  const [existing] = await connection.execute("SELECT id,event_hash,sequence_no FROM event_integrity_records WHERE source_type=? AND source_id=? LIMIT 1", [sourceType, sourceId])
  if (existing[0]) return existing[0]
  const [heads] = await connection.execute("SELECT last_sequence,last_event_hash FROM event_integrity_heads WHERE user_id=? FOR UPDATE", [userId])
  const sequence = Number(heads[0]?.last_sequence || 0) + 1
  const previousHash = heads[0]?.last_event_hash || null
  const canonicalPayload = stable({ userId, sequence, sourceType, sourceId, occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt || null, payload: payload || {} })
  const canonicalJson = JSON.stringify(canonicalPayload)
  const eventHash = createHash("sha256").update(`${previousHash || "GENESIS"}|${canonicalJson}`, "utf8").digest("hex")
  const id = randomUUID()
  await connection.execute(
    `INSERT INTO event_integrity_records
     (id,user_id,sequence_no,source_type,source_id,canonical_payload_json,previous_event_hash,event_hash,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,COALESCE(?,UTC_TIMESTAMP(3)))`,
    [id,userId,sequence,sourceType,sourceId,canonicalJson,previousHash,eventHash,occurredAt || null],
  )
  await connection.execute("UPDATE event_integrity_heads SET last_sequence=?,last_event_hash=? WHERE user_id=?", [sequence,eventHash,userId])
  return { id, event_hash: eventHash, sequence_no: sequence }
}

function isRetryableIntegrityError(error) {
  return error?.code === "ER_LOCK_DEADLOCK" || error?.errno === 1213 || error?.sqlState === "40001"
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function appendIntegrityRecord(db, record, options = {}) {
  const retries = Number.isInteger(options.retries) ? options.retries : 3
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const result = await appendIntegrityOnConnection(connection, record)
      await connection.commit()
      return result
    } catch (error) {
      lastError = error
      try { await connection.rollback() } catch {}
      if (!isRetryableIntegrityError(error) || attempt >= retries) throw error
      await wait(30 * (attempt + 1) + Math.floor(Math.random() * 30))
    } finally {
      connection.release()
    }
  }

  throw lastError
}
