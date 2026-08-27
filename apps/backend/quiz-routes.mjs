import { createHash, randomUUID } from "node:crypto"
import { userFor } from "./learning-routes.mjs"

const DIMENSIONS = [
  "核心概念理解",
  "工程操作判断",
  "程序与接口集成",
  "调试诊断能力",
  "AI协作与Prompt能力",
  "安全与证据意识",
]
const TYPES = ["single_choice", "multiple_choice", "true_false"]
const COURSE_VISIBLE_BANNED_RE = /(?:Day\s*\d+|day\s*\d+|平台开发者|开发者|后端表|数据库表|哈希链|adaptive_|user_learning_events|learning_events|quiz\s*生成逻辑|Quiz\s*生成逻辑)/gi

function invalid(reply, error, status = 400, extra = {}) {
  return reply.code(status).send({ error, ...extra })
}
function jsonValue(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return typeof value === "object" ? value : fallback
}
function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}
function isGenericStepTitle(value) {
  const s = text(value).toLowerCase()
  return !s || /^(step\s*\d+|preparation|core|practice|guided|challenge|learning content|学习内容)$/i.test(s)
}
function isUsefulQuizPhrase(value) {
  const s = text(value)
  if (!s || s.length < 4) return false
  if (/^(已上传|上传|完成|已完成|提交|截图|照片|文件齐全|参数可复现|practice|core|preparation)$/i.test(s)) return false
  if (/[\/／、，,：:；;和或与]$/.test(s)) return false
  if (/^(明确|说明|检查|记录|确认|完成)\s*$/.test(s)) return false
  return true
}
function isIncompleteVisibleText(value) {
  const s = text(value)
  if (!s || s.length < 6) return true
  COURSE_VISIBLE_BANNED_RE.lastIndex = 0
  if (COURSE_VISIBLE_BANNED_RE.test(s)) return true
  COURSE_VISIBLE_BANNED_RE.lastIndex = 0
  if (/[\/／、，,：:；;和或与]$/.test(s)) return true
  if (/^(关键检查点|当前知识点|课程核心能力)$/.test(s)) return true
  if (/^(补充检查项|关键验收点|不完整做法|Option\s+[A-D]|关键证据\s*\d+|错误做法\s*[A-D0-9]*)/.test(s)) return true
  if (/^(practice|core|preparation|guided|challenge)$/i.test(s)) return true
  return false
}
function cleanVisiblePhrase(value, fallback = "保留可复核的过程证据") {
  const s = cleanStudentText(value)
    .replace(/[\/／、，,：:；;和或与]+$/g, "")
    .trim()
  return isIncompleteVisibleText(s) ? fallback : s
}
function semanticStepTitle(step, fallbackTitle = "") {
  const payloads = step?.payloads || {}
  const candidates = [
    step?.title,
    payloads.standard?.title,
    payloads.detailed?.title,
    payloads.guide?.title,
    payloads.standard?.goal,
    payloads.detailed?.goal,
    payloads.guide?.goal,
    fallbackTitle,
  ].map(text).filter(Boolean)
  return candidates.find((item) => !isGenericStepTitle(item) && isUsefulQuizPhrase(item)) || text(fallbackTitle) || "当前学习任务"
}
function resolveLocale(request) {
  const candidate = String(
    request.body?.locale ||
    request.query?.locale ||
    request.headers["x-app-locale"] ||
    request.headers["accept-language"] ||
    "",
  ).toLowerCase()
  return candidate.startsWith("en") ? "en" : "zh"
}
function hashNumber(seed) {
  return Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16)
}
function pick(items, seed, count = 1) {
  const list = [...items].sort((a, b) => hashNumber(`${seed}:${JSON.stringify(a)}`) - hashNumber(`${seed}:${JSON.stringify(b)}`))
  return count === 1 ? list[0] : list.slice(0, count)
}
function shuffle(items, seed) {
  return [...items]
    .map((value, index) => ({ value, order: hashNumber(`${seed}:${index}:${JSON.stringify(value)}`) }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.value)
}
function phaseFromModule(moduleId) {
  const raw = String(moduleId || "")
  const match = raw.match(/phase[_-]?(\d+)/i)
  return match ? `Phase ${match[1]}` : raw || "Phase"
}
function displayPhaseFromModule(moduleId) {
  const raw = String(moduleId || "")
  const mapped = {
    ai_agent: "Phase 1",
    ai_manufacturing: "Phase 2",
    embedded_perception: "Phase 3",
    embodied_projects: "Phase 4",
  }[raw.toLowerCase()]
  return mapped || phaseFromModule(raw)
}
function titleOf(payload) {
  return text(payload?.title || payload?.goal || payload?.instruction || "")
}
function checklistItems(payload) {
  const raw = payload?.checklist || []
  if (!Array.isArray(raw)) return []
  return raw.map((item) => text(typeof item === "string" ? item : item?.item || item?.detail)).filter(Boolean)
}
function stepText(step) {
  const payloads = step.payloads || {}
  const blocks = [step.title, step.stepType, payloads.standard, payloads.detailed, payloads.guide].flatMap((block) => {
    if (!block || typeof block !== "object") return [block]
    return [block.title, block.goal, block.instruction, block.safety_check, block.completion_checkpoint, ...(block.common_mistakes || []), ...checklistItems(block)]
  })
  return text(blocks.filter(Boolean).join(" "))
}
function inferTags(raw) {
  const s = raw.toLowerCase()
  const tags = []
  const add = (needle, label) => { if (s.includes(needle.toLowerCase())) tags.push(label) }
  add("api", "API调用")
  add("prompt", "Prompt工程")
  add("schema", "Schema设计")
  add("json", "JSON结构")
  add("agent", "Agent编排")
  add("esp32", "ESP32-S3")
  add("led", "LED输出控制")
  add("按钮", "按键输入")
  add("button", "按键输入")
  add("gpio", "GPIO输入输出")
  add("usb", "USB连接与端口")
  add("串口", "串口日志")
  add("端口", "USB连接与端口")
  add("i2c", "I2C通信")
  add("oled", "OLED显示")
  add("dht", "温湿度传感")
  add("mqtt", "云边通信")
  add("http", "HTTP通信")
  add("传感", "传感器采集")
  add("摄像", "视觉识别")
  add("麦克风", "音频采集")
  add("edge", "边缘AI")
  add("arduino", "Arduino IO")
  add("舵机", "执行器控制")
  add("灯带", "多模态反馈")
  add("安全", "安全规范")
  add("证据", "学习证据")
  add("调试", "故障排查")
  return [...new Set(tags)].slice(0, 3)
}
function dimensionFor(tags, index) {
  const joined = tags.join("|")
  if (/安全|证据/.test(joined)) return "安全与证据意识"
  if (/调试|故障/.test(joined)) return "调试诊断能力"
  if (/API|JSON|Schema|ESP32|HTTP|MQTT|Arduino|GPIO|USB|I2C|串口/.test(joined)) return "程序与接口集成"
  if (/Agent|Prompt|AI/.test(joined)) return "AI协作与Prompt能力"
  if (/传感器|温湿度|OLED|LED|按键|视觉|音频|执行器/.test(joined)) return "工程操作判断"
  return DIMENSIONS[index % DIMENSIONS.length]
}
const MEMORY_KEYWORDS = [
  ["langchain", "LangChain", "AI协作与Prompt能力"],
  ["rag", "RAG检索增强", "AI协作与Prompt能力"],
  ["api", "API调用", "程序与接口集成"],
  ["appkey", "AppKey配置", "程序与接口集成"],
  ["schema", "Schema设计", "程序与接口集成"],
  ["json", "JSON结构", "程序与接口集成"],
  ["prompt", "Prompt工程", "AI协作与Prompt能力"],
  ["agent", "Agent编排", "AI协作与Prompt能力"],
  ["esp32", "ESP32-S3", "程序与接口集成"],
  ["mqtt", "云边通信", "程序与接口集成"],
  ["arduino", "Arduino IO", "工程操作判断"],
  ["edge impulse", "边缘AI训练", "工程操作判断"],
  ["摄像头", "视觉采集", "工程操作判断"],
  ["图像识别", "视觉识别", "工程操作判断"],
  ["麦克风", "音频采集", "工程操作判断"],
  ["舵机", "执行器控制", "工程操作判断"],
  ["灯带", "多模态反馈", "工程操作判断"],
  ["报错", "故障排查", "调试诊断能力"],
  ["失败", "故障排查", "调试诊断能力"],
  ["连不上", "连接故障", "调试诊断能力"],
  ["没有输出", "输出验证", "调试诊断能力"],
  ["安全", "安全规范", "安全与证据意识"],
]
const MEMORY_STOPWORDS = new Set(["what", "how", "why", "with", "from", "this", "that", "the", "and", "for", "can", "should", "about"])
const MEMORY_CHINESE_STOP_PHRASES = new Set(["我应该", "应该", "可以", "不能", "无法", "为什么", "怎么", "如何", "如果课程里没有讲"])

function extractMemoryFocuses(recentMessages, content) {
  const userMessages = recentMessages
    .filter((m) => String(m.role || "").toLowerCase() === "user")
    .map((m) => text(m.content))
    .filter((item) => item.length >= 4)
  const userText = userMessages.join("\n")
  if (!userText) return []
  const lowered = userText.toLowerCase()
  const courseText = normalizeSteps(content).map((step) => `${step.title} ${step.raw} ${step.tags.join(" ")}`).join(" ").toLowerCase()
  const focuses = []
  const addFocus = (label, source, dimension = "AI协作与Prompt能力") => {
    const clean = text(label).replace(/[?？。！!，,：:；;]/g, "")
    if (!clean || clean.length < 2 || clean.length > 40) return
    if (MEMORY_CHINESE_STOP_PHRASES.has(clean)) return
    if (focuses.some((item) => item.label.toLowerCase() === clean.toLowerCase())) return
    focuses.push({
      label: clean,
      source,
      abilityDimension: dimension,
      courseLinked: courseText.includes(clean.toLowerCase()) || courseText.includes(source.toLowerCase()),
    })
  }
  for (const [needle, label, dimension] of MEMORY_KEYWORDS) {
    if (lowered.includes(needle.toLowerCase()) || userText.includes(label)) addFocus(label, needle, dimension)
  }
  const phraseRegex = /([\u4e00-\u9fa5A-Za-z0-9+#._-]{2,32})(?:是什么|怎么|如何|为什么|报错|失败|连不上|没有输出|无法|不能)/g
  let phraseMatch
  while ((phraseMatch = phraseRegex.exec(userText)) && focuses.length < 5) {
    addFocus(phraseMatch[1], phraseMatch[1], "调试诊断能力")
  }
  const englishTerms = lowered.match(/[a-z][a-z0-9+#._-]{3,30}/g) || []
  for (const term of englishTerms) {
    if (focuses.length >= 5) break
    if (!MEMORY_STOPWORDS.has(term)) addFocus(term, term, "AI协作与Prompt能力")
  }
  return focuses.slice(0, 3)
}

function buildMemoryQuestion(focus, step, index, type, course, seed) {
  const courseKey = String(course.course_id || course.id || "course")
  const focusLabel = text(focus.label)
  const tags = [...new Set([focusLabel, "Agent交互记忆", ...(step.tags || []).slice(0, 1)])].slice(0, 4)
  const base = {
    question_id: `${courseKey}_${step.code}_memory_${index + 1}`,
    phase: displayPhaseFromModule(course.module_id),
    tags,
    ability_dimension: focus.abilityDimension || dimensionFor(tags, index),
    difficulty: "diagnostic",
    knowledge_point_id: `${courseKey}:memory:${focusLabel}:${step.code}`.replace(/\s+/g, "_").slice(0, 128),
    knowledge_point_label: `${focusLabel} · 课程问题诊断`.slice(0, 180),
    target_step_code: step.code,
    source_basis: `Agent对话记忆 / ${course.title} / ${step.title}`,
    related_memory_basis: focus.source,
  }
  if (type === "multiple_choice") {
    const options = {
      A: `先描述${focusLabel}相关现象，再定位输入、输出或配置环节`,
      B: `把${focusLabel}和“${step.title}”的验收标准对应起来`,
      C: "只记住一个名词，不结合实验现象判断",
      D: "保留关键日志、参数或连接状态，便于复盘原因",
    }
    return {
      ...base,
      type,
      stem: `遇到与“${focusLabel}”有关的疑问时，哪些处理方式更利于真正理解并排查问题？`,
      options,
      answer: ["A", "B", "D"],
      analysis: `有效学习不是只记概念名，而是把概念放回具体实验：现象是什么、输入输出在哪里、验收标准是什么。这样才能判断问题是理解偏差、配置错误还是操作遗漏。`,
    }
  }
  if (type === "true_false") {
    return {
      ...base,
      type,
      stem: `遇到“${focusLabel}”相关问题时，应先把它和当前实验的输入、输出、检查点或报错现象对应起来。`,
      options: { A: "对", B: "错" },
      answer: "A",
      analysis: `这是正确的排查顺序。先建立概念和实验现象之间的关系，再判断需要复习哪一块知识，能避免盲目搜索或反复重做。`,
    }
  }
  return {
    ...base,
    type: "single_choice",
    stem: `如果对“${focusLabel}”不确定，第一步最应该确认什么？`,
    options: {
      A: `它和“${step.title}”中的哪一个输入、输出、检查点或故障现象有关`,
      B: "它是不是一个看起来更高级的新名词",
      C: "是否可以跳过当前任务，直接改学这个概念",
      D: "是否只需要背下定义，不需要结合实验判断",
    },
    answer: "A",
    analysis: `先把概念和当前任务中的可观察现象对应起来，才能判断它到底影响配置、连接、数据流、模型输出还是验收标准。`,
  }
}

function normalizeSteps(content) {
  const steps = Array.isArray(content?.steps) ? content.steps : []
  return steps.map((step, index) => {
    const raw = stepText(step)
    const tags = inferTags(raw).filter((tag) => !isGenericStepTitle(tag))
    const displayTitle = semanticStepTitle(step, titleOf(step.payloads?.standard) || `Step ${index + 1}`)
    const titleTags = inferTags(displayTitle)
    const fallbackTag = !isGenericStepTitle(step.stepType) ? text(step.stepType) : (titleTags[0] || "实验验证能力")
    const checklist = [
      ...checklistItems(step.payloads?.standard),
      ...checklistItems(step.payloads?.detailed),
      ...checklistItems(step.payloads?.guide),
    ].filter(isUsefulQuizPhrase).slice(0, 8)
    return {
      id: Number(step.id || index + 1),
      code: String(step.code || `step_${index + 1}`),
      title: displayTitle,
      raw,
      tags: tags.length ? tags : [fallbackTag],
      checklist,
      payloads: step.payloads || {},
    }
  }).filter((item) => item.raw.length > 20)
}
function sanitizeQuestion(q) {
  return {
    question_id: q.question_id,
    phase: q.phase,
    type: q.type,
    stem: q.stem,
    options: q.options,
  }
}
function answerLabel(answer) {
  return Array.isArray(answer) ? answer.join("、") : String(answer)
}
function exactAnswer(userAnswer, answer) {
  if (Array.isArray(answer)) {
    const got = Array.isArray(userAnswer) ? userAnswer.map(String).sort() : []
    const exp = answer.map(String).sort()
    return got.length === exp.length && got.every((item, idx) => item === exp[idx])
  }
  return String(userAnswer ?? "") === String(answer)
}
function normalizeStem(value) {
  return text(value)
    .replace(/[“”‘’"'`，。？！、：；（）()【】\[\]\s]/g, "")
    .toLowerCase()
}
function stemSimilar(a, b) {
  const x = normalizeStem(a)
  const y = normalizeStem(b)
  if (!x || !y) return false
  if (x === y) return true
  const min = Math.min(x.length, y.length)
  if (min < 18) return false
  return x.includes(y.slice(0, Math.min(42, y.length))) || y.includes(x.slice(0, Math.min(42, x.length)))
}
function optionsFrom(seed, correct, distractors) {
  const cleanCorrect = cleanVisiblePhrase(correct, "保留可复核的关键证据")
  const pool = distractors
    .map((item, index) => cleanVisiblePhrase(item, `错误做法 ${index + 1}`))
    .filter(Boolean)
    .filter((item) => item !== cleanCorrect && !isIncompleteVisibleText(item))
  const unique = [...new Set(pool)]
  const safeWrong = [
    "跳过验证，直接进入下一项操作",
    "只保留最终截图，不说明过程依据",
    "先更换工具环境，不定位输入输出链路",
    "删除报错信息后重新开始",
    "只记录步骤名称，不说明判断依据",
  ]
  for (const item of safeWrong) {
    if (unique.length >= 3) break
    if (item !== cleanCorrect && !unique.includes(item)) unique.push(item)
  }
  const labels = ["A", "B", "C", "D"]
  const selected = shuffle([cleanCorrect, ...pick(unique, `${seed}:wrong`, 3)], `${seed}:answer-position`)
  const options = Object.fromEntries(labels.map((label, index) => [label, selected[index]]))
  return { options, answer: labels.find((label) => options[label] === cleanCorrect) || "A" }
}
function cleanStudentText(value) {
  return text(value)
    .replace(COURSE_VISIBLE_BANNED_RE, "")
    .replace(/\bQuiz\b/g, "小练")
    .replace(/后续分层\s*Step/g, "后续学习安排")
    .replace(/Step\s*分层/g, "学习步骤调整")
    .replace(/当前步骤的证据/g, "当前操作的证据")
    .replace(/本课\s*小练/g, "本次小练")
    .replace(/\s+/g, " ")
    .trim()
}
function cleanQuestionForStudent(q) {
  const cleaned = { ...q }
  delete cleaned.day
  cleaned.stem = cleanStudentText(cleaned.stem)
  cleaned.analysis = cleanStudentText(cleaned.analysis)
  cleaned.source_basis = cleanStudentText(cleaned.source_basis)
  cleaned.related_memory_basis = cleanStudentText(cleaned.related_memory_basis)
  cleaned.knowledge_point_label = cleanStudentText(cleaned.knowledge_point_label)
  if (cleaned.options && typeof cleaned.options === "object") {
    cleaned.options = Object.fromEntries(Object.entries(cleaned.options).map(([key, value]) => [key, cleanStudentText(value)]))
  }
  cleaned.tags = Array.isArray(cleaned.tags) ? cleaned.tags.map(cleanStudentText).filter(Boolean).slice(0, 4) : []
  return cleaned
}
function buildQuestion(step, index, type, course, seed) {
  const courseKey = String(course.course_id || course.id || "course")
  const tags = step.tags.length ? step.tags : ["课程核心能力"]
  const dimension = dimensionFor(tags, index)
  const checklist = step.checklist.length ? step.checklist : [
    text(step.payloads?.standard?.goal || step.payloads?.detailed?.goal || step.title),
    text(step.payloads?.standard?.completion_checkpoint || step.payloads?.detailed?.completion_checkpoint || "完成关键步骤并保留结果"),
  ].filter(Boolean)
  const rawTarget = pick(checklist, `${seed}:target:${index}`) || step.title
  const target = cleanVisiblePhrase(rawTarget, step.title || "本步骤关键完成标准")
  const concept = tags[0] || "课程核心能力"
  const secondary = cleanVisiblePhrase(
    pick(checklist.filter((item) => item !== rawTarget), `${seed}:secondary:${index}`) || checklist[0] || target,
    target,
  )
  const lens = assessmentLens(index, seed)
  const distractors = optionPool(checklist, target, step, concept, secondary)
  const base = {
    question_id: `${courseKey}_${step.code}_q${index + 1}`,
    phase: displayPhaseFromModule(course.module_id),
    tags: [...new Set([...tags.slice(0, 3), lens.tag])],
    ability_dimension: lens.dimension || dimension,
    assessment_lens: lens.tag,
    difficulty: index % 3 === 0 ? "applied" : index % 3 === 1 ? "diagnostic" : "conceptual",
    knowledge_point_id: `${courseKey}:${tags[0].replace(/\s+/g, "_")}:${step.code}`.slice(0, 128),
    knowledge_point_label: `${tags[0]} · ${step.title}`.slice(0, 180),
    target_step_code: step.code,
    source_basis: `${course.title} / ${step.title}`,
  }
  if (type === "multiple_choice") {
    const sourceItems = positiveEvidencePool(checklist, target, step, concept, secondary)
    while (sourceItems.length < 3) sourceItems.push(cleanVisiblePhrase(`保留第 ${sourceItems.length + 1} 项可复核证据`, "保留可复核证据"))
    const correctCount = sourceItems.length >= 3 && hashNumber(`${seed}:multi-count:${index}`) % 2 === 0 ? 3 : 2
    const correctItems = pick(sourceItems, `${seed}:multi:${index}`, correctCount)
    const wrongPool = [...new Set(flawedOptionPool(step, concept, secondary).filter((item) => !correctItems.includes(item)))]
    while (wrongPool.length < 4 - correctItems.length) wrongPool.push(`只看最终结果，不保存第 ${wrongPool.length + 1} 项依据`)
    const wrongItems = [].concat(pick(wrongPool, `${seed}:multiwrong:${index}`, 4 - correctItems.length))
    const labels = ["A", "B", "C", "D"]
    const all = shuffle([...correctItems, ...wrongItems], `${seed}:multiall:${index}`).slice(0, 4)
    const options = Object.fromEntries(labels.map((label, i) => [label, all[i]]))
    const answer = labels.filter((label) => correctItems.includes(options[label]))
    const multiStems = [
      lens.multi(step, concept, secondary),
      `结合“${step.title}”的输入、处理和输出，哪些证据能支撑你已经掌握？`,
      `如果要把“${concept}”用于新的实验任务，哪些条件不能省略？`,
      `排查“${secondary}”相关风险时，哪些处理方式更稳妥？`,
    ]
    return {
      ...base,
      type,
      stem: multiStems[index % multiStems.length],
      options,
      answer,
      analysis: `本题考察“${base.knowledge_point_label}”。正确做法应同时覆盖关键操作、验证现象和复盘依据；只看最终结果会降低排查和迁移能力。`,
    }
  }
  if (type === "true_false") {
    const truthful = hashNumber(`${seed}:tf:${index}`) % 2 === 0
    const trueStems = [
      lens.tfTrue(step, concept, secondary),
      `完成“${step.title}”时，应把关键输入、输出或验证现象记录为后续判断依据。`,
      `如果“${secondary}”是关键检查点，应把它和最终结果一起保存。`,
      `能解释为什么选择某个参数或检查点，通常比只给最终截图更能说明掌握程度。`,
    ]
    const falseStems = [
      lens.tfFalse(step, concept, secondary),
      `“${step.title}”只需要给出最终截图，不需要说明输入、输出和检查点。`,
      `如果结果偶然成功，就可以跳过“${secondary}”这类验收点。`,
      `只要记住“${step.title}”的名称，就等于已经掌握对应实验能力。`,
    ]
    return {
      ...base,
      type,
      stem: truthful ? trueStems[index % trueStems.length] : falseStems[index % falseStems.length],
      options: { A: "对", B: "错" },
      answer: truthful ? "A" : "B",
      analysis: truthful
        ? `这一步不仅要求完成操作，还要求留下可追溯证据，便于判断是否真正掌握。`
        : `只看最终现象无法定位中间错误，也无法支持后续分层推荐，应保留关键证据。`,
    }
  }
  const { options, answer } = optionsFrom(`${seed}:single:${index}`, target, distractors)
  const singleStems = [
    lens.single(step, concept, secondary),
    `运行结果和预期不一致时，“${step.title}”最先应该核对哪一项？`,
    `提交成果前，哪一项最能作为后续复盘和评分的依据？`,
    `从工程排错角度看，哪种做法最能把“${secondary}”转化为可验证判断？`,
  ]
  return {
    ...base,
    type,
    stem: singleStems[index % singleStems.length],
    options,
    answer,
    analysis: `本题对应“${base.knowledge_point_label}”。达成标准必须能反映本步骤的核心产出或检查点，而不是泛泛地继续下一步。`,
  }
}
function matchScopedStep(steps, scope = {}) {
  const code = text(scope.stepCode)
  const title = text(scope.stepTitle)
  const index = Number.isFinite(Number(scope.stepIndex)) ? Number(scope.stepIndex) : null
  if (code) {
    const byCode = steps.find((step) => step.code === code || String(step.id) === code)
    if (byCode) return byCode
  }
  if (index !== null && index >= 0 && steps[index]) return steps[index]
  if (title) {
    const normalizedTitle = normalizeStem(title)
    const byTitle = steps.find((step) => {
      const candidate = normalizeStem(`${step.title} ${step.raw}`)
      return candidate.includes(normalizedTitle) || normalizedTitle.includes(normalizeStem(step.title))
    })
    if (byTitle) return byTitle
  }
  return null
}
function diverseStepSelection(scored, scopedStep, seed) {
  const ordered = scored.map((item) => item.step).filter(Boolean)
  const byCode = new Map()
  const add = (step) => {
    if (!step) return
    const count = byCode.get(step.code) || 0
    const maxSameStep = 2
    if (count >= maxSameStep) return
    byCode.set(step.code, count + 1)
    selected.push(step)
  }
  const selected = []
  if (scopedStep) {
    add(scopedStep)
    add(scopedStep)
  }
  for (const step of ordered) add(step)
  for (const step of shuffle(ordered, `${seed}:selection-fill`)) {
    if (selected.length >= 10) break
    add(step)
  }
  let guard = 0
  while (selected.length < 10 && ordered.length && guard < 30) {
    selected.push(ordered[guard % ordered.length])
    guard += 1
  }
  return selected.slice(0, 10)
}

function alternateQuestionType(stepCode, currentType, usedFamilies, seed, index) {
  const order = shuffle(TYPES.filter((type) => type !== currentType), `${seed}:alt-type:${stepCode}:${index}`)
  return order.find((type) => !usedFamilies.has(`${stepCode}:${type}`)) || null
}

function flawedOptionPool(step, concept, secondary) {
  return [
    "跳过验证，直接进入下一项操作",
    "只保留最终截图，不说明过程依据",
    "先更换工具环境，不定位输入输出链路",
    "删除报错信息后重新开始",
    "只记录步骤名称，不说明判断依据",
    "不保存参数、日志或中间版本",
    `忽略“${cleanVisiblePhrase(secondary, "关键检查点")}”，只看最终是否成功`,
    `把“${cleanVisiblePhrase(concept, "核心概念")}”当作口号，不结合实验现象判断`,
  ].map((item, index) => cleanVisiblePhrase(item, `错误做法 ${index + 1}`)).filter(Boolean)
}

function positiveEvidencePool(checklist, target, step, concept, secondary) {
  const raw = [
    target,
    ...checklist,
    `说明“${cleanVisiblePhrase(concept, "核心概念")}”与当前输入、处理、输出的关系`,
    `保留“${cleanVisiblePhrase(secondary, "关键检查点")}”对应的参数、现象或日志`,
    `记录失败现象、定位依据、修复动作和最终验证结果`,
    `能解释为什么当前结果满足“${cleanVisiblePhrase(step.title, "本步骤")}”的完成标准`,
  ]
  return [...new Set(raw.map((item, index) => cleanVisiblePhrase(item, `关键证据 ${index + 1}`)).filter(Boolean))]
}

function optionPool(checklist, target, step, concept, secondary) {
  return flawedOptionPool(step, concept, secondary).filter((item) => item !== target)
}

function assessmentLens(index, seed) {
  const lenses = [
    {
      tag: "概念辨析",
      dimension: "概念理解与边界判断",
      single: (step, concept) => `在“${step.title}”中，哪一项最能区分“${concept}”的核心概念和表面操作？`,
      multi: (step, concept) => `围绕“${concept}”建立理解时，哪些判断能说明不是只记住了步骤名称？`,
      tfTrue: (step, concept, secondary) => `理解“${concept}”时，需要能解释“${secondary}”为什么会影响“${step.title}”的结果。`,
      tfFalse: (step, concept) => `只要能复述“${concept}”这个词，就说明已经掌握了“${step.title}”的实验能力。`,
    },
    {
      tag: "操作顺序",
      dimension: "工程流程与步骤组织",
      single: (step) => `执行“${step.title}”时，哪一项最适合作为优先处理的关键动作？`,
      multi: (step) => `为了让“${step.title}”的流程更稳定，哪些动作应该被纳入操作顺序？`,
      tfTrue: (step) => `“${step.title}”应先确认输入条件，再观察输出结果，最后记录可复盘证据。`,
      tfFalse: (step) => `“${step.title}”可以先看最终结果，等失败后再补充输入条件和过程记录。`,
    },
    {
      tag: "异常诊断",
      dimension: "排错与诊断能力",
      single: (step, concept) => `当“${step.title}”结果异常时，哪一项最能帮助定位“${concept}”相关问题？`,
      multi: (step) => `“${step.title}”出现异常时，哪些信息能帮助判断问题来源？`,
      tfTrue: (step) => `“${step.title}”出错时，保留现象、参数和日志，比直接重做更有利于定位原因。`,
      tfFalse: (step) => `如果“${step.title}”失败，删除报错信息并立刻换工具通常是最可靠的第一步。`,
    },
    {
      tag: "验收判断",
      dimension: "结果验证与质量评估",
      single: (step) => `判断“${step.title}”是否达标时，哪一项最能作为可靠验收依据？`,
      multi: (step) => `对“${step.title}”做验收时，哪些证据能共同说明结果可靠？`,
      tfTrue: (step) => `“${step.title}”的验收应同时关注结果、过程和关键检查点。`,
      tfFalse: (step) => `只要“${step.title}”最终看起来成功，就不需要说明验收标准。`,
    },
    {
      tag: "证据链",
      dimension: "学习证据与可追溯表达",
      single: (step) => `完成“${step.title}”后，哪一项最能支撑后续复盘和学习画像更新？`,
      multi: (step) => `为了让“${step.title}”形成可追溯证据，哪些内容应该保留下来？`,
      tfTrue: (step) => `完成“${step.title}”时，应把关键输入、输出或验证现象记录为后续判断依据。`,
      tfFalse: (step) => `“${step.title}”只需要保留最终截图，不需要记录输入、输出和检查点。`,
    },
    {
      tag: "迁移应用",
      dimension: "知识迁移与举一反三",
      single: (step, concept) => `把“${step.title}”迁移到新任务时，哪一项最能帮助复用“${concept}”能力？`,
      multi: (step) => `如果要把“${step.title}”复用到类似任务，哪些信息最值得保留？`,
      tfTrue: (step, concept) => `能把“${concept}”用于新的任务场景，比只完成一次“${step.title}”更能说明掌握程度。`,
      tfFalse: (step) => `只要本次“${step.title}”成功，就不需要考虑它能否迁移到类似任务。`,
    },
    {
      tag: "安全边界",
      dimension: "安全意识与边界控制",
      single: (step) => `在“${step.title}”开始前，哪一项最能降低安全风险和误操作成本？`,
      multi: (step) => `围绕“${step.title}”控制风险时，哪些做法更符合安全边界要求？`,
      tfTrue: (step) => `涉及设备、接口或外部服务时，“${step.title}”应先确认环境、参数和权限。`,
      tfFalse: (step) => `为了提高速度，“${step.title}”可以先跳过安全边界检查，出问题后再处理。`,
    },
    {
      tag: "决策解释",
      dimension: "技术表达与决策说明",
      single: (step) => `如果需要解释“${step.title}”的处理选择，哪一项最能体现清晰的技术判断？`,
      multi: (step) => `汇报“${step.title}”时，哪些内容能让他人判断你的选择是否合理？`,
      tfTrue: (step) => `能说明“${step.title}”为什么这样做，比只给出结果更能体现工程判断。`,
      tfFalse: (step) => `“${step.title}”只要结果正确，就没有必要解释选择依据。`,
    },
  ]
  return lenses[index % lenses.length]
}

function stemConflict(stem, generated, priorStems) {
  return generated.some((item) => stemSimilar(stem, item)) || priorStems.some((item) => stemSimilar(stem, item))
}

function optionSignature(options = {}) {
  return Object.values(options)
    .map((value) => normalizeStem(value))
    .filter(Boolean)
    .sort()
    .join("|")
}

function stemFrame(stem) {
  const s = text(stem)
  if (/^面对/.test(s)) return "面对"
  if (/^如果/.test(s)) return "如果"
  if (/^完成/.test(s)) return "完成"
  if (/^为了/.test(s)) return "为了"
  if (/^在“/.test(s)) return "在"
  if (/^围绕/.test(s)) return "围绕"
  if (/^当/.test(s)) return "当"
  if (/^判断/.test(s)) return "判断"
  if (/^汇报/.test(s)) return "汇报"
  return normalizeStem(s).slice(0, 8)
}

function questionHasQualityIssue(q) {
  if (!q || isIncompleteVisibleText(q.stem)) return true
  const optionValues = Object.values(q.options || {})
  if (q.type === "true_false") {
    const values = optionValues.map((value) => text(value))
    return values.length < 2 || !values.includes("对") || !values.includes("错")
  }
  if (q.type !== "true_false" && optionValues.length < 4) return true
  if (optionValues.some((value) => isIncompleteVisibleText(value))) return true
  const normalized = optionValues.map((value) => normalizeStem(value)).filter(Boolean)
  if (new Set(normalized).size !== normalized.length) return true
  if (q.type === "multiple_choice" && (!Array.isArray(q.answer) || q.answer.length < 2)) return true
  if (q.type === "single_choice" && Array.isArray(q.answer)) return true
  return false
}

function fallbackStemFor(q, index) {
  const label = cleanVisiblePhrase(q.knowledge_point_label || q.tags?.[0] || "当前知识点", "当前知识点")
  const stems = {
    single_choice: [
      `围绕“${label}”进行判断时，哪一项最能说明已经理解关键原理和验收标准？`,
      `如果“${label}”相关结果不稳定，最应优先核对哪类证据？`,
      `在迁移到相似任务时，哪一项最能帮助判断“${label}”是否真正掌握？`,
    ],
    multiple_choice: [
      `为了证明“${label}”已经掌握，哪些证据需要同时保留？`,
      `排查“${label}”相关问题时，哪些做法能形成可复核的判断链？`,
      `把“${label}”应用到新任务时，哪些条件不能省略？`,
    ],
    true_false: [
      `掌握“${label}”不仅要得到最终结果，还要能说明关键条件、判断依据和验证现象。`,
      `只展示“${label}”的最终现象，而不说明输入、过程和检查点，通常不足以证明真正掌握。`,
    ],
  }
  return stems[q.type]?.[index % stems[q.type].length] || `围绕“${label}”，哪一项最符合工程学习中的验证要求？`
}

function uniqueFallbackStemFor(q, index, usedFrames) {
  const label = cleanVisiblePhrase(q.knowledge_point_label || q.tags?.[0] || "当前知识点", "当前知识点")
  const candidates = [
    fallbackStemFor(q, index),
    `从输入条件、执行过程和输出现象看，哪一项最能验证“${label}”已经掌握？`,
    `准备提交“${label}”相关成果时，哪一项最能支持后续复盘？`,
    `把“${label}”迁移到相似任务时，哪些判断依据最不能省略？`,
    `遇到“${label}”相关异常时，哪一项最能帮助定位原因？`,
    `复查“${label}”时，哪一项最能区分偶然成功和稳定掌握？`,
  ]
  return candidates.find((stem) => !usedFrames.has(stemFrame(stem))) || candidates[index % candidates.length]
}

function repairQuestion(q, index, seed) {
  const repaired = { ...q }
  if (isIncompleteVisibleText(repaired.stem)) repaired.stem = fallbackStemFor(repaired, index)
  if (repaired.type === "true_false") {
    repaired.options = { A: "对", B: "错" }
    repaired.answer = repaired.answer === "B" ? "B" : "A"
    return repaired
  }
  const labels = ["A", "B", "C", "D"]
  const oldOptions = repaired.options || {}
  const correctLabels = new Set(Array.isArray(repaired.answer) ? repaired.answer : [repaired.answer].filter(Boolean))
  const correctPool = [
    "保留可复核的过程证据、关键参数和最终现象",
    "说明输入条件、处理过程、输出结果之间的对应关系",
    "记录失败现象、定位依据、修复动作和最终验证结果",
    "用完成标准判断结果是否可靠，而不是只看表面现象",
    "把关键检查点与实际现象对应起来，说明为什么判断成立",
    "同时保留中间版本、参数变化和最终验收结论",
    "说明风险点、处理选择和验证依据，便于他人复查",
    "能把本次操作方法迁移到相似任务，并说明适用边界",
  ]
  const wrongPool = [
    "跳过验证，直接进入下一项操作",
    "只保留最终截图，不说明过程依据",
    "先更换工具环境，不定位输入输出链路",
    "删除报错信息后重新开始",
    "只记录步骤名称，不说明判断依据",
    "只背概念名称，不结合实验输入和输出判断",
    "把偶然成功当成稳定掌握，不再复查关键条件",
    "忽略异常现象，只根据最终展示效果判断完成",
    "不区分概念理解、操作步骤和验收证据的边界",
  ]
  const used = new Set()
  const fixed = {}
  for (const label of labels) {
    let value = cleanVisiblePhrase(oldOptions[label], "")
    if (isIncompleteVisibleText(value) || used.has(normalizeStem(value))) {
      const pool = correctLabels.has(label) ? correctPool : wrongPool
      value = pool.find((item) => !used.has(normalizeStem(item)))
        || [...correctPool, ...wrongPool].find((item) => !used.has(normalizeStem(item)))
        || "说明输入、处理、输出和验收之间的对应关系"
    }
    used.add(normalizeStem(value))
    fixed[label] = value
  }
  repaired.options = fixed
  if (repaired.type === "single_choice" && !labels.includes(repaired.answer)) repaired.answer = pick(labels, `${seed}:repair-answer:${index}`)
  if (repaired.type === "multiple_choice" && (!Array.isArray(repaired.answer) || !repaired.answer.length)) repaired.answer = ["A", "B"]
  return repaired
}

function qualityGateQuestions(questions, selectedSteps, course, seed, priorStems) {
  const optionSigs = new Set()
  const usedStems = []
  const frameCounts = new Map()
  return questions.map((initial, index) => {
    let q = initial
    let attempts = 0
    while (attempts < 10) {
      const sig = optionSignature(q.options)
      const frame = stemFrame(q.stem)
      const issue = questionHasQualityIssue(q)
        || stemConflict(q.stem, usedStems, priorStems)
        || (sig && optionSigs.has(sig))
        || ((frameCounts.get(frame) || 0) >= 1)
      if (!issue) break
      const step = selectedSteps[(index + attempts + 1) % Math.max(1, selectedSteps.length)] || selectedSteps[index]
      if (step) q = cleanQuestionForStudent(buildQuestion(step, index + 101 + attempts * 13, q.type || TYPES[index % TYPES.length], course, `${seed}:quality:${index}:${attempts}`))
      attempts += 1
    }
    q = repairQuestion(q, index, seed)
    if ((frameCounts.get(stemFrame(q.stem)) || 0) >= 1) {
      q = { ...q, stem: uniqueFallbackStemFor(q, index + usedStems.length + 3, new Set(frameCounts.keys())) }
    }
    const finalSig = optionSignature(q.options)
    if (finalSig && optionSigs.has(finalSig)) {
      q = repairQuestion({ ...q, stem: fallbackStemFor(q, index + 7), options: {} }, index, `${seed}:last-repair:${index}`)
    }
    optionSigs.add(optionSignature(q.options))
    usedStems.push(q.stem)
    const frame = stemFrame(q.stem)
    frameCounts.set(frame, (frameCounts.get(frame) || 0) + 1)
    return q
  })
}

function buildQuestions(course, content, recentMessages, priorStems, weakRows, scope = {}) {
  const steps = normalizeSteps(content)
  const scopedStep = matchScopedStep(steps, scope)
  const memoryText = recentMessages.map((m) => m.content).join(" ")
  const weakLabels = weakRows.map((row) => row.knowledge_point_label).join(" ")
  const scored = steps.map((step, index) => ({
    step,
    score: index
      + (scopedStep && step.code === scopedStep.code ? -40 : 0)
      + (step.tags.some((tag) => memoryText.includes(tag)) ? -20 : 0)
      + (step.tags.some((tag) => weakLabels.includes(tag)) ? -15 : 0),
  })).sort((a, b) => a.score - b.score)
  const seed = `${course.course_id || course.id || "course"}:${scope.stepCode || scope.stepTitle || "course"}:${Date.now()}:${recentMessages.length}:${priorStems.length}:${hashNumber(memoryText + weakLabels)}`
  const selected = diverseStepSelection(scored, scopedStep, seed)
  const typePlan = shuffle([
    "single_choice", "single_choice", "single_choice", "single_choice",
    "multiple_choice", "multiple_choice", "multiple_choice",
    "true_false", "true_false", "true_false",
  ], seed)
  const questions = selected.map((step, index) => buildQuestion(step, index, typePlan[index] || TYPES[index % TYPES.length], course, seed))
  const memoryFocuses = extractMemoryFocuses(recentMessages, content)
  for (let i = 0; i < Math.min(2, memoryFocuses.length, questions.length); i += 1) {
    const targetStep = scored[i % Math.max(1, scored.length)]?.step || selected[i]
    const type = typePlan[i] || TYPES[i % TYPES.length]
    questions[i] = buildMemoryQuestion(memoryFocuses[i], targetStep, i, type, course, seed)
  }
  const used = new Set()
  const usedFamilies = new Set()
  const targetTypeCounts = { single_choice: 4, multiple_choice: 3, true_false: 3 }
  const typeCounts = questions.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1
    return acc
  }, {})
  for (const [index] of questions.entries()) {
    let q = questions[index]
    const familyKey = `${q.target_step_code || "step"}:${q.type || "single_choice"}`
    if (usedFamilies.has(familyKey)) {
      const alternativeType = alternateQuestionType(q.target_step_code || "step", q.type, usedFamilies, seed, index)
      const canPreserveTypeBalance = alternativeType
        && (typeCounts[q.type] || 0) > (targetTypeCounts[q.type] || 0)
        && (typeCounts[alternativeType] || 0) < (targetTypeCounts[alternativeType] || 0)
      if (alternativeType && selected[index]) {
        if (canPreserveTypeBalance) {
          typeCounts[q.type] = (typeCounts[q.type] || 0) - 1
          typeCounts[alternativeType] = (typeCounts[alternativeType] || 0) + 1
          q = buildQuestion(selected[index], index + 17, alternativeType, course, `${seed}:alt:${index}`)
          questions[index] = q
        } else {
          q = buildQuestion(selected[index], index + 17, q.type, course, `${seed}:alt-same-type:${index}`)
          questions[index] = q
        }
      }
    }
    usedFamilies.add(`${q.target_step_code || "step"}:${q.type || "single_choice"}`)
    let normalized = normalizeStem(q.stem)
    let attempts = 0
    while ((used.has(normalized) || stemConflict(q.stem, [...used], priorStems)) && selected[index] && attempts < 8) {
      q = buildQuestion(selected[index], index + 31 + attempts * 11, q.type, course, `${seed}:diverse-rebuild:${index}:${attempts}`)
      questions[index] = q
      normalized = normalizeStem(q.stem)
      attempts += 1
    }
    used.add(normalized)
  }
  const cleaned = questions.map(cleanQuestionForStudent)
  return qualityGateQuestions(cleaned, selected, course, seed, priorStems)
}
async function ownedNode(db, userId, trackId, routeStepId) {
  const [rows] = await db.execute(
    `SELECT t.id track_id, t.current_path_id, n.id route_step_id, n.course_id, n.path_id, n.learning_level, n.sort_order,
            c.id course_id, c.lesson_id, c.module_id, c.title, c.summary, c.content_version, content.content_json
     FROM learning_tracks t
     JOIN learning_path_nodes n ON n.path_id=t.current_path_id
     JOIN courses c ON c.id=n.course_id
     JOIN course_contents content ON content.course_id=c.id AND content.version=c.content_version AND content.status='PUBLISHED'
     WHERE t.id=? AND t.user_id=? AND n.id=? LIMIT 1`,
    [trackId, userId, routeStepId],
  )
  return rows[0] ?? null
}
function phaseStageAliases(moduleId) {
  const id = String(moduleId || "").toLowerCase()
  if (id === "ai_agent") return ["phase1", "phase_1", "1"]
  if (id === "ai_manufacturing") return ["phase2", "phase_2", "2"]
  if (id === "embedded_perception") return ["phase3", "phase_3", "3"]
  if (id === "embodied_projects") return ["phase4", "phase_4", "4"]
  return []
}

function englishCourseTitle(title, moduleId) {
  const raw = text(title)
  const titleMap = [
    [/电子硬件入门|开发板|LED|按钮|接口/, "Electronics Hardware Fundamentals"],
    [/AI\s*辅助三维|三维|切片|3D|建模/, "AI-assisted 3D Modeling and Slicing"],
    [/刀路|CNC|虚实|数控/, "AI Toolpaths and Simulation-to-Reality Check"],
    [/加工质量|质量评价|数据分析/, "Manufacturing Quality Evaluation and Data Analysis"],
    [/传感器|屏幕|I2C|OLED|DHT/, "Sensor Communication and Screen UI Design"],
    [/摄像头|视觉|Edge\s*Impulse/, "Camera Vision and Edge Impulse"],
    [/超声波|距离|智能决策/, "Ultrasonic Sensing and Decision Making"],
    [/执行器|舵机|电机|灯带/, "Multi-actuator Control Fundamentals"],
    [/AI\s*标签|设备联动/, "AI Labels and Device Coordination"],
    [/具身|协同|机器人/, "Embodied AI Coordination Practice"],
    [/寻路|小车/, "Smart Route-following Car"],
    [/Agent|Handoff|RAG|Tool/, "AI Agent Engineering Practice"],
    [/模型评测|模型选择|路由/, "Model Evaluation and Routing"],
  ]
  const matched = titleMap.find(([pattern]) => pattern.test(raw))
  if (matched) return matched[1]
  const moduleMap = {
    ai_agent: "AI Agent Engineering",
    ai_manufacturing: "AI Manufacturing Practice",
    embedded_perception: "Embedded Perception Practice",
    embodied_projects: "Embodied AI Project Practice",
  }
  const moduleTitle = moduleMap[String(moduleId || "").toLowerCase()]
  if (moduleTitle) return moduleTitle
  return raw && !/[\u4e00-\u9fff]/.test(raw) ? raw : "Current Course"
}

async function recentAgentMemory(db, userId, context = {}, limit = 16) {
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 12))
  const params = [userId]
  const filters = ["idx.user_id=?"]
  const phaseAliases = phaseStageAliases(context.moduleId)
  if (context.moduleId || phaseAliases.length) {
    const phaseFilters = []
    if (context.moduleId) { phaseFilters.push("s.module_id=?"); params.push(context.moduleId) }
    if (phaseAliases.length) {
      phaseFilters.push(`LOWER(COALESCE(s.stage_id,'')) IN (${phaseAliases.map(() => "?").join(",")})`)
      params.push(...phaseAliases)
    }
    filters.push(`(${phaseFilters.join(" OR ")})`)
  }
  const [rows] = await db.execute(
    `SELECT m.role, m.content, m.created_at, s.track_id, s.route_step_id, s.course_id
     FROM agent_messages_index idx
     JOIN memory_messages m ON m.id=idx.memory_message_id
     JOIN agent_sessions s ON s.id=idx.session_id
     WHERE ${filters.join(" AND ")}
     ORDER BY m.created_at DESC LIMIT ${safeLimit}`,
    params,
  )
  return rows.reverse().map((row) => ({ role: row.role, content: text(row.content).slice(0, 1200), createdAt: row.created_at }))
}
async function priorQuestionStems(db, userId, courseId) {
  const [rows] = await db.execute(
    `SELECT questions_json FROM adaptive_quiz_sessions
     WHERE user_id=? AND course_id=?
     ORDER BY created_at DESC LIMIT 8`,
    [userId, courseId],
  )
  return rows.flatMap((row) => jsonValue(row.questions_json, [])).map((q) => q.stem).filter(Boolean)
}
async function weakMastery(db, userId) {
  const [rows] = await db.execute(
    `SELECT knowledge_point_id, knowledge_point_label, score, evidence_count
     FROM adaptive_knowledge_mastery
     WHERE user_id=? ORDER BY score ASC, evidence_count DESC LIMIT 10`,
    [userId],
  )
  return rows
}
function sanitizeQuiz(row, questions, report = null) {
  return {
    quizId: row.id,
    trackId: row.track_id,
    routeStepId: row.route_step_id,
    courseId: row.course_id,
    lessonId: row.lesson_id ? Number(row.lesson_id) : null,
    phase: row.phase_id,
    title: row.title,
    questionCount: Number(row.question_count),
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    questions: questions.map(sanitizeQuestion),
    report,
  }
}
function compactText(value, max = 120) {
  const raw = text(value)
  return raw.length > max ? `${raw.slice(0, max)}…` : raw
}
function adaptivePayload(step, level) {
  const payloads = step.payloads || {}
  const detailed = payloads.detailed || payloads.guide || payloads.standard || {}
  const standard = payloads.standard || payloads.guide || payloads.detailed || {}
  if (level === "detailed") {
    return {
      supportLevel: "detailed",
      title: text(detailed.title || step.title),
      goal: text(detailed.goal || standard.goal || ""),
      instruction: text(detailed.instruction || standard.instruction || ""),
      checklist: checklistItems(detailed).length ? checklistItems(detailed) : checklistItems(standard),
      completionCheckpoint: text(detailed.completion_checkpoint || standard.completion_checkpoint || ""),
      reason: "依据最近 Quiz 薄弱点，使用更细的操作粒度。",
    }
  }
  if (level === "brief") {
    return {
      supportLevel: "brief",
      title: text(standard.title || step.title),
      goal: compactText(standard.goal || ""),
      instruction: compactText(standard.instruction || "", 90),
      checklist: checklistItems(standard).slice(0, 2),
      completionCheckpoint: compactText(standard.completion_checkpoint || "", 90),
      reason: "依据最近 Quiz 表现，压缩为方向性步骤。",
    }
  }
  return {
    supportLevel: "standard",
    title: text(standard.title || step.title),
    goal: text(standard.goal || ""),
    instruction: text(standard.instruction || ""),
    checklist: checklistItems(standard),
    completionCheckpoint: text(standard.completion_checkpoint || ""),
    reason: "保持标准学习粒度。",
  }
}
async function nextNode(db, node) {
  const [rows] = await db.execute(
    `SELECT id, course_id FROM learning_path_nodes
     WHERE path_id=? AND (learning_level > ? OR (learning_level=? AND sort_order > ?))
     ORDER BY learning_level, sort_order LIMIT 1`,
    [node.path_id, Number(node.learning_level), Number(node.learning_level), Number(node.sort_order)],
  )
  return rows[0] ?? null
}

function stripJsonFence(value) {
  return String(value || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

function fallbackEnglishQuestion(q, index) {
  const labels = Object.keys(q.options || {})
  const isTf = q.type === "true_false"
  const lens = String(q.assessment_lens || q.tags?.[q.tags.length - 1] || "verification")
  const tagMap = {
    "概念辨析": "concept boundary",
    "操作顺序": "operation sequence",
    "异常诊断": "troubleshooting diagnosis",
    "验收判断": "verification judgment",
    "证据链": "evidence chain",
    "迁移应用": "transfer application",
    "安全边界": "safety boundary",
    "决策解释": "decision explanation",
    "安全规范": "safety practice",
    "学习证据": "learning evidence",
    "Prompt工程": "prompt engineering",
    "ESP32-S3": "ESP32-S3",
    "LED输出控制": "LED output control",
    "按键输入": "button input",
    "GPIO输入输出": "GPIO input and output",
    "USB连接与端口": "USB connection and serial port",
    "串口日志": "serial log analysis",
    "I2C通信": "I2C communication",
    "OLED显示": "OLED display",
    "温湿度传感": "temperature and humidity sensing",
    "传感器": "sensor integration",
    "边缘AI": "edge AI",
    "模型部署": "model deployment",
    "Agent编排": "agent orchestration",
  }
  const primaryTag = Array.isArray(q.tags) ? q.tags.find((tag) => tagMap[tag]) : ""
  const kp = tagMap[primaryTag] || tagMap[lens] || "the current learning step"
  const lensMap = {
    "概念辨析": "distinguishing the concept from a surface-level operation",
    "操作顺序": "organizing a reliable operation sequence",
    "异常诊断": "locating the cause of an abnormal result",
    "验收判断": "judging whether the result meets the completion standard",
    "证据链": "building a verifiable evidence chain",
    "迁移应用": "transferring the method to a similar task",
    "安全边界": "keeping safety and risk boundaries clear",
    "决策解释": "explaining the technical reason behind a decision",
  }
  const lensGoal = lensMap[lens] || "connecting the concept, operation, evidence, and verification standard"
  const optionMap = {
    "对": "True",
    "错": "False",
    "跳过验证，直接进入下一项操作": "Skip verification and move directly to the next task",
    "只记录最终截图，不检查中间过程": "Record only the final screenshot without checking intermediate steps",
    "优先更换工具或环境，暂不定位输入输出": "Change tools or environment first without locating input-output issues",
    "删除报错信息后重新开始": "Delete the error message and restart without analysis",
    "只记住步骤名称，不说明判断依据": "Only remember the step name without explaining the judgment basis",
    "不保存参数、日志或中间版本": "Do not keep parameters, logs, or intermediate versions",
    "保留可复核的运行证据": "Keep verifiable runtime evidence",
    "检查关键输入输出": "Check the key inputs and outputs",
    "完成关键步骤并保留结果": "Complete the key step and keep the result",
  }
  const correctLabels = new Set(Array.isArray(q.answer) ? q.answer : [q.answer].filter(Boolean))
  const correctUnknown = [
    "Keep verifiable evidence from the actual operation",
    "Check the key input, output, and completion condition",
    "Record the parameter or observation needed for later review",
    "Use the step-specific checkpoint to judge whether the result is reliable",
  ]
  const wrongUnknown = [
    "Skip verification and move directly to the next task",
    "Keep only a final screenshot without explaining the process",
    "Change tools first without diagnosing the input-output chain",
    "Ignore the error message and restart without preserving evidence",
  ]
  const translateOption = (value, label) => {
    const raw = String(value || "").trim()
    if (optionMap[raw]) return optionMap[raw]
    if (/^[A-Z]\.?$/.test(raw)) return raw
    if (/[\u4e00-\u9fff]/.test(raw)) {
      const pool = correctLabels.has(label) ? correctUnknown : wrongUnknown
      const idx = Math.max(0, labels.indexOf(label)) % pool.length
      return pool[idx]
    }
    return raw || `Option ${label}`
  }
  const stemsByType = {
    single_choice: [
      `When working on ${kp}, which choice best supports ${lensGoal}?`,
      `If ${kp} produces an unexpected result, which evidence should be checked first?`,
      `Which choice best proves mastery of ${kp} beyond memorizing a keyword?`,
      `For ${kp}, which action would make the result easiest to review later?`,
      `Which decision is most defensible when applying ${kp} to a similar task?`,
      `Which observation would most clearly connect ${kp} with the actual input-output behavior?`,
      `When preparing a handoff for ${kp}, what should be verified before claiming completion?`,
      `Which action best separates a stable understanding of ${kp} from an accidental success?`,
    ],
    multiple_choice: [
      `For ${kp}, which records should be kept to support review, troubleshooting, and transfer?`,
      `Which actions show reliable understanding of ${kp} across process, evidence, and safety?`,
      `Which choices explain not only what was done, but why the result is trustworthy?`,
      `Which conditions should not be skipped when validating ${kp}?`,
      `Which pieces of evidence would help diagnose a later failure in ${kp}?`,
      `Which checks would make a review of ${kp} useful for another similar task?`,
      `Which practices help preserve the reasoning chain behind ${kp}?`,
      `Which items should be compared before deciding that ${kp} is ready to continue?`,
    ],
    true_false: [
      `For ${kp}, the result should be judged together with process evidence and verification points.`,
      `Mastering ${kp} means explaining the conditions, checks, and result rather than only showing the final output.`,
      `If ${kp} appears to work once, it is still necessary to keep the evidence needed for review.`,
      `A reliable ${kp} result should connect the observed output with the input condition and completion standard.`,
      `A screenshot alone is usually enough to prove that ${kp} has been understood.`,
      `When ${kp} fails, the error context is part of the learning evidence rather than noise to delete.`,
    ],
  }
  return {
    ...q,
    stem: stemsByType[q.type]?.[index % (stemsByType[q.type]?.length || 1)] || `Question ${index + 1}: Which option best verifies this learning step?`,
    options: labels.reduce((acc, label) => {
      if (isTf) acc[label] = label === "A" ? "True" : "False"
      else acc[label] = translateOption(q.options?.[label], label)
      return acc
    }, {}),
    analysis: `This question checks ${lens}: whether the learner can connect the concept, operation, evidence, and verification standard instead of only recalling a keyword.`,
    knowledge_point_label: kp,
    source_basis: String(q.source_basis || "Current course step").replace(/·/g, " / "),
  }
}

function englishVisibleHasIssue(value) {
  const s = text(value)
  if (!s || s.length < 8) return true
  if (/[\u4e00-\u9fff]/.test(s)) return true
  if (/[\/,;:–—-]\s*$/.test(s)) return true
  if (/^(Option\s+[A-D]|Key evidence\s*\d+|Wrong choice\s*[A-D0-9]*)/i.test(s)) return true
  return false
}

function englishStemFrame(stem) {
  const s = text(stem).replace(/^Question\s*\d+\s*[:.)-]?\s*/i, "").toLowerCase()
  if (s.startsWith("when working on")) return "en-working"
  if (s.startsWith("if ") && s.includes("unexpected result")) return "en-unexpected"
  if (s.startsWith("which choice best proves mastery")) return "en-mastery"
  if (s.startsWith("for ") && s.includes("easiest to review")) return "en-review"
  if (s.startsWith("which decision is most defensible")) return "en-decision"
  if (s.startsWith("which observation would")) return "en-observation"
  if (s.startsWith("when preparing a handoff")) return "en-handoff"
  if (s.startsWith("which action best separates")) return "en-stability"
  if (s.startsWith("which actions show")) return "en-process"
  if (s.startsWith("which choices explain")) return "en-trust"
  if (s.startsWith("which conditions should")) return "en-condition"
  if (s.startsWith("which pieces of evidence")) return "en-diagnosis"
  if (s.startsWith("which checks would")) return "en-transfer"
  if (s.startsWith("which practices help")) return "en-reasoning"
  if (s.startsWith("which items should")) return "en-compare"
  if (s.startsWith("mastering ")) return "en-explain"
  if (s.startsWith("a reliable ")) return "en-reliable"
  if (s.startsWith("a screenshot alone")) return "en-screenshot"
  return normalizeStem(s).replace(/\d+/g, "").slice(0, 36)
}

function englishStemConflict(stem, usedStems = []) {
  const frame = englishStemFrame(stem)
  return usedStems.some((item) => englishStemFrame(item) === frame || stemSimilar(stem, item))
}

function repairEnglishQuestion(q, index) {
  const base = fallbackEnglishQuestion(q, index)
  const labels = ["A", "B", "C", "D"]
  const repaired = { ...q }
  if (englishVisibleHasIssue(repaired.stem) || englishStemFrame(repaired.stem).length < 5) {
    repaired.stem = base.stem
  } else {
    repaired.stem = text(repaired.stem).replace(/^Question\s*\d+\s*[:.)-]?\s*/i, "").trim()
  }
  repaired.analysis = englishVisibleHasIssue(repaired.analysis) ? base.analysis : repaired.analysis
  repaired.knowledge_point_label = englishVisibleHasIssue(repaired.knowledge_point_label) ? base.knowledge_point_label : repaired.knowledge_point_label
  if (repaired.type === "true_false") {
    repaired.options = { A: "True", B: "False" }
    repaired.answer = repaired.answer === "B" ? "B" : "A"
    return repaired
  }
  const correctLabels = new Set(Array.isArray(repaired.answer) ? repaired.answer : [repaired.answer].filter(Boolean))
  const correctPool = [
    "Keep verifiable process evidence, key parameters, and the final result",
    "Explain how the input condition, process, and output are connected",
    "Record the failure symptom, diagnosis basis, repair action, and final verification",
    "Use the completion standard to judge reliability, not only the surface result",
    "Connect each checkpoint with the observed behavior and explain why the judgment holds",
    "Keep intermediate versions, parameter changes, and final acceptance evidence together",
    "Explain the risk, the chosen action, and the evidence that supports it",
    "Transfer the method to a similar task and state its boundary of use",
  ]
  const wrongPool = [
    "Skip verification and move directly to the next task",
    "Keep only the final screenshot without explaining the process",
    "Change the tool or environment first without locating the input-output chain",
    "Delete the error message and restart without preserving evidence",
    "Only remember the step name without stating the judgment basis",
    "Memorize the concept name without connecting it to experimental input and output",
    "Treat one accidental success as stable mastery and stop checking key conditions",
    "Ignore abnormal behavior and judge only from the final display effect",
    "Mix up concept understanding, operation steps, and acceptance evidence",
  ]
  const sourceOptions = repaired.options && typeof repaired.options === "object" ? repaired.options : {}
  const used = new Set()
  const fixed = {}
  for (const label of labels) {
    let value = text(sourceOptions[label])
    if (englishVisibleHasIssue(value) || used.has(normalizeStem(value))) {
      const pool = correctLabels.has(label) ? correctPool : wrongPool
      value = pool.find((item) => !used.has(normalizeStem(item)))
        || [...correctPool, ...wrongPool].find((item) => !used.has(normalizeStem(item)))
        || `Explain the evidence that supports option ${label}`
    }
    used.add(normalizeStem(value))
    fixed[label] = value
  }
  repaired.options = fixed
  if (repaired.type === "single_choice" && !labels.includes(repaired.answer)) repaired.answer = "A"
  if (repaired.type === "multiple_choice" && (!Array.isArray(repaired.answer) || repaired.answer.length < 2)) repaired.answer = ["A", "B"]
  return repaired
}

function englishUniqueFallbackStem(q, index, usedStems) {
  const base = fallbackEnglishQuestion(q, index)
  const kp = base.knowledge_point_label || "the current learning step"
  const candidates = [
    base.stem,
    `Which evidence would best show that ${kp} is understood beyond a successful final display?`,
    `When reviewing ${kp}, which action best connects the procedure with the acceptance standard?`,
    `If ${kp} has to be repeated by another person, what information is most important to keep?`,
    `Which choice best distinguishes a safe, repeatable result in ${kp} from a one-time success?`,
    `Which judgment should be made before transferring ${kp} to a different but related task?`,
    `Which check would most directly expose a hidden problem in ${kp}?`,
    `Which record best supports a later explanation of why ${kp} worked or failed?`,
  ]
  return candidates.find((stem) => !englishStemConflict(stem, usedStems)) || candidates[index % candidates.length]
}

function finalEnglishQualityGate(questions) {
  const optionSigs = new Set()
  const usedStems = []
  return questions.map((initial, index) => {
    let q = repairEnglishQuestion(initial, index)
    if (englishStemConflict(q.stem, usedStems)) {
      q = { ...q, stem: englishUniqueFallbackStem(q, index + usedStems.length + 5, usedStems) }
    }
    let sig = optionSignature(q.options)
    if (sig && optionSigs.has(sig)) {
      q = repairEnglishQuestion({ ...q, options: {}, stem: englishUniqueFallbackStem(q, index + 19, usedStems) }, index + 19)
      sig = optionSignature(q.options)
    }
    optionSigs.add(sig)
    usedStems.push(q.stem)
    return q
  })
}

async function translateQuizQuestionsToEnglish(questions, courseTitle) {
  const deepseekKey = process.env.DEEPSEEK_API_KEY || ""
  if (!deepseekKey) return finalEnglishQualityGate(questions.map(fallbackEnglishQuestion))
  const protectedKeys = new Set(["question_id", "phase", "day", "type", "answer", "tags", "ability_dimension", "assessment_lens", "difficulty", "knowledge_point_id", "target_step_code"])
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        max_tokens: 5000,
        messages: [
          {
            role: "system",
            content: [
              "Translate the Quiz JSON into natural educational English for students.",
              "Return JSON only: an array with the same length and the same keys.",
              "Preserve question_id, phase, day, type, answer, tags, ability_dimension, difficulty, knowledge_point_id, and target_step_code exactly.",
              "Translate only stem, options values, analysis, knowledge_point_label, source_basis, and related_memory_basis.",
              "Keep option keys A/B/C/D unchanged. For true_false, use True / False.",
              "Do not include Chinese text in translated fields unless it is a proper noun, code, API name, hardware model, or course-specific term.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({ courseTitle, questions }),
          },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) throw new Error(`deepseek_${resp.status}`)
    const data = await resp.json()
    const raw = stripJsonFence(data.choices?.[0]?.message?.content || "")
    const translated = JSON.parse(raw)
    if (!Array.isArray(translated) || translated.length !== questions.length) throw new Error("invalid_translation_shape")
    const mergedQuestions = questions.map((q, index) => {
      const t = translated[index] || {}
      const merged = { ...q }
      for (const key of Object.keys(t)) {
        if (protectedKeys.has(key)) continue
        if (key === "options" && t.options && typeof t.options === "object") merged.options = t.options
        else if (typeof t[key] === "string" || t[key] === null) merged[key] = t[key]
      }
      return merged
    })
    return finalEnglishQualityGate(mergedQuestions)
  } catch {
    return finalEnglishQualityGate(questions.map(fallbackEnglishQuestion))
  }
}

export function registerQuizRoutes(app, db) {
  app.post("/v1/quiz/start", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const locale = resolveLocale(request)
    const trackId = String(request.body?.trackId || request.body?.routeId || "")
    const routeStepId = String(request.body?.routeStepId || "")
    const stepScope = {
      stepCode: text(request.body?.stepCode).slice(0, 128),
      stepTitle: text(request.body?.stepTitle).slice(0, 240),
      stepIndex: request.body?.stepIndex,
    }
    const node = await ownedNode(db, user.id, trackId, routeStepId)
    if (!node) return invalid(reply, "route_step_not_found", 404)
    const content = jsonValue(node.content_json, {})
    const [recentMessages, priorStems, weakRows] = await Promise.all([
      recentAgentMemory(db, user.id, { moduleId: node.module_id }),
      priorQuestionStems(db, user.id, node.course_id),
      weakMastery(db, user.id),
    ])
    const generatedQuestions = buildQuestions(node, content, recentMessages, priorStems, weakRows, stepScope)
    const localizedCourseTitle = locale === "en" ? englishCourseTitle(node.title, node.module_id) : node.title
    const questions = locale === "en"
      ? await translateQuizQuestionsToEnglish(generatedQuestions, localizedCourseTitle)
      : generatedQuestions
    if (questions.length < 10) return invalid(reply, "course_content_not_enough_for_quiz", 409)
    const id = randomUUID()
    const phase = displayPhaseFromModule(node.module_id)
    const source = recentMessages.length ? "course_memory_rule" : "course_rule"
    const title = locale === "en" ? `${phase} · ${localizedCourseTitle} Course Check` : `${phase} · ${node.title} 课程小练`
    const context = {
      courseId: node.course_id,
      lessonId: node.lesson_id,
      stepScope,
      memoryScope: {
        moduleId: node.module_id,
        phaseAliases: phaseStageAliases(node.module_id),
      },
      memoryMessageCount: recentMessages.length,
      memoryFocuses: extractMemoryFocuses(recentMessages, content),
      weakKnowledgePointCount: weakRows.length,
      generatedBy: "personalized-secure-api",
      locale: locale === "en" ? "en-US" : "zh-CN",
    }
    await db.execute(
      `INSERT INTO adaptive_quiz_sessions
       (id, user_id, track_id, route_step_id, course_id, lesson_id, phase_id, source, title, question_count, context_json, questions_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, node.track_id, node.route_step_id, node.course_id, node.lesson_id, phase, source, title, questions.length, JSON.stringify(context), JSON.stringify(questions)],
    )
    await db.execute(
      `INSERT INTO user_learning_events
       (id, user_id, track_id, route_step_id, lesson_id, event_name, payload_json)
       VALUES (?, ?, ?, ?, ?, 'quiz_started', ?)`,
      [randomUUID(), user.id, node.track_id, node.route_step_id, node.lesson_id, JSON.stringify({ quizId: id, source, locale: locale === "en" ? "en-US" : "zh-CN" })],
    )
    const [rows] = await db.execute("SELECT * FROM adaptive_quiz_sessions WHERE id=? AND user_id=? LIMIT 1", [id, user.id])
    return reply.code(201).send({ quiz: sanitizeQuiz(rows[0], questions) })
  })

  app.get("/v1/quiz/:quizId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute("SELECT * FROM adaptive_quiz_sessions WHERE id=? AND user_id=? LIMIT 1", [request.params.quizId, user.id])
    const row = rows[0]
    if (!row) return invalid(reply, "quiz_not_found", 404)
    return { quiz: sanitizeQuiz(row, jsonValue(row.questions_json, []), jsonValue(row.report_json, null)) }
  })

  app.get("/v1/quizzes", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const limit = Math.min(50, Math.max(1, Number(request.query?.limit) || 20))
    const offset = Math.max(0, Number(request.query?.offset) || 0)
    const trackId = String(request.query?.trackId || "").slice(0, 64) || null
    const courseId = String(request.query?.courseId || "").slice(0, 128) || null
    const status = request.query?.status || null

    const conditions = ["qs.user_id=?"]
    const params = [user.id]
    if (trackId) { conditions.push("qs.track_id=?"); params.push(trackId) }
    if (courseId) { conditions.push("qs.course_id=?"); params.push(courseId) }
    if (status === "SUBMITTED" || status === "GENERATED") { conditions.push("qs.status=?"); params.push(status) }

    const where = conditions.join(" AND ")
    const [[countRows], [rows]] = await Promise.all([
      db.execute(`SELECT COUNT(*) total FROM adaptive_quiz_sessions qs WHERE ${where}`, params),
      db.execute(
        `SELECT qs.id, qs.track_id, qs.route_step_id, qs.course_id, qs.lesson_id,
                qs.phase_id, qs.source, qs.status, qs.title, qs.question_count,
                qs.report_json, qs.created_at, qs.submitted_at
         FROM adaptive_quiz_sessions qs
         WHERE ${where}
         ORDER BY qs.created_at DESC
         LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
        params,
      ),
    ])

    const items = rows.map((row) => {
      const report = jsonValue(row.report_json, null)
      return {
        quizId: row.id,
        trackId: row.track_id,
        routeStepId: row.route_step_id,
        courseId: row.course_id,
        lessonId: row.lesson_id ? Number(row.lesson_id) : null,
        phase: row.phase_id,
        title: row.title,
        questionCount: Number(row.question_count),
        status: row.status,
        source: row.source,
        createdAt: new Date(row.created_at).toISOString(),
        submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
        score: report?.score ?? null,
        total: report?.total ?? null,
        scorePercent: report?.scorePercent ?? null,
        weakTags: report?.weakTags ?? [],
      }
    })

    return {
      items,
      total: Number(countRows[0]?.total ?? 0),
      limit,
      offset,
    }
  })


  app.get("/v1/quizzes/:quizId", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const quizId = String(request.params?.quizId || "").slice(0, 128)
    if (!quizId) return invalid(reply, "quiz_id_required")

    const [rows] = await db.execute(
      `SELECT qs.id, qs.track_id, qs.route_step_id, qs.course_id, qs.lesson_id,
              qs.phase_id, qs.source, qs.status, qs.title, qs.question_count,
              qs.questions_json, qs.report_json, qs.created_at, qs.submitted_at,
              qa.score, qa.total, qa.detail_json
       FROM adaptive_quiz_sessions qs
       LEFT JOIN adaptive_quiz_attempts qa ON qa.id=qs.id AND qa.user_id=qs.user_id
       WHERE qs.id=? AND qs.user_id=?
       LIMIT 1`,
      [quizId, user.id],
    )
    const row = rows[0]
    if (!row) return invalid(reply, "quiz_not_found", 404)
    const questionsJson = jsonValue(row.questions_json, [])
    const report = jsonValue(row.report_json, {})
    const detail = jsonValue(row.detail_json, null)
    return {
      quizId: row.id,
      trackId: row.track_id,
      routeStepId: row.route_step_id,
      courseId: row.course_id,
      lessonId: row.lesson_id ? Number(row.lesson_id) : null,
      phase: row.phase_id,
      title: row.title,
      questionCount: Number(row.question_count),
      status: row.status,
      source: row.source,
      createdAt: new Date(row.created_at).toISOString(),
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      score: report?.score ?? row.score ?? null,
      total: report?.total ?? row.total ?? null,
      scorePercent: report?.scorePercent ?? (row.total ? Math.round(Number(row.score || 0) / Number(row.total) * 100) : null),
      weakTags: report?.weakTags ?? [],
      report,
      detail,
      questions: detail?.items || report?.items || detail?.questions || detail?.results || report?.questions || questionsJson || [],
      answers: detail?.answers || report?.answers || {},
    }
  })

  app.post("/v1/quiz/:quizId/submit", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const [rows] = await db.execute("SELECT * FROM adaptive_quiz_sessions WHERE id=? AND user_id=? LIMIT 1", [request.params.quizId, user.id])
    const row = rows[0]
    if (!row) return invalid(reply, "quiz_not_found", 404)
    const existingReport = jsonValue(row.report_json, null)
    if (row.status === "SUBMITTED" && existingReport) {
      return { report: existingReport, replayed: true }
    }
    const questions = jsonValue(row.questions_json, [])
    if (!questions.length) return invalid(reply, "quiz_questions_missing", 409)
    const answers = request.body?.answers && typeof request.body.answers === "object" ? request.body.answers : {}
    const missingQuestionIds = questions
      .filter((question) => {
        const answer = answers[question.question_id]
        return answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)
      })
      .map((question) => question.question_id)
    if (missingQuestionIds.length) {
      return invalid(reply, "quiz_answers_incomplete", 422, { missingQuestionIds })
    }
    const items = questions.map((q) => {
      const userAnswer = answers[q.question_id]
      const correct = exactAnswer(userAnswer, q.answer)
      return {
        questionId: q.question_id,
        type: q.type,
        stem: q.stem,
        options: q.options,
        userAnswer: Array.isArray(userAnswer) ? userAnswer : userAnswer ? String(userAnswer) : "",
        correctAnswer: q.answer,
        correct,
        analysis: q.analysis,
        tags: q.tags,
        abilityDimension: q.ability_dimension,
        difficulty: q.difficulty,
        knowledgePointId: q.knowledge_point_id,
        knowledgePointLabel: q.knowledge_point_label,
        targetStepCode: q.target_step_code,
      }
    })
    const score = items.filter((item) => item.correct).length
    const weak = items.filter((item) => !item.correct)
    const weakTags = [...new Set(weak.flatMap((item) => item.tags || []))]
    const report = {
      score,
      total: questions.length,
      scorePercent: Math.round(score / Math.max(1, questions.length) * 100),
      items,
      weakTags,
      weakKnowledgePoints: weak.map((item) => ({
        id: item.knowledgePointId,
        label: item.knowledgePointLabel,
        abilityDimension: item.abilityDimension,
      })),
      submittedAt: new Date().toISOString(),
    }
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [claimResult] = await connection.execute(
        `UPDATE adaptive_quiz_sessions
         SET status='SUBMITTED', report_json=?, submitted_at=UTC_TIMESTAMP(3)
         WHERE id=? AND user_id=? AND status<>'SUBMITTED'`,
        [JSON.stringify(report), row.id, user.id],
      )
      if (!claimResult.affectedRows) {
        const [submittedRows] = await connection.execute(
          "SELECT report_json FROM adaptive_quiz_sessions WHERE id=? AND user_id=? LIMIT 1",
          [row.id, user.id],
        )
        await connection.commit()
        return {
          report: jsonValue(submittedRows[0]?.report_json, existingReport || report),
          replayed: true,
        }
      }
      await connection.execute(
        `INSERT INTO adaptive_quiz_attempts (id, user_id, track_id, route_step_id, score, total, detail_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score=VALUES(score), total=VALUES(total), detail_json=VALUES(detail_json), submitted_at=UTC_TIMESTAMP(3)`,
        [row.id, user.id, row.track_id, row.route_step_id, score, questions.length, JSON.stringify(report)],
      )
      for (const item of items) {
        const delta = item.correct ? 0.16 : -0.18
        await connection.execute(
          `INSERT INTO adaptive_knowledge_mastery (user_id, knowledge_point_id, knowledge_point_label, score, evidence_count)
           VALUES (?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
             knowledge_point_label=VALUES(knowledge_point_label),
             score=LEAST(1, GREATEST(0, score + ?)),
             evidence_count=evidence_count + 1`,
          [user.id, item.knowledgePointId, item.knowledgePointLabel, item.correct ? 0.66 : 0.34, delta],
        )
      }
      await connection.execute(
        `INSERT INTO user_learning_events
         (id, user_id, track_id, route_step_id, lesson_id, event_name, payload_json)
         VALUES (?, ?, ?, ?, ?, 'quiz_submitted', ?)`,
        [randomUUID(), user.id, row.track_id, row.route_step_id, row.lesson_id, JSON.stringify({ quizId: row.id, score, total: questions.length, weakTags })],
      )
      const [nodeRows] = await connection.execute(
        "SELECT n.* FROM learning_path_nodes n JOIN learning_tracks t ON t.current_path_id=n.path_id WHERE t.id=? AND t.user_id=? AND n.id=? LIMIT 1",
        [row.track_id, user.id, row.route_step_id],
      )
      const targetNode = nodeRows[0] ? await nextNode(connection, nodeRows[0]) : null
      const recNodeId = targetNode?.id || row.route_step_id
      const recommendation = {
        source: "secure_quiz",
        fromQuizId: row.id,
        fromRouteStepId: row.route_step_id,
        supportLevel: report.scorePercent >= 85 ? "brief" : report.scorePercent >= 60 ? "standard" : "detailed",
        reason: report.scorePercent >= 85 ? "Quiz表现稳定，后续步骤可压缩提示。" : report.scorePercent >= 60 ? "Quiz基本达标，后续步骤保持标准粒度。" : "Quiz存在薄弱点，后续步骤采用详细粒度。",
        weakTags,
        weakKnowledgePoints: report.weakKnowledgePoints,
        generatedAt: new Date().toISOString(),
      }
      await connection.execute(
        `INSERT INTO adaptive_recommendations (user_id, track_id, route_step_id, recommendation_json)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE recommendation_json=VALUES(recommendation_json)`,
        [user.id, row.track_id, recNodeId, JSON.stringify(recommendation)],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    return { report }
  })

  app.get("/v1/quiz/recommendation", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const trackId = String(request.query?.trackId || request.query?.routeId || "")
    const routeStepId = String(request.query?.routeStepId || "")
    if (!trackId || !routeStepId) return invalid(reply, "track_and_route_step_required")
    const node = await ownedNode(db, user.id, trackId, routeStepId)
    if (!node) return invalid(reply, "route_step_not_found", 404)
    const [rows] = await db.execute(
      "SELECT recommendation_json, updated_at FROM adaptive_recommendations WHERE user_id=? AND track_id=? AND route_step_id=? LIMIT 1",
      [user.id, trackId, routeStepId],
    )
    const row = rows[0]
    return { recommendation: row ? jsonValue(row.recommendation_json, null) : null, updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null }
  })

  app.get("/v1/quiz/adaptive-steps", async (request, reply) => {
    const user = await userFor(request, reply); if (!user) return
    const trackId = String(request.query?.trackId || request.query?.routeId || "")
    const routeStepId = String(request.query?.routeStepId || "")
    if (!trackId || !routeStepId) return invalid(reply, "track_and_route_step_required")
    const node = await ownedNode(db, user.id, trackId, routeStepId)
    if (!node) return invalid(reply, "route_step_not_found", 404)
    const content = jsonValue(node.content_json, {})
    const steps = normalizeSteps(content)
    const [recRows, masteryRows] = await Promise.all([
      db.execute(
        "SELECT recommendation_json, updated_at FROM adaptive_recommendations WHERE user_id=? AND track_id=? AND route_step_id=? LIMIT 1",
        [user.id, trackId, routeStepId],
      ).then(([rows]) => rows),
      db.execute(
        "SELECT knowledge_point_label, score FROM adaptive_knowledge_mastery WHERE user_id=? AND score < 0.5 ORDER BY score ASC LIMIT 12",
        [user.id],
      ).then(([rows]) => rows),
    ])
    const recommendation = recRows[0] ? jsonValue(recRows[0].recommendation_json, {}) : {}
    const weakText = [
      ...(recommendation.weakTags || []),
      ...(recommendation.weakKnowledgePoints || []).map((item) => item.label || ""),
      ...masteryRows.map((row) => row.knowledge_point_label || ""),
    ].join(" ")
    const defaultLevel = recommendation.supportLevel || "standard"
    const adaptiveSteps = steps.map((step) => {
      const hitsWeak = step.tags.some((tag) => weakText.includes(tag)) || weakText.includes(step.title)
      const level = hitsWeak ? "detailed" : defaultLevel
      const payload = adaptivePayload(step, level)
      return {
        id: step.id,
        code: step.code,
        sourceTitle: step.title,
        tags: step.tags,
        ...payload,
      }
    })
    return {
      courseId: node.course_id,
      lessonId: node.lesson_id ? Number(node.lesson_id) : null,
      trackId,
      routeStepId,
      supportLevel: defaultLevel,
      recommendationSource: recommendation.source || "course_default",
      updatedAt: recRows[0]?.updated_at ? new Date(recRows[0].updated_at).toISOString() : null,
      steps: adaptiveSteps,
    }
  })
}
