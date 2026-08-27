import { randomUUID } from "node:crypto"
import { userFor } from "./learning-routes.mjs"
import { appendIntegrityOnConnection } from "./integrity-chain.mjs"
import { serializeInterestCatalog } from "./interest-catalog.mjs"
import { CAREER_BY_ID, serializeCareerCatalog } from "./career-catalog.mjs"
import { COMPETENCIES, COMPETENCY_CATALOG_VERSION } from "./competency-catalog.mjs"
import { RecommendationInputError, recommendCareerCourses } from "./career-course-recommendation.mjs"

const invalid = (reply, error, status = 400, extra = {}) => reply.code(status).send({ error, ...extra })

export async function readCareerPreference(db, userId) {
  const [rows] = await db.execute(
    "SELECT primary_career_id, career_preference_updated_at FROM user_profiles WHERE user_id=? LIMIT 1",
    [userId],
  )
  const row = rows[0] ?? {}
  const primaryCareerId = row.primary_career_id ?? null
  return {
    primaryCareerId,
    careerPreferenceUpdatedAt: row.career_preference_updated_at ? new Date(row.career_preference_updated_at).toISOString() : null,
    status: primaryCareerId === null ? "not_selected" : CAREER_BY_ID.has(primaryCareerId) ? "selected" : "unavailable",
  }
}

export async function updateCareerPreference(db, userId, requestedCareerId) {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      `INSERT IGNORE INTO user_profiles
       (user_id, aspiration, desired_skills, future_identity, selected_interest_ids)
       VALUES (?, '', '', '', JSON_ARRAY())`,
      [userId],
    )
    const [currentRows] = await connection.execute(
      "SELECT primary_career_id FROM user_profiles WHERE user_id=? FOR UPDATE",
      [userId],
    )
    const previousCareerId = currentRows[0]?.primary_career_id ?? null
    const changed = previousCareerId !== requestedCareerId

    // Preserve the existing endpoint behavior: every successful PATCH refreshes
    // career_preference_updated_at, while only a real state change creates history.
    await connection.execute(
      `UPDATE user_profiles
       SET primary_career_id=?, career_preference_updated_at=UTC_TIMESTAMP(3)
       WHERE user_id=?`,
      [requestedCareerId, userId],
    )

    if (changed) {
      const eventId = randomUUID()
      const occurredAt = new Date()
      const payload = {
        previousCareerId,
        careerId: requestedCareerId,
        source: "profile_career_preference_patch",
      }
      await connection.execute(
        `INSERT INTO user_learning_events
         (id, user_id, event_name, payload_json, occurred_at)
         VALUES (?, ?, 'career_preference_changed', ?, ?)`,
        [eventId, userId, JSON.stringify(payload), occurredAt],
      )
      await appendIntegrityOnConnection(connection, {
        userId,
        sourceType: "learning",
        sourceId: eventId,
        occurredAt,
        payload: { eventName: "career_preference_changed", ...payload },
      })
    }

    const [savedRows] = await connection.execute(
      "SELECT primary_career_id, career_preference_updated_at FROM user_profiles WHERE user_id=? LIMIT 1",
      [userId],
    )
    await connection.commit()
    return savedRows[0] ?? { primary_career_id: requestedCareerId, career_preference_updated_at: null }
  } catch (error) {
    try { await connection.rollback() } catch {}
    throw error
  } finally {
    connection.release()
  }
}

export function registerCareerRoutes(app, db) {
  app.get("/v1/interests", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    return serializeInterestCatalog()
  })

  app.get("/v1/careers", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    return { ...serializeCareerCatalog(), competencyCatalogVersion: COMPETENCY_CATALOG_VERSION, competencies: COMPETENCIES }
  })

  app.get("/v1/profile/career-preference", async (request, reply) => {
    reply.header("Cache-Control", "no-store")
    const user = await userFor(request, reply); if (!user) return
    return readCareerPreference(db, user.id)
  })

  app.patch("/v1/profile/career-preference", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const body = request.body ?? {}
    if (!("primaryCareerId" in body)) return invalid(reply, "primary_career_id_required")
    const primaryCareerId = body.primaryCareerId
    if (primaryCareerId !== null && (typeof primaryCareerId !== "string" || !CAREER_BY_ID.has(primaryCareerId))) return invalid(reply, "invalid_career_id")
    const row = await updateCareerPreference(db, user.id, primaryCareerId)
    return {
      primaryCareerId: row.primary_career_id ?? null,
      careerPreferenceUpdatedAt: row.career_preference_updated_at ? new Date(row.career_preference_updated_at).toISOString() : null,
    }
  })

  app.post("/v1/course-recommendations/by-career", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const body = request.body ?? {}
    const limit = body.limit === undefined ? 5 : body.limit
    try {
      if (!CAREER_BY_ID.has(body.careerId)) throw new RecommendationInputError("invalid_career_id")
      if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new RecommendationInputError("invalid_recommendation_limit")
      const [courseRows, relationRows, completedRows] = await Promise.all([
        db.execute(
          `SELECT c.id, c.module_id, c.title, c.summary, c.sort_order, c.status, c.is_selectable_target,
                  m.name module_name
           FROM courses c
           JOIN course_modules m ON m.id=c.module_id AND m.status='PUBLISHED'
           JOIN course_contents content ON content.course_id=c.id AND content.version=c.content_version
             AND content.status='PUBLISHED' AND JSON_LENGTH(JSON_EXTRACT(content.content_json, '$.steps')) > 0
           WHERE c.status='PUBLISHED'
           ORDER BY m.sort_order, c.sort_order, c.id`,
        ).then(([rows]) => rows),
        db.execute(
          `SELECT prerequisite_course_id, target_course_id, relation_type
           FROM course_relations WHERE status='PUBLISHED' AND relation_type='REQUIRED_PREREQUISITE'
           ORDER BY prerequisite_course_id, target_course_id`,
        ).then(([rows]) => rows),
        db.execute("SELECT course_id FROM user_course_completions WHERE user_id=?", [user.id]).then(([rows]) => rows),
      ])
      const result = recommendCareerCourses({
        careerId: body.careerId,
        limit,
        courses: courseRows.map((row) => ({ id: row.id, moduleId: row.module_id, moduleName: row.module_name, title: row.title, summary: row.summary, sortOrder: row.sort_order, status: row.status, isSelectableTarget: Boolean(row.is_selectable_target), hasContent: true })),
        completedCourseIds: completedRows.map((row) => row.course_id),
        relations: relationRows.map((row) => ({ prerequisiteCourseId: row.prerequisite_course_id, targetCourseId: row.target_course_id, relationType: row.relation_type })),
      })
      return { ...result, generatedAt: new Date().toISOString() }
    } catch (error) {
      if (error instanceof RecommendationInputError) return invalid(reply, error.code)
      throw error
    }
  })
}
