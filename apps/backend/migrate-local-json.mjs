import mysql from "mysql2/promise"
import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const dataDirectory = path.resolve(process.argv[2] || process.env.LEGACY_DATA_DIR || "./data")
const db = mysql.createPool({
  host: required("DATABASE_HOST"),
  port: Number(process.env.DATABASE_PORT || 3306),
  database: required("DATABASE_NAME"),
  user: required("DATABASE_USER"),
  password: required("DATABASE_PASSWORD"),
  waitForConnections: true,
  connectionLimit: 4,
  charset: "utf8mb4",
})

const report = {
  dataDirectory,
  files: {},
  migrated: 0,
  archivedOnly: 0,
  placeholderUsersCreated: 0,
  unresolvedUsers: [],
}

function firstJsonValue(source) {
  const text = source.trimStart()
  if (!text) return { value: null, trailingBytes: 0 }
  const opening = text[0]
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : null
  if (!closing) return { value: JSON.parse(text), trailingBytes: 0 }
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === "\"") inString = false
      continue
    }
    if (character === "\"") {
      inString = true
      continue
    }
    if (character === opening) depth += 1
    else if (character === closing) {
      depth -= 1
      if (depth === 0) {
        const end = index + 1
        return {
          value: JSON.parse(text.slice(0, end)),
          trailingBytes: Buffer.byteLength(text.slice(end).trim(), "utf8"),
        }
      }
    }
  }
  return { value: JSON.parse(text), trailingBytes: 0 }
}

async function readJson(name, fallback) {
  try {
    const parsed = firstJsonValue(await readFile(path.join(dataDirectory, name), "utf8"))
    const value = parsed.value
    report.files[name] = {
      found: true,
      records: Array.isArray(value) ? value.length : Object.keys(value ?? {}).length,
      trailingBytesIgnored: parsed.trailingBytes,
    }
    return value
  } catch (error) {
    if (error?.code === "ENOENT") {
      report.files[name] = { found: false, records: 0 }
      return fallback
    }
    throw new Error(`${name}: ${error.message}`)
  }
}

const legacyUsers = await readJson("legacy-users.json", [])
const legacyUserByIdentity = new Map()
for (const item of Array.isArray(legacyUsers) ? legacyUsers : []) {
  const platformId = String(item?.platform_user_id ?? item?.platformUserId ?? "").trim()
  const username = String(item?.username ?? "").trim()
  if (platformId) {
    legacyUserByIdentity.set(platformId, item)
    legacyUserByIdentity.set(`aix-${platformId}`, item)
  }
  if (username) legacyUserByIdentity.set(username, item)
}

function deterministicUuid(value) {
  const hex = createHash("sha256").update(`personalized-secure:legacy-user:${value}`).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function legacyUsername(value) {
  const safe = String(value || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 40)
  return `legacy-${safe || createHash("sha256").update(String(value)).digest("hex").slice(0, 12)}`
}

function jsonValue(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return typeof value === "object" ? value : fallback
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : [])]
}

function uniqueIntegers(value) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => Number.isInteger(item) && item > 0) : [])]
}

async function resolveUser(legacyLearnerId) {
  const value = String(legacyLearnerId || "")
  const candidates = [...new Set([value, value.startsWith("aix-") ? value.slice(4) : value].filter(Boolean))]
  if (!candidates.length) return null
  const [mappedRows] = await db.execute(
    `SELECT user_id FROM legacy_user_identity_map
     WHERE source_system='next_json' AND legacy_identity IN (${candidates.map(() => "?").join(",")})
     LIMIT 1`,
    candidates,
  )
  if (mappedRows[0]?.user_id) return mappedRows[0].user_id
  const placeholders = candidates.map(() => "?").join(",")
  const [rows] = await db.execute(
    `SELECT id FROM users WHERE id IN (${placeholders}) OR username IN (${placeholders}) LIMIT 1`,
    [...candidates, ...candidates],
  )
  let userId = rows[0]?.id ?? null
  const metadata = legacyUserByIdentity.get(value)
    ?? candidates.map((candidate) => legacyUserByIdentity.get(candidate)).find(Boolean)
  if (!userId && metadata?.username) {
    const [matchingUsers] = await db.execute(
      "SELECT id FROM users WHERE username=? LIMIT 1",
      [String(metadata.username)],
    )
    userId = matchingUsers[0]?.id ?? null
  }
  if (!userId) {
    userId = deterministicUuid(value)
    const username = legacyUsername(metadata?.platform_user_id ?? value)
    const displayName = String(metadata?.display_name ?? metadata?.username ?? `历史用户 ${value}`).slice(0, 120)
    await db.execute(
      `INSERT IGNORE INTO users
       (id, username, display_name, password_hash, role, status)
       VALUES (?, ?, ?, '$migrated-account-no-login$', 'student', 'migrated')`,
      [userId, username, displayName],
    )
    report.placeholderUsersCreated += 1
  }
  for (const candidate of candidates) {
    await db.execute(
      `INSERT INTO legacy_user_identity_map
       (source_system, legacy_identity, user_id, username_snapshot, display_name_snapshot)
       VALUES ('next_json', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),
         username_snapshot=VALUES(username_snapshot),
         display_name_snapshot=VALUES(display_name_snapshot)`,
      [candidate, userId, metadata?.username ?? null, metadata?.display_name ?? null],
    )
  }
  return userId
}

