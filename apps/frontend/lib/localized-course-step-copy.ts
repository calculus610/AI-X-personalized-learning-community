import type { StepPayload } from "./course-executor-contract"

type StepCopy = {
  title: string
  goal?: string
  instruction?: string
  checklist?: string[]
  safetyCheck?: string
  completionCheckpoint?: string
  troubleshooting?: string[]
  evidenceRequirement?: string[]
}

const lessonStepTitles: Array<{ prefix: string; padded?: boolean; titles: string[] }> = [
  { prefix: "phase3_day1_step_", padded: true, titles: [
    "Identify the Development Board, LED, Button and Interfaces",
    "Confirm the USB Data Cable, Board Model and Port",
    "Turn On the LED",
    "Make the LED Blink and Understand setup, loop and delay",
    "Control the LED with a Button and Check GPIO Input/Output",
    "Build a Breathing-Light Effect and Review the Evidence",
  ] },
  { prefix: "phase3_day2_step_", padded: true, titles: [
    "Scan the I2C Address and Confirm OLED Communication",
    "Read DHT11 Temperature and Humidity over Serial",
    "Display a Hello Message on the OLED",
    "Build a DHT11 and OLED Temperature-Humidity Display",
    "Create a Multi-Screen Badge or Temperature-Humidity Project",
  ] },
  { prefix: "phase3_day3_step_", padded: true, titles: [
    "Read Multiple Sensors at the Same Time",
    "Normalise Raw Sensor Data into Scores",
    "Fuse Multiple States with Rules",
    "Build a Sensor-Fusion Environment Monitor",
    "Extend the Project with an Edge Impulse Sensor-Fusion Classifier",
  ] },
  { prefix: "phase3_day4_step_", padded: true, titles: [
    "Measure Distance with an Ultrasonic Sensor",
    "Define Distance Thresholds and States",
    "Display Distance and Decision State on the OLED",
    "Build an Ultrasonic Smart-Decision Project",
  ] },
  { prefix: "phase3_day5_step_", padded: true, titles: [
    "Initialise the Camera and Capture the First Frame",
    "Understand Image Data and Pixel Information",
    "Detect Visual Targets with Colour Rules",
    "Build a Visual-Perception Mini Project",
    "Extend the Project with Edge Impulse Image Classification",
  ] },
  { prefix: "phase3_day6_step_", padded: true, titles: [
    "Control an LED Strip",
    "Test the Microphone Input",
    "Detect Sound-Intensity States",
    "Control Lights with a Clap or Simple Sound Event",
    "Extend the Project with Edge Impulse Audio Classification",
  ] },
  { prefix: "phase4_day1_step", titles: [
    "Confirm the Microphone Acquisition Pipeline",
    "Verify Raw Audio Data Quality",
    "Build Basic Audio Features",
    "Implement Sound-Controlled Lighting",
    "Organise Troubleshooting Evidence",
  ] },
  { prefix: "phase4_day2_step", titles: [
    "Create an Edge Impulse Project and Label System",
    "Collect Multi-Source Sensor Data",
    "Train an Edge AI Model",
    "Generate Environment-Monitoring Code",
    "Debug the Sensor-Fusion Logic",
  ] },
  { prefix: "phase4_day3_step", titles: [
    "Optimise the Audio Recognition Model",
    "Define and Complete the Photo-Collection Protocol",
    "Train an Image Recognition Model",
    "Deploy the Multimodal Model to the Device",
    "Complete System-Level Acceptance Testing",
  ] },
  { prefix: "phase4_day4_step", titles: [
    "Design the Screen Information Architecture",
    "Calibrate Touch Coordinates",
    "Implement the Menu State Machine",
    "Debug Touch Feedback",
    "Optimise Interaction Responsiveness",
  ] },
  { prefix: "phase4_day5_step", titles: [
    "Check Actuator Safety and Power",
    "Test Each Actuator Independently",
    "Design a Multi-Actuator Sequence",
    "Implement Coordinated Actuator Control",
    "Record Operating Evidence and Limitations",
  ] },
  { prefix: "phase4_day6_step", titles: [
    "Define the AI Label System",
    "Build the Trigger Mapping Table",
    "Link AI Labels to LED-Strip Effects",
    "Synchronise On-Screen Feedback",
    "Debug End-to-End Response Smoothness",
  ] },
  { prefix: "phase4_day7_step", titles: [
    "Design a Joint Control Strategy",
    "Coordinate the Smart Car and Servo",
    "Reduce Recognition-to-Action Latency",
    "Diagnose Stuttering and Instability",
    "Complete End-to-End Demo Acceptance",
  ] },
  { prefix: "phase1_day1_step", titles: [
    "Understand the Four-Day Phase 1 Engineering Pipeline",
    "Design the Model-Evaluation Task",
    "Compare Model Outputs and Failure Cases",
    "Create the Model-Routing Table",
    "Organise the Day 1 Deliverables",
  ] },
  { prefix: "phase1_day2_step", titles: [
    "Define Capability-Module Boundaries",
    "Build the Prompt Library",
    "Define Schema and Action Contracts",
    "Design Evaluation Cases",
    "Complete the Handoff Package",
  ] },
  { prefix: "phase1_day3_step", titles: [
    "Understand the Desktop Agent Workflow",
    "Prepare the Agent Workspace",
    "Run a Desktop Agent Task",
    "Inspect the trace_log",
    "Prepare the Day 4 Input",
  ] },
  { prefix: "phase1_day4_step", titles: [
    "Understand the Device-Gateway Architecture",
    "Start and Self-Test the Service",
    "Inspect the Dashboard and Workspace",
    "Trigger the Agent from a Device or External Entry Point",
    "Archive the Phase 1 Learning Record",
  ] },
  { prefix: "phase2_day1_step", titles: [
    "Define Part Requirements and the Prompt",
    "Generate a STEP Model and Inspect Its Geometry",
    "Correct Model Defects",
    "Slice the Model in Bambu Studio",
    "Organise Manufacturing Evidence",
  ] },
  { prefix: "phase2_day2_step", titles: [
    "Understand the Blender Python API",
    "Use a Large Language Model to Generate the Script",
    "Export a Printable STL",
    "Slice the Model and Observe the Print",
    "Complete Post-Processing and Assembly Tests",
  ] },
  { prefix: "phase2_day3_step", titles: [
    "Understand the OpenClaw Command Model",
    "Learn the Laser-Processing Parameters",
    "Learn the UV Printing Workflow",
    "Run AI-Orchestrated Manufacturing",
    "Organise Dual-Machine Collaboration Evidence",
  ] },
  { prefix: "phase2_day4_step", titles: [
    "Understand Five-Axis Structure and Coordinate Systems",
    "Understand 3+2 Positional Machining",
    "Create and Simulate the CAM Toolpath",
    "Set Up, Touch Off and Dry-Run the Machine",
    "Create a Virtual-to-Physical Comparison Record",
  ] },
  { prefix: "phase2_day5_step", titles: [
    "Understand Machining-Quality Metrics",
    "Organise Process-Parameter Data",
    "Perform Visualisation and Regression Analysis",
    "Review the Work against Expert Cases",
    "Complete the Phase 2 Summary",
  ] },
]

