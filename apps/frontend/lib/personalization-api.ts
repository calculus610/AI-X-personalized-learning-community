"use client"

import type { LearningProgress, ProgressUpdateRequest } from "./personalization-contract"
import type {
  EvidenceRecord,
  LessonExecutionProgress,
  LessonProgressUpdate,
  OriginalLessonDetail,
  StepPayload,
} from "./course-executor-contract"
import { getPlatformUserIdentity, readPlatformSession } from "./platform-auth"
import type { LearnerProfileUpdate, LearnerProfileView } from "./learner-profile-contract"

const EVENT_OUTBOX_KEY = "personalized-secure:event-outbox:v1"
const EVENT_SESSION_KEY = "open_university_personalized_event_session_v1"

function personalizedApiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_PERSONALIZED_SERVICE_BASE?.replace(/\/$/, "") || "/personalized-api"
  return `${base}${path}`
}

function mysqlLearningApiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_PERSONALIZED_V2_API_BASE?.replace(/\/$/, "") || "/personalized-v2/api/v1"
  return `${base}${path}`
}

function platformHeaders(contentType = false) {
  const headers = new Headers()
  const token = readPlatformSession()?.token
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (contentType) headers.set("Content-Type", "application/json")
  return headers
}

type PersonalizedEventInput = {
  eventType: "route_generated" | "route_opened" | "route_interest_selected" | "route_step_opened" | "route_completed" | "course_completed" | "step_opened" | "step_completed" | "checklist_updated" | "support_mode_selected" | "evidence_uploaded" | "quiz_started" | "quiz_submitted" | "agent_message" | "help_requested" | "profile_viewed" | "video_opened" | "resource_opened" | "timeline_opened" | "language_changed" | "logout"
  routeId?: string
  routeStepId?: string
  lessonId?: number
  stepId?: number
  payload?: Record<string, unknown>
}

type QueuedPersonalizedEvent = PersonalizedEventInput & {
  eventId: string
  clientOccurredAt: string
  sessionId: string
}

let eventFlushPromise: Promise<void> | null = null

function currentUserId() {
  return getPlatformUserIdentity(readPlatformSession()?.user ?? {}) ?? null
}

function eventOutboxKey() {
  const userId = currentUserId()
  return userId ? `${EVENT_OUTBOX_KEY}:${userId}` : null
}

