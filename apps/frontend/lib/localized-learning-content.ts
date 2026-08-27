"use client"

import type { Locale } from "./bilingual-ui"
import type { OriginalLessonResource, OriginalLessonStep, StepPayload } from "./course-executor-contract"
import type { KnowledgeNode } from "./learning-map-data"
import type { PersonalizedRouteStep } from "./learning-map-utils"
import { englishModuleNames, englishStepCopy, mergeEnglishStepPayload } from "./localized-course-step-copy"

const cjkPattern = /[\u3400-\u9fff]/

export function containsChinese(value?: string | null) {
  return Boolean(value && cjkPattern.test(value))
}

const courseCopy: Record<string, { title: string; description: string; outcome: string }> = {
  "model-evaluation": {
    title: "Model Evaluation and Routing",
    description: "Compare model responses, choose suitable models and understand routing decisions.",
    outcome: "AI application and model selection",
  },
  "agent-handoff": {
    title: "Agent Handoff",
    description: "Understand how capability modules, contracts and handoff records support an agent workflow.",
    outcome: "Agent workflow foundations",
  },
  "desktop-agent": {
    title: "Desktop Agent, Tool Use and RAG",
    description: "Build an agent workflow that can call tools, read context and answer with grounded information.",
    outcome: "Agent application workflow",
  },
  "device-gateway": {
    title: "Device Gateway and Cloud Collaboration",
    description: "Connect local devices, edge services and cloud-side collaboration into one workflow.",
    outcome: "Cloud-edge device collaboration",
  },
  "ai-cad": {
    title: "AI CAD and Slicing",
    description: "Use natural-language CAD, model review and slicing to prepare a manufacturable object.",
    outcome: "AI-assisted digital manufacturing",
  },
  "blender-automation": {
    title: "Blender Automation",
    description: "Generate and modify 3D assets through scripts and AI-assisted modelling workflows.",
    outcome: "Parametric 3D modelling",
  },
  "laser-uv": {
    title: "Laser and UV Collaborative Manufacturing",
    description: "Coordinate laser engraving, UV printing, materials and machine parameters.",
    outcome: "Hybrid fabrication workflow",
  },
  "cam-toolpath": {
    title: "CAM Toolpath and Virtual-Physical Check",
    description: "Generate toolpaths, simulate machining, check setup safety and compare real output with the plan.",
    outcome: "CNC toolpath validation",
  },
  "manufacturing-quality": {
    title: "Manufacturing Quality and Data Analysis",
    description: "Collect process parameters, evaluate quality and use data analysis to explain the result.",
    outcome: "Manufacturing quality analysis",
  },
  "electronics-basics": {
    title: "Electronics Hardware Basics",
    description: "Practise GPIO, button input, PWM and basic embedded electronics experiments.",
    outcome: "Intelligent hardware and edge sensing",
  },
  "sensors-oled": {
    title: "Sensors and OLED Display",
    description: "Read sensor values, communicate through I2C and present device state on a display.",
    outcome: "Sensor data and visual feedback",
  },
  "edge-sensor-fusion": {
    title: "Edge Sensor Fusion",
    description: "Combine multiple sensor inputs and prepare data for edge AI interaction.",
    outcome: "Multimodal sensing",
  },
  "ultrasonic-decision": {
    title: "Ultrasonic Decision Logic",
    description: "Use distance sensing and control rules to trigger safe device behaviour.",
    outcome: "Sensing-to-action decision logic",
  },
  "camera-vision": {
    title: "Camera Vision Recognition",
    description: "Capture images, train or use visual recognition models and test edge inference.",
    outcome: "Computer vision on edge devices",
  },
  "audio-edge-ai": {
    title: "Audio Edge AI",
    description: "Collect audio, recognise signals and connect results to device feedback.",
    outcome: "Audio recognition and device feedback",
  },
  "audio-control": {
    title: "Voice-Controlled Interaction",
    description: "Use sound recognition to trigger lights, motion or interactive responses.",
    outcome: "Voice interaction prototype",
  },
  "edge-ai-training": {
    title: "Edge AI Training and Deployment",
    description: "Train a lightweight AI model and deploy it to an edge device for testing.",
    outcome: "Deployable edge AI model",
  },
  "multimodal-edge-ai": {
    title: "Multimodal Edge AI",
    description: "Combine audio, visual or sensor signals into a multimodal edge-AI workflow.",
    outcome: "Multimodal AI application",
  },
  "touch-interface": {
    title: "Touch Interface Design",
    description: "Design touch interaction, screen layout and feedback logic for an embedded device.",
    outcome: "Touch interaction prototype",
  },
  "multi-actuator": {
    title: "Multi-Actuator Control",
    description: "Control LEDs, motors, servos or other actuators safely and predictably.",
    outcome: "Actuator control system",
  },
  "ai-device-linkage": {
    title: "AI Device Linkage",
    description: "Connect AI decisions with device-side execution and interaction logic.",
    outcome: "Embodied AI linkage",
  },
  "embodied-collaboration": {
    title: "Embodied Collaboration Project",
    description: "Integrate sensing, AI decisions and device actions into a presentable robot or interactive object.",
    outcome: "Embodied intelligence project",
  },
  "build-smart-car": {
    title: "Build a Smart Car",
    description: "Map sensor or AI states to motor and servo actions for safe stopping, obstacle avoidance or path following.",
    outcome: "Smart vehicle prototype",
  },
}

