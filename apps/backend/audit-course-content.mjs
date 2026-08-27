import mysql from "mysql2/promise"
import { Client as MinioClient } from "minio"

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const db = await mysql.createConnection({
  host: required("DATABASE_HOST"),
  port: Number(process.env.DATABASE_PORT || 3306),
  database: required("DATABASE_NAME"),
  user: required("DATABASE_USER"),
  password: required("DATABASE_PASSWORD"),
  charset: "utf8mb4",
})
const objectStore = new MinioClient({
  endPoint: required("MINIO_ENDPOINT"),
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: required("MINIO_ACCESS_KEY"),
  secretKey: required("MINIO_SECRET_KEY"),
})
const bucket = required("MINIO_BUCKET")

function jsonValue(value) {
  if (typeof value === "string") return JSON.parse(value)
  return value
}

try {
  const [rows] = await db.execute(
    `SELECT c.id, c.lesson_id, c.title, c.content_version, content.content_json
     FROM courses c
     LEFT JOIN course_contents content
       ON content.course_id=c.id AND content.version=c.content_version AND content.status='PUBLISHED'
     WHERE c.status='PUBLISHED' AND c.is_selectable_target=1
     ORDER BY c.module_id, c.sort_order, c.id`,
  )
  const failures = []
  const report = []
  for (const row of rows) {
    const content = row.content_json ? jsonValue(row.content_json) : null
    const steps = Array.isArray(content?.steps) ? content.steps : []
    const resources = Array.isArray(content?.resources) ? content.resources : []
    const missingObjects = []
    for (const resource of resources.filter((item) => item.availability === "MIGRATED_OBJECT")) {
      if (!resource.objectKey) {
        missingObjects.push(`${resource.id}:missing_object_key`)
        continue
      }
      try {
        await objectStore.statObject(bucket, resource.objectKey)
      } catch {
        missingObjects.push(`${resource.id}:${resource.objectKey}`)
      }
    }
    if (!content) failures.push(`${row.id}: current published content is missing`)
    if (!steps.length) failures.push(`${row.id}: steps are empty`)
    if (missingObjects.length) failures.push(`${row.id}: missing MinIO objects: ${missingObjects.join(", ")}`)
    report.push({
      courseId: row.id,
      lessonId: Number(row.lesson_id),
      title: row.title,
      steps: steps.length,
      resources: resources.length,
      missingObjects: missingObjects.length,
    })
  }
  console.log(JSON.stringify({ ok: failures.length === 0, courses: report.length, report, failures }, null, 2))
  if (failures.length) process.exitCode = 1
} finally {
  await db.end()
}