async function ownedTrack(userId, trackId) {
  if (!trackId) return null
  const [rows] = await db.execute(
    "SELECT id, current_path_id FROM learning_tracks WHERE id=? AND user_id=? LIMIT 1",
    [trackId, userId],
  )
  return rows[0] ?? null
}

async function ownedNode(userId, trackId, routeStepId) {
  if (!trackId || !routeStepId) return null
  const [rows] = await db.execute(
    `SELECT t.id track_id, n.id route_step_id, n.course_id, c.lesson_id
     FROM learning_tracks t
     JOIN learning_path_nodes n ON n.path_id=t.current_path_id
     JOIN courses c ON c.id=n.course_id
     WHERE t.id=? AND t.user_id=? AND n.id=? LIMIT 1`,
    [trackId, userId, routeStepId],
  )
  return rows[0] ?? null
}

async function archive(userId, sourceType, sourceKey, payload, status) {
  await db.execute(
    `INSERT INTO legacy_user_data_imports
     (user_id, source_type, source_key, payload_json, import_status)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE payload_json=VALUES(payload_json),
       import_status=VALUES(import_status), imported_at=UTC_TIMESTAMP(3)`,
    [userId, sourceType, String(sourceKey).slice(0, 500), JSON.stringify(payload), status],
  )
  if (status === "MIGRATED") report.migrated += 1
  else report.archivedOnly += 1
}

async function migrateRouteProgress(database) {
  for (const [sourceKey, progress] of Object.entries(database ?? {})) {
    const userId = await resolveUser(progress?.learnerId ?? sourceKey.split("::")[0])
    if (!userId) continue
    const trackId = String(progress?.routeId ?? sourceKey.split("::")[1] ?? "")
    const track = await ownedTrack(userId, trackId)
    if (track) {
      await db.execute(
        `INSERT INTO user_route_progress
         (user_id, track_id, active_step_index, completed_step_ids, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE active_step_index=VALUES(active_step_index),
           completed_step_ids=VALUES(completed_step_ids),
           updated_at=GREATEST(updated_at, VALUES(updated_at))`,
        [userId, track.id, Math.max(0, Number(progress.activeStepIndex) || 0),
          JSON.stringify(uniqueStrings(progress.completedStepIds)),
          progress.updatedAt ? new Date(progress.updatedAt) : new Date()],
      )
      await archive(userId, "learning_progress", sourceKey, progress, "MIGRATED")
    } else {
      await archive(userId, "learning_progress", sourceKey, progress, "ARCHIVED_UNMAPPED_ROUTE")
    }
  }
}

async function migrateEvidenceMetadata(userId, node, progress) {
  for (const [stepKey, records] of Object.entries(progress.evidenceByStep ?? {})) {
    const stepId = Number(stepKey)
    if (!Number.isInteger(stepId) || stepId <= 0 || !Array.isArray(records)) continue
    for (const record of records) {
      const id = /^[0-9a-f-]{36}$/i.test(String(record.id ?? "")) ? String(record.id) : randomUUID()
      await db.execute(
        `INSERT IGNORE INTO user_evidence_files
         (id, user_id, track_id, route_step_id, course_id, lesson_id, step_id,
          file_name, mime_type, file_size, storage_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LEGACY_METADATA', ?)`,
        [id, userId, node.track_id, node.route_step_id, node.course_id, Number(node.lesson_id),
          stepId, String(record.fileName ?? "legacy-evidence").slice(0, 500),
          String(record.fileType ?? "application/octet-stream").slice(0, 190),
          Math.max(0, Number(record.fileSize) || 0),
          record.uploadedAt ? new Date(record.uploadedAt) : new Date()],
      )
    }
  }
}

