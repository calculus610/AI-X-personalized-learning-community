import { readFile } from "node:fs/promises"
import mysql from "mysql2/promise"

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const sourceFile = process.env.LEGACY_COURSE_CONTENT_FILE || "/import/original-course-executor-data.json"
const resourceManifestFile = process.env.LEGACY_RESOURCE_MANIFEST_FILE || "/import/resources.json"
const source = JSON.parse(await readFile(sourceFile, "utf8"))
const manifest = JSON.parse(await readFile(resourceManifestFile, "utf8"))
if (!Array.isArray(source.lessons) || source.lessons.length !== 22) throw new Error("Expected exactly 22 legacy lessons")
if (!Array.isArray(manifest)) throw new Error("Legacy resource manifest must be an array")

const assetByLegacyPath = new Map(manifest.map((asset) => [`/course-assets/github/${asset.originalPath}`, asset]))
const lessonById = new Map(source.lessons.map((lesson) => [Number(lesson.id), lesson]))

// A course id is the stable identity in V2. Multiple V2 courses may
// intentionally reuse one legacy lesson while the catalogue is being split
// into smaller targets. Keep those aliases explicit so a duplicate lesson_id
// can never be silently won by Map insertion order again.
const courseOverrides = {
  "build-smart-car": {
    title: "智能寻路小车",
    description: "把传感器状态、AI 标签或分类结果映射为电机和舵机动作，完成安全停止、避障或简单寻路。",
    code: "project_pathfinding_car",
  },
}

function contentForCourse(course, lesson) {
  const override = courseOverrides[course.id]
  const resources = lesson.resources.map((resource) => {
    const asset = assetByLegacyPath.get(resource.url)
    return {
      id: String(resource.id),
      lessonId: Number(resource.lessonId),
      type: resource.type,
      title: resource.title,
      description: resource.description ?? null,
      orderIndex: Number(resource.orderIndex ?? 0),
      objectKey: asset ? `legacy/github/${asset.originalPath}` : null,
      fileName: asset?.originalPath?.split("/").at(-1) ?? null,
      mimeType: asset?.mimeType ?? null,
      fileSize: asset?.fileSize ?? null,
      availability: asset ? "MIGRATED_OBJECT" : "REFERENCE_ONLY",
    }
  })
  return {
    schemaVersion: 2,
    source: "legacy-personalized-platform",
    sourceLessonId: Number(lesson.id),
    migratedAt: new Date().toISOString(),
    lesson: {
      id: Number(lesson.id),
      phaseId: Number(lesson.phaseId),
      code: override?.code ?? lesson.code,
      dayIndex: lesson.dayIndex,
      title: override?.title ?? lesson.title,
      description: override?.description ?? lesson.description ?? null,
      orderIndex: Number(lesson.orderIndex),
    },
    resources,
    steps: lesson.steps,
  }
}

const db = await mysql.createConnection({
  host: required("DATABASE_HOST"), port: Number(process.env.DATABASE_PORT || 3306), database: required("DATABASE_NAME"),
  user: required("DATABASE_USER"), password: required("DATABASE_PASSWORD"), charset: "utf8mb4",
})

try {
  const [courseRows] = await db.execute("SELECT id, lesson_id, content_version FROM courses WHERE status='PUBLISHED'")
  const courseLessonIds = new Set(courseRows.map((course) => Number(course.lesson_id)))
  const unmatchedLessons = source.lessons.filter((lesson) => !courseLessonIds.has(Number(lesson.id))).map((lesson) => lesson.id)
  const unmatchedCourses = courseRows.filter((course) => !lessonById.has(Number(course.lesson_id))).map((course) => course.id)
  if (unmatchedLessons.length || unmatchedCourses.length) throw new Error(`Lesson/course mapping mismatch: lessons=${unmatchedLessons.join(",")} courses=${unmatchedCourses.join(",")}`)

  await db.beginTransaction()
  let migratedResources = 0
  let migratedCourses = 0
  for (const course of courseRows) {
    const lesson = lessonById.get(Number(course.lesson_id))
    const content = contentForCourse(course, lesson)
    migratedResources += content.resources.filter((resource) => resource.availability === "MIGRATED_OBJECT").length
    await db.execute(
      `INSERT INTO course_contents (course_id, version, content_json, status) VALUES (?, ?, ?, 'PUBLISHED')
       ON DUPLICATE KEY UPDATE content_json=VALUES(content_json), status='PUBLISHED'`,
      [course.id, course.content_version, JSON.stringify(content)],
    )
    migratedCourses += 1
  }
  await db.commit()
  console.log(JSON.stringify({
    ok: true,
    legacyLessons: source.lessons.length,
    courses: migratedCourses,
    migratedResourceReferences: migratedResources,
    explicitCourseAliases: Object.keys(courseOverrides),
  }))
} catch (error) {
  await db.rollback()
  throw error
} finally {
  await db.end()
}
