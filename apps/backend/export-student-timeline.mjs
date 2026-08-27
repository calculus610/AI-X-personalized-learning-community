import mysql from "mysql2/promise"
import { createHash, randomUUID } from "node:crypto"
import { buildTimeline, verifyIntegrityChain } from "./admin-routes.mjs"

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`missing_environment:${name}`)
  return value
}

function parseArguments(argv) {
  const options = { subject: "", from: null, to: new Date(), days: null, limit: 50000 }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith("--") && !options.subject) options.subject = value
    else if (value === "--from") options.from = new Date(argv[++index])
    else if (value === "--to") options.to = new Date(argv[++index])
    else if (value === "--days") options.days = Number(argv[++index])
    else if (value === "--limit") options.limit = Math.min(50000, Math.max(1, Number(argv[++index]) || 50000))
    else throw new Error(`unknown_argument:${value}`)
  }
  if (!options.subject) throw new Error("usage: export-student-timeline <username-or-user-id> [--from ISO] [--to ISO] [--days N] [--limit N]")
  if (options.from && options.days !== null) throw new Error("time_range_conflict:choose_either_--from_or_--days")
  if (options.days !== null) {
    if (!Number.isFinite(options.days) || options.days <= 0) throw new Error("days_invalid")
    options.from = new Date(options.to.getTime() - options.days * 86400000)
  }
  if (!Number.isFinite(options.to.getTime()) || (options.from && !Number.isFinite(options.from.getTime()))) throw new Error("time_range_invalid")
  return options
}

const args = parseArguments(process.argv.slice(2))
const dbConfig = {
  host: required("DATABASE_HOST"), port: Number(process.env.DATABASE_PORT || 3306),
  database: required("DATABASE_NAME"), user: required("DATABASE_USER"), password: required("DATABASE_PASSWORD"),
  waitForConnections: true, connectionLimit: 3, charset: "utf8mb4",
}
const memoryConfig = {
  host: process.env.MEMORY_DATABASE_HOST || dbConfig.host,
  port: Number(process.env.MEMORY_DATABASE_PORT || dbConfig.port),
  database: process.env.MEMORY_DATABASE_NAME || dbConfig.database,
  user: process.env.MEMORY_DATABASE_USER || dbConfig.user,
  password: process.env.MEMORY_DATABASE_PASSWORD || dbConfig.password,
  waitForConnections: true, connectionLimit: 3, charset: "utf8mb4",
}
const db = mysql.createPool(dbConfig)
const memoryDb = mysql.createPool(memoryConfig)

try {
  const [users] = await db.execute(
    "SELECT id,username,display_name,status,created_at FROM users WHERE role='student' AND (id=? OR username=?) LIMIT 1",
    [args.subject, args.subject],
  )
  const student = users[0]
  if (!student) throw new Error("student_not_found")
  const [bounds] = await db.execute(
    `SELECT MIN(event_time) AS earliest_at FROM (
       SELECT created_at AS event_time FROM users WHERE id=?
       UNION ALL SELECT occurred_at FROM user_raw_interaction_events WHERE user_id=?
       UNION ALL SELECT occurred_at FROM user_learning_events WHERE user_id=?
       UNION ALL SELECT uploaded_at FROM user_evidence_files WHERE user_id=?
       UNION ALL SELECT occurred_at FROM agent_events WHERE user_id=?
       UNION ALL SELECT created_at FROM agent_messages_index WHERE user_id=?
       UNION ALL SELECT occurred_at FROM event_integrity_records WHERE user_id=?
     ) timeline_bounds`,
    Array(7).fill(student.id),
  )
  const from = args.from || new Date(bounds[0]?.earliest_at || student.created_at)
  if (from > args.to) throw new Error("time_range_invalid")

  const events = await buildTimeline(db, memoryDb, student.id, from, args.to, args.limit, true)
  const exportedAt = new Date().toISOString()
  const body = {
    schemaVersion: "1.0",
    exportMode: "internal_ssh_cli",
    exportedAt,
    retentionPolicy: "2 years",
    student: { ...student, created_at: new Date(student.created_at).toISOString() },
    range: { from: from.toISOString(), to: args.to.toISOString() },
    integrity: verifyIntegrityChain(events),
    eventCount: events.length,
    limit: args.limit,
    possiblyTruncated: events.length >= args.limit,
    events,
  }
  const exportSha256 = createHash("sha256").update(JSON.stringify(body), "utf8").digest("hex")

  await db.execute(
    `INSERT INTO internal_export_audit_events
     (id,actor_name,target_user_id,export_from,export_to,event_count,export_sha256,output_reference)
     VALUES (?,?,?,?,?,?,?,?)`,
    [randomUUID(), String(process.env.EXPORT_ACTOR || "ssh:root").slice(0,128), student.id, from, args.to,
      events.length, exportSha256, String(process.env.EXPORT_OUTPUT_REFERENCE || "stdout").slice(0,512)],
  )
  process.stderr.write(`exported ${events.length} events for ${student.username}; integrity=${body.integrity.valid}; sha256=${exportSha256}\n`)
  process.stdout.write(`${JSON.stringify({ ...body, exportSha256 }, null, 2)}\n`)
} finally {
  await Promise.allSettled([db.end(), memoryDb.end()])
}
