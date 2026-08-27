import { CAREER_BY_ID } from "./career-catalog.mjs"
import { COURSE_COMPETENCIES_BY_ID } from "./course-competency-map.mjs"

export const CAREER_RECOMMENDATION_CONFIG = Object.freeze({
  algorithmVersion: "career-course-v2",
  maxLimit: 5,
  weights: Object.freeze({ baseFit: .65, coverageGain: .25, feasibility: .10, redundancy: -.10, completed: -.35 }),
})

const round = (value) => Math.round((value + Number.EPSILON) * 1e6) / 1e6
const vectorValue = (vector, id) => Number(vector?.[id] ?? 0)
const COURSE_TITLES_EN = Object.freeze({
  "model-evaluation": "Model Evaluation and Routing", "agent-handoff": "Agent Handoff",
  "desktop-agent": "Desktop Agent, Tool Use and RAG", "device-gateway": "Device Gateway and Cloud Collaboration",
  "ai-cad": "AI CAD and Slicing", "blender-automation": "Blender Automation",
  "laser-uv": "Laser and UV Collaborative Manufacturing", "cam-toolpath": "CAM Toolpath and Virtual-Physical Check",
  "manufacturing-quality": "Manufacturing Quality and Data Analysis", "electronics-basics": "Electronics Hardware Basics",
  "sensors-oled": "Sensors and OLED Display", "edge-sensor-fusion": "Edge Sensor Fusion",
  "ultrasonic-decision": "Ultrasonic Decision Logic", "camera-vision": "Camera Vision Recognition",
  "audio-edge-ai": "Audio Edge AI", "audio-control": "Voice-Controlled Interaction",
  "edge-ai-training": "Edge AI Training and Deployment", "multimodal-edge-ai": "Multimodal Edge AI",
  "touch-interface": "Touch Interface Design", "multi-actuator": "Multi-Actuator Control",
  "ai-device-linkage": "AI Device Linkage", "embodied-collaboration": "Embodied Collaboration Project",
  "build-smart-car": "Build a Smart Car",
})
const MODULE_TITLES_EN = Object.freeze({
  ai_agent: "AI Applications and Agents",
  ai_manufacturing: "AI Design and Digital Manufacturing",
  embedded_perception: "Smart Hardware and Edge Perception",
  embodied_projects: "Embodied Interaction and Smart Vehicles",
})

export class RecommendationInputError extends Error {
  constructor(code) { super(code); this.code = code }
}

export function cosineSimilarity(left = {}, right = {}) {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)])
  let dot = 0, leftNorm = 0, rightNorm = 0
  for (const id of ids) {
    const a = vectorValue(left, id), b = vectorValue(right, id)
    dot += a * b; leftNorm += a * a; rightNorm += b * b
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0
}

function normalizedCareerWeights(career) {
  const total = Object.values(career.competencies).reduce((sum, value) => sum + value, 0)
  return Object.fromEntries(Object.entries(career.competencies).map(([id, value]) => [id, value / total]))
}

function feasibilityFor(courseId, courseById, prerequisites, completed) {
  const visiting = new Set()
  const pending = new Set()
  function visit(id) {
    if (visiting.has(id)) return false
    if (completed.has(id)) return true
    const course = courseById.get(id)
    if (!course || course.status !== "PUBLISHED" || course.hasContent === false) return false
    visiting.add(id)
    for (const prerequisiteId of prerequisites.get(id) ?? []) {
      if (!completed.has(prerequisiteId)) pending.add(prerequisiteId)
      if (!visit(prerequisiteId)) return false
    }
    visiting.delete(id)
    return true
  }
  if (!visit(courseId)) return { value: 0, pendingPrerequisiteCourseIds: [] }
  pending.delete(courseId)
  return { value: pending.size ? .7 : 1, pendingPrerequisiteCourseIds: [...pending].sort() }
}

