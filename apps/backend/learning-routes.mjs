import { createHash, randomUUID } from "node:crypto"

const CATALOG_VERSION = "demo-2026-07-v1"
const LARGE_PLAN_LIMIT = 30

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string" && /^[a-z0-9_-]{1,64}$/i.test(item)) : [])]
}
function signature(courseIds) {
  return createHash("sha256").update([...courseIds].sort().join("|")).digest("hex")
}
function validation(reply, error, status = 400, extra = {}) {
  return reply.code(status).send({ error, ...extra })
}

function jsonValue(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return null }
  }
  return value && typeof value === "object" ? value : null
}

function fileName(value) {
  return String(value || "resource").replace(/[\\\r\n\"]/g, "_").slice(0, 180)
}

function makeGraph(courses, relations, targetIds) {
  const byId = new Map(courses.map((course) => [course.id, course]))
  const prerequisites = new Map()
  for (const relation of relations) {
    if (!prerequisites.has(relation.target_course_id)) prerequisites.set(relation.target_course_id, [])
    prerequisites.get(relation.target_course_id).push(relation.prerequisite_course_id)
  }
  const visiting = new Set(), included = new Set(), levelByCourse = new Map()
  function visit(courseId) {
    if (visiting.has(courseId)) throw new Error("course_relation_cycle")
    if (included.has(courseId)) return levelByCourse.get(courseId)
    if (!byId.has(courseId)) throw new Error("course_not_published")
    visiting.add(courseId)
    const level = Math.max(-1, ...(prerequisites.get(courseId) ?? []).map(visit)) + 1
    visiting.delete(courseId)
    included.add(courseId)
    levelByCourse.set(courseId, level)
    return level
  }
  targetIds.forEach(visit)
  return { courseIds: [...included], levelByCourse, relations: relations.filter((item) => included.has(item.prerequisite_course_id) && included.has(item.target_course_id)) }
}

export async function userFor(request, reply) {
  try { await request.jwtVerify() } catch { validation(reply, "unauthorized", 401); return null }
  const id = String(request.user?.sub ?? "")
  if (!id) { validation(reply, "unauthorized", 401); return null }
  return { id }
}

async function recordEvent(db, userId, eventName, input = {}) {
  await db.execute(
    "INSERT INTO learning_events (id, user_id, track_id, path_id, event_name, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
    [randomUUID(), userId, input.trackId ?? null, input.pathId ?? null, eventName, JSON.stringify(input.payload ?? {})],
  )
}

async function refreshPath(db, userId, pathId) {
  const [nodes] = await db.execute(
    "SELECT id, course_id, learning_level FROM learning_path_nodes WHERE path_id=? ORDER BY learning_level, sort_order",
    [pathId],
  )
  const [edges] = await db.execute(
    `SELECT e.prerequisite_node_id, e.target_node_id FROM learning_path_edges e
     WHERE e.path_id=? AND e.relation_type='REQUIRED_PREREQUISITE'`,
    [pathId],
  )
  const [completedRows] = await db.execute("SELECT course_id, completed_at FROM user_course_completions WHERE user_id=?", [userId])
  const completed = new Map(completedRows.map((row) => [row.course_id, row.completed_at]))
  const prerequisites = new Map()
  for (const edge of edges) {
    if (!prerequisites.has(edge.target_node_id)) prerequisites.set(edge.target_node_id, [])
    prerequisites.get(edge.target_node_id).push(edge.prerequisite_node_id)
  }
  const statusByNode = new Map()
  for (const node of nodes) {
    const doneAt = completed.get(node.course_id)
    const required = prerequisites.get(node.id) ?? []
    const prerequisitesDone = required.every((id) => statusByNode.get(id) === "COMPLETED")
    const status = doneAt ? "COMPLETED" : prerequisitesDone ? "AVAILABLE" : "LOCKED"
    statusByNode.set(node.id, status)
    await db.execute("UPDATE learning_path_nodes SET status=?, completed_at=? WHERE id=?", [status, doneAt ?? null, node.id])
  }
}

async function trackSummary(db, userId, track) {
  if (!track.current_path_id) return { ...track, completedCount: 0, totalCount: 0, progressPercent: 0 }
  const [rows] = await db.execute(
    `SELECT COUNT(*) total_count, SUM(status='COMPLETED') completed_count
     FROM learning_path_nodes WHERE path_id=?`,
    [track.current_path_id],
  )
  const total = Number(rows[0]?.total_count ?? 0), completed = Number(rows[0]?.completed_count ?? 0)
  return { ...track, completedCount: completed, totalCount: total, progressPercent: total ? Math.round(completed / total * 100) : 0 }
}

export function registerLearningRoutes(app, db, objectStore) {
  app.get("/v1/catalog", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [moduleRows, courseRows, tagRows] = await Promise.all([
      db.execute("SELECT id, name, description, icon, color, sort_order FROM course_modules WHERE status='PUBLISHED' ORDER BY sort_order").then(([rows]) => rows),
      db.execute(
        `SELECT c.id, c.module_id, c.lesson_id, c.title, c.summary, c.content_version, c.sort_order
         FROM courses c
         JOIN course_contents content ON content.course_id=c.id AND content.version=c.content_version
           AND content.status='PUBLISHED' AND JSON_LENGTH(JSON_EXTRACT(content.content_json, '$.steps')) > 0
         LEFT JOIN user_course_completions done ON done.course_id=c.id AND done.user_id=?
         WHERE c.status='PUBLISHED' AND c.is_selectable_target=1 AND done.course_id IS NULL
         ORDER BY c.module_id, c.sort_order, c.title`, [user.id],
      ).then(([rows]) => rows),
      db.execute("SELECT course_id, tag_type, tag_value FROM course_tags").then(([rows]) => rows),
    ])
    const tagsByCourse = new Map()
    for (const tag of tagRows) {
      const tags = tagsByCourse.get(tag.course_id) ?? []
      tags.push({ type: tag.tag_type, value: tag.tag_value })
      tagsByCourse.set(tag.course_id, tags)
    }
    return { catalogVersion: CATALOG_VERSION, modules: moduleRows.map((module) => ({ ...module, courses: courseRows.filter((course) => course.module_id === module.id).map((course) => ({ ...course, tags: tagsByCourse.get(course.id) ?? [] })) })) }
  })

  // This endpoint is deliberately separate from /catalog: it returns only the
  // verified course dependencies used to draw solid prerequisite edges.
  app.get("/v1/graph-source", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [courses, relations] = await Promise.all([
      db.execute(
        `SELECT c.id, c.lesson_id, c.title FROM courses c
         JOIN course_contents content ON content.course_id=c.id AND content.version=c.content_version
           AND content.status='PUBLISHED' AND JSON_LENGTH(JSON_EXTRACT(content.content_json, '$.steps')) > 0
         LEFT JOIN user_course_completions done ON done.course_id=c.id AND done.user_id=?
         WHERE c.status='PUBLISHED' AND done.course_id IS NULL
         ORDER BY c.sort_order, c.title`,
        [user.id],
      ).then(([rows]) => rows),
      db.execute(
        `SELECT prerequisite_course_id, target_course_id
         FROM course_relations
         WHERE status='PUBLISHED' AND relation_type='REQUIRED_PREREQUISITE'`,
      ).then(([rows]) => rows),
    ])
    return {
      courses: courses.map((course) => ({ id: course.id, lessonId: course.lesson_id, title: course.title })),
      requiredPrerequisites: relations.map((relation) => ({
        prerequisiteCourseId: relation.prerequisite_course_id,
        targetCourseId: relation.target_course_id,
      })),
    }
  })

  // Course content is deliberately served from the versioned MySQL record.
  // It never falls back to a local JSON export or a Next.js route.
  app.get("/v1/courses/:courseId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute(
      `SELECT c.id, c.lesson_id, c.module_id, c.title, c.summary, c.content_version,
              content.content_json
       FROM courses c JOIN course_contents content
         ON content.course_id=c.id AND content.version=c.content_version
       WHERE c.id=? AND c.status='PUBLISHED' AND content.status='PUBLISHED' LIMIT 1`,
      [request.params.courseId],
    )
    const row = rows[0]
    const content = row && jsonValue(row.content_json)
    if (!row || !content) return validation(reply, "course_content_not_found", 404)
    return {
      course: { id: row.id, lessonId: row.lesson_id, moduleId: row.module_id, title: row.title, summary: row.summary, version: row.content_version },
      content,
    }
  })

  // Kept only for legacy callers. A lesson id is no longer a safe identity:
  // when one legacy lesson has been split into multiple V2 courses, require
  // the caller to use /v1/courses/:courseId instead of returning an arbitrary
  // row.
  app.get("/v1/lessons/:lessonId/content", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute(
      `SELECT c.id, c.lesson_id, c.module_id, c.title, c.summary, c.content_version,
              content.content_json
       FROM courses c JOIN course_contents content
         ON content.course_id=c.id AND content.version=c.content_version
       WHERE c.lesson_id=? AND c.status='PUBLISHED' AND content.status='PUBLISHED'
       ORDER BY c.id`,
      [request.params.lessonId],
    )
    if (rows.length > 1) return validation(reply, "lesson_id_ambiguous_use_course_id", 409, {
      courseIds: rows.map((item) => item.id),
    })
    const row = rows[0]
    const content = row && jsonValue(row.content_json)
    if (!row || !content) return validation(reply, "course_content_not_found", 404)
    return {
      course: { id: row.id, lessonId: row.lesson_id, moduleId: row.module_id, title: row.title, summary: row.summary, version: row.content_version },
      content,
    }
  })

  // The browser never receives MinIO credentials or an unbounded bucket URL.
  // This authenticated API streams only a resource attached to this course's
  // current published content record.
  app.get("/v1/courses/:courseId/resources/:resourceId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute(
      `SELECT content.content_json FROM courses c JOIN course_contents content
         ON content.course_id=c.id AND content.version=c.content_version
       WHERE c.id=? AND c.status='PUBLISHED' AND content.status='PUBLISHED' LIMIT 1`,
      [request.params.courseId],
    )
    const content = rows[0] && jsonValue(rows[0].content_json)
    const resource = content?.resources?.find((item) => String(item.id) === String(request.params.resourceId))
    if (!resource?.objectKey) return validation(reply, "course_resource_not_found", 404)
    try {
      const stream = await objectStore.client.getObject(objectStore.bucket, resource.objectKey)
      const fn = (resource.fileName || resource.title || "").toLowerCase()
      const mime = resource.mimeType || (fn.endsWith(".md") ? "text/markdown" : fn.endsWith(".html") ? "text/html" : "application/octet-stream")
      reply.header("content-type", /^text\//.test(mime) ? `${mime}; charset=utf-8` : mime)
      reply.header("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileName(resource.fileName || resource.title))}`)
      reply.header("cache-control", "private, no-store")
      return reply.send(stream)
    } catch (error) {
      request.log.warn({ err: error, courseId: request.params.courseId, resourceId: request.params.resourceId }, "course resource unavailable")
      return validation(reply, "course_resource_unavailable", 404)
    }
  })

  app.get("/v1/history", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute(
      `SELECT c.id, c.title, c.content_version, done.completed_at, done.completion_source
       FROM user_course_completions done JOIN courses c ON c.id=done.course_id
       WHERE done.user_id=? ORDER BY done.completed_at DESC`, [user.id],
    )
    return { courses: rows }
  })

  app.post("/v1/tracks", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const targetIds = uniqueStrings(request.body?.targetCourseIds)
    if (targetIds.length < 1 || targetIds.length > 5) return validation(reply, "target_course_count_invalid")
    const [courseRows, relationRows, completedRows] = await Promise.all([
      db.execute(
        `SELECT c.id, c.module_id, c.lesson_id, c.title, c.summary, c.content_version, c.sort_order
         FROM courses c JOIN course_contents content
           ON content.course_id=c.id AND content.version=c.content_version
          AND content.status='PUBLISHED' AND JSON_LENGTH(JSON_EXTRACT(content.content_json, '$.steps')) > 0
         WHERE c.status='PUBLISHED'`,
      ).then(([rows]) => rows),
      db.execute("SELECT prerequisite_course_id, target_course_id, relation_type FROM course_relations WHERE status='PUBLISHED' AND relation_type='REQUIRED_PREREQUISITE'").then(([rows]) => rows),
      db.execute("SELECT course_id FROM user_course_completions WHERE user_id=?", [user.id]).then(([rows]) => rows),
    ])
    const courseIds = new Set(courseRows.map((row) => row.id))
    if (targetIds.some((id) => !courseIds.has(id))) return validation(reply, "target_course_not_available")
    if (completedRows.some((row) => targetIds.includes(row.course_id))) return validation(reply, "target_course_already_completed", 409)
    let graph
    try { graph = makeGraph(courseRows, relationRows, targetIds) } catch (error) { return validation(reply, error.message, 409) }
    const completed = new Set(completedRows.map((row) => row.course_id))
    const todoCount = graph.courseIds.filter((id) => !completed.has(id)).length
    if (todoCount > LARGE_PLAN_LIMIT && request.body?.confirmLargePlan !== true) {
      return validation(reply, "LARGE_PLAN_CONFIRMATION_REQUIRED", 409, { todoCount, limit: LARGE_PLAN_LIMIT, targetCourseIds: targetIds })
    }
    const targetSignature = signature(targetIds)
    const [existingRows] = await db.execute("SELECT * FROM learning_tracks WHERE user_id=? AND target_signature=? AND status IN ('GENERATING','ACTIVE') ORDER BY updated_at DESC LIMIT 1", [user.id, targetSignature])
    if (existingRows[0]) return { reused: true, track: await trackSummary(db, user.id, existingRows[0]) }
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const trackId = randomUUID(), pathId = randomUUID(), taskId = randomUUID()
      const targetTitles = courseRows.filter((row) => targetIds.includes(row.id)).map((row) => row.title)
      await connection.execute("INSERT INTO learning_tracks (id, user_id, target_signature, title, status, current_path_id) VALUES (?, ?, ?, ?, 'GENERATING', ?)", [trackId, user.id, targetSignature, targetTitles.join(" · "), pathId])
      for (const courseId of targetIds) await connection.execute("INSERT INTO track_targets (track_id, course_id) VALUES (?, ?)", [trackId, courseId])
      await connection.execute("INSERT INTO path_generation_tasks (id, track_id, status, catalog_version, started_at) VALUES (?, ?, 'RUNNING', ?, UTC_TIMESTAMP(3))", [taskId, trackId, CATALOG_VERSION])
      await connection.execute("INSERT INTO learning_paths (id, track_id, version_number, status, catalog_version) VALUES (?, ?, 1, 'ACTIVE', ?)", [pathId, trackId, CATALOG_VERSION])
      const courseById = new Map(courseRows.map((row) => [row.id, row])), nodeByCourse = new Map()
      const ordered = [...graph.courseIds].sort((a, b) => graph.levelByCourse.get(a) - graph.levelByCourse.get(b) || courseById.get(a).sort_order - courseById.get(b).sort_order)
      for (const courseId of ordered) {
        const course = courseById.get(courseId), nodeId = randomUUID(); nodeByCourse.set(courseId, nodeId)
        await connection.execute(
          `INSERT INTO learning_path_nodes (id, path_id, course_id, module_id, title_snapshot, content_version, learning_level, sort_order, status, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [nodeId, pathId, course.id, course.module_id, course.title, course.content_version, graph.levelByCourse.get(courseId), course.sort_order, completed.has(courseId) ? "COMPLETED" : "LOCKED", completed.has(courseId) ? new Date() : null],
        )
      }
      for (const relation of graph.relations) await connection.execute(
        "INSERT INTO learning_path_edges (id, path_id, prerequisite_node_id, target_node_id, relation_type) VALUES (?, ?, ?, ?, 'REQUIRED_PREREQUISITE')",
        [randomUUID(), pathId, nodeByCourse.get(relation.prerequisite_course_id), nodeByCourse.get(relation.target_course_id)],
      )
      await connection.execute("UPDATE learning_tracks SET status='ACTIVE' WHERE id=?", [trackId])
      await connection.execute("UPDATE path_generation_tasks SET status='SUCCESS', finished_at=UTC_TIMESTAMP(3) WHERE id=?", [taskId])
      await connection.commit()
      await refreshPath(db, user.id, pathId)
      await recordEvent(db, user.id, "track_created", { trackId, pathId, payload: { targetCourseIds: targetIds, todoCount } })
      const [createdRows] = await db.execute("SELECT * FROM learning_tracks WHERE id=?", [trackId])
      return reply.code(201).send({ reused: false, taskId, track: await trackSummary(db, user.id, createdRows[0]) })
    } catch (error) {
      await connection.rollback(); throw error
    } finally { connection.release() }
  })

  app.get("/v1/tracks", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute("SELECT * FROM learning_tracks WHERE user_id=? AND status<>'ARCHIVED' ORDER BY updated_at DESC", [user.id])
    return { tracks: await Promise.all(rows.map((track) => trackSummary(db, user.id, track))) }
  })

  app.get("/v1/tracks/:trackId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [tracks] = await db.execute("SELECT * FROM learning_tracks WHERE id=? AND user_id=? AND status<>'ARCHIVED' LIMIT 1", [request.params.trackId, user.id])
    const track = tracks[0]; if (!track) return validation(reply, "track_not_found", 404)
    await refreshPath(db, user.id, track.current_path_id)
    const [targets, nodes, edges, modules] = await Promise.all([
      db.execute("SELECT c.id, c.title FROM track_targets t JOIN courses c ON c.id=t.course_id WHERE t.track_id=? ORDER BY c.sort_order", [track.id]).then(([rows]) => rows),
      // A completed course is intentionally absent from the learner's catalogue.
      // Return its lesson id with the path node itself, rather than requiring a
      // client to reverse-map `course_id` through that filtered catalogue.
      db.execute(
        "SELECT n.*, c.lesson_id FROM learning_path_nodes n JOIN courses c ON c.id=n.course_id WHERE n.path_id=? ORDER BY n.learning_level, n.sort_order",
        [track.current_path_id],
      ).then(([rows]) => rows),
      db.execute("SELECT * FROM learning_path_edges WHERE path_id=?", [track.current_path_id]).then(([rows]) => rows),
      db.execute("SELECT id, name, description, icon, color, sort_order FROM course_modules WHERE status='PUBLISHED' ORDER BY sort_order").then(([rows]) => rows),
    ])
    return { track: await trackSummary(db, user.id, track), targets, modules: modules.map((module) => ({ ...module, courses: nodes.filter((node) => node.module_id === module.id) })), edges }
  })

  app.post("/v1/tracks/:trackId/archive", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [result] = await db.execute("UPDATE learning_tracks SET status='ARCHIVED', archived_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=? AND status<>'ARCHIVED'", [request.params.trackId, user.id])
    if (!result.affectedRows) return validation(reply, "track_not_found", 404)
    await recordEvent(db, user.id, "track_archived", { trackId: request.params.trackId })
    return { ok: true }
  })

  app.post("/v1/courses/:courseId/complete", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [courses] = await db.execute("SELECT id, content_version FROM courses WHERE id=? AND status='PUBLISHED' LIMIT 1", [request.params.courseId])
    const course = courses[0]; if (!course) return validation(reply, "course_not_found", 404)
    await db.execute(
      `INSERT INTO user_course_completions (user_id, course_id, content_version, completion_source) VALUES (?, ?, ?, 'MANUAL_CONFIRM')
       ON DUPLICATE KEY UPDATE content_version=VALUES(content_version), completion_source='MANUAL_CONFIRM', completed_at=UTC_TIMESTAMP(3)`,
      [user.id, course.id, course.content_version],
    )
    const [paths] = await db.execute("SELECT current_path_id FROM learning_tracks WHERE user_id=? AND status='ACTIVE' AND current_path_id IS NOT NULL", [user.id])
    for (const path of paths) await refreshPath(db, user.id, path.current_path_id)
    await recordEvent(db, user.id, "course_completed", { payload: { courseId: course.id } })
    return { ok: true }
  })

  app.post("/v1/courses/:courseId/revoke-completion", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [result] = await db.execute("DELETE FROM user_course_completions WHERE user_id=? AND course_id=?", [user.id, request.params.courseId])
    if (!result.affectedRows) return validation(reply, "completion_not_found", 404)
    const [paths] = await db.execute("SELECT current_path_id FROM learning_tracks WHERE user_id=? AND status='ACTIVE' AND current_path_id IS NOT NULL", [user.id])
    for (const path of paths) await refreshPath(db, user.id, path.current_path_id)
    await recordEvent(db, user.id, "course_completion_revoked", { payload: { courseId: request.params.courseId } })
    return { ok: true }
  })
}
