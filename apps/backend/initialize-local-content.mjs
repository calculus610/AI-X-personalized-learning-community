import { access, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { Client as MinioClient } from "minio"

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const sourceFile = process.env.LEGACY_COURSE_CONTENT_FILE || "/import/original-course-executor-data.json"
const assetsRoot = path.resolve(process.env.LEGACY_COURSE_ASSETS_DIR || "/import/original-course-assets")
const manifestFile = "/tmp/personalized-secure-resources.json"
const bucket = required("MINIO_BUCKET")
const objectStore = new MinioClient({
  endPoint: required("MINIO_ENDPOINT"),
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: required("MINIO_ACCESS_KEY"),
  secretKey: required("MINIO_SECRET_KEY"),
})

const mimeByExtension = {
  ".html": "text/html",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".zip": "application/zip",
}

function localResourcePath(url) {
  const value = String(url || "")
  let relativePath = ""
  if (value.startsWith("/course-assets/github/")) relativePath = value.slice("/course-assets/github/".length)
  else if (value.startsWith("/course-assets/")) relativePath = value.slice("/course-assets/".length)
  else return null
  const resolved = path.resolve(assetsRoot, relativePath)
  if (!resolved.startsWith(`${assetsRoot}${path.sep}`)) throw new Error(`Unsafe course resource path: ${relativePath}`)
  return { relativePath: relativePath.replaceAll("\\", "/"), resolved }
}

async function waitForObjectStore() {
  let lastError
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const exists = await objectStore.bucketExists(bucket)
      if (!exists) await objectStore.makeBucket(bucket)
      return
    } catch (error) {
      lastError = error
      if (attempt < 60) await delay(1000)
    }
  }
  throw lastError
}

const source = JSON.parse(await readFile(sourceFile, "utf8"))
if (!Array.isArray(source.lessons) || source.lessons.length !== 22) {
  throw new Error("Expected exactly 22 canonical course lessons")
}

const manifest = []
for (const lesson of source.lessons) {
  let orderIndex = 0
  for (const resource of lesson.resources || []) {
    const local = localResourcePath(resource.url)
    if (!local) continue
    await access(local.resolved)
    const metadata = await stat(local.resolved)
    manifest.push({
      lessonId: Number(lesson.id),
      type: resource.type || path.extname(local.resolved).slice(1) || "file",
      title: resource.title,
      description: resource.description ?? null,
      originalPath: local.relativePath,
      mimeType: mimeByExtension[path.extname(local.resolved).toLowerCase()] || "application/octet-stream",
      fileSize: metadata.size,
      orderIndex: orderIndex++,
    })
  }
}

await waitForObjectStore()
const uploaded = new Set()
for (const resource of manifest) {
  if (uploaded.has(resource.originalPath)) continue
  const sourcePath = path.resolve(assetsRoot, resource.originalPath)
  await objectStore.fPutObject(bucket, `legacy/github/${resource.originalPath}`, sourcePath, {
    "Content-Type": resource.mimeType,
  })
  uploaded.add(resource.originalPath)
}

await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
process.env.LEGACY_COURSE_CONTENT_FILE = sourceFile
process.env.LEGACY_RESOURCE_MANIFEST_FILE = manifestFile

await import("./seed-learning-catalog.mjs")
await import("./import-legacy-course-content.mjs")
await import("./audit-course-content.mjs")

console.log(JSON.stringify({
  ok: true,
  lessons: source.lessons.length,
  resourceReferences: manifest.length,
  uploadedObjects: uploaded.size,
}))
