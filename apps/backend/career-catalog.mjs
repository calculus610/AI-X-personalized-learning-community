import { COMPETENCY_IDS } from "./competency-catalog.mjs"

export const CAREER_CATALOG_VERSION = "career-catalog-v1"

const categories = [
  ["embedded-hardware", "嵌入式与硬件", "Embedded and Hardware"],
  ["ai-data", "人工智能与数据", "Artificial Intelligence and Data"],
  ["robotics-automation", "机器人与自动化", "Robotics and Automation"],
  ["design-manufacturing", "设计与数字制造", "Design and Digital Manufacturing"],
  ["software-product", "软件、产品与综合应用", "Software, Product and Integrated Applications"],
]

const career = (id, categoryId, zh, en, descriptionZh, descriptionEn, competencies) => ({ id, categoryId, name: { zh, en }, description: { zh: descriptionZh, en: descriptionEn }, competencies })
const careers = [
  career("embedded-systems-engineer", "embedded-hardware", "嵌入式系统工程师", "Embedded Systems Engineer", "开发运行在智能设备上的软硬件系统", "Develops hardware-software systems running on smart devices", { "embedded-systems": 1, "circuit-design": .7, debugging: .8, "system-integration": .55 }),
  career("electronics-engineer", "embedded-hardware", "电子工程师", "Electronics Engineer", "设计、连接并验证电子电路与设备接口", "Designs, connects and validates electronic circuits and device interfaces", { "circuit-design": 1, "embedded-systems": .7, "sensor-integration": .5, debugging: .65 }),
  career("sensor-applications-engineer", "embedded-hardware", "传感器应用工程师", "Sensor Applications Engineer", "把环境和设备传感器接入真实产品", "Integrates environmental and device sensors into real products", { "sensor-integration": 1, "embedded-systems": .65, "edge-computing": .55, debugging: .6 }),
  career("iot-engineer", "embedded-hardware", "物联网工程师", "IoT Engineer", "连接设备、网关、接口和云端服务", "Connects devices, gateways, APIs and cloud services", { iot: 1, "backend-integration": .8, "embedded-systems": .6, "system-integration": .75 }),
  career("smart-hardware-engineer", "embedded-hardware", "智能硬件工程师", "Smart Hardware Engineer", "集成传感、交互、执行和设备端计算", "Integrates sensing, interaction, actuation and on-device computing", { "embedded-systems": 1, "sensor-integration": .8, "motor-control": .55, "system-integration": .85, "interaction-design": .45 }),
  career("edge-computing-engineer", "embedded-hardware", "边缘计算工程师", "Edge Computing Engineer", "在设备侧完成低延迟数据处理和智能决策", "Runs low-latency data processing and intelligent decisions on devices", { "edge-computing": 1, "embedded-systems": .65, "model-deployment": .75, "system-integration": .55 }),

  career("artificial-intelligence-engineer", "ai-data", "人工智能工程师", "Artificial Intelligence Engineer", "设计、评测并交付可用的人工智能能力", "Designs, evaluates and delivers usable AI capabilities", { "machine-learning": 1, "model-evaluation": .8, "model-deployment": .7, "system-integration": .5 }),
  career("machine-learning-engineer", "ai-data", "机器学习工程师", "Machine Learning Engineer", "构建数据、训练、验证和部署流程", "Builds data, training, validation and deployment pipelines", { "machine-learning": 1, "model-evaluation": .75, "model-deployment": .85, debugging: .45 }),
  career("computer-vision-engineer", "ai-data", "计算机视觉工程师", "Computer Vision Engineer", "开发图像采集、识别与视觉模型部署能力", "Develops image capture, recognition and vision-model deployment", { "computer-vision": 1, "machine-learning": .8, "model-deployment": .75, "edge-computing": .5 }),
  career("multimodal-ai-engineer", "ai-data", "多模态 AI 工程师", "Multimodal AI Engineer", "组合图像、声音和传感器信号完成智能任务", "Combines image, audio and sensor signals for intelligent tasks", { "multimodal-ai": 1, "machine-learning": .75, "computer-vision": .55, "speech-recognition": .55, "model-deployment": .65 }),
  career("edge-ai-engineer", "ai-data", "边缘 AI 工程师", "Edge AI Engineer", "训练并在嵌入式设备上运行轻量模型", "Trains and runs lightweight models on embedded devices", { "edge-computing": 1, "model-deployment": .95, "machine-learning": .75, "embedded-systems": .6 }),
  career("ai-model-deployment-engineer", "ai-data", "AI 模型部署工程师", "AI Model Deployment Engineer", "将经过验证的模型可靠部署到目标设备", "Reliably deploys validated models to target devices", { "model-deployment": 1, "edge-computing": .85, "machine-learning": .6, debugging: .7 }),
  career("audio-ai-engineer", "ai-data", "语音与声音识别工程师", "Speech and Audio Recognition Engineer", "采集音频、训练识别模型并连接交互反馈", "Captures audio, trains recognition models and connects interaction feedback", { "speech-recognition": 1, "machine-learning": .7, "model-deployment": .65, "interaction-design": .45 }),
  career("ai-application-engineer", "ai-data", "AI 应用开发工程师", "AI Application Engineer", "把模型、智能体、接口和产品工作流组合起来", "Combines models, agents, APIs and product workflows", { "agent-development": 1, "backend-integration": .7, "model-evaluation": .65, "system-integration": .8 }),
  career("agent-development-engineer", "ai-data", "智能体开发工程师", "Agent Development Engineer", "开发带工具调用、检索和协作边界的智能体", "Develops agents with tool use, retrieval and collaboration boundaries", { "agent-development": 1, automation: .8, "backend-integration": .65, "model-evaluation": .55 }),

  career("robotics-engineer", "robotics-automation", "机器人工程师", "Robotics Engineer", "集成机器人感知、控制、执行和系统调试", "Integrates robot perception, control, actuation and debugging", { "robot-perception": .8, "robot-control": 1, "motor-control": .85, "system-integration": .9, debugging: .55 }),
  career("robot-perception-engineer", "robotics-automation", "机器人感知工程师", "Robot Perception Engineer", "利用视觉、传感器和 AI 帮助机器人理解环境", "Uses vision, sensors and AI to help robots understand environments", { "robot-perception": 1, "computer-vision": .9, "sensor-integration": .85, "multimodal-ai": .6, "model-deployment": .5 }),
  career("robot-control-engineer", "robotics-automation", "机器人控制工程师", "Robot Control Engineer", "将决策转换为安全、稳定的电机和执行器动作", "Turns decisions into safe and stable motor and actuator actions", { "robot-control": 1, "motor-control": .95, "embedded-systems": .65, debugging: .7 }),
  career("automation-engineer", "robotics-automation", "自动化工程师", "Automation Engineer", "编排设备、工具和控制流程实现稳定自动运行", "Orchestrates devices, tools and control flows for reliable automation", { automation: 1, "system-integration": .85, "robot-control": .55, "backend-integration": .5 }),
  career("smart-vehicle-engineer", "robotics-automation", "智能小车开发工程师", "Smart Vehicle Engineer", "开发具备感知、决策和运动能力的智能车辆", "Develops smart vehicles with sensing, decisions and motion", { "robot-control": 1, "motor-control": .95, "robot-perception": .85, "sensor-integration": .65, "portfolio-development": .55 }),

  career("ai-product-designer", "design-manufacturing", "AI 产品设计师", "AI Product Designer", "设计融合人工智能、交互和真实使用场景的产品", "Designs products combining AI, interaction and real use cases", { "product-design": 1, "interaction-design": .8, "model-evaluation": .55, "system-integration": .55, "portfolio-development": .45 }),
  career("interaction-designer", "design-manufacturing", "交互设计师", "Interaction Designer", "设计界面结构、触摸反馈和设备交互流程", "Designs interface structure, touch feedback and device interaction flows", { "interaction-design": 1, "product-design": .8, "embedded-systems": .35, "portfolio-development": .55 }),
  career("cad-design-engineer", "design-manufacturing", "CAD 设计工程师", "CAD Design Engineer", "创建、检查并准备可制造的三维模型", "Creates, checks and prepares manufacturable 3D models", { cad: 1, "digital-manufacturing": .75, "product-design": .55, debugging: .4 }),
  career("digital-manufacturing-engineer", "design-manufacturing", "数字制造工程师", "Digital Manufacturing Engineer", "连接 CAD、加工参数、设备和质量评价", "Connects CAD, process parameters, equipment and quality evaluation", { "digital-manufacturing": 1, cad: .65, "cnc-toolpath": .7, "quality-analysis": .65, automation: .45 }),
  career("cnc-process-engineer", "design-manufacturing", "CNC 工艺工程师", "CNC Process Engineer", "设计、仿真并验证数控加工刀路和工艺", "Designs, simulates and validates CNC toolpaths and processes", { "cnc-toolpath": 1, "digital-manufacturing": .8, "quality-analysis": .7, debugging: .55 }),
  career("laser-processing-engineer", "design-manufacturing", "激光加工应用工程师", "Laser Processing Engineer", "选择材料与参数并交付激光或 UV 制造作品", "Selects materials and parameters to deliver laser or UV work", { "laser-processing": 1, "digital-manufacturing": .8, cad: .5, "quality-analysis": .45 }),

  career("technical-solutions-engineer", "software-product", "技术解决方案工程师", "Technical Solutions Engineer", "把客户目标转化为设备、接口和 AI 的集成方案", "Turns customer goals into integrated device, API and AI solutions", { "system-integration": 1, "backend-integration": .8, iot: .65, "product-design": .55, debugging: .5 }),
  career("smart-hardware-product-manager", "software-product", "智能硬件产品经理", "Smart Hardware Product Manager", "规划融合传感、交互和设备能力的智能产品", "Plans smart products combining sensing, interaction and device capabilities", { "product-design": 1, "system-integration": .75, "interaction-design": .7, "sensor-integration": .45, "portfolio-development": .5 }),
  career("ai-product-manager", "software-product", "AI 产品经理", "AI Product Manager", "定义 AI 产品目标、评测标准和交付流程", "Defines AI product goals, evaluation criteria and delivery workflows", { "product-design": 1, "model-evaluation": .85, "agent-development": .55, "interaction-design": .65, "portfolio-development": .45 }),
  career("technology-innovation-entrepreneur", "software-product", "科技创新创业者", "Technology Innovation Entrepreneur", "把跨领域技术整合为可验证、可展示的创新产品", "Combines cross-domain technologies into testable, demonstrable products", { "product-design": 1, "portfolio-development": .95, "system-integration": .8, automation: .45, "digital-manufacturing": .4 }),
]