const interestCopy: Record<string, string> = {
  esp32: "ESP32",
  sensor: "Sensors",
  circuit: "Electronic circuits",
  vision: "Edge Impulse vision",
  car: "Build my own smart car",
  cad: "Generate CAD from natural language",
  agent: "Build a desktop Agent",
  model: "Evaluate and choose AI models",
  camera: "Make a camera recognise objects",
  motor: "Control motors and servos",
  audio: "Control lights with sound",
  touch: "Build a touch menu",
  portfolio: "Build a presentable robot",
  "laser-uv": "Make a laser / UV work",
  toolpath: "Generate and check CNC toolpaths",
  quality: "Analyse manufacturing quality",
  "audio-model": "Train my own sound model",
  multimodal: "Train multimodal edge AI",
  "deploy-model": "Deploy a model to a device",
}

const nodeCopy: Record<string, { label: string; description: string }> = {
  "k-model": { label: "Model capability", description: "Understand model strengths, limitations and suitable use cases." },
  "k-routing": { label: "Model routing", description: "Choose the right model or tool path for a task." },
  "k-agent": { label: "Agent workflow", description: "Use prompts, tools and memory to complete a task." },
  "k-handoff": { label: "Agent handoff", description: "Pass context and responsibility between capability modules." },
  "k-tools": { label: "Tool use", description: "Let an agent call external tools safely and traceably." },
  "k-rag": { label: "RAG", description: "Use retrieved knowledge to ground an answer." },
  "k-gateway": { label: "Device gateway", description: "Connect agents, APIs and physical devices through a controlled gateway." },
  "k-cad": { label: "CAD modelling", description: "Create and inspect digital models before fabrication." },
  "k-slicing": { label: "STEP, slicing and G-code", description: "Convert a 3D model into checked manufacturing instructions." },
  "k-blender": { label: "Blender Python", description: "Automate 3D modelling workflows with scripts." },
  "k-openclaw": { label: "OpenClaw orchestration", description: "Turn manufacturing tasks into executable device commands." },
  "k-laser-uv": { label: "Laser and UV processes", description: "Choose process parameters and verify safe manufacturing boundaries." },
  "k-cam": { label: "CAM toolpaths", description: "Generate and inspect toolpaths, feeds, depths and collision risks." },
  "k-five-axis": { label: "Coordinate systems and virtual-physical alignment", description: "Align simulation, workholding, tool zero and the physical machine." },
  "k-quality": { label: "Machining quality", description: "Evaluate dimensions, surfaces and defects with measurable criteria." },
  "k-data-analysis": { label: "Process-data analysis", description: "Relate process parameters to quality outcomes through analysis." },
  "k-fabrication": { label: "Digital fabrication", description: "Prepare files, parameters and workflows for making physical objects." },
  "k-sensing": { label: "Sensing", description: "Collect signals from sensors, cameras or microphones." },
  "k-esp32": { label: "ESP32-S3", description: "Use the embedded development board that supports the hardware course." },
  "k-gpio": { label: "GPIO input and output", description: "Read buttons and sensors and control LEDs, displays and actuators." },
  "k-sensor": { label: "Sensor communication", description: "Read real environmental data such as temperature, humidity and distance." },
  "k-i2c": { label: "I2C and OLED", description: "Discover I2C devices and display data on an OLED screen." },
  "k-fusion": { label: "Sensor fusion", description: "Normalise and combine data from multiple sensors." },
  "k-ultrasonic": { label: "Ultrasonic ranging", description: "Use distance measurements to drive rule-based decisions." },
  "k-camera": { label: "Camera acquisition", description: "Capture image frames for visual processing and model input." },
  "k-edge-ai": { label: "Edge AI", description: "Run AI models on local or embedded devices." },
  "k-audio": { label: "Microphone and audio events", description: "Capture audio and use sound events to control device feedback." },
  "k-audio-feature": { label: "Audio windows and features", description: "Extract stable, trainable features from an audio window." },
  "k-edge-training": { label: "Edge AI training", description: "Build labels, training data and validation data for an edge model." },
  "k-multimodal": { label: "Multimodal fusion", description: "Combine audio and image inputs into one decision process." },
  "k-deployment": { label: "On-device model deployment", description: "Align preprocessing, model versions and device resources." },
  "k-touch": { label: "Screen and touch menu", description: "Design touch feedback and a reliable menu state machine." },
  "k-motor": { label: "Smart-car motor drive", description: "Control vehicle power, direction and response." },
  "k-servo": { label: "Servo control", description: "Control servo motion and coordinate it with the vehicle." },
  "k-ai-label": { label: "AI labels and action mapping", description: "Map audio or visual labels to physical device actions." },
  "k-actuator": { label: "Actuator control", description: "Control lights, motors, servos and device behaviour." },
  "k-interaction": { label: "Interaction design", description: "Design touch, sound, visual or embodied interactions." },
  "a-evaluate": { label: "Evaluate", description: "Compare outputs and explain why one result is better." },
  "a-workflow": { label: "Automated workflow", description: "Connect tools and steps into a reusable workflow." },
  "a-system": { label: "Embodied system integration", description: "Form a stable loop across sensing, decisions and physical actions." },
  "a-build": { label: "Build", description: "Make a working prototype from a learning route." },
  "a-debug": { label: "Debug", description: "Locate problems through evidence and systematic checks." },
  "a-present": { label: "Present", description: "Explain the final work, process and evidence clearly." },
}

