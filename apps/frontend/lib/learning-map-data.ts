import { withAppBasePath } from "./app-path"

export type NodeType = "goal" | "knowledge" | "ability" | "course"

export type Interest = {
  id: string
  label: string
  x: number
  y: number
  summary: string
}

export type KnowledgeNode = {
  id: string
  label: string
  type: NodeType
  description: string
  relatedCourseIds: string[]
  x: number
  y: number
  interests: string[]
}

export type KnowledgeEdge = {
  id: string
  source: string
  target: string
  direction: "directed" | "bidirectional"
  relation: string
  /** Only REQUIRED_PREREQUISITE is a verified, MySQL-backed learning dependency. */
  kind?: "REQUIRED_PREREQUISITE" | "RELATED_KNOWLEDGE" | "GOAL_SELECTION"
}

export type OriginalCourseResource = {
  title: string
  type: "html" | "md" | "pdf"
  url: string
  description: string
}

export type CourseTopic = {
  id: string
  lessonId: number
  phaseNumber: 1 | 2 | 3 | 4
  title: string
  module: string
  description: string
  knowledgeNodeIds: string[]
  interests: string[]
  priority: number
  platformUrl: string
  resources: OriginalCourseResource[]
}

export type LearningProject = {
  id: string
  title: string
  description: string
  outcome: string
  relatedCourseIds: string[]
  interests: string[]
  priority: number
  resources: OriginalCourseResource[]
}

const assetRoot = withAppBasePath("/original-course-assets")

export const interests: Interest[] = [
  { id: "esp32", label: "ESP32", x: 11, y: 36, summary: "进入原平台的电子硬件与 GPIO 课程" },
  { id: "sensor", label: "传感器", x: 27, y: 25, summary: "进入传感器、I2C、OLED 与融合课程" },
  { id: "circuit", label: "电子电路", x: 48, y: 31, summary: "学习原平台电子硬件入门内容" },
  { id: "vision", label: "Edge Impulse 视觉", x: 72, y: 24, summary: "进入摄像头视觉与边缘 AI 课程" },
  { id: "car", label: "做一辆自己的小车", x: 88, y: 38, summary: "进入多执行器与具身协同课程" },
  { id: "cad", label: "自然语言生成 CAD", x: 19, y: 58, summary: "进入 AI-CAD 与切片课程" },
  { id: "agent", label: "做一个桌面 Agent", x: 44, y: 51, summary: "进入 Tool Use、RAG 与桌面 Agent 课程" },
  { id: "model", label: "评测与选择 AI 模型", x: 71, y: 55, summary: "进入模型评测与路由课程" },
  { id: "camera", label: "让摄像头识别物体", x: 89, y: 63, summary: "进入摄像头采集与图像分类课程" },
  { id: "motor", label: "控制电机和舵机", x: 12, y: 78, summary: "进入小车、电机与多执行器课程" },
  { id: "audio", label: "用声音控制灯", x: 36, y: 73, summary: "进入音频边缘 AI 与灯带课程" },
  { id: "touch", label: "做一个触摸菜单", x: 60, y: 78, summary: "进入屏幕布局与触摸交互课程" },
  { id: "portfolio", label: "做一个可展示的机器人", x: 84, y: 83, summary: "进入 AI 标签与具身协同课程" },
  { id: "laser-uv", label: "做一个激光 / UV 作品", x: 8, y: 55, summary: "进入 OpenClaw 与激光、UV 协同制造课程" },
  { id: "toolpath", label: "生成并检查 CNC 刀路", x: 31, y: 88, summary: "进入 CAM 刀路、装夹与虚实对照课程" },
  { id: "quality", label: "分析加工质量", x: 53, y: 91, summary: "进入加工质量评价与工艺数据分析课程" },
  { id: "audio-model", label: "训练自己的声音识别模型", x: 77, y: 92, summary: "进入麦克风采集、音频特征和边缘 AI 训练课程" },
  { id: "multimodal", label: "训练多模态边缘 AI", x: 87, y: 74, summary: "进入声音、图像多模态训练课程" },
  { id: "deploy-model", label: "把模型部署到设备", x: 87, y: 20, summary: "进入边缘模型部署与设备端验收课程" },
]

// A bubble is a learner-facing goal, not a loose tag query. Each goal maps to
// one concrete course target; MySQL then expands only its REQUIRED_PREREQUISITE
// chain. This keeps an ESP32 goal from accidentally pulling every course that
// merely happens to use an ESP32 board.
export const targetCourseByInterestId: Record<string, string> = {
  esp32: "phase3_day1",
  sensor: "phase3_day2",
  circuit: "phase3_day1",
  vision: "phase3_day5",
  car: "phase4_day7",
  cad: "phase2_day1",
  agent: "phase1_day3",
  model: "phase1_day1",
  camera: "phase3_day5",
  motor: "phase4_day5",
  audio: "phase3_day6",
  touch: "phase4_day4",
  portfolio: "phase4_day6",
  "laser-uv": "phase2_day3",
  toolpath: "phase2_day4",
  quality: "phase2_day5",
  "audio-model": "phase4_day1",
  multimodal: "phase4_day2",
  "deploy-model": "phase4_day2",
}

// The database id is the source of truth used to generate a route.  Keep the
// legacy course id above only for the presentational graph; in particular this
// avoids ambiguity where two historical courses share one lesson id.
export const targetDatabaseCourseByInterestId: Record<string, string> = {
  esp32: "electronics-basics",
  sensor: "sensors-oled",
  circuit: "electronics-basics",
  vision: "camera-vision",
  car: "build-smart-car",
  cad: "ai-cad",
  agent: "desktop-agent",
  model: "model-evaluation",
  camera: "camera-vision",
  motor: "multi-actuator",
  audio: "audio-edge-ai",
  touch: "touch-interface",
  portfolio: "embodied-collaboration",
  "laser-uv": "laser-uv",
  toolpath: "cam-toolpath",
  quality: "manufacturing-quality",
  "audio-model": "audio-control",
  multimodal: "multimodal-edge-ai",
  "deploy-model": "edge-ai-training",
}