const vectors = new Set()
for (const item of careers) {
  if (!categories.some(([id]) => id === item.categoryId)) throw new Error(`invalid_career_category:${item.id}`)
  if (!Object.values(item.competencies).some((value) => value === 1)) throw new Error(`career_without_core_competency:${item.id}`)
  for (const [id, value] of Object.entries(item.competencies)) if (!COMPETENCY_IDS.has(id) || value < 0 || value > 1) throw new Error(`invalid_career_competency:${item.id}:${id}`)
  const signature = JSON.stringify(Object.entries(item.competencies).sort())
  if (vectors.has(signature)) throw new Error(`duplicate_career_vector:${item.id}`)
  vectors.add(signature)
}

export const CAREERS = Object.freeze(careers.map((item, index) => Object.freeze({ ...item, name: Object.freeze(item.name), description: Object.freeze(item.description), competencies: Object.freeze(item.competencies), sortOrder: index + 1 })))
export const CAREER_BY_ID = new Map(CAREERS.map((item) => [item.id, item]))
export const CAREER_CATEGORIES = Object.freeze(categories.map(([id, zh, en], index) => Object.freeze({ id, name: Object.freeze({ zh, en }), sortOrder: index + 1 })))

export function serializeCareerCatalog() {
  return {
    version: CAREER_CATALOG_VERSION,
    categories: CAREER_CATEGORIES.map((category) => ({ ...category, careers: CAREERS.filter((careerItem) => careerItem.categoryId === category.id).map(({ competencies, ...publicCareer }) => publicCareer) })),
  }
}
