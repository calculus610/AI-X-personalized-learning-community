export type LearnerProfile = {
  learnerId: string
  displayName?: string
  aspiration: string
  desiredSkills: string
  futureIdentity: string
  selectedInterestIds: string[]
  createdAt: string
  updatedAt: string
}

export type LearnerMasterySummary = {
  knowledgePointId: string
  knowledgePointLabel: string
  score: number
  evidenceCount: number
  level: "weak" | "developing" | "strong"
  updatedAt: string
}

export type LearnerEvidenceSummary = {
  completedCourseSteps: number
  checkedItems: number
  evidenceFiles: number
  quizAttempts: number
}

export type LearnerAbilityDimension = {
  id: string
  label: string
  score: number | null
  evidenceCount: number
  status: "measured" | "low_confidence" | "unmeasured"
}

export type LearnerInteractionSummary = {
  total: number
  agentInteractions: number
  helpRequests: number
  stepCompletions: number
  evidenceUploads: number
}

export type LearnerProfileView = LearnerProfile & {
  mastery: LearnerMasterySummary[]
  evidenceSummary: LearnerEvidenceSummary
  dimensions: LearnerAbilityDimension[]
  interactionSummary: LearnerInteractionSummary
  averageQuizScore: number | null
  profileLevel: string
  weakKnowledgePoints: LearnerMasterySummary[]
  recommendations: string[]
}

export type LearnerProfileUpdate = Pick<
  LearnerProfile,
  "aspiration" | "desiredSkills" | "futureIdentity" | "selectedInterestIds"
>
