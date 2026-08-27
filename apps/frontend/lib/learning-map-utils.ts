import {
  allNodes,
  conceptEdges,
  conceptNodes,
  courses,
  interests,
  legacyCourseIdByDatabaseCourseId,
  targetCourseByInterestId,
  targetDatabaseCourseByInterestId,
  learningProjects,
  type CourseTopic,
  type KnowledgeEdge,
  type KnowledgeNode,
  type LearningProject,
  type NodeType,
  type OriginalCourseResource,
} from "./learning-map-data"

const goalPositions = [
  { x: 150, y: 170 },
  { x: 150, y: 330 },
  { x: 150, y: 490 },
  { x: 285, y: 610 },
  { x: 285, y: 85 },
]

const nodeMap = new Map(allNodes.map((item) => [item.id, item]))

const moduleNameByPhase: Record<number, string> = {
  1: "AI 应用与智能体",
  2: "AI 设计与数字制造",
  3: "智能硬件与边缘感知",
  4: "具身交互与智能小车",
}

export type RequiredPrerequisite = {
  prerequisiteCourseId: string
  targetCourseId: string
}

export type GraphCourseReference = {
  id: string
  lessonId: number | null
}

export type GraphModuleGroup = {
  id: number
  name: string
  x: number
  y: number
  width: number
  height: number
}

function scoreNode(node: KnowledgeNode, selected: string[]) {
  return node.interests.filter((id) => selected.includes(id)).length
}

function createGoalNodes(selected: string[]) {
  return selected.slice(0, 5).map((id, index): KnowledgeNode => {
    const interest = interests.find((item) => item.id === id)!
    return {
      id: `goal-${id}`,
      label: interest.label,
      type: "goal",
      description: interest.summary,
      relatedCourseIds: courses.filter((course) => course.interests.includes(id)).map((course) => course.id),
      interests: [id],
      ...goalPositions[index],
    }
  })
}

export function getMatchedCourses(selected: string[]) {
  const explicitTargetIds = new Set(
    selected.map((interestId) => targetCourseByInterestId[interestId]).filter((id): id is string => Boolean(id)),
  )
  if (explicitTargetIds.size) {
    return courses
      .filter((course) => explicitTargetIds.has(course.id))
      .map((course) => ({ ...course, score: course.interests.filter((id) => selected.includes(id)).length || 1 }))
      .sort((a, b) => a.priority - b.priority)
  }
  return courses
    .map((course) => ({
      ...course,
      score: course.interests.filter((id) => selected.includes(id)).length,
    }))
    .filter((course) => course.score > 0)
    .sort((a, b) => b.score - a.score || a.priority - b.priority)
}

function getRouteCourses(
  selected: string[],
  options: { completedCourseIds?: string[]; maxCourses?: number } = {},
) {
  const completed = new Set(options.completedCourseIds ?? [])
  const maxCourses = Math.max(1, Math.min(4, options.maxCourses ?? 4))
  const matched = getMatchedCourses(selected).filter((course) => !completed.has(course.id))
  const chosen: typeof matched = []
  const uncovered = new Set(selected)

  while (chosen.length < maxCourses) {
    const candidates = matched.filter((course) => !chosen.some((item) => item.id === course.id))
    if (!candidates.length) break
    candidates.sort((a, b) => {
      const aNewCoverage = a.interests.filter((id) => uncovered.has(id)).length
      const bNewCoverage = b.interests.filter((id) => uncovered.has(id)).length
      return bNewCoverage - aNewCoverage || b.score - a.score || a.priority - b.priority
    })
    const next = candidates[0]
    chosen.push(next)
    next.interests.forEach((interestId) => uncovered.delete(interestId))
  }

  return chosen.sort((a, b) => a.priority - b.priority)
}