const stepCopy: Record<string, StepCopy> = Object.fromEntries(
  lessonStepTitles.flatMap(({ prefix, padded, titles }) => titles.map((title, index) => [
    `${prefix}${padded ? String(index + 1).padStart(2, "0") : index + 1}`,
    { title },
  ])),
)

Object.assign(stepCopy, {
  phase3_day5_step_01: {
    title: "Initialise the Camera and Capture the First Frame",
    goal: "Confirm that the camera hardware, board profile and pin configuration work together.",
    instruction: "Use the ESP32-S3 camera board and upload the first-frame capture program. In the serial monitor, confirm Camera initialized, Frame captured, Width, Height and Size before continuing.",
    checklist: ["Select the correct development-board profile", "Initialise the camera successfully", "Read frame width, height and size in the serial monitor"],
    safetyCheck: "Do not capture identifiable images of people without their consent.",
    completionCheckpoint: "Provide serial output showing that the first frame was captured successfully.",
    troubleshooting: ["Check the official camera pin map", "Reduce the frame size", "Test the board vendor's camera example"],
    evidenceRequirement: ["Photo of the board and camera", "Screenshot of the first-frame serial output"],
  },
  phase3_day5_step_02: {
    title: "Understand Image Data and Pixel Information",
    goal: "Understand that the camera provides image data, not a ready-made semantic answer.",
    instruction: "Capture frames repeatedly and print width, height and byte count. Change the frame size and compare how the amount of image data changes.",
    checklist: ["Print frame information continuously", "Compare byte counts at different frame sizes", "Explain why an image is data that still needs interpretation"],
    safetyCheck: "Do not store or upload images containing private or identifiable content.",
    completionCheckpoint: "Explain why additional processing is needed before the program can decide what the camera sees.",
    troubleshooting: ["Lower the resolution", "Print metadata only", "Add image-processing logic one part at a time"],
    evidenceRequirement: ["Serial screenshots for two frame sizes", "One-sentence explanation of image data"],
  },
  phase3_day5_step_03: {
    title: "Detect Visual Targets with Colour Rules",
    goal: "Use simple rules to detect a red, blue or green target in image data.",
    instruction: "Use a low-resolution RGB image to calculate the proportion of target-colour pixels. Place a coloured card in view and observe how the score and state change.",
    checklist: ["Prepare a clearly coloured target", "Print the colour score in the serial monitor", "Confirm that the state changes when the target enters the frame"],
    safetyCheck: "Use coloured cards or objects instead of capturing classmates' faces.",
    completionCheckpoint: "Explain why this is rule-based visual perception rather than a trained AI model.",
    troubleshooting: ["Keep the lighting stable", "Adjust the colour threshold", "Use a more saturated target colour"],
    evidenceRequirement: ["Photo of the target card", "Screenshot of the colour-detection output"],
  },
  phase3_day5_step_04: {
    title: "Build a Visual-Perception Mini Project",
    goal: "Make the device output a simple visual state from camera input.",
    instruction: "Choose colour, brightness or near-object detection. Extract one visual feature, convert it into a state, and display the state over serial or on the OLED.",
    checklist: ["Define one clear visual task", "Extract one measurable visual feature", "Convert the feature into a device state", "Describe the limitations of the rule"],
    safetyCheck: "Point the camera only at test cards, objects or an explicitly authorised scene.",
    completionCheckpoint: "Demonstrate different outputs for two distinct visual scenes.",
    troubleshooting: ["Choose one simple feature", "Fix the test environment first", "Add negative test cases gradually"],
    evidenceRequirement: ["Photos of two test scenes", "Screenshot of the running output", "Short note explaining the rule's limitations"],
  },
  phase3_day5_step_05: {
    title: "Extend the Project with Edge Impulse Image Classification",
    goal: "Understand the image-classification workflow from sampling and training to on-device inference.",
    instruction: "Design labels such as red_card, blue_card and empty. If time allows, collect images in Edge Impulse, train the classifier, export the Arduino library and run local inference.",
    checklist: ["Define clear classification labels", "Explain the sampling and training workflow", "Replace the exported library name with the name of the current project"],
    safetyCheck: "Do not upload images of people or private scenes without consent.",
    completionCheckpoint: "Submit the label design or an Edge Impulse workflow screenshot.",
    troubleshooting: ["Use coloured cards to reduce task difficulty", "Keep the background consistent", "Complete the rule-based vision version first"],
    evidenceRequirement: ["Screenshot of the label design", "Edge Impulse project screenshot or workflow diagram", "Optional inference-result screenshot"],
  },
} satisfies Record<string, StepCopy>)

