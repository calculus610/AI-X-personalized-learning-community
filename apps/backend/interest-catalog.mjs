export const INTEREST_CATALOG_VERSION = "interest-catalog-v1"

// Names and order are copied from the currently deployed production frontend bundle.
export const INTERESTS = Object.freeze([
  ["esp32", "ESP32", "ESP32"],
  ["sensor", "传感器", "Sensors"],
  ["circuit", "电子电路", "Electronic circuits"],
  ["vision", "Edge Impulse 视觉", "Edge Impulse vision"],
  ["car", "做一辆自己的小车", "Build my own smart car"],
  ["cad", "自然语言生成 CAD", "Generate CAD from natural language"],
  ["agent", "做一个桌面 Agent", "Build a desktop Agent"],
  ["model", "评测与选择 AI 模型", "Evaluate and choose AI models"],
  ["camera", "让摄像头识别物体", "Make a camera recognise objects"],
  ["motor", "控制电机和舵机", "Control motors and servos"],
  ["audio", "用声音控制灯", "Control lights with sound"],
  ["touch", "做一个触摸菜单", "Build a touch menu"],
  ["portfolio", "做一个可展示的机器人", "Build a presentable robot"],
  ["laser-uv", "做一个激光 / UV 作品", "Make a laser / UV work"],
  ["toolpath", "生成并检查 CNC 刀路", "Generate and check CNC toolpaths"],
  ["quality", "分析加工质量", "Analyse manufacturing quality"],
  ["audio-model", "训练自己的声音识别模型", "Train my own sound model"],
  ["multimodal", "训练多模态边缘 AI", "Train multimodal edge AI"],
  ["deploy-model", "把模型部署到设备", "Deploy a model to a device"],
].map(([id, zh, en], index) => Object.freeze({ id, name: Object.freeze({ zh, en }), sortOrder: index + 1 })))

export const INTEREST_IDS = new Set(INTERESTS.map((item) => item.id))

export function serializeInterestCatalog() {
  return { version: INTEREST_CATALOG_VERSION, interests: INTERESTS }
}
