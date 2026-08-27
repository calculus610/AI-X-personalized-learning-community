export const COMPETENCY_CATALOG_VERSION = "competency-catalog-v1"

const definitions = [
  ["embedded-systems", "嵌入式系统", "Embedded Systems", "在资源受限设备上设计、编程和调试软硬件系统", "Designs, programs and debugs resource-constrained devices"],
  ["circuit-design", "电子电路", "Electronic Circuits", "理解 GPIO、电气连接和基础电路行为", "Understands GPIO, electrical connections and basic circuit behaviour"],
  ["sensor-integration", "传感器集成", "Sensor Integration", "接入、读取并融合真实传感器数据", "Connects, reads and combines real sensor data"],
  ["motor-control", "电机与执行器控制", "Motor and Actuator Control", "安全控制电机、舵机和其他执行器", "Controls motors, servos and other actuators safely"],
  ["iot", "物联网与设备网关", "IoT and Device Gateways", "连接设备、接口与云端服务", "Connects devices, APIs and cloud services"],
  ["computer-vision", "计算机视觉", "Computer Vision", "利用图像进行识别、分析与理解", "Uses images for recognition, analysis and understanding"],
  ["machine-learning", "机器学习", "Machine Learning", "设计数据、训练、验证和评测模型", "Designs data, training, validation and model evaluation"],
  ["multimodal-ai", "多模态人工智能", "Multimodal AI", "组合图像、声音和传感器信号", "Combines image, audio and sensor signals"],
  ["speech-recognition", "语音与声音识别", "Speech and Audio Recognition", "从音频中提取特征并识别事件", "Extracts features and recognises events from audio"],
  ["model-deployment", "模型部署", "Model Deployment", "把经过验证的模型部署到设备", "Deploys validated models to devices"],
  ["edge-computing", "边缘计算", "Edge Computing", "在设备侧完成低延迟处理和决策", "Runs low-latency processing and decisions on devices"],
  ["agent-development", "智能体开发", "Agent Development", "构建带工具、检索和工作流的智能体", "Builds agents with tools, retrieval and workflows"],
  ["model-evaluation", "模型评测与路由", "Model Evaluation and Routing", "比较模型能力并选择合适路径", "Compares model capabilities and selects suitable routes"],
  ["backend-integration", "后端与接口集成", "Backend and API Integration", "设计接口并连接服务与设备", "Designs APIs and connects services and devices"],
  ["interaction-design", "交互设计", "Interaction Design", "设计界面、状态、反馈和可用性", "Designs interfaces, states, feedback and usability"],
  ["product-design", "产品设计", "Product Design", "把用户目标转化为可验证的产品方案", "Turns user goals into testable product solutions"],
  ["cad", "CAD 与三维建模", "CAD and 3D Modelling", "创建和检查可制造的数字模型", "Creates and checks manufacturable digital models"],
  ["cnc-toolpath", "CNC 刀路", "CNC Toolpaths", "生成、仿真并检查加工刀路", "Generates, simulates and checks machining toolpaths"],
  ["digital-manufacturing", "数字制造", "Digital Manufacturing", "连接数字设计、参数和制造流程", "Connects digital design, parameters and fabrication"],
  ["laser-processing", "激光与 UV 加工", "Laser and UV Processing", "选择加工参数并验证安全边界", "Selects process parameters and verifies safety boundaries"],
  ["quality-analysis", "质量分析", "Quality Analysis", "用数据评价结果并改进工艺", "Uses data to evaluate results and improve processes"],
  ["robot-perception", "机器人感知", "Robot Perception", "融合视觉和传感器理解环境", "Combines vision and sensors to understand environments"],
  ["robot-control", "机器人控制", "Robot Control", "把决策可靠地转换为设备动作", "Turns decisions into reliable device actions"],
  ["automation", "自动化与系统编排", "Automation and Orchestration", "组织工具、设备和流程自动协作", "Orchestrates tools, devices and workflows"],
  ["debugging", "工程调试", "Engineering Debugging", "定位软硬件与集成问题并验证修复", "Diagnoses software, hardware and integration issues"],
  ["system-integration", "系统集成", "System Integration", "组合感知、决策、接口和执行", "Combines sensing, decisions, APIs and actuation"],
  ["portfolio-development", "作品与展示", "Portfolio Development", "把技术成果组织为可演示作品", "Turns technical outcomes into demonstrable work"],
]

export const COMPETENCIES = Object.freeze(definitions.map(([id, zh, en, descriptionZh, descriptionEn]) => Object.freeze({
  id, name: Object.freeze({ zh, en }), description: Object.freeze({ zh: descriptionZh, en: descriptionEn }),
})))
export const COMPETENCY_IDS = new Set(COMPETENCIES.map((item) => item.id))
export const COMPETENCY_BY_ID = new Map(COMPETENCIES.map((item) => [item.id, item]))
