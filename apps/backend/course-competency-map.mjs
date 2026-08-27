import { COMPETENCY_IDS } from "./competency-catalog.mjs"

export const COURSE_COMPETENCY_MAP_VERSION = "course-competency-map-v1"

const entry = (courseId, competencies, evidence) => ({ courseId, competencies: Object.freeze(competencies), evidence: Object.freeze(evidence) })
export const COURSE_COMPETENCY_MAP = Object.freeze([
  entry("model-evaluation", { "model-evaluation": 1, "machine-learning": .65, debugging: .45 }, ["课程简介包含模型能力、成本与路由策略比较", "课程任务要求分析模型失败案例"]),
  entry("agent-handoff", { "agent-development": .8, automation: .7, "system-integration": .65, "backend-integration": .45 }, ["课程建立 Agent 能力模块和协作边界", "课程包含合同与交接记录"]),
  entry("desktop-agent", { "agent-development": 1, automation: .75, "backend-integration": .55, debugging: .5 }, ["课程构建 Tool Use、RAG 与桌面 Agent", "课程要求检查可追踪执行日志"]),
  entry("device-gateway", { iot: 1, "backend-integration": .9, "system-integration": .75, automation: .45 }, ["课程连接设备能力、统一网关和接口", "课程覆盖云边设备协作"]),
  entry("ai-cad", { cad: 1, "digital-manufacturing": .7, "product-design": .5, debugging: .35 }, ["课程从自然语言生成 CAD 到切片", "课程要求检查模型几何和制造准备"]),
  entry("blender-automation", { cad: .8, automation: .8, "digital-manufacturing": .55, "product-design": .45 }, ["课程使用 Blender Python 自动化三维工作流", "课程输出可制造三维资产"]),
  entry("laser-uv", { "laser-processing": 1, "digital-manufacturing": .85, automation: .55, "system-integration": .45 }, ["课程连接激光和 UV 制造流程", "课程覆盖材料、参数与设备协同"]),
  entry("cam-toolpath", { "cnc-toolpath": 1, "digital-manufacturing": .8, debugging: .45, "system-integration": .35 }, ["课程生成和仿真 CAM 刀路", "课程检查装夹、坐标和碰撞风险"]),
  entry("manufacturing-quality", { "quality-analysis": 1, "digital-manufacturing": .65, "machine-learning": .35, debugging: .5 }, ["课程以数据评价加工质量", "课程分析工艺参数与缺陷"]),
  entry("electronics-basics", { "embedded-systems": 1, "circuit-design": .9, debugging: .7 }, ["课程包含 GPIO、按钮和 PWM", "课程要求完成基础嵌入式调试"]),
  entry("sensors-oled", { "sensor-integration": 1, "embedded-systems": .75, "interaction-design": .55, debugging: .55 }, ["课程读取 I2C 传感器并显示数据", "课程包含 OLED 信息设计"]),
  entry("edge-sensor-fusion", { "sensor-integration": .9, "edge-computing": .8, "multimodal-ai": .65, "machine-learning": .5 }, ["课程融合多类传感器数据", "课程在边缘侧归一化并判断状态"]),
  entry("ultrasonic-decision", { "sensor-integration": .75, "robot-perception": .65, "edge-computing": .6, debugging: .45 }, ["课程基于超声波距离完成决策", "课程包含阈值和设备状态验证"]),
  entry("camera-vision", { "computer-vision": 1, "machine-learning": .75, "model-deployment": .7, "edge-computing": .65 }, ["课程使用摄像头和 Edge Impulse", "课程覆盖图像采集、训练与边缘推理"]),
  entry("audio-edge-ai", { "speech-recognition": .9, "edge-computing": .75, "model-deployment": .55, "interaction-design": .4 }, ["课程用音频输入驱动边缘 AI", "课程把识别结果连接到设备反馈"]),
  entry("audio-control", { "speech-recognition": 1, "embedded-systems": .55, "interaction-design": .6, "portfolio-development": .45 }, ["课程采集麦克风数据并控制灯光", "课程形成可演示声音交互项目"]),
  entry("edge-ai-training", { "machine-learning": .9, "model-deployment": .85, "sensor-integration": .7, "edge-computing": 1 }, ["课程完成 Edge Impulse 训练和部署", "课程使用多源传感器完成环境监测"]),
  entry("multimodal-edge-ai", { "multimodal-ai": 1, "machine-learning": .75, "model-deployment": .85, "edge-computing": .8 }, ["课程训练和部署多模态边缘 AI", "课程组合声音、图像或传感器信号"]),
  entry("touch-interface", { "interaction-design": 1, "embedded-systems": .55, "product-design": .5, debugging: .45 }, ["课程构建屏幕布局、触摸和菜单状态", "课程覆盖反馈和响应性调试"]),
  entry("multi-actuator", { "motor-control": 1, "robot-control": .8, "embedded-systems": .65, debugging: .55 }, ["课程控制电机、舵机和动作组合", "课程包含执行器安全与独立测试"]),
  entry("ai-device-linkage", { "robot-control": .85, "system-integration": .9, "model-deployment": .55, automation: .65 }, ["课程把 AI 标签映射为设备动作", "课程验证端到端响应"]),
  entry("embodied-collaboration", { "system-integration": 1, "robot-perception": .75, "robot-control": .8, "portfolio-development": .85 }, ["课程完成感知、决策和执行闭环", "课程要求可展示具身项目"]),
  entry("build-smart-car", { "robot-control": 1, "robot-perception": .8, "motor-control": .9, "portfolio-development": .8 }, ["课程实现感知、决策和小车执行", "课程形成可展示智能小车"]),
])

for (const item of COURSE_COMPETENCY_MAP) {
  if (!item.courseId || !Object.keys(item.competencies).length) throw new Error("invalid_course_competency_map")
  for (const [id, value] of Object.entries(item.competencies)) {
    if (!COMPETENCY_IDS.has(id) || typeof value !== "number" || value <= 0 || value > 1) throw new Error(`invalid_course_competency:${item.courseId}:${id}`)
  }
}
export const COURSE_COMPETENCIES_BY_ID = new Map(COURSE_COMPETENCY_MAP.map((item) => [item.courseId, item]))