export function getVisibleGraph(
  selected: string[],
  mysqlGraph?: { courses: GraphCourseReference[]; requiredPrerequisites: RequiredPrerequisite[] },
) {
  if (!selected.length) return { visibleNodes: [], visibleEdges: [], moduleGroups: [] }

  const goalNodes = createGoalNodes(selected)
  const rawConceptCandidates = conceptNodes
    .map((item) => ({ item, score: scoreNode(item, selected) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "zh-CN"))
    .slice(0, 8)
    .map(({ item }) => item)

  const legacyCourseByDatabaseId = new Map(
    Object.entries(legacyCourseIdByDatabaseCourseId)
      .map(([databaseId, legacyCourseId]) => [databaseId, courses.find((course) => course.id === legacyCourseId)] as const)
      .filter((entry): entry is readonly [string, CourseTopic] => Boolean(entry[1])),
  )
  // A selected goal is one explicit MySQL target.  Do not infer the target
  // from lesson ids: one legacy lesson can represent more than one course.
  const includedDatabaseCourseIds = new Set(
    mysqlGraph
      ? selected
        .map((interestId) => targetDatabaseCourseByInterestId[interestId])
        .filter((id): id is string => Boolean(id) && mysqlGraph.courses.some((course) => course.id === id))
      : getMatchedCourses(selected)
        .map((course) => Object.entries(legacyCourseIdByDatabaseCourseId)
          .find(([, legacyCourseId]) => legacyCourseId === course.id)?.[0])
        .filter((id): id is string => Boolean(id)),
  )
  const requiredPrerequisites = mysqlGraph?.requiredPrerequisites ?? []
  let addedPrerequisite = true
  while (addedPrerequisite) {
    addedPrerequisite = false
    for (const relation of requiredPrerequisites) {
      if (includedDatabaseCourseIds.has(relation.targetCourseId) && !includedDatabaseCourseIds.has(relation.prerequisiteCourseId)) {
        includedDatabaseCourseIds.add(relation.prerequisiteCourseId)
        addedPrerequisite = true
      }
    }
  }
  const matchedCourses = mysqlGraph
    ? [...includedDatabaseCourseIds]
      .map((id) => legacyCourseByDatabaseId.get(id))
      .filter((course): course is CourseTopic => Boolean(course))
      .sort((a, b) => a.priority - b.priority)
    : getMatchedCourses(selected).slice(0, 4)

  // A selection can disappear from the MySQL catalogue between the graph
  // request and React pruning it (for example, immediately after completion).
  // There is then no module into which concept nodes can be positioned.
  if (!matchedCourses.length) {
    return { visibleNodes: goalNodes, visibleEdges: [], moduleGroups: [] }
  }

  // Modules are the layout primitive. Each active module receives its own
  // bordered cluster; no knowledge or course node is placed in a shared,
  // generic middle/right column.
  const activePhases = [...new Set(matchedCourses.map((course) => course.phaseNumber))].sort((a, b) => a - b)
  const moduleGroups: GraphModuleGroup[] = activePhases.map((phase, index) => ({
    id: phase,
    name: moduleNameByPhase[phase],
    x: 430 + (index % 2) * 760,
    y: 90 + Math.floor(index / 2) * 430,
    width: 640,
    height: 350,
  }))
  const groupByPhase = new Map(moduleGroups.map((group) => [group.id, group]))
  const phaseForConcept = (concept: KnowledgeNode) => {
    const counts = new Map<number, number>()
    for (const courseId of concept.relatedCourseIds) {
      const course = courses.find((item) => item.id === courseId)
      if (course && groupByPhase.has(course.phaseNumber)) counts.set(course.phaseNumber, (counts.get(course.phaseNumber) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? activePhases[0]
  }
  const conceptIndexWithinModule = new Map<number, number>()
  const conceptCandidates = rawConceptCandidates.map((concept) => {
    const phase = phaseForConcept(concept)
    const group = groupByPhase.get(phase)!
    const itemIndex = conceptIndexWithinModule.get(phase) ?? 0
    conceptIndexWithinModule.set(phase, itemIndex + 1)
    return { ...concept, x: group.x + 115, y: group.y + 82 + itemIndex * 72 }
  })

  const courseIndexWithinModule = new Map<number, number>()
  const matchedCourseNodes = matchedCourses.map((course) => {
    const phase = Math.max(1, Math.min(4, course.phaseNumber))
    const group = groupByPhase.get(phase)!
    const itemIndex = courseIndexWithinModule.get(phase) ?? 0
    courseIndexWithinModule.set(phase, itemIndex + 1)
    return {
      ...nodeMap.get(course.id)!,
      x: group.x + 390 + Math.floor(itemIndex / 4) * 190,
      y: group.y + 94 + (itemIndex % 4) * 78,
    }
  })

  const visibleNodes = [...goalNodes, ...conceptCandidates, ...matchedCourseNodes]
  const visibleIds = new Set(visibleNodes.map((item) => item.id))
  const visibleEdges: KnowledgeEdge[] = []

  goalNodes.forEach((goal) => {
    const selectedId = goal.interests[0]
    conceptCandidates
      .filter((candidate) => candidate.interests.includes(selectedId))
      .slice(0, 3)
      .forEach((candidate, index) => {
        visibleEdges.push({
          id: `goal-edge-${goal.id}-${candidate.id}-${index}`,
          source: goal.id,
          target: candidate.id,
          direction: "directed",
          relation: "你选择了",
          kind: "GOAL_SELECTION",
        })
      })
  })

  conceptEdges.forEach((edge, index) => {
    if (visibleIds.has(edge.source) && visibleIds.has(edge.target)) {
      visibleEdges.push({ ...edge, id: `concept-edge-${index}`, kind: "RELATED_KNOWLEDGE" })
    }
  })

  matchedCourseNodes.forEach((courseNode) => {
    const course = courses.find((item) => item.id === courseNode.id)!
    const sources = conceptCandidates.filter((candidate) => course.knowledgeNodeIds.includes(candidate.id)).slice(0, 2)
    sources.forEach((source, index) => {
      visibleEdges.push({
        id: `course-edge-${source.id}-${courseNode.id}-${index}`,
        source: source.id,
        target: courseNode.id,
        direction: "directed",
        relation: "映射到课题",
        kind: "RELATED_KNOWLEDGE",
      })
    })
  })

  const legacyNodeIdByDatabaseId = new Map(
    [...legacyCourseByDatabaseId.entries()]
      .filter(([, course]) => matchedCourses.some((matched) => matched.id === course.id))
      .map(([databaseId, course]) => [databaseId, course.id] as const),
  )
  requiredPrerequisites.forEach((relation, index) => {
    const source = legacyNodeIdByDatabaseId.get(relation.prerequisiteCourseId)
    const target = legacyNodeIdByDatabaseId.get(relation.targetCourseId)
    if (!source || !target) return
    visibleEdges.push({
      id: `mysql-required-prerequisite-${index}`,
      source,
      target,
      direction: "directed",
      relation: "必修前置课程",
      kind: "REQUIRED_PREREQUISITE",
    })
  })

  return { visibleNodes, visibleEdges, moduleGroups }
}

export function buildPath(selected: string[]): KnowledgeNode[] {
  return getRouteCourses(selected)
    .map((course) => nodeMap.get(course.id)!)
}

export type PersonalizedRouteStep = {
  id: string
  kind: "course" | "project"
  /** MySQL course primary key. Present for MySQL-generated course nodes. */
  courseId?: string
  sourceId: string
  title: string
  description: string
  outcome: string
  interests: string[]
  matchedInterestIds: string[]
  recommendationReason: string
  resources: OriginalCourseResource[]
  lessonId: number
  phaseNumber: 1 | 2 | 3 | 4
  knowledgeNodeIds: string[]
  focus: "lesson" | "project"
  course?: CourseTopic
  project?: LearningProject
}

export function buildPersonalizedRoute(
  selected: string[],
  options: { completedCourseIds?: string[]; maxCourses?: number } = {},
): PersonalizedRouteStep[] {
  const matchedCourses = getRouteCourses(selected, options)
  const chosenProjectIds = new Set<string>()
  const steps: PersonalizedRouteStep[] = []

  matchedCourses.forEach((course) => {
    const matchedInterestIds = course.interests.filter((interest) => selected.includes(interest))
    const matchedLabels = interests
      .filter((interest) => matchedInterestIds.includes(interest.id))
      .map((interest) => interest.label)
    steps.push({
      id: `course-${course.id}`,
      kind: "course",
      sourceId: course.id,
      title: course.title,
      description: course.description.replace(/^原平台课程：/, ""),
      outcome: course.module,
      interests: course.interests,
      matchedInterestIds,
      recommendationReason: `这部分原课程与「${matchedLabels.join("」「")}」直接相关。`,
      resources: course.resources,
      lessonId: course.lessonId,
      phaseNumber: course.phaseNumber,
      knowledgeNodeIds: course.knowledgeNodeIds,
      focus: "lesson",
      course,
    })

    const project = learningProjects
      .filter((item) =>
        !chosenProjectIds.has(item.id)
        && item.relatedCourseIds.includes(course.id)
        && item.interests.some((interest) => selected.includes(interest)),
      )
      .map((item) => ({
        ...item,
        matchScore: item.interests.filter((interest) => selected.includes(interest)).length,
      }))
      .sort((a, b) => b.matchScore - a.matchScore || a.priority - b.priority)[0]

    if (!project) return

    const projectMatchedInterestIds = project.interests.filter((interest) => selected.includes(interest))
    const projectMatchedLabels = interests
      .filter((interest) => projectMatchedInterestIds.includes(interest.id))
      .map((interest) => interest.label)
    chosenProjectIds.add(project.id)
    const preferredCourseId = project.id === "project-pathfinding-car"
      ? "phase4_day7"
      : project.relatedCourseIds[0]
    const projectCourse = courses.find((item) => item.id === preferredCourseId)
    if (!projectCourse) return
    steps.push({
      id: `project-${project.id}`,
      kind: "project",
      sourceId: project.id,
      title: project.title,
      description: project.description,
      outcome: project.outcome,
      interests: project.interests,
      matchedInterestIds: projectMatchedInterestIds,
      recommendationReason: `这个原平台项目把「${projectMatchedLabels.join("」「")}」转化为可完成的实践产出。`,
      resources: project.resources,
      lessonId: projectCourse.lessonId,
      phaseNumber: projectCourse.phaseNumber,
      knowledgeNodeIds: projectCourse.knowledgeNodeIds,
      focus: "project",
      project,
    })
  })

  return steps
}

export const typeLabels: Record<NodeType, string> = {
  goal: "你的目标",
  knowledge: "知识点",
  ability: "能力",
  course: "现有课题",
}

export function recommendationReason(node: KnowledgeNode, selected: string[]) {
  if (node.type === "course") {
    const course = courses.find((item) => item.id === node.id)
    const overlap = course?.interests.filter((id) => selected.includes(id)).length ?? 0
    return overlap > 1 ? `同时连接你的 ${overlap} 个选择，因此优先推荐。` : "能把当前兴趣转化成一次具体实践。"
  }
  if (node.type === "goal") return "这是你亲自选择的方向，可以随时调整。"
  if (node.type === "ability") return "帮助你把零散知识变成可重复使用的能力。"
  return "这是继续向目标推进所需的关键知识。"
}