async function migrateCourseProgress(database) {
  for (const [sourceKey, progress] of Object.entries(database ?? {})) {
    const parts = sourceKey.split("::")
    const userId = await resolveUser(progress?.learnerId ?? parts[0])
    if (!userId) continue
    const trackId = String(progress?.routeId ?? parts[1] ?? "")
    const routeStepId = String(progress?.routeStepId ?? parts[2] ?? "")
    const node = await ownedNode(userId, trackId, routeStepId)
    if (node) {
      await db.execute(
        `INSERT INTO user_course_progress
         (user_id, track_id, route_step_id, course_id, lesson_id, support_mode,
          active_course_step_index, completed_course_step_ids, checklist_by_step,
          stuck_step_ids, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE support_mode=VALUES(support_mode),
           active_course_step_index=VALUES(active_course_step_index),
           completed_course_step_ids=VALUES(completed_course_step_ids),
           checklist_by_step=VALUES(checklist_by_step),
           stuck_step_ids=VALUES(stuck_step_ids),
           updated_at=GREATEST(updated_at, VALUES(updated_at))`,
        [userId, node.track_id, node.route_step_id, node.course_id, Number(node.lesson_id),
          [null, "guided", "self_directed"].includes(progress.supportMode) ? progress.supportMode : null,
          Math.max(0, Number(progress.activeCourseStepIndex) || 0),
          JSON.stringify(uniqueIntegers(progress.completedCourseStepIds)),
          JSON.stringify(jsonValue(progress.checklistByStep, {})),
          JSON.stringify(uniqueIntegers(progress.stuckStepIds)),
          progress.updatedAt ? new Date(progress.updatedAt) : new Date()],
      )
      await migrateEvidenceMetadata(userId, node, progress)
      await archive(userId, "course_execution_progress", sourceKey, progress, "MIGRATED")
    } else {
      await archive(userId, "course_execution_progress", sourceKey, progress, "ARCHIVED_UNMAPPED_ROUTE_STEP")
    }
  }
}

