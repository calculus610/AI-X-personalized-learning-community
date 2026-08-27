import mysql from "mysql2/promise"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const db = await mysql.createConnection({
  host: required("DATABASE_HOST"),
  port: Number(process.env.DATABASE_PORT || 3306),
  user: required("DATABASE_USER"),
  password: required("DATABASE_PASSWORD"),
  database: required("DATABASE_NAME"),
  multipleStatements: true,
  charset: "utf8mb4",
})

const catalogVersion = "demo-2026-07-v1"
const modules = [
  ["ai_agent", "AI 应用与智能体", "模型评测、智能体、Tool Use 与 RAG。", "brain", "#7deaf2", 1],
  ["ai_manufacturing", "AI 设计与数字制造", "AI-CAD、三维设计、CAM 与数字制造。", "box", "#c69bff", 2],
  ["embedded_perception", "智能硬件与边缘感知", "ESP32、传感器、视觉、音频和边缘 AI。", "cpu", "#65e7f2", 3],
  ["embodied_projects", "具身交互与智能小车", "触摸交互、执行器控制与可展示的机器人项目。", "bot", "#c7ff68", 4],
]

const course = (id, moduleId, lessonId, title, summary, sortOrder, level, resources = []) => ({
  id, moduleId, lessonId, title, summary, sortOrder, level, resources,
})
const courses = [
  course("model-evaluation", "ai_agent", 17, "模型评测与路由", "比较模型能力、成本与路由策略。", 10, "foundation"),
  course("agent-handoff", "ai_agent", 18, "能力模块与 Agent Handoff", "拆分能力模块并建立 Agent 协作边界。", 20, "application"),
  course("desktop-agent", "ai_agent", 19, "桌面 Agent、Tool Use 与 RAG", "构建可调用工具并检索知识的桌面 Agent。", 30, "project"),
  course("device-gateway", "ai_agent", 20, "设备网关与兼容接口", "将设备能力接入统一网关与接口。", 40, "application"),
  course("ai-cad", "ai_manufacturing", 21, "AI 辅助三维造型与切片", "从自然语言到 CAD、切片和制造准备。", 10, "foundation"),
  course("blender-automation", "ai_manufacturing", 22, "Blender AI 自动化 3D 工作流", "用 AI 和脚本自动化三维工作流。", 20, "application"),
  course("laser-uv", "ai_manufacturing", 23, "OpenClaw 与激光 / UV 协同", "把数字设计连接到激光或 UV 制造流程。", 30, "project"),
  course("cam-toolpath", "ai_manufacturing", 24, "AI 刀路与虚实对照", "理解 CAM 刀路、仿真与实机加工。", 40, "application"),
  course("manufacturing-quality", "ai_manufacturing", 25, "加工质量评价与数据分析", "用数据分析加工质量并迭代工艺。", 50, "application"),
  course("electronics-basics", "embedded_perception", 4, "电子硬件入门", "GPIO、按钮输入、PWM 与基础嵌入式实验。", 10, "foundation"),
  course("sensors-oled", "embedded_perception", 5, "传感器通信与屏幕设计", "I2C 传感器、OLED 和交互显示。", 20, "foundation"),
  course("edge-sensor-fusion", "embedded_perception", 6, "边缘 AI 传感器融合", "把多类传感器数据用于边缘侧判断。", 30, "application"),
  course("ultrasonic-decision", "embedded_perception", 7, "超声波智能决策", "基于距离与规则完成设备决策。", 40, "application"),
  course("camera-vision", "embedded_perception", 8, "摄像头视觉与 Edge Impulse", "训练并部署视觉分类能力。", 50, "application"),
  course("audio-edge-ai", "embedded_perception", 9, "灯带与音频边缘 AI", "用音频输入驱动边缘 AI 与设备反馈。", 60, "application"),
  course("audio-control", "embedded_perception", 10, "麦克风数据采集与声音控制灯", "采集声音数据并完成灯光控制。", 70, "project"),
  course("edge-ai-training", "embedded_perception", 11, "边缘 AI 训练与传感器数据融合", "完成 Edge Impulse 流程、多源传感器融合和环境监测调试。", 75, "application"),
  course("multimodal-edge-ai", "embedded_perception", 12, "多模态边缘 AI 训练与部署", "训练并部署多模态边缘 AI。", 80, "project"),
  course("touch-interface", "embodied_projects", 13, "屏幕布局与触摸交互", "构建屏幕、按钮、触摸与菜单状态。", 10, "foundation"),
  course("multi-actuator", "embodied_projects", 14, "多执行器控制基础", "控制电机、舵机及其动作组合。", 20, "foundation"),
  course("ai-device-linkage", "embodied_projects", 15, "AI 标签与设备联动", "将 AI 标签映射为真实设备动作。", 30, "application"),
  course("embodied-collaboration", "embodied_projects", 16, "AI 驱动的具身协同实战", "完成感知、决策、执行的具身协同闭环。", 40, "project"),
  course("build-smart-car", "embodied_projects", 16, "智能寻路小车", "完成一辆具备感知、决策和执行能力的可展示小车。", 50, "project"),
]