function copyForStep(routeStep: PersonalizedRouteStep) {
  return courseCopy[routeStep.courseId ?? ""] ?? courseCopy[routeStep.sourceId] ?? {
    title: "Learning activity",
    description: "Complete this learning activity according to the current route.",
    outcome: "Learning outcome",
  }
}

export function localizeInterestLabel(locale: Locale, id: string, fallback?: string) {
  if (locale === "zh") return fallback ?? id
  return interestCopy[id] ?? fallback ?? id
}

export function localizeKnowledgeNode(locale: Locale, node: KnowledgeNode): KnowledgeNode {
  if (locale === "zh") return node
  const copy = nodeCopy[node.id]
  const label = copy?.label ?? interestCopy[node.id] ?? localizeText(locale, node.label, node.type === "course" ? "Course" : "Knowledge node")
  const description = copy?.description ?? localizeText(locale, node.description, "This node is part of the selected learning route.")
  return { ...node, label, description }
}

export function localizeRouteStep(locale: Locale, routeStep: PersonalizedRouteStep) {
  if (locale === "zh") return routeStep
  const copy = copyForStep(routeStep)
  return {
    ...routeStep,
    title: copy.title,
    description: copy.description,
    outcome: copy.outcome,
    recommendationReason: routeStep.recommendationReason && !containsChinese(routeStep.recommendationReason)
      ? routeStep.recommendationReason
      : "This item is part of your current learning route.",
    interests: routeStep.interests.map((id) => interestCopy[id] ?? id),
  }
}

export function localizeText(locale: Locale, value: string | null | undefined, fallback: string) {
  if (locale === "zh") return value || fallback
  if (!value || containsChinese(value)) return fallback
  return value
}

export function localizeStepTitle(locale: Locale, step: OriginalLessonStep, index: number) {
  if (locale === "zh") return step.title
  const type = step.stepType === "challenge" ? "Challenge" : step.stepType === "safety" ? "Safety check" : "Step"
  return englishStepCopy(step.code, `${type} ${index + 1}`).title
}

export function localizePayload(locale: Locale, payload: StepPayload, step: OriginalLessonStep, index: number): StepPayload {
  if (locale === "zh") return payload
  const translated = mergeEnglishStepPayload(payload, step.code, localizeStepTitle(locale, step, index))
  return {
    ...translated,
    troubleshooting: translated.troubleshooting ?? [
      "Check wiring, power and connection state first.",
      "Compare the current result with the expected output.",
      "Ask the learning partner if the issue still cannot be located.",
    ],
    evidence_requirement: translated.evidence_requirement ?? "Save a screenshot, photo, log or file that demonstrates the result.",
    scaffold_instruction: payload.scaffold_instruction ? localizeText(locale, payload.scaffold_instruction, "Use the scaffold to break the task into smaller checks.") : undefined,
    remedial_task: payload.remedial_task ? localizeText(locale, payload.remedial_task, "Review the prerequisite concept before continuing.") : undefined,
    challenge_task: payload.challenge_task ? localizeText(locale, payload.challenge_task, "Apply this step to a slightly different case.") : undefined,
  }
}

export function localizeModuleName(locale: Locale, value: string) {
  if (locale === "zh") return value
  return englishModuleNames[value] ?? localizeText(locale, value, "Learning module")
}

export function localizeResource(locale: Locale, resource: OriginalLessonResource, index: number) {
  if (locale === "zh") return resource
  return {
    ...resource,
    title: localizeText(locale, resource.title, `Course resource ${index + 1}`),
    description: localizeText(locale, resource.description, "Original course resource"),
  }
}