// The visual shell still reuses a small amount of legacy presentation data
// (phase position, copy and icon).  Resolve that presentation data by the
// new stable database id, never by lesson_id: two historical project records
// deliberately share lesson_id 16.
export const legacyCourseIdByDatabaseCourseId: Record<string, string> = {
  "model-evaluation": "phase1_day1",
  "agent-handoff": "phase1_day2",
  "desktop-agent": "phase1_day3",
  "device-gateway": "phase1_day4",
  "ai-cad": "phase2_day1",
  "blender-automation": "phase2_day2",
  "laser-uv": "phase2_day3",
  "cam-toolpath": "phase2_day4",
  "manufacturing-quality": "phase2_day5",
  "electronics-basics": "phase3_day1",
  "sensors-oled": "phase3_day2",
  "edge-sensor-fusion": "phase3_day3",
  "ultrasonic-decision": "phase3_day4",
  "camera-vision": "phase3_day5",
  "audio-edge-ai": "phase3_day6",
  "audio-control": "phase4_day1",
  "edge-ai-training": "phase4_day2",
  "multimodal-edge-ai": "phase4_day3",
  "touch-interface": "phase4_day4",
  "multi-actuator": "phase4_day5",
  "ai-device-linkage": "phase4_day6",
  "embodied-collaboration": "phase4_day7",
  "build-smart-car": "phase4_day7",
}

