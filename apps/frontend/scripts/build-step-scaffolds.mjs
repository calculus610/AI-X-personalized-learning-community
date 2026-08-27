import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const seedRoot = path.join(root, "services", "personalized-api", "seed")
const sourceRoot = path.join(seedRoot, "course-assets")
const courseData = JSON.parse(readFileSync(path.join(root, "lib", "original-course-executor-data.json"), "utf8"))

const VERSION = "2026-07-22-v1"
const SOURCE_DEFINITIONS = [
  {
    id: "artificial-intelligence-foundations",
    moduleId: "artificial_intelligence",
    phaseNumber: 1,
    fileName: "人工智能技术基础模块课程支架素材包.md",
  },
  {
    id: "intelligent-manufacturing",
    moduleId: "intelligent_manufacturing",
    phaseNumber: 2,
    fileName: "智能制造模块课程支架素材包.md",
  },
  {
    id: "electronic-circuits",
    moduleId: "electronic_circuits",
    phaseNumber: 3,
    fileName: "电子电路模块课程支架素材包.md",
  },
]

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizeSectionName(value) {
  const name = value.trim().toLowerCase()
  if (name.startsWith("这个步骤的目标")) return "goal"
  if (name.startsWith("compact")) return "compact"
  if (name.startsWith("standard")) return "standard"
  if (name.startsWith("detailed")) return "detailed"
  if (name.startsWith("证据要求")) return "evidence"
  if (name.startsWith("常见错误")) return "commonErrors"
  if (name.startsWith("排错路径")) return "troubleshooting"
  if (name.startsWith("补救任务")) return "remedialTask"
  if (name.startsWith("挑战任务")) return "challengeTask"
  if (name.startsWith("安全规则")) return "safety"
  if (name.startsWith("资源素材")) return "resources"
  return null
}

function cleanMarkdown(value) {
  return value
    .replace(/<!--[^]*?-->/g, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line))
    .join("\n")
    .trim()
}

function listFromMarkdown(value) {
  const lines = cleanMarkdown(value).split(/\r?\n/)
  const items = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("|"))
    .map((line) => line.replace(/^[-*+]\s+/, "").replace(/^\d+[.)、]\s*/, "").trim())
    .filter(Boolean)
  return [...new Set(items)]
}

