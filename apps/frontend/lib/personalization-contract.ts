import type { PersonalizedRouteStep } from "./learning-map-utils"

export type RouteGenerationRequest = {
  interestIds: string[]
  completedCourseIds?: string[]
}

export type RouteGenerationResponse = {
  routeId: string
  selectedInterestIds: string[]
  generatedAt: string
  source: "original-course-registry"
  summary: {
    courseCount: number
    projectCount: number
    stepCount: number
  }
  steps: PersonalizedRouteStep[]
}

export type LearningProgress = {
  routeId: string
  activeStepIndex: number
  completedStepIds: string[]
  updatedAt: string
}

export type ProgressUpdateRequest = {
  routeId: string
  activeStepIndex: number
  completedStepIds: string[]
}
