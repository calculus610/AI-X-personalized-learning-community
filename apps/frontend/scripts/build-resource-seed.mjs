import { readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = JSON.parse(readFileSync(path.join(root, "lib/original-course-executor-data.json"), "utf8"))
const outputDirectory = path.join(root, "services/personalized-api/seed")
mkdirSync(outputDirectory, { recursive: true })

const mimeByExtension = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".zip": "application/zip",
}

const resources = []
for (const lesson of source.lessons) {
  let orderIndex = 0
  for (const resource of lesson.resources) {
    const url = String(resource.url || "")
    let relativePath = ""
    if (url.startsWith("/course-assets/github/")) relativePath = url.slice("/course-assets/github/".length)
    else if (url.startsWith("/course-assets/")) relativePath = url.slice("/course-assets/".length)
    else continue
    const localPath = path.join(root, "public/original-course-assets", ...relativePath.split("/"))
    if (!existsSync(localPath)) continue
    const extension = path.extname(localPath).toLowerCase()
    resources.push({
      lessonId: lesson.id,
      type: resource.type || extension.slice(1) || "file",
      title: resource.title,
      description: resource.description || null,
      objectKey: `courses/imported/original-course-assets/${relativePath.replaceAll("\\", "/")}`,
      originalPath: relativePath.replaceAll("\\", "/"),
      mimeType: mimeByExtension[extension] || "application/octet-stream",
      fileSize: statSync(localPath).size,
      orderIndex: orderIndex++,
    })
  }
}

writeFileSync(path.join(outputDirectory, "resources.json"), JSON.stringify(resources, null, 2) + "\n")
console.log(`Wrote ${resources.length} real course resources.`)