export const courses: CourseTopic[] = [
  {
    id: "phase1_day1",
    lessonId: 17,
    phaseNumber: 1,
    title: "模型评测与路由",
    module: "模型评测",
    description: "原平台课程：模型评测与路由的交互任务。",
    knowledgeNodeIds: ["k-model", "k-routing", "a-evaluate"],
    interests: ["model"],
    priority: 10,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 1 模型评测任务", type: "html", url: `${assetRoot}/phase1/day1-model-evaluation/index.html`, description: "模型评测与路由的交互任务页面。" },
      { title: "Day 1 仓库实验说明", type: "md", url: `${assetRoot}/phase1/day1-model-evaluation/README.md`, description: "Day 1 运行方式与交付要求。" },
    ],
  },
  {
    id: "phase1_day2",
    lessonId: 18,
    phaseNumber: 1,
    title: "能力模块与 Agent Handoff",
    module: "Agent 系统",
    description: "原平台课程：能力模块与 Agent Handoff 合同任务。",
    knowledgeNodeIds: ["k-agent", "k-handoff", "a-workflow"],
    interests: ["agent"],
    priority: 20,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 2 能力模块任务", type: "html", url: `${assetRoot}/phase1/day2-capability-modules/index.html`, description: "能力模块与 Agent Handoff 合同任务页面。" },
      { title: "Day 2 仓库实验说明", type: "md", url: `${assetRoot}/phase1/day2-capability-modules/README.md`, description: "Day 2 运行方式与交付要求。" },
    ],
  },
  {
    id: "phase1_day3",
    lessonId: 19,
    phaseNumber: 1,
    title: "桌面 Agent、Tool Use 与 RAG",
    module: "桌面 Agent",
    description: "原平台课程：桌面 Agent、Tool Use 与 RAG 任务。",
    knowledgeNodeIds: ["k-agent", "k-tools", "k-rag"],
    interests: ["agent"],
    priority: 30,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 3 桌面 Agent 任务", type: "html", url: `${assetRoot}/phase1/day3-desktop-agent/index.html`, description: "桌面 Agent、Tool Use 与 RAG 任务页面。" },
      { title: "Day 3–4 概念与实操手册", type: "html", url: `${assetRoot}/phase1/Day3-Day4_概念与实操手册.html`, description: "Day 3 与 Day 4 共用手册。" },
      { title: "Day 3 仓库实验说明", type: "md", url: `${assetRoot}/phase1/day3-desktop-agent/README.md`, description: "Day 3 运行方式与交付要求。" },
    ],
  },
  {
    id: "phase1_day4",
    lessonId: 20,
    phaseNumber: 1,
    title: "设备网关与兼容接口",
    module: "设备网关",
    description: "原平台课程：设备网关与兼容接口任务。",
    knowledgeNodeIds: ["k-gateway", "k-tools", "a-workflow"],
    interests: ["agent"],
    priority: 40,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 4 设备网关任务", type: "html", url: `${assetRoot}/phase1/day4-device-gateway/index.html`, description: "设备网关与兼容接口任务页面。" },
      { title: "Day 3–4 概念与实操手册", type: "html", url: `${assetRoot}/phase1/Day3-Day4_概念与实操手册.html`, description: "Day 3 与 Day 4 共用手册。" },
      { title: "Day 4 仓库实验说明", type: "md", url: `${assetRoot}/phase1/day4-device-gateway/README.md`, description: "Day 4 运行方式与交付要求。" },
    ],
  },
  {
    id: "phase2_day1",
    lessonId: 21,
    phaseNumber: 2,
    title: "AI 辅助三维造型与切片",
    module: "AI-CAD",
    description: "原平台课程：从自然语言生成 CAD，到 STEP、切片参数与 G-code 预览。",
    knowledgeNodeIds: ["k-cad", "k-slicing", "a-workflow"],
    interests: ["cad", "portfolio"],
    priority: 50,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 1 AI-CAD 课程任务", type: "html", url: `${assetRoot}/phase2/Day 1 上午：AI 辅助三维造型生成：从自然语言到制造闭环/day1-ai-cad-tutorial.html`, description: "从自然语言生成 CAD 到可制造模型。" },
      { title: "Day 1 Bambu Studio 切片指南", type: "html", url: `${assetRoot}/phase2/Day 1 下午：从 STEP 到 G-code：切片里的制造学问/bambu-studio-guide.html`, description: "STEP、切片参数与 G-code 预览。" },
      { title: "Text2CAD 交互资料", type: "html", url: `${assetRoot}/phase2/text2cad_v2.html`, description: "Text-to-CAD 补充内容。" },
    ],
  },
  {
    id: "phase2_day2",
    lessonId: 22,
    phaseNumber: 2,
    title: "Blender AI 自动化 3D 工作流",
    module: "Blender 自动化",
    description: "原平台课程：Blender Python 与 AI 自动化 3D 工作流。",
    knowledgeNodeIds: ["k-blender", "k-tools", "a-workflow"],
    interests: ["cad", "agent"],
    priority: 60,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 2 Blender AI 自动化指南", type: "html", url: `${assetRoot}/phase2/Day2上午：让 AI 接管 Blender：自动化 3D 工作流/blender_ai_guide.html`, description: "Blender Python 与 AI 自动化 3D 工作流。" },
      { title: "Day 2 Blender 自动化补充说明", type: "md", url: `${assetRoot}/phase2/Day2上午：让 AI 接管 Blender：自动化 3D 工作流/CLI-Anything_README.md`, description: "Agent-native Blender 使用说明。" },
    ],
  },
  {
    id: "phase2_day3",
    lessonId: 23,
    phaseNumber: 2,
    title: "OpenClaw 与激光 / UV 协同",
    module: "智能制造协同",
    description: "原平台课程：OpenClaw 命令模型、激光参数、UV 打印与双机协同证据。",
    knowledgeNodeIds: ["k-openclaw", "k-laser-uv", "a-workflow"],
    interests: ["laser-uv", "agent", "portfolio"],
    priority: 61,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "CAD/CAM 数字制造操作指南", type: "html", url: `${assetRoot}/phase2/Day3上午：从虚拟到现实：CADCAM × Xhorse 端到端数字制造/Xmachine_Xhorse_操作指南.html`, description: "原平台现有 CAD/CAM 与设备操作参考。" },
      { title: "Phase 2 Text2CAD 入口", type: "html", url: `${assetRoot}/phase2/text2cad_v2.html`, description: "数字制造阶段课程入口。" },
    ],
  },
  {
    id: "phase2_day4",
    lessonId: 24,
    phaseNumber: 2,
    title: "AI 刀路与虚实对照",
    module: "CAM 刀路",
    description: "原平台课程：五轴坐标、3+2 定位、CAM 仿真、装夹对刀与空跑验证。",
    knowledgeNodeIds: ["k-cam", "k-five-axis", "a-workflow"],
    interests: ["toolpath", "cad", "quality"],
    priority: 62,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "CAD/CAM 与设备操作参考", type: "html", url: `${assetRoot}/phase2/Day3上午：从虚拟到现实：CADCAM × Xhorse 端到端数字制造/Xmachine_Xhorse_操作指南.html`, description: "原平台 CAM 与设备操作参考。" },
      { title: "Phase 2 Text2CAD 入口", type: "html", url: `${assetRoot}/phase2/text2cad_v2.html`, description: "数字制造阶段课程入口。" },
    ],
  },
  {
    id: "phase2_day5",
    lessonId: 25,
    phaseNumber: 2,
    title: "加工质量评价与数据分析",
    module: "制造数据分析",
    description: "原平台课程：加工质量指标、工艺参数数据、可视化与回归分析。",
    knowledgeNodeIds: ["k-quality", "k-data-analysis", "a-evaluate"],
    interests: ["quality", "toolpath", "portfolio"],
    priority: 63,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Phase 2 Text2CAD 入口", type: "html", url: `${assetRoot}/phase2/text2cad_v2.html`, description: "原平台数字制造阶段入口。" },
      { title: "Text2CAD 研究论文", type: "pdf", url: `${assetRoot}/phase2/NeurIPS-2024-text2cad-generating-sequential-cad-designs-from-beginner-to-expert-level-text-prompts-Paper-Conference.pdf`, description: "AI-CAD 数据与方法扩展阅读。" },
    ],
  },
  {
    id: "phase3_day1",
    lessonId: 4,
    phaseNumber: 3,
    title: "电子硬件入门",
    module: "电子硬件",
    description: "原平台课程：Arduino / ESP32-S3 环境检查、LED、GPIO、按钮输入和 PWM 呼吸灯。",
    knowledgeNodeIds: ["k-esp32", "k-gpio", "a-debug"],
    interests: ["esp32", "circuit", "motor", "car"],
    priority: 70,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 1 电子硬件入门任务", type: "html", url: `${assetRoot}/phase3/day1-basic-embedded/硬件开发入门.html`, description: "GPIO、按钮输入、PWM 与基础嵌入式实验。" },
      { title: "Day 1 仓库实验说明", type: "md", url: `${assetRoot}/phase3/day1-basic-embedded/README.md`, description: "Day 1 实验列表与交付方式。" },
    ],
  },
  {
    id: "phase3_day2",
    lessonId: 5,
    phaseNumber: 3,
    title: "传感器通信与屏幕设计",
    module: "传感器与 OLED",
    description: "原平台课程：读取温湿度、扫描 I2C，并使用 OLED 展示数据与提示。",
    knowledgeNodeIds: ["k-sensor", "k-i2c", "k-gpio"],
    interests: ["sensor", "esp32", "touch"],
    priority: 80,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 2 传感器与屏幕任务", type: "html", url: `${assetRoot}/phase3/day2-sensors-oled-i2c/接入传感器.html`, description: "传感器、I2C 与 OLED 交互实验。" },
      { title: "Day 2 仓库实验说明", type: "md", url: `${assetRoot}/phase3/day2-sensors-oled-i2c/README.md`, description: "Day 2 实验列表与交付方式。" },
    ],
  },
  {
    id: "phase3_day3",
    lessonId: 6,
    phaseNumber: 3,
    title: "边缘 AI 传感器融合",
    module: "边缘 AI",
    description: "原平台课程：多传感器读取、数据归一化、规则融合和 Edge Impulse 入门。",
    knowledgeNodeIds: ["k-sensor", "k-fusion", "k-edge-ai"],
    interests: ["sensor", "vision", "audio"],
    priority: 90,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 3 边缘 AI 传感器融合说明", type: "md", url: `${assetRoot}/phase3/day3-edge-ai-sensor-fusion/README.md`, description: "Day 3 章节实验与代码入口。" },
      { title: "Phase 3 六日课程入口", type: "html", url: `${assetRoot}/phase3/index.html`, description: "从原课程入口进入传感器融合章节。" },
    ],
  },
  {
    id: "phase3_day4",
    lessonId: 7,
    phaseNumber: 3,
    title: "超声波智能决策",
    module: "传感器决策",
    description: "原平台课程：超声波测距、阈值规则和屏幕反馈智能决策装置。",
    knowledgeNodeIds: ["k-ultrasonic", "k-sensor", "a-debug"],
    interests: ["sensor", "car", "motor"],
    priority: 100,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 4 超声波智能决策说明", type: "md", url: `${assetRoot}/phase3/day4-ultrasonic-ai-decision/README.md`, description: "Day 4 章节实验与代码入口。" },
      { title: "Phase 3 六日课程入口", type: "html", url: `${assetRoot}/phase3/index.html`, description: "从原课程入口进入超声波智能决策章节。" },
    ],
  },
  {
    id: "phase3_day5",
    lessonId: 8,
    phaseNumber: 3,
    title: "摄像头视觉与 Edge Impulse",
    module: "边缘视觉",
    description: "原平台课程：摄像头采集、图像分类和本地视觉推理基础实验。",
    knowledgeNodeIds: ["k-camera", "k-edge-ai", "a-debug"],
    interests: ["vision", "camera", "portfolio"],
    priority: 110,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 5 摄像头视觉说明", type: "md", url: `${assetRoot}/phase3/day5-camera-edge-ai-vision/README.md`, description: "Day 5 章节实验与代码入口。" },
      { title: "Phase 3 六日课程入口", type: "html", url: `${assetRoot}/phase3/index.html`, description: "从原课程入口进入摄像头视觉章节。" },
    ],
  },
  {
    id: "phase3_day6",
    lessonId: 9,
    phaseNumber: 3,
    title: "灯带与音频边缘 AI",
    module: "音频边缘 AI",
    description: "原平台课程：控制灯带、读取麦克风数据，并尝试声音事件控制灯光。",
    knowledgeNodeIds: ["k-audio", "k-edge-ai", "k-gpio"],
    interests: ["audio", "esp32", "portfolio"],
    priority: 120,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Day 6 音频边缘 AI 说明", type: "md", url: `${assetRoot}/phase3/day6-audio-edge-ai-led-strip/README.md`, description: "Day 6 章节实验与代码入口。" },
      { title: "Phase 3 六日课程入口", type: "html", url: `${assetRoot}/phase3/index.html`, description: "从原课程入口进入音频与灯带章节。" },
    ],
  },
  {
    id: "phase4_day1",
    lessonId: 10,
    phaseNumber: 4,
    title: "麦克风数据采集与声音控制灯",
    module: "音频感知",
    description: "原平台课程：麦克风采集、音频数据质量、基础特征与声音控制灯。",
    knowledgeNodeIds: ["k-audio", "k-audio-feature", "k-gpio"],
    interests: ["audio", "audio-model", "esp32"],
    priority: 123,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Phase 4 音频与设备课程入口", type: "html", url: `${assetRoot}/phase4/index.html`, description: "原平台 Phase 4 课程入口。" },
      { title: "Phase 4 硬件清单", type: "md", url: `${assetRoot}/phase4/resources/hardware-list.md`, description: "设备与接口准备参考。" },
    ],
  },
  {
    id: "phase4_day2",
    lessonId: 11,
    phaseNumber: 4,
    title: "边缘 AI 训练与传感器数据融合",
    module: "边缘模型训练",
    description: "原平台课程：建立标签体系、采集多源数据、训练模型并调试融合逻辑。",
    knowledgeNodeIds: ["k-edge-training", "k-fusion", "k-edge-ai"],
    interests: ["audio-model", "sensor", "vision", "deploy-model"],
    priority: 124,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Phase 4 边缘 AI 课程入口", type: "html", url: `${assetRoot}/phase4/index.html`, description: "原平台 Phase 4 课程入口。" },
      { title: "Phase 4 排错参考", type: "md", url: `${assetRoot}/phase4/resources/troubleshooting.md`, description: "硬件与部署排错参考。" },
    ],
  },
  {
    id: "phase4_day3",
    lessonId: 12,
    phaseNumber: 4,
    title: "多模态边缘 AI 训练与部署",
    module: "多模态部署",
    description: "原平台课程：优化音频模型、训练图像模型并部署多模态系统到设备。",
    knowledgeNodeIds: ["k-multimodal", "k-deployment", "a-system"],
    interests: ["multimodal", "deploy-model", "vision", "audio-model", "portfolio"],
    priority: 125,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Phase 4 多模态课程入口", type: "html", url: `${assetRoot}/phase4/index.html`, description: "原平台 Phase 4 课程入口。" },
      { title: "Phase 4 排错参考", type: "md", url: `${assetRoot}/phase4/resources/troubleshooting.md`, description: "设备端部署与联调参考。" },
    ],
  },
  {
    id: "phase4_day4",
    lessonId: 13,
    phaseNumber: 4,
    title: "屏幕布局与触摸交互",
    module: "触摸交互",
    description: "原平台课程：屏幕 UI/UX 布局、触摸反馈与菜单控制。",
    knowledgeNodeIds: ["k-touch", "k-gpio", "a-debug"],
    interests: ["touch", "esp32", "portfolio"],
    priority: 130,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "Phase 4 屏幕与触摸课程入口", type: "html", url: `${assetRoot}/phase4/index.html`, description: "从原课程入口进入屏幕与触摸菜单章节。" },
      { title: "屏幕与触摸菜单实验说明", type: "md", url: `${assetRoot}/phase4/day1-screen-touch-menu/README.md`, description: "屏幕、按钮、触摸与菜单状态机。" },
    ],
  },
  {
    id: "phase4_day5",
    lessonId: 14,
    phaseNumber: 4,
    title: "多执行器控制基础",
    module: "智能小车",
    description: "原平台课程：灯带视觉反馈、小车动力驱动与舵机控制。",
    knowledgeNodeIds: ["k-motor", "k-servo", "k-gpio"],
    interests: ["car", "motor", "esp32", "portfolio"],
    priority: 140,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "智能小车与多执行器参考", type: "html", url: `${assetRoot}/phase4/智能小车.html`, description: "小车、电机和舵机综合页面。" },
      { title: "电机与舵机实验说明", type: "md", url: `${assetRoot}/phase4/day3-car-motor-servo-control/README.md`, description: "多执行器基础控制。" },
    ],
  },
  {
    id: "phase4_day6",
    lessonId: 15,
    phaseNumber: 4,
    title: "AI 标签与设备联动",
    module: "设备联动",
    description: "原平台课程：通过语音及视觉标签触发灯带特效、屏幕显示与设备动作。",
    knowledgeNodeIds: ["k-ai-label", "k-edge-ai", "a-system"],
    interests: ["vision", "audio", "car", "portfolio"],
    priority: 150,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "智能小车与 AI 联动参考", type: "html", url: `${assetRoot}/phase4/智能小车.html`, description: "设备联动课程参考。" },
      { title: "AI 寻路小车实验说明", type: "md", url: `${assetRoot}/phase4/day5-ai-pathfinding-car/README.md`, description: "规则决策、传感器触发和边缘 AI 小车。" },
    ],
  },
  {
    id: "phase4_day7",
    lessonId: 16,
    phaseNumber: 4,
    title: "AI 驱动的具身协同实战",
    module: "具身协同",
    description: "原平台课程：AI 标签对小车与舵机的联合控制和动作调优。",
    knowledgeNodeIds: ["k-ai-label", "k-motor", "a-system"],
    interests: ["car", "motor", "portfolio", "vision"],
    priority: 160,
    platformUrl: "/personalized-secure/",
    resources: [
      { title: "智能小车具身协同参考", type: "html", url: `${assetRoot}/phase4/智能小车.html`, description: "AI 小车与多执行器协同页面。" },
      { title: "AI 寻路小车实验说明", type: "md", url: `${assetRoot}/phase4/day5-ai-pathfinding-car/README.md`, description: "具身决策与执行闭环参考。" },
    ],
  },
]

