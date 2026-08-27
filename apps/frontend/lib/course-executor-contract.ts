export type SupportMode = "guided" | "self_directed"

export type ChecklistItem = {
  item: string
  detail?: string
}

export type StepPayload = {
  title?: string
  goal?: string
  instruction?: string
  checklist?: Array<string | ChecklistItem>
  completion_checkpoint?: string
  safety_check?: string | null
  agent_help_hint?: string
  agent_prompt?: string
  common_errors?: string[]
  common_mistakes?: string[]
  troubleshooting?: string[]
  evidence_requirement?: string | string[]
  scaffold_instruction?: string
  remedial_task?: string
  challenge_task?: string
  resource_hints?: string[]
}

export type StepPersonalization = {
  selectedLayer: "compact" | "standard" | "detailed"
  reasonCode: string
  reasonText: string
  ruleVersion: string
  snapshotHash: string
}

export type StepScaffoldSource = {
  id: string
  fileName: string
  sourceStepNumber: number
  sourceStepTitle: string
  sha256: string
  contentHash: string
  version: string
}

export type OriginalLessonResource = {
  id: number
  lessonId: number
  courseId?: string
  type: string
  title: string
  url?: string
  description?: string | null
  mimeType?: string | null
  fileSize?: number | null
  availability?: "MIGRATED_OBJECT" | "REFERENCE_ONLY"
  orderIndex: number
}

export type OriginalLessonStep = {
  id: number
  lessonId: number
  code: string
  title: string
  stepType: "preparation" | "core" | "guided" | "practice" | "challenge" | "safety" | string
  required: boolean
  priority: number
  estimatedMinutes: number
  estimatedSeconds: number
  orderIndex: number
  sourceRef?: string | null
  payloads: {
    compact?: StepPayload
    guide?: StepPayload
    standard?: StepPayload
    detailed?: StepPayload
  }
  personalization?: StepPersonalization
  scaffoldSource?: StepScaffoldSource
}

export type OriginalLessonDetail = {
  courseId?: string
  id: number
  phaseId: number
  code: string
  dayIndex: number | null
  title: string
  description?: string | null
  orderIndex: number
  resources: OriginalLessonResource[]
  steps: OriginalLessonStep[]
}

export type EvidenceRecord = {
  id: string
  stepId: number
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: string
}

export type LessonExecutionProgress = {
  routeId: string
  routeStepId: string
  lessonId: number
  supportMode: SupportMode | null
  activeCourseStepIndex: number
  completedCourseStepIds: number[]
  checklistByStep: Record<string, number[]>
  evidenceByStep: Record<string, EvidenceRecord[]>
  stuckStepIds: number[]
  updatedAt: string
}

export type LessonProgressUpdate = Omit<LessonExecutionProgress, "updatedAt">