const requiredRelations = [
  ["model-evaluation", "agent-handoff"], ["agent-handoff", "desktop-agent"],
  ["ai-cad", "laser-uv"], ["ai-cad", "cam-toolpath"], ["cam-toolpath", "manufacturing-quality"],
  ["electronics-basics", "sensors-oled"], ["electronics-basics", "camera-vision"], ["electronics-basics", "audio-edge-ai"], ["electronics-basics", "multi-actuator"],
  ["sensors-oled", "edge-sensor-fusion"], ["sensors-oled", "ultrasonic-decision"], ["sensors-oled", "touch-interface"],
  ["multi-actuator", "ai-device-linkage"], ["multi-actuator", "build-smart-car"], ["ultrasonic-decision", "build-smart-car"], ["ai-device-linkage", "build-smart-car"],
]

try {
  const schema = await readFile(new URL("./learning-schema.sql", import.meta.url), "utf8")
  await db.query(schema)
  for (const item of modules) {
    await db.execute(
      `INSERT INTO course_modules (id, name, description, icon, color, sort_order, status, version)
       VALUES (?, ?, ?, ?, ?, ?, 'PUBLISHED', 1)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), icon=VALUES(icon), color=VALUES(color), sort_order=VALUES(sort_order), status='PUBLISHED', version=1`,
      item,
    )
  }
  for (const item of courses) {
    await db.execute(
      `INSERT INTO courses (id, module_id, lesson_id, title, summary, content_version, is_selectable_target, sort_order, status)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?, 'PUBLISHED')
       ON DUPLICATE KEY UPDATE module_id=VALUES(module_id), lesson_id=VALUES(lesson_id), title=VALUES(title), summary=VALUES(summary), sort_order=VALUES(sort_order), status='PUBLISHED', is_selectable_target=1`,
      [item.id, item.moduleId, item.lessonId, item.title, item.summary, item.sortOrder],
    )
    await db.execute(
      `INSERT INTO course_contents (course_id, version, content_json, status) VALUES (?, 1, ?, 'PUBLISHED')
       ON DUPLICATE KEY UPDATE status='PUBLISHED'`,
      [item.id, JSON.stringify({ title: item.title, summary: item.summary, level: item.level, lessonId: item.lessonId, resources: item.resources })],
    )
    for (const [tagType, tagValue] of [["domain", item.moduleId], ["level", item.level]]) {
      await db.execute(
        `INSERT INTO course_tags (course_id, tag_type, tag_value, version) VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE version=1`,
        [item.id, tagType, tagValue],
      )
    }
  }
  for (const [prerequisite, target] of requiredRelations) {
    await db.execute(
      `INSERT INTO course_relations (id, prerequisite_course_id, target_course_id, relation_type, version, status)
       VALUES (?, ?, ?, 'REQUIRED_PREREQUISITE', 1, 'PUBLISHED')
       ON DUPLICATE KEY UPDATE status='PUBLISHED', version=1`,
      [randomUUID(), prerequisite, target],
    )
  }
  console.log(JSON.stringify({ ok: true, catalogVersion, modules: modules.length, courses: courses.length, relations: requiredRelations.length }))
} finally {
  await db.end()
}
