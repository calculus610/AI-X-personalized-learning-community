export type AdaptiveSupportLevel = "detailed" | "standard" | "compact"

export type PublicQuizQuestion = {
  id: string
  knowledgePointId: string
  knowledgePointLabel: string
  prompt: string
  options: Array<{ id: string; text: string }>
}

export type AdaptiveQuizSession = {
  quizId: string
  title: string
  routeStepId: string
  questions: PublicQuizQuestion[]
}

export type KnowledgePointResult = {
  knowledgePointId: string
  knowledgePointLabel: string
  correct: boolean
  selectedOptionId: string
  correctOptionId: string
  explanation: string
  masteryScore: number
  masteryLevel: "weak" | "developing" | "strong"
}

export type AdaptiveSupportRecommendation = {
  routeStepId: string
  level: AdaptiveSupportLevel
  label: string
  reason: string
  score: number
  total: number
  weakKnowledgeLabels: string[]
  strongKnowledgeLabels: string[]
  sourceRouteStepId: string
  sourceQuizTitle: string
  updatedAt: string
}

export type AdaptiveQuizResult = {
  quizId: string
  score: number
  total: number
  knowledgeResults: KnowledgePointResult[]
  nextRecommendation: AdaptiveSupportRecommendation | null
}