function parseScaffoldDocument(document) {
  const matches = [...document.matchAll(/^###\s+Step\s+(\d+)\s*[：:]\s*(.+)$/gm)]
  return matches.map((match, index) => {
    const start = match.index + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index : document.length
    const block = document.slice(start, end)
    const sections = {}
    const sectionMatches = [...block.matchAll(/^####\s+(.+)$/gm)]
    sectionMatches.forEach((sectionMatch, sectionIndex) => {
      const key = normalizeSectionName(sectionMatch[1])
      if (!key) return
      const sectionStart = sectionMatch.index + sectionMatch[0].length
      const sectionEnd = sectionIndex + 1 < sectionMatches.length ? sectionMatches[sectionIndex + 1].index : block.length
      sections[key] = cleanMarkdown(block.slice(sectionStart, sectionEnd))
    })
    return {
      number: Number(match[1]),
      title: match[2].trim(),
      sections,
    }
  })
}

const sourceDocuments = SOURCE_DEFINITIONS.map((definition) => {
  const content = readFileSync(path.join(sourceRoot, definition.fileName), "utf8")
  return {
    ...definition,
    sha256: sha256(content),
    version: VERSION,
    objectKey: `curriculum/scaffolds/phase-${definition.phaseNumber}/${definition.fileName}`,
    content,
    steps: parseScaffoldDocument(content),
  }
})

const sourceById = new Map(sourceDocuments.map((source) => [source.id, source]))

const AI_STEP_MAP = new Map([
  [66, 1], [67, 2], [68, 3], [69, 4], [70, 4],
  [71, 5], [72, 5], [73, 5], [74, 5], [75, 6],
  [76, 7], [77, 7], [78, 7], [79, 7], [80, 8],
  [81, 8], [82, 8], [83, 8], [84, 8], [85, 9],
])

const MANUFACTURING_STEP_MAP = new Map([
  [86, 1], [87, 2], [88, 3], [89, 7], [90, 10],
  [91, 4], [92, 2], [93, 4], [94, 7], [95, 10],
  [96, 1], [97, 6], [98, 6], [99, 8], [100, 10],
  [101, 1], [102, 6], [103, 7], [104, 8], [105, 10],
  [106, 3], [107, 6], [108, 7], [109, 8], [110, 10],
])

function electronicSourceStep(title) {
  if (/证据|归档|整理|复盘|总结|交付/.test(title)) return 7
  if (/排错|调试|异常|故障|失败|优化|卡顿|诊断/.test(title)) return 6
  if (/实战|项目|协同|联动|控制|决策|执行器|具身/.test(title)) return 7
  if (/日志|串口|现象|数据质量|显示|可视化|观察/.test(title)) return 5
  if (/供电|电压|安全|电源|VCC|GND/.test(title)) return 2
  if (/GPIO|接线|接口|引脚|通信|坐标|I2C|SPI|UART|触摸/.test(title)) return 3
  if (/认识|理解|结构|架构|元件|传感器|屏幕|灯带|麦克风|摄像头/.test(title)) return 1
  return 4
}

function sourceForStep(step) {
  if (AI_STEP_MAP.has(step.id)) {
    return { sourceId: "artificial-intelligence-foundations", sourceStepNumber: AI_STEP_MAP.get(step.id) }
  }
  if (MANUFACTURING_STEP_MAP.has(step.id)) {
    return { sourceId: "intelligent-manufacturing", sourceStepNumber: MANUFACTURING_STEP_MAP.get(step.id) }
  }
  return { sourceId: "electronic-circuits", sourceStepNumber: electronicSourceStep(step.title) }
}

function mergeUnique(left, right) {
  const values = [
    ...(Array.isArray(left) ? left : left ? [left] : []),
    ...(Array.isArray(right) ? right : right ? [right] : []),
  ].map((item) => typeof item === "string" ? item.trim() : item).filter(Boolean)
  return [...new Set(values.map((item) => JSON.stringify(item)))].map((item) => JSON.parse(item))
}

function buildLayerPayload(step, scaffold, layer) {
  const legacyKey = layer === "compact" ? "guide" : layer
  const base = step.payloads?.[legacyKey] ?? step.payloads?.standard ?? step.payloads?.detailed ?? {}
  const section = scaffold.sections[layer] ?? ""
  return {
    ...base,
    title: base.title ?? step.title,
    goal: base.goal ?? cleanMarkdown(scaffold.sections.goal ?? ""),
    scaffold_instruction: section,
    evidence_requirement: mergeUnique(base.evidence_requirement, listFromMarkdown(scaffold.sections.evidence ?? "")),
    common_errors: mergeUnique(base.common_errors ?? base.common_mistakes, listFromMarkdown(scaffold.sections.commonErrors ?? "")),
    troubleshooting: mergeUnique(base.troubleshooting, listFromMarkdown(scaffold.sections.troubleshooting ?? "")),
    safety_check: base.safety_check || cleanMarkdown(scaffold.sections.safety ?? "") || null,
    remedial_task: cleanMarkdown(scaffold.sections.remedialTask ?? ""),
    challenge_task: cleanMarkdown(scaffold.sections.challengeTask ?? ""),
    resource_hints: listFromMarkdown(scaffold.sections.resources ?? ""),
  }
}

const phaseNumberForLesson = (lessonId) => {
  if (lessonId >= 17 && lessonId <= 20) return 1
  if (lessonId >= 21 && lessonId <= 25) return 2
  if (lessonId >= 4 && lessonId <= 9) return 3
  return 4
}

const stepScaffolds = courseData.lessons.flatMap((lesson) => lesson.steps.map((step) => {
  const mapping = sourceForStep(step)
  const source = sourceById.get(mapping.sourceId)
  const scaffold = source.steps.find((item) => item.number === mapping.sourceStepNumber)
  if (!scaffold) throw new Error(`Missing source scaffold ${mapping.sourceId} Step ${mapping.sourceStepNumber}`)
  const payloads = {
    compact: buildLayerPayload(step, scaffold, "compact"),
    standard: buildLayerPayload(step, scaffold, "standard"),
    detailed: buildLayerPayload(step, scaffold, "detailed"),
  }
  return {
    stepId: step.id,
    lessonId: lesson.id,
    stepCode: step.code,
    stepTitle: step.title,
    phaseNumber: phaseNumberForLesson(lesson.id),
    moduleId: source.moduleId,
    sourceId: source.id,
    sourceStepNumber: scaffold.number,
    sourceStepTitle: scaffold.title,
    payloads,
    contentHash: sha256(JSON.stringify(payloads)),
    version: VERSION,
  }
}))

const output = {
  version: VERSION,
  generatedAt: new Date().toISOString(),
  sources: sourceDocuments.map(({ content, steps, ...source }) => ({ ...source, sourceStepCount: steps.length })),
  stepScaffolds,
}

if (stepScaffolds.length !== 110) throw new Error(`Expected 110 Step scaffolds, got ${stepScaffolds.length}`)
for (const item of output.stepScaffolds) {
  for (const layer of ["compact", "standard", "detailed"]) {
    if (!item.payloads[layer]?.scaffold_instruction) throw new Error(`Step ${item.stepId} missing ${layer} scaffold content`)
  }
}

writeFileSync(path.join(seedRoot, "step-scaffolds.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8")
console.log(JSON.stringify({
  version: VERSION,
  sourceDocuments: output.sources.length,
  sourceSteps: sourceDocuments.reduce((total, source) => total + source.steps.length, 0),
  platformSteps: stepScaffolds.length,
}, null, 2))