export const learningProjects: LearningProject[] = [
  {
    id: "project-button-light",
    title: "按键控制灯光",
    description: "把开发环境、GPIO 输出和按钮输入组合起来，完成按键控制 LED 或灯效变化。",
    outcome: "可运行的按键控制灯光装置",
    relatedCourseIds: ["phase3_day1"],
    interests: ["esp32", "circuit"],
    priority: 10,
    resources: [
      {
        title: "按键控制灯光综合实践",
        type: "html",
        url: `${assetRoot}/phase3/day1-basic-embedded/硬件开发入门.html#slide15`,
        description: "原课程中的综合项目与 Agent 提示词。",
      },
      {
        title: "电子硬件实验说明",
        type: "md",
        url: `${assetRoot}/phase3/day1-basic-embedded/README.md`,
        description: "原课程实验列表、代码入口与交付要求。",
      },
    ],
  },
  {
    id: "project-sensor-badge",
    title: "多接口徽章 / 温湿度计",
    description: "把传感器数据、屏幕显示和简单交互结合起来，并使用 AI 辅助改进界面设计。",
    outcome: "多接口徽章、温湿度计或舒适度提醒装置",
    relatedCourseIds: ["phase3_day2"],
    interests: ["sensor", "esp32", "touch"],
    priority: 20,
    resources: [
      {
        title: "温湿度与屏幕综合任务",
        type: "html",
        url: `${assetRoot}/phase3/day2-sensors-oled-i2c/接入传感器.html#slide20`,
        description: "原课程中的温湿度、OLED 与综合练习。",
      },
      {
        title: "多接口徽章 / 温湿度计项目",
        type: "md",
        url: `${assetRoot}/phase3/day2-sensors-oled-i2c/labs/05-multi-interface-badge/README.md`,
        description: "原项目的目标、要求和界面挑战。",
      },
    ],
  },
  {
    id: "project-sensor-fusion",
    title: "环境监测装置",
    description: "选择至少两个输入，把它们转换成状态或分数，再融合成一个综合判断。",
    outcome: "能输出安全、警告或危险状态的环境监测装置",
    relatedCourseIds: ["phase3_day3"],
    interests: ["sensor", "vision", "audio"],
    priority: 30,
    resources: [
      {
        title: "传感器融合项目",
        type: "md",
        url: `${assetRoot}/phase3/day3-edge-ai-sensor-fusion/labs/04-sensor-fusion-project/README.md`,
        description: "原项目的多传感器融合任务与要求。",
      },
      {
        title: "边缘 AI 传感器融合说明",
        type: "md",
        url: `${assetRoot}/phase3/day3-edge-ai-sensor-fusion/README.md`,
        description: "原课程实验路径与代码入口。",
      },
    ],
  },
  {
    id: "project-smart-decision",
    title: "智能决策装置",
    description: "基于距离传感器设计环境监测应用，并说明传感器数据如何转化成环境状态。",
    outcome: "能根据距离状态做出反馈的智能决策装置",
    relatedCourseIds: ["phase3_day4"],
    interests: ["sensor", "car", "motor"],
    priority: 40,
    resources: [
      {
        title: "环境感知小项目",
        type: "md",
        url: `${assetRoot}/phase3/day4-ultrasonic-ai-decision/labs/04-environment-sensing-mini-project/README.md`,
        description: "原项目的超声波状态判断任务。",
      },
      {
        title: "超声波智能决策说明",
        type: "md",
        url: `${assetRoot}/phase3/day4-ultrasonic-ai-decision/README.md`,
        description: "原课程实验路径与代码入口。",
      },
    ],
  },
  {
    id: "project-visual-perception",
    title: "手势识别系统 / 视觉分类器",
    description: "选择一个简单视觉任务，让设备根据摄像头数据判断环境状态。",
    outcome: "手势识别系统或简单视觉分类器",
    relatedCourseIds: ["phase3_day5"],
    interests: ["vision", "camera", "portfolio"],
    priority: 50,
    resources: [
      {
        title: "视觉感知小项目",
        type: "md",
        url: `${assetRoot}/phase3/day5-camera-edge-ai-vision/labs/04-visual-perception-mini-project/README.md`,
        description: "原项目的摄像头判断任务与要求。",
      },
      {
        title: "摄像头视觉课程说明",
        type: "md",
        url: `${assetRoot}/phase3/day5-camera-edge-ai-vision/README.md`,
        description: "原课程实验路径与代码入口。",
      },
    ],
  },
  {
    id: "project-voice-light",
    title: "语音控制灯光",
    description: "让设备根据声音强度、拍手或声音类别控制 LED 灯带状态。",
    outcome: "能对声音事件作出反应的灯光系统",
    relatedCourseIds: ["phase3_day6", "phase4_day6"],
    interests: ["audio", "esp32", "portfolio"],
    priority: 60,
    resources: [
      {
        title: "声音感知小项目",
        type: "md",
        url: `${assetRoot}/phase3/day6-audio-edge-ai-led-strip/labs/04-audio-perception-mini-project/README.md`,
        description: "原项目的声音状态、反馈方式与挑战。",
      },
      {
        title: "音频边缘 AI 课程说明",
        type: "md",
        url: `${assetRoot}/phase3/day6-audio-edge-ai-led-strip/README.md`,
        description: "原课程实验路径与代码入口。",
      },
    ],
  },
  {
    id: "project-touch-menu",
    title: "触摸菜单控制原型",
    description: "整合屏幕布局与触摸操作；没有触摸屏时，可用按钮、触摸传感器或串口命令模拟菜单交互。",
    outcome: "可操作的菜单控制原型",
    relatedCourseIds: ["phase4_day4"],
    interests: ["touch", "esp32", "portfolio"],
    priority: 70,
    resources: [
      {
        title: "屏幕与触摸菜单项目",
        type: "md",
        url: `${assetRoot}/phase4/day1-screen-touch-menu/README.md`,
        description: "原项目的屏幕布局、菜单状态机与硬件说明。",
      },
      {
        title: "屏幕与触摸课程入口",
        type: "html",
        url: `${assetRoot}/phase4/index.html`,
        description: "原平台屏幕与触摸课程入口。",
      },
    ],
  },
  {
    id: "project-car-motion",
    title: "小车运动程序",
    description: "组合直流电机、电机驱动板、PWM 速度控制和舵机角度控制。",
    outcome: "支持前进、后退、左转、右转和停止的小车程序",
    relatedCourseIds: ["phase4_day5"],
    interests: ["car", "motor", "esp32"],
    priority: 80,
    resources: [
      {
        title: "小车电机与舵机项目",
        type: "md",
        url: `${assetRoot}/phase4/day3-car-motor-servo-control/README.md`,
        description: "原项目的运动函数、调试流程与安全要求。",
      },
      {
        title: "智能小车综合页面",
        type: "html",
        url: `${assetRoot}/phase4/智能小车.html`,
        description: "原平台智能小车综合内容。",
      },
    ],
  },
  {
    id: "project-remote-car",
    title: "遥控小车",
    description: "通过蓝牙命令控制小车，并把输入状态映射为安全的电机动作。",
    outcome: "可用蓝牙控制并包含安全停止指令的遥控小车",
    relatedCourseIds: ["phase4_day5", "phase4_day6"],
    interests: ["car", "motor", "esp32"],
    priority: 90,
    resources: [
      {
        title: "蓝牙遥控小车项目",
        type: "md",
        url: `${assetRoot}/phase4/day4-bluetooth-remote-car/README.md`,
        description: "原项目的命令设计、联调流程与安全要求。",
      },
      {
        title: "智能小车综合页面",
        type: "html",
        url: `${assetRoot}/phase4/智能小车.html`,
        description: "原平台智能小车综合内容。",
      },
    ],
  },
  {
    id: "project-pathfinding-car",
    title: "智能寻路小车",
    description: "把传感器状态、AI 标签或分类结果映射为电机和舵机动作，实现寻路、避障或目标导向移动。",
    outcome: "具备安全停止与简单寻路能力的智能小车",
    relatedCourseIds: ["phase4_day6", "phase4_day7"],
    interests: ["sensor", "car", "motor", "vision", "portfolio"],
    priority: 100,
    resources: [
      {
        title: "智能寻路小车最终项目",
        type: "md",
        url: `${assetRoot}/phase4/day5-ai-pathfinding-car/labs/05-intelligent-pathfinding-project/README.md`,
        description: "原最终项目的输入、动作映射与交付要求。",
      },
      {
        title: "AI 寻路小车课程说明",
        type: "md",
        url: `${assetRoot}/phase4/day5-ai-pathfinding-car/README.md`,
        description: "原课程实验路径与项目主线。",
      },
    ],
  },
  {
    id: "project-model-evaluation",
    title: "模型评测与路由任务",
    description: "使用原平台交互任务比较模型能力、边界与失败场景，并据此完成模型路由。",
    outcome: "一份基于任务证据的模型选择结果",
    relatedCourseIds: ["phase1_day1"],
    interests: ["model"],
    priority: 110,
    resources: [
      {
        title: "模型评测交互任务",
        type: "html",
        url: `${assetRoot}/phase1/day1-model-evaluation/index.html`,
        description: "原平台模型评测与路由任务页面。",
      },
      {
        title: "模型评测实验说明",
        type: "md",
        url: `${assetRoot}/phase1/day1-model-evaluation/README.md`,
        description: "原任务运行方式与交付要求。",
      },
    ],
  },
  {
    id: "project-desktop-agent",
    title: "桌面 Agent 实践",
    description: "使用 Tool Use 与 RAG 让桌面 Agent 调用真实资源完成任务。",
    outcome: "一个可演示的桌面 Agent 工作流",
    relatedCourseIds: ["phase1_day3", "phase1_day4"],
    interests: ["agent"],
    priority: 120,
    resources: [
      {
        title: "桌面 Agent 任务",
        type: "html",
        url: `${assetRoot}/phase1/day3-desktop-agent/index.html`,
        description: "原平台桌面 Agent、Tool Use 与 RAG 任务。",
      },
      {
        title: "Agent 概念与实操手册",
        type: "html",
        url: `${assetRoot}/phase1/Day3-Day4_概念与实操手册.html`,
        description: "原平台共用概念与实操手册。",
      },
    ],
  },
  {
    id: "project-cad-manufacturing",
    title: "从自然语言到制造闭环",
    description: "从自然语言生成 CAD，检查 STEP 模型，再完成切片参数设置与 G-code 预览。",
    outcome: "一套可制造的模型与切片结果",
    relatedCourseIds: ["phase2_day1"],
    interests: ["cad", "portfolio"],
    priority: 130,
    resources: [
      {
        title: "AI 辅助三维造型",
        type: "html",
        url: `${assetRoot}/phase2/Day 1 上午：AI 辅助三维造型生成：从自然语言到制造闭环/day1-ai-cad-tutorial.html`,
        description: "原平台从自然语言到 CAD 的完整课程任务。",
      },
      {
        title: "从 STEP 到 G-code",
        type: "html",
        url: `${assetRoot}/phase2/Day 1 下午：从 STEP 到 G-code：切片里的制造学问/bambu-studio-guide.html`,
        description: "原平台切片与 G-code 课程。",
      },
    ],
  },
]