export function englishStepCopy(stepCode: string, fallbackTitle: string): StepCopy {
  const copy = stepCopy[stepCode]
  const title = copy?.title ?? fallbackTitle
  return {
    title,
    goal: copy?.goal ?? `Complete “${title}” and verify the course-specific result.`,
    instruction: copy?.instruction ?? `Carry out “${title}” using the current course materials. Check each result before moving to the next step.`,
    checklist: copy?.checklist ?? [
      `Complete the required work for “${title}”`,
      `Verify the expected result for “${title}”`,
      "Record the result and any issue for review",
    ],
    safetyCheck: copy?.safetyCheck,
    completionCheckpoint: copy?.completionCheckpoint ?? `The result of “${title}” can be demonstrated and explained.`,
    troubleshooting: copy?.troubleshooting,
    evidenceRequirement: copy?.evidenceRequirement,
  }
}

export function mergeEnglishStepPayload(payload: StepPayload, stepCode: string, fallbackTitle: string): StepPayload {
  const copy = englishStepCopy(stepCode, fallbackTitle)
  return {
    ...payload,
    title: copy.title,
    goal: copy.goal,
    instruction: copy.instruction,
    checklist: copy.checklist,
    safety_check: copy.safetyCheck ?? (payload.safety_check ? "Follow the equipment and classroom safety rules for this step." : null),
    completion_checkpoint: copy.completionCheckpoint,
    troubleshooting: copy.troubleshooting,
    evidence_requirement: copy.evidenceRequirement,
  }
}

export const englishModuleNames: Record<string, string> = {
  "AI 应用与智能体": "AI Applications and Agents",
  "AI 设计与数字制造": "AI Design and Digital Manufacturing",
  "智能硬件与边缘感知": "Intelligent Hardware and Edge Sensing",
  "具身交互与智能小车": "Embodied Interaction and Smart Vehicles",
}