function browserUuid() {
  if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID()
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0")
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`
}

function eventSessionId() {
  const created = browserUuid()
  const userId = currentUserId()
  if (!userId) return created
  const key = `${EVENT_SESSION_KEY}:${userId}`
  try {
    const existing = window.sessionStorage.getItem(key)
    if (existing) return existing
    window.sessionStorage.setItem(key, created)
  } catch {
    return created
  }
  return created
}

function readEventOutbox() {
  const key = eventOutboxKey()
  if (!key) return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as QueuedPersonalizedEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEventOutbox(events: QueuedPersonalizedEvent[]) {
  const key = eventOutboxKey()
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(events.slice(-250)))
  } catch {
    // The UI remains usable when browser storage is unavailable.
  }
}

export function flushPersonalizedEventOutbox() {
  if (typeof window === "undefined") return Promise.resolve()
  if (eventFlushPromise) return eventFlushPromise
  eventFlushPromise = (async () => {
    while (true) {
      const [event] = readEventOutbox()
      if (!event) return
      const response = await fetch(mysqlLearningApiUrl("/events"), {
        method: "POST",
        headers: platformHeaders(true),
        body: JSON.stringify(event),
        keepalive: true,
      })
      if (!response.ok) throw new Error(`event_sync_failed:${response.status}`)
      writeEventOutbox(readEventOutbox().filter((item) => item.eventId !== event.eventId))
    }
  })().finally(() => {
    eventFlushPromise = null
  })
  return eventFlushPromise
}

export function trackPersonalizedEvent(input: PersonalizedEventInput, options: { requireSync?: boolean } = {}) {
  if (typeof window === "undefined") return Promise.resolve()
  const event: QueuedPersonalizedEvent = {
    ...input,
    eventId: browserUuid(),
    clientOccurredAt: new Date().toISOString(),
    sessionId: eventSessionId(),
  }
  writeEventOutbox([...readEventOutbox(), event])
  const sync = flushPersonalizedEventOutbox()
  return options.requireSync ? sync : sync.catch(() => undefined)
}

export type InterestCourseProgress = {
  courseId: string
  lessonId: number
  required: boolean
  completedSteps: number
  requiredSteps: number
  bestQuizPercent: number
  evidenceCount: number
  progressPercent: number
  started: boolean
  qualified: boolean
}

export type InterestLearningItem = {
  interestId: string
  status: "not_started" | "selected" | "paused" | "mastered"
  totalCourseCount: number
  startedCourseCount: number
  completedCourseCount: number
  progressPercent: number
  evidenceCount: number
  selectedAt?: string | null
  pausedAt?: string | null
  masteredAt?: string | null
  courses: InterestCourseProgress[]
}

export type InterestLearningState = {
  selectedInterestIds: string[]
  masteredInterestIds: string[]
  qualifiedCourseIds: string[]
  qualifiedLessonIds: number[]
  rules: { requiredStepCount: number; quizPassPercent: number }
  items: InterestLearningItem[]
  recalculatedAt: string
}

export async function getInterestLearningState() {
  return readJson<InterestLearningState>(await fetch(personalizedApiUrl("/interests/state"), {
    headers: platformHeaders(),
    cache: "no-store",
  }))
}

export type BoundCourseResource = {
  id: number
  lessonId: number
  type: string
  title: string
  description?: string | null
  mimeType?: string | null
  fileSize?: number | null
  orderIndex: number
  url: string
}

export type BoundCourseVideo = {
  id: number
  lessonId: number
  title: string
  mimeType?: string | null
  durationSeconds?: number | null
  orderIndex: number
  url: string
}

export type PlatformQuizQuestion = {
  question_id: string
  question_type: "single_choice" | "multiple_choice" | "true_false" | string
  question_text: string
  options: Array<{ id: string; text: string }>
  difficulty?: string
}

export type PlatformQuizSession = {
  quiz_session_id: string
  lesson_id: number
  quiz_title: string
  question_count: number
  questions: PlatformQuizQuestion[]
}

export type PlatformQuizResult = {
  score: number
  percentage: number
  total: number
  correct_count: number
  wrong_count: number
  student_visible_message: string
  weak_tags: string[]
  profile_dimensions: Array<{ dimension_code: string; dimension_name: string; score: number; evidence_count: number }>
  question_results: Array<{
    question_id: string
    question_type: string
    question_text: string
    options: Array<{ id: string; text: string }>
    selected_answer: string | string[]
    correct_answer: string | string[]
    is_correct: boolean
    explanation: string
    knowledge_point_name: string
    difficulty?: string
  }>
}

export type LearningAgentReply = {
  message_id: number | string
  user_message_id?: number | string
  conversation_id: string
  answer: string
  provider?: string
  routed_agent_id: string
  server_received_at?: string
  server_finished_at?: string
}

export type LearningAgentSession = {
  session_id: string
  conversation_id: string
  agent: {
    agent_id: string
    agent_name: string
    prompt_version?: string
    opening_message: string
    output_format: string
  }
  messages: Array<{
    message_id: string
    role: "user" | "assistant"
    text: string
    created_at: string
  }>
}

export async function getBoundLessonResources(lessonId: number) {
  return readJson<{ lessonId: number; resources: BoundCourseResource[]; videos: BoundCourseVideo[] }>(
    await fetch(personalizedApiUrl(`/lessons/${lessonId}/resources`), {
      headers: platformHeaders(),
      cache: "no-store",
    }),
  )
}

export async function recordCourseResourceOpen(resourceId: number) {
  return readJson<{ ok: true }>(await fetch(personalizedApiUrl(`/resources/${resourceId}/open`), {
    method: "POST",
    // No request body: sending application/json without one makes Fastify reject
    // the request before the resource-open handler runs.
    headers: platformHeaders(),
  }))
}

export async function searchBoundKnowledge(phase: number, query: string) {
  const params = new URLSearchParams({ phase: String(phase), q: query })
  return readJson<Record<string, unknown>>(await fetch(personalizedApiUrl(`/knowledge/search?${params}`), {
    headers: platformHeaders(),
    cache: "no-store",
  }))
}

export async function startPlatformQuiz(input: {
  lessonId: number
  routeId: string
  routeStepId: string
  locale: "zh" | "en"
}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 60_000)
  try {
    const response = await readJson<{ quiz: {
      quizId: string
      lessonId: number | null
      title: string
      questionCount: number
      questions: Array<{
        question_id: string
        type: string
        stem: string
        options: Record<string, string>
        difficulty?: string
      }>
    } }>(await fetch(mysqlLearningApiUrl("/quiz/start"), {
      method: "POST",
      headers: platformHeaders(true),
      body: JSON.stringify({ trackId: input.routeId, routeStepId: input.routeStepId, locale: input.locale }),
      signal: controller.signal,
    }))
    return {
      quiz_session_id: response.quiz.quizId,
      lesson_id: response.quiz.lessonId ?? input.lessonId,
      quiz_title: response.quiz.title,
      question_count: response.quiz.questionCount,
      questions: response.quiz.questions.map((question) => ({
        question_id: question.question_id,
        question_type: question.type,
        question_text: question.stem,
        options: Object.entries(question.options ?? {}).map(([id, text]) => ({ id, text })),
        difficulty: question.difficulty,
      })),
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("本次出题超过 60 秒，请返回课程后重试。")
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function preparePlatformQuiz(input: {
  lessonId: number
  routeId: string
  routeStepId: string
}) {
  return readJson<{ status: "preparing" | "ready" }>(await fetch(personalizedApiUrl("/quiz/prepare"), {
    method: "POST",
    headers: platformHeaders(true),
    body: JSON.stringify(input),
  }))
}

export async function submitPlatformQuiz(input: {
  quizSessionId: string
  lessonId: number
  routeId: string
  routeStepId: string
  locale: "zh" | "en"
  answers: Array<{ questionId: string; selectedAnswer: string | string[] }>
}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await readJson<{ report: {
      score: number
      total: number
      scorePercent: number
      weakTags?: string[]
      items?: Array<{
        questionId: string
        type: string
        stem: string
        options: Record<string, string>
        userAnswer: string | string[]
        correctAnswer: string | string[]
        correct: boolean
        analysis?: string
        knowledgePointLabel?: string
        difficulty?: string
      }>
    } }>(await fetch(mysqlLearningApiUrl(`/quiz/${encodeURIComponent(input.quizSessionId)}/submit`), {
      method: "POST",
      headers: platformHeaders(true),
      body: JSON.stringify({ answers: Object.fromEntries(input.answers.map((answer) => [String(answer.questionId), answer.selectedAnswer])) }),
      signal: controller.signal,
    }))
    const report = response.report
    const items = report.items ?? []
    return {
      score: report.scorePercent,
      percentage: report.scorePercent,
      total: report.total,
      correct_count: report.score,
      wrong_count: Math.max(0, report.total - report.score),
      student_visible_message: input.locale === "en"
        ? report.scorePercent >= 85
          ? "Your Quiz performance is stable. Later steps will use compact guidance."
          : report.scorePercent >= 60
            ? "You met the Quiz baseline. Later steps will keep standard guidance."
            : "The Quiz found topics to strengthen. Later steps will provide detailed guidance."
        : report.scorePercent >= 85
          ? "Quiz 表现稳定，后续学习将使用精简支架。"
          : report.scorePercent >= 60
            ? "Quiz 基本达标，后续学习将保持标准支架。"
            : "Quiz 暴露了需要巩固的知识点，后续学习将提供强化讲解。",
      weak_tags: report.weakTags ?? [],
      profile_dimensions: [],
      question_results: items.map((item) => ({
        question_id: item.questionId,
        question_type: item.type,
        question_text: item.stem,
        options: Object.entries(item.options ?? {}).map(([id, text]) => ({ id, text })),
        selected_answer: item.userAnswer,
        correct_answer: item.correctAnswer,
        is_correct: item.correct,
        explanation: item.analysis ?? "",
        knowledge_point_name: item.knowledgePointLabel || item.stem,
        difficulty: item.difficulty,
      })),
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") throw new Error(input.locale === "en" ? "The Quiz submission timed out. Please try again." : "Quiz 提交超时，请重试。")
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function chatWithLearningAgent(input: {
  sessionId: string
  message: string
  locale: "zh" | "en"
}) {
  return readJson<LearningAgentReply>(await fetch(mysqlLearningApiUrl(`/agent/sessions/${input.sessionId}/messages`), {
    method: "POST",
    headers: platformHeaders(true),
    body: JSON.stringify({
      message: input.message,
      locale: input.locale,
      clientSentAt: new Date().toISOString(),
    }),
  }))
}

export async function createLearningAgentSession(input: {
  trackId: string
  routeStepId: string
  stageId: string | null
  locale: "zh" | "en"
}) {
  return readJson<LearningAgentSession>(await fetch(mysqlLearningApiUrl("/agent/sessions"), {
    method: "POST",
    headers: platformHeaders(true),
    body: JSON.stringify({
      trackId: input.trackId,
      routeStepId: input.routeStepId,
      stageId: input.stageId,
      locale: input.locale,
      clientSentAt: new Date().toISOString(),
    }),
  }))
}

export async function stopLearningAgentSession(sessionId: string) {
  return readJson<{ ok: true; stopped_at: string }>(await fetch(mysqlLearningApiUrl(`/agent/sessions/${sessionId}/stop`), {
    method: "POST",
    headers: platformHeaders(true),
    body: JSON.stringify({ clientSentAt: new Date().toISOString() }),
  }))
}

export async function recordLearningAgentCopy(messageId: string | number) {
  return readJson<{ ok: true }>(await fetch(mysqlLearningApiUrl(`/agent/messages/${messageId}/copy`), {
    method: "POST",
    headers: platformHeaders(true),
    body: JSON.stringify({ clientSentAt: new Date().toISOString() }),
  }))
}

export async function getLearningAgentMessages(sessionId: string) {
  return readJson<Pick<LearningAgentSession, "session_id" | "conversation_id" | "messages">>(await fetch(mysqlLearningApiUrl(`/agent/sessions/${sessionId}/messages`), {
    headers: platformHeaders(),
    cache: "no-store",
  }))
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text()
    let message = raw
    try {
      const payload = JSON.parse(raw) as { error?: string; message?: string }
      message = payload.error || payload.message || raw
    } catch {
      // Keep a non-JSON response as-is for diagnostics.
    }
    throw new Error(message || `API request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function getLearningProgress(routeId: string) {
  const response = await fetch(mysqlLearningApiUrl(`/progress/${routeId}`), {
    headers: platformHeaders(),
    cache: "no-store",
  })
  if (response.status === 404) return null
  return readJson<LearningProgress>(response)
}

export async function saveLearningProgress(update: ProgressUpdateRequest) {
  return readJson<LearningProgress>(await fetch(mysqlLearningApiUrl(`/progress/${update.routeId}`), {
    method: "PATCH",
    headers: platformHeaders(true),
    body: JSON.stringify({
      activeStepIndex: update.activeStepIndex,
      completedStepIds: update.completedStepIds,
    }),
  }))
}

type BoundStepScaffolds = {
  lessonId: number
  ruleVersion: string
  steps: Array<{
    stepId: number
    stepCode: string
    payloads: Record<"compact" | "standard" | "detailed", StepPayload>
    personalization: NonNullable<OriginalLessonDetail["steps"][number]["personalization"]>
    source: NonNullable<OriginalLessonDetail["steps"][number]["scaffoldSource"]>
  }>
}

function normalizeMySqlCourseDetail(payload: {
  course: { id: string }
  content: { lesson: OriginalLessonDetail; resources: OriginalLessonDetail["resources"]; steps: OriginalLessonDetail["steps"] }
}) {
  return {
    ...payload.content.lesson,
    courseId: payload.course.id,
    resources: (Array.isArray(payload.content.resources) ? payload.content.resources : [])
      .map((resource) => ({ ...resource, id: Number(resource.id), lessonId: Number(resource.lessonId), courseId: payload.course.id })),
    steps: Array.isArray(payload.content.steps) ? payload.content.steps : [],
  }
}

export async function getMySqlCourseDetail(courseId: string) {
  // course_id is the stable MySQL identity. Never use lesson_id here: two
  // migrated project rows share lesson_id=16, so that old key is ambiguous.
  const payload = await readJson<{
    course: { id: string }
    content: { lesson: OriginalLessonDetail; resources: OriginalLessonDetail["resources"]; steps: OriginalLessonDetail["steps"] }
  }>(await fetch(mysqlLearningApiUrl(`/courses/${courseId}`), {
    headers: platformHeaders(),
    cache: "no-store",
  }))
  return normalizeMySqlCourseDetail(payload)
}

export async function openMySqlCourseResource(resource: OriginalLessonDetail["resources"][number]) {
  if (!resource.courseId || resource.availability !== "MIGRATED_OBJECT") {
    throw new Error("该资源尚未迁移到新的课程资源库。")
  }
  const response = await fetch(mysqlLearningApiUrl(`/courses/${resource.courseId}/resources/${resource.id}`), {
    headers: platformHeaders(),
    cache: "no-store",
  })
  if (!response.ok) throw new Error("课程资源暂时不可用。")
  const blobUrl = URL.createObjectURL(await response.blob())
  const target = window.open("", "_blank")
  if (target) {
    target.opener = null
    target.location.href = blobUrl
  } else {
    window.location.assign(blobUrl)
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}

export async function completeMySqlCourse(courseId: string) {
  return readJson<{ ok: true }>(await fetch(mysqlLearningApiUrl(`/courses/${courseId}/complete`), {
    method: "POST",
    // This completion endpoint is intentionally bodyless. Do not advertise an
    // empty JSON body, otherwise Fastify returns FST_ERR_CTP_EMPTY_JSON_BODY.
    headers: platformHeaders(),
  }))
}

export async function getCourseProgress(routeId: string, routeStepId: string) {
  const response = await fetch(mysqlLearningApiUrl(`/tracks/${routeId}/nodes/${routeStepId}/progress`), {
    headers: platformHeaders(),
    cache: "no-store",
  })
  if (response.status === 404) return null
  return readJson<LessonExecutionProgress>(response)
}

export async function saveCourseProgress(update: LessonProgressUpdate) {
  const result = await readJson<LessonExecutionProgress>(await fetch(
    mysqlLearningApiUrl(`/tracks/${update.routeId}/nodes/${update.routeStepId}/progress`),
    {
    method: "PATCH",
    headers: platformHeaders(true),
    body: JSON.stringify({
      lessonId: update.lessonId,
      supportMode: update.supportMode,
      activeCourseStepIndex: update.activeCourseStepIndex,
      completedCourseStepIds: update.completedCourseStepIds,
      checklistByStep: update.checklistByStep,
      stuckStepIds: update.stuckStepIds,
    }),
  }))
  return result
}

export async function uploadCourseEvidence(input: {
  routeId: string
  routeStepId: string
  lessonId: number
  stepId: number
  file: File
}) {
  const form = new FormData()
  form.set("routeId", input.routeId)
  form.set("routeStepId", input.routeStepId)
  form.set("lessonId", String(input.lessonId))
  form.set("stepId", String(input.stepId))
  form.set("file", input.file)
  const result = await readJson<EvidenceRecord>(await fetch(mysqlLearningApiUrl("/evidence"), {
    method: "POST",
    headers: platformHeaders(),
    body: form,
  }))
  trackPersonalizedEvent({ eventType: "evidence_uploaded", routeId: input.routeId, routeStepId: input.routeStepId, lessonId: input.lessonId, stepId: input.stepId, payload: { fileName: input.file.name, fileType: input.file.type } })
  return result
}

export async function getLearnerProfile() {
  return readJson<LearnerProfileView>(await fetch(mysqlLearningApiUrl("/profile/me"), {
    headers: platformHeaders(),
    cache: "no-store",
  }))
}

export async function saveLearnerProfile(update: LearnerProfileUpdate) {
  await readJson<{ ok: true }>(await fetch(mysqlLearningApiUrl("/profile/me"), {
    method: "PATCH",
    headers: platformHeaders(true),
    body: JSON.stringify(update),
  }))
  return getLearnerProfile()
}

export type LearningTimelineEvent = {
  id: string
  source: "process" | "evidence" | "agent"
  eventName: string
  eventLabel: string
  occurredAt: string
  clientOccurredAt?: string | null
  trackId?: string | null
  routeStepId?: string | null
  courseId?: string | null
  lessonId?: number | null
  stepId?: number | null
  title?: string | null
  detail?: string | null
  payload: Record<string, unknown>
}

export type LearningTimelineResponse = {
  events: LearningTimelineEvent[]
  generatedAt: string
}

export async function getLearningTimeline(input: {
  routeId?: string
  routeStepId?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input.routeId) params.set("routeId", input.routeId)
  if (input.routeStepId) params.set("routeStepId", input.routeStepId)
  if (input.limit) params.set("limit", String(input.limit))
  const query = params.toString()
  return readJson<LearningTimelineResponse>(await fetch(mysqlLearningApiUrl(`/timeline${query ? `?${query}` : ""}`), {
    headers: platformHeaders(),
    cache: "no-store",
  }))
}