const node = (
  id: string,
  label: string,
  type: NodeType,
  description: string,
  relatedCourseIds: string[],
  interestsForNode: string[],
): KnowledgeNode => ({
  id,
  label,
  type,
  description,
  relatedCourseIds,
  interests: interestsForNode,
  x: 0,
  y: 0,
})

export const conceptNodes: KnowledgeNode[] = [
  node("k-model", "模型评测", "knowledge", "比较模型能力、边界与失败场景。", ["phase1_day1"], ["model"]),
  node("k-routing", "模型路由", "knowledge", "根据任务类型选择合适的模型。", ["phase1_day1"], ["model", "agent"]),
  node("k-agent", "Agent 能力模块", "knowledge", "把复杂任务拆成可调用能力。", ["phase1_day2", "phase1_day3"], ["agent"]),
  node("k-handoff", "Agent Handoff", "knowledge", "在能力模块之间传递任务和上下文。", ["phase1_day2"], ["agent"]),
  node("k-tools", "Tool Use", "knowledge", "让 Agent 调用真实工具完成任务。", ["phase1_day3", "phase1_day4", "phase2_day2"], ["agent"]),
  node("k-rag", "RAG", "knowledge", "通过检索向 Agent 提供外部知识。", ["phase1_day3"], ["agent"]),
  node("k-gateway", "设备网关", "knowledge", "连接 Agent、接口与真实设备。", ["phase1_day4"], ["agent", "esp32"]),
  node("k-cad", "自然语言到 CAD", "knowledge", "把自然语言约束转换为三维模型。", ["phase2_day1"], ["cad"]),
  node("k-slicing", "STEP、切片与 G-code", "knowledge", "把三维模型转换为制造指令。", ["phase2_day1"], ["cad"]),
  node("k-blender", "Blender Python", "knowledge", "使用脚本自动化三维工作流。", ["phase2_day2"], ["cad", "agent"]),
  node("k-openclaw", "OpenClaw 协同", "knowledge", "把制造任务转换为设备可执行命令。", ["phase2_day3"], ["laser-uv", "agent"]),
  node("k-laser-uv", "激光与 UV 工艺", "knowledge", "根据材料选择激光和 UV 参数并验证安全边界。", ["phase2_day3"], ["laser-uv", "portfolio"]),
  node("k-cam", "CAM 刀路", "knowledge", "生成并检查刀具、进给、切深和碰撞。", ["phase2_day4"], ["toolpath", "cad"]),
  node("k-five-axis", "坐标系与虚实对照", "knowledge", "对齐仿真、装夹、刀具零点和真实设备。", ["phase2_day4"], ["toolpath"]),
  node("k-quality", "加工质量评价", "knowledge", "使用尺寸、表面和缺陷指标评价结果。", ["phase2_day5"], ["quality"]),
  node("k-data-analysis", "工艺数据分析", "knowledge", "关联工艺参数与质量结果并完成可视化分析。", ["phase2_day5"], ["quality", "toolpath"]),
  node("k-esp32", "ESP32-S3", "knowledge", "原平台电子硬件课程使用的开发板。", ["phase3_day1", "phase4_day5"], ["esp32", "circuit", "car"]),
  node("k-gpio", "GPIO 输入与输出", "knowledge", "读取按钮和传感器，并控制 LED、屏幕和执行器。", ["phase3_day1", "phase3_day2", "phase4_day5"], ["esp32", "circuit", "sensor", "motor"]),
  node("k-sensor", "传感器通信", "knowledge", "读取温湿度、距离等真实环境数据。", ["phase3_day2", "phase3_day3", "phase3_day4"], ["sensor", "car"]),
  node("k-i2c", "I2C 与 OLED", "knowledge", "扫描设备地址并在屏幕上显示数据。", ["phase3_day2"], ["sensor", "touch"]),
  node("k-fusion", "传感器融合", "knowledge", "归一化并组合多路传感器数据。", ["phase3_day3"], ["sensor", "vision"]),
  node("k-ultrasonic", "超声波测距", "knowledge", "使用距离数据驱动规则决策。", ["phase3_day4"], ["sensor", "car"]),
  node("k-camera", "摄像头采集", "knowledge", "获取图像并准备视觉模型输入。", ["phase3_day5"], ["camera", "vision"]),
  node("k-edge-ai", "Edge Impulse", "knowledge", "训练并部署轻量边缘 AI 模型。", ["phase3_day3", "phase3_day5", "phase3_day6"], ["vision", "camera", "audio"]),
  node("k-audio", "麦克风与音频事件", "knowledge", "采集音频并用声音事件控制灯光。", ["phase3_day6", "phase4_day6"], ["audio"]),
  node("k-audio-feature", "音频窗口与特征", "knowledge", "从一段声音中提取稳定、可训练的特征。", ["phase4_day1"], ["audio", "audio-model"]),
  node("k-edge-training", "边缘 AI 训练", "knowledge", "建立标签、训练集与验证集并评估泛化能力。", ["phase4_day2"], ["audio-model", "vision"]),
  node("k-multimodal", "多模态融合", "knowledge", "组合声音和图像输入形成统一判断。", ["phase4_day3"], ["multimodal"]),
  node("k-deployment", "设备端模型部署", "knowledge", "对齐输入预处理、模型版本和设备资源。", ["phase4_day3"], ["deploy-model", "multimodal"]),
  node("k-touch", "屏幕与触摸菜单", "knowledge", "设计触摸反馈和菜单状态机。", ["phase4_day4"], ["touch", "portfolio"]),
  node("k-motor", "小车电机驱动", "knowledge", "控制小车动力、方向和响应。", ["phase4_day5", "phase4_day7"], ["car", "motor"]),
  node("k-servo", "舵机控制", "knowledge", "控制舵机动作并与小车协同。", ["phase4_day5", "phase4_day7"], ["car", "motor"]),
  node("k-ai-label", "AI 标签与动作映射", "knowledge", "把语音或视觉标签映射为设备动作。", ["phase4_day6", "phase4_day7"], ["vision", "audio", "car"]),
  node("a-evaluate", "证据化评测", "ability", "用任务结果和失败证据比较模型。", ["phase1_day1"], ["model"]),
  node("a-workflow", "自动化工作流", "ability", "把多个工具和步骤连接成可复用流程。", ["phase1_day2", "phase1_day3", "phase2_day1", "phase2_day2"], ["agent", "cad"]),
  node("a-debug", "硬件调试", "ability", "根据接线、端口和日志定位问题。", ["phase3_day1", "phase3_day4", "phase3_day5"], ["esp32", "sensor", "camera"]),
  node("a-system", "具身系统联调", "ability", "让感知、决策和执行形成稳定闭环。", ["phase4_day6", "phase4_day7"], ["car", "motor", "portfolio"]),
]

