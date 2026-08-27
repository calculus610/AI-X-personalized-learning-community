import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, "..")
const defaultDump = path.resolve(
  projectRoot,
  "..",
  "server_backups",
  "before-lesson-split-20260716-123811",
  "database.sql",
)
const dumpPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultDump
const outputPath = path.join(projectRoot, "lib", "original-course-executor-data.json")

const sql = await readFile(dumpPath, "utf8")

function decodeEscape(character) {
  return {
    0: "\0",
    b: "\b",
    n: "\n",
    r: "\r",
    t: "\t",
    Z: "\x1a",
  }[character] ?? character
}

function parseInsert(table) {
  const marker = `INSERT INTO \`${table}\` VALUES `
  const start = sql.indexOf(marker)
  if (start < 0) throw new Error(`Missing INSERT for ${table}`)
  const bodyStart = start + marker.length
  const endMarker = `;\n/*!40000 ALTER TABLE \`${table}\` ENABLE KEYS */`
  const end = sql.indexOf(endMarker, bodyStart)
  if (end < 0) throw new Error(`Missing INSERT terminator for ${table}`)
  const input = sql.slice(bodyStart, end)
  const rows = []
  let index = 0

  function skipWhitespace() {
    while (/\s/.test(input[index] ?? "")) index += 1
  }

  function parseString() {
    index += 1
    let value = ""
    while (index < input.length) {
      const character = input[index]
      if (character === "\\") {
        value += decodeEscape(input[index + 1])
        index += 2
        continue
      }
      if (character === "'") {
        if (input[index + 1] === "'") {
          value += "'"
          index += 2
          continue
        }
        index += 1
        return value
      }
      value += character
      index += 1
    }
    throw new Error(`Unterminated string in ${table}`)
  }

  function parseValue() {
    skipWhitespace()
    if (input[index] === "'") return parseString()
    const startIndex = index
    while (index < input.length && input[index] !== "," && input[index] !== ")") index += 1
    const token = input.slice(startIndex, index).trim()
    if (token === "NULL") return null
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token)
    return token
  }

  while (index < input.length) {
    skipWhitespace()
    if (input[index] === ",") {
      index += 1
      continue
    }
    if (input[index] !== "(") throw new Error(`Expected row at ${table}:${index}`)
    index += 1
    const row = []
    while (index < input.length) {
      row.push(parseValue())
      skipWhitespace()
      if (input[index] === ",") {
        index += 1
        continue
      }
      if (input[index] === ")") {
        index += 1
        break
      }
      throw new Error(`Expected comma or row end at ${table}:${index}`)
    }
    rows.push(row)
  }
  return rows
}

function parseJson(value, fallback = {}) {
  if (!value || typeof value !== "string") return fallback
  try {
    return JSON.parse(value)
  } catch (error) {
    throw new Error(`Invalid content_json: ${error.message}`)
  }
}

const lessons = parseInsert("lessons").map((row) => ({
  id: row[0],
  phaseId: row[1],
  code: row[2],
  dayIndex: row[3],
  title: row[4],
  description: row[5],
  orderIndex: row[6],
}))

const resources = parseInsert("lesson_resources").map((row) => ({
  id: row[0],
  lessonId: row[1],
  type: row[2],
  title: row[3],
  url: row[4],
  description: row[5],
  orderIndex: row[6],
}))

const steps = parseInsert("step_blocks").map((row) => ({
  id: row[0],
  lessonId: row[1],
  code: row[2],
  title: row[3],
  stepType: row[4],
  required: Boolean(row[5]),
  priority: row[6],
  estimatedMinutes: row[7],
  payloads: parseJson(row[8]),
  sourceRef: row[9],
  estimatedSeconds: row[11] ?? Number(row[7] ?? 10) * 60,
  orderIndex: row[12] ?? row[6],
}))

const output = {
  source: "Original Open University MySQL backup (2026-07-16)",
  lessons: lessons
    .filter((lesson) => lesson.id >= 4 && lesson.id <= 25)
    .map((lesson) => ({
      ...lesson,
      resources: resources
        .filter((resource) => resource.lessonId === lesson.id)
        .sort((a, b) => a.orderIndex - b.orderIndex),
      steps: steps
        .filter((step) => step.lessonId === lesson.id)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    })),
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8")
console.log(`Wrote ${output.lessons.length} lessons and ${output.lessons.reduce((sum, lesson) => sum + lesson.steps.length, 0)} steps to ${outputPath}`)