export function recommendCareerCourses({ careerId, limit = 5, courses = [], completedCourseIds = [], relations = [] }) {
  const career = CAREER_BY_ID.get(careerId)
  if (!career) throw new RecommendationInputError("invalid_career_id")
  if (!Number.isInteger(limit) || limit < 1 || limit > CAREER_RECOMMENDATION_CONFIG.maxLimit) throw new RecommendationInputError("invalid_recommendation_limit")
  const careerWeights = normalizedCareerWeights(career)
  const completed = new Set(completedCourseIds)
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const prerequisites = new Map()
  for (const relation of relations.filter((item) => !item.relationType || item.relationType === "REQUIRED_PREREQUISITE")) {
    const values = prerequisites.get(relation.targetCourseId) ?? []
    values.push(relation.prerequisiteCourseId); prerequisites.set(relation.targetCourseId, values)
  }

  const candidates = []
  for (const course of courses) {
    const mapping = COURSE_COMPETENCIES_BY_ID.get(course.id)
    if (!course.id || course.status !== "PUBLISHED" || course.isSelectableTarget === false || course.hasContent === false || !mapping) continue
    const contributions = Object.entries(careerWeights).map(([id, weight]) => ({ id, contribution: weight * vectorValue(mapping.competencies, id) })).filter((item) => item.contribution > 0)
    const baseFit = contributions.reduce((sum, item) => sum + item.contribution, 0)
    if (baseFit <= 0) continue
    const feasibility = feasibilityFor(course.id, courseById, prerequisites, completed)
    if (!feasibility.value) continue
    candidates.push({ course, mapping, contributions, baseFit, feasibility, isCompleted: completed.has(course.id) })
  }

  const selected = []
  const covered = {}
  while (selected.length < limit && selected.length < candidates.length) {
    const remaining = candidates.filter((candidate) => !selected.includes(candidate))
    const scored = remaining.map((candidate) => {
      const gains = Object.entries(careerWeights).map(([id, weight]) => ({ id, contribution: weight * Math.max(0, vectorValue(candidate.mapping.competencies, id) - vectorValue(covered, id)) })).filter((item) => item.contribution > 0)
      const coverageGain = gains.reduce((sum, item) => sum + item.contribution, 0)
      const redundancy = selected.length ? Math.max(...selected.map((item) => cosineSimilarity(candidate.mapping.competencies, item.mapping.competencies))) : 0
      const finalScore = CAREER_RECOMMENDATION_CONFIG.weights.baseFit * candidate.baseFit
        + CAREER_RECOMMENDATION_CONFIG.weights.coverageGain * coverageGain
        + CAREER_RECOMMENDATION_CONFIG.weights.feasibility * candidate.feasibility.value
        + CAREER_RECOMMENDATION_CONFIG.weights.redundancy * redundancy
        + CAREER_RECOMMENDATION_CONFIG.weights.completed * Number(candidate.isCompleted)
      return { candidate, gains, coverageGain, redundancy, finalScore }
    })
    scored.sort((left, right) => Number(left.candidate.isCompleted) - Number(right.candidate.isCompleted)
      || right.finalScore - left.finalScore
      || right.candidate.baseFit - left.candidate.baseFit
      || right.coverageGain - left.coverageGain
      || Number(left.candidate.course.sortOrder ?? 0) - Number(right.candidate.course.sortOrder ?? 0)
      || String(left.candidate.course.id).localeCompare(String(right.candidate.course.id)))
    const winner = scored[0]
    winner.candidate.selection = winner
    selected.push(winner.candidate)
    for (const [id, value] of Object.entries(winner.candidate.mapping.competencies)) covered[id] = Math.max(vectorValue(covered, id), value)
  }

  return {
    algorithmVersion: CAREER_RECOMMENDATION_CONFIG.algorithmVersion,
    careerId,
    candidateCount: candidates.length,
    availableCandidateCount: candidates.filter((candidate) => !candidate.isCompleted).length,
    recommendedCourses: selected.map((candidate, index) => {
      const { gains, coverageGain, redundancy, finalScore } = candidate.selection
      const matchedCompetencies = [...candidate.contributions].sort((a, b) => b.contribution - a.contribution || a.id.localeCompare(b.id)).slice(0, 2).map((item) => ({ ...item, contribution: round(item.contribution) }))
      const newCompetency = [...gains].sort((a, b) => b.contribution - a.contribution || a.id.localeCompare(b.id))[0]
      const reasons = matchedCompetencies.map((item) => ({ type: "career-match", competencyId: item.id }))
      if (newCompetency) reasons.push({ type: "coverage-gain", competencyId: newCompetency.id })
      if (candidate.feasibility.pendingPrerequisiteCourseIds.length) reasons.push({ type: "prerequisites-included", prerequisiteCourseIds: candidate.feasibility.pendingPrerequisiteCourseIds })
      return {
        courseId: candidate.course.id,
        course: {
          id: candidate.course.id,
          title: candidate.course.title,
          titleLocalized: { zh: candidate.course.title, en: COURSE_TITLES_EN[candidate.course.id] || candidate.course.title },
          moduleId: candidate.course.moduleId,
          moduleName: candidate.course.moduleName,
          moduleNameLocalized: { zh: candidate.course.moduleName, en: MODULE_TITLES_EN[candidate.course.moduleId] || candidate.course.moduleName },
          sortOrder: candidate.course.sortOrder,
        },
        completionStatus: candidate.isCompleted ? "MASTERED" : "AVAILABLE",
        rank: index + 1,
        score: round(finalScore),
        scoreComponents: { baseFit: round(candidate.baseFit), coverageGain: round(coverageGain), feasibility: candidate.feasibility.value, redundancy: round(redundancy) },
        matchedCompetencies,
        coveredCompetencyIds: Object.keys(candidate.mapping.competencies).sort(),
        pendingPrerequisiteCourseIds: candidate.feasibility.pendingPrerequisiteCourseIds,
        reasons,
      }
    }),
  }
}