export const conceptEdges: Omit<KnowledgeEdge, "id">[] = [
  { source: "k-model", target: "k-routing", direction: "directed", relation: "评测支持路由" },
  { source: "k-agent", target: "k-handoff", direction: "bidirectional", relation: "能力与交接互相约束" },
  { source: "k-agent", target: "k-tools", direction: "directed", relation: "调用真实工具" },
  { source: "k-rag", target: "k-agent", direction: "directed", relation: "提供外部知识" },
  { source: "k-tools", target: "k-gateway", direction: "directed", relation: "连接设备接口" },
  { source: "k-cad", target: "k-slicing", direction: "directed", relation: "模型进入制造" },
  { source: "k-blender", target: "a-workflow", direction: "bidirectional", relation: "脚本驱动工作流" },
  { source: "k-openclaw", target: "k-laser-uv", direction: "directed", relation: "调度制造设备" },
  { source: "k-cam", target: "k-five-axis", direction: "bidirectional", relation: "刀路与坐标互相校验" },
  { source: "k-five-axis", target: "k-quality", direction: "directed", relation: "加工结果进入评价" },
  { source: "k-quality", target: "k-data-analysis", direction: "bidirectional", relation: "质量与参数互相解释" },
  { source: "k-esp32", target: "k-gpio", direction: "bidirectional", relation: "开发板与接口" },
  { source: "k-sensor", target: "k-i2c", direction: "directed", relation: "通过总线通信" },
  { source: "k-sensor", target: "k-fusion", direction: "directed", relation: "形成多源数据" },
  { source: "k-ultrasonic", target: "k-motor", direction: "directed", relation: "距离驱动动作" },
  { source: "k-camera", target: "k-edge-ai", direction: "directed", relation: "提供图像输入" },
  { source: "k-audio", target: "k-edge-ai", direction: "bidirectional", relation: "音频采集与识别" },
  { source: "k-audio", target: "k-audio-feature", direction: "directed", relation: "原始信号形成特征" },
  { source: "k-audio-feature", target: "k-edge-training", direction: "directed", relation: "特征进入训练" },
  { source: "k-edge-training", target: "k-multimodal", direction: "directed", relation: "单模态进入融合" },
  { source: "k-multimodal", target: "k-deployment", direction: "directed", relation: "模型部署到设备" },
  { source: "k-gpio", target: "k-motor", direction: "directed", relation: "输出控制信号" },
  { source: "k-touch", target: "k-ai-label", direction: "directed", relation: "触发设备状态" },
  { source: "k-edge-ai", target: "k-ai-label", direction: "directed", relation: "识别结果形成标签" },
  { source: "k-ai-label", target: "a-system", direction: "directed", relation: "进入具身联调" },
  { source: "k-motor", target: "a-system", direction: "bidirectional", relation: "动作与系统反馈" },
  { source: "k-servo", target: "a-system", direction: "bidirectional", relation: "舵机与系统反馈" },
]

export const courseNodes: KnowledgeNode[] = courses.map((course) =>
  node(course.id, course.title, "course", course.description, [course.id], course.interests),
)

export const allNodes = [...conceptNodes, ...courseNodes]