async function migrateEvents(events) {
  for (const [index, event] of (Array.isArray(events) ? events : []).entries()) {
    const userId = await resolveUser(event?.learnerId)
    if (!userId) continue
    const track = await ownedTrack(userId, event.routeId)
    const node = track && event.routeStepId ? await ownedNode(userId, track.id, event.routeStepId) : null
    const clientEventId = String(event.id ?? `legacy-${index}`).slice(0, 128)
    await db.execute(
      `INSERT IGNORE INTO user_learning_events
       (id, user_id, client_event_id, track_id, route_step_id, lesson_id, step_id,
        event_name, payload_json, client_occurred_at, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), userId, clientEventId, track?.id ?? null, node?.route_step_id ?? null,
        event.lessonId ? Number(event.lessonId) : null, event.stepId ? Number(event.stepId) : null,
        String(event.eventType ?? "legacy_event").slice(0, 96),
        JSON.stringify(event.payload ?? {}),
        event.createdAt ? new Date(event.createdAt) : null,
        event.createdAt ? new Date(event.createdAt) : new Date()],
    )
    await archive(
      userId,
      "learning_event",
      clientEventId,
      event,
      event.routeStepId && !node ? "MIGRATED_WITH_UNMAPPED_CONTEXT" : "MIGRATED",
    )
  }
}

async function migrateProfiles(profiles) {
  for (const [legacyLearnerId, profile] of Object.entries(profiles ?? {})) {
    const userId = await resolveUser(profile?.learnerId ?? legacyLearnerId)
    if (!userId) continue
    await db.execute(
      `INSERT INTO user_profiles
       (user_id, aspiration, desired_skills, future_identity, selected_interest_ids,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE aspiration=VALUES(aspiration),
         desired_skills=VALUES(desired_skills), future_identity=VALUES(future_identity),
         selected_interest_ids=VALUES(selected_interest_ids),
         updated_at=GREATEST(updated_at, VALUES(updated_at))`,
      [userId, String(profile.aspiration ?? ""), String(profile.desiredSkills ?? ""),
        String(profile.futureIdentity ?? ""), JSON.stringify(uniqueStrings(profile.selectedInterestIds)),
        profile.createdAt ? new Date(profile.createdAt) : new Date(),
        profile.updatedAt ? new Date(profile.updatedAt) : new Date()],
    )
    await archive(userId, "learner_profile", legacyLearnerId, profile, "MIGRATED")
  }
}

function masteryLevel(score) {
  return score >= 0.8 ? "strong" : score >= 0.5 ? "developing" : "weak"
}

async function migrateAdaptive(database) {
  for (const [sourceKey, state] of Object.entries(database ?? {})) {
    const [legacyLearnerId, trackId = ""] = sourceKey.split("::")
    const userId = await resolveUser(legacyLearnerId)
    if (!userId) continue
    const track = await ownedTrack(userId, trackId)
    for (const record of Object.values(state?.mastery ?? {})) {
      const score = Math.max(0, Math.min(1, Number(record.score) || 0))
      const evidenceCount = Math.max(0, Number(record.evidenceCount) || 0)
      await db.execute(
        `INSERT INTO adaptive_knowledge_mastery
         (user_id, knowledge_point_id, knowledge_point_label, score, evidence_count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE knowledge_point_label=VALUES(knowledge_point_label),
           score=IF(VALUES(updated_at)>=updated_at, VALUES(score), score),
           evidence_count=IF(VALUES(updated_at)>=updated_at, VALUES(evidence_count), evidence_count),
           updated_at=GREATEST(updated_at, VALUES(updated_at))`,
        [userId, String(record.knowledgePointId).slice(0, 128),
          String(record.knowledgePointLabel ?? "未命名知识点").slice(0, 500),
          score, evidenceCount, record.updatedAt ? new Date(record.updatedAt) : new Date()],
      )
    }
    if (track) {
      for (const attempt of state?.attempts ?? []) {
        const node = await ownedNode(userId, track.id, attempt.routeStepId)
        if (!node) continue
        await db.execute(
          `INSERT INTO adaptive_quiz_attempts
           (id, user_id, track_id, route_step_id, score, total, detail_json, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE score=VALUES(score), total=VALUES(total),
             detail_json=VALUES(detail_json), submitted_at=VALUES(submitted_at)`,
          [String(attempt.quizId).slice(0, 128), userId, track.id, node.route_step_id,
            Math.max(0, Number(attempt.score) || 0), Math.max(0, Number(attempt.total) || 0),
            JSON.stringify(attempt), attempt.submittedAt ? new Date(attempt.submittedAt) : new Date()],
        )
      }
      for (const [routeStepId, recommendation] of Object.entries(state?.recommendations ?? {})) {
        const node = await ownedNode(userId, track.id, routeStepId)
        if (!node) continue
        await db.execute(
          `INSERT INTO adaptive_recommendations
           (user_id, track_id, route_step_id, recommendation_json, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE recommendation_json=VALUES(recommendation_json),
             updated_at=GREATEST(updated_at, VALUES(updated_at))`,
          [userId, track.id, node.route_step_id, JSON.stringify({
            ...recommendation,
            level: recommendation.level ?? masteryLevel(Number(recommendation.score) / Math.max(1, Number(recommendation.total))),
          }), recommendation.updatedAt ? new Date(recommendation.updatedAt) : new Date()],
        )
      }
    }
    await archive(userId, "adaptive_learning", sourceKey, state, track ? "MIGRATED" : "ARCHIVED_UNMAPPED_ROUTE")
  }
}

try {
  await migrateRouteProgress(await readJson("learning-progress.json", {}))
  await migrateCourseProgress(await readJson("course-execution-progress.json", {}))
  await migrateEvents(await readJson("learning-events.json", []))
  await migrateProfiles(await readJson("learner-profiles.json", {}))
  await migrateAdaptive(await readJson("adaptive-learning.json", {}))
  console.log(JSON.stringify(report, null, 2))
  if (report.unresolvedUsers.length) process.exitCode = 2
} finally {
  await db.end()
}
