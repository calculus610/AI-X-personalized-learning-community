"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  ShieldAlert,
  Sparkles,
  Target,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  EvidenceRecord,
  LessonProgressUpdate,
  OriginalLessonDetail,
  OriginalLessonStep,
  StepPayload,
  SupportMode,
} from "@/lib/course-executor-contract"
import type { PersonalizedRouteStep } from "@/lib/learning-map-utils"
import {
  getCourseProgress,
  getMySqlCourseDetail,
  completeMySqlCourse,
  openMySqlCourseResource,
  saveCourseProgress,
  trackPersonalizedEvent,
  uploadCourseEvidence,
} from "@/lib/personalization-api"
import { t, type Locale } from "@/lib/bilingual-ui"
import {
  localizePayload,
  localizeResource,
  localizeRouteStep,
  localizeStepTitle,
  localizeText,
  containsChinese,
} from "@/lib/localized-learning-content"
import { cn } from "@/lib/utils"
import { setActivityContext } from "@/lib/activity-telemetry"
import { CourseResourceSidebar } from "./course-resource-sidebar"
import type { LearningAgentHelpRequest } from "./unified-learning-agent"
import { AdaptiveQuiz } from "./adaptive-quiz"

type ChecklistState = Record<string, number[]>
type EvidenceState = Record<string, EvidenceRecord[]>

function checklistItem(value: string | { item: string; detail?: string }) {
  return typeof value === "string" ? { item: value, detail: "" } : value
}

function evidenceText(value: StepPayload["evidence_requirement"], locale: Locale) {
  if (Array.isArray(value)) return value.join(" · ")
  return value || t(locale, "defaultEvidence")
}

const projectStepCodes: Record<string, string[]> = {
  "project-button-light": ["phase3_day1_step_05"],
  "project-sensor-badge": ["phase3_day2_step_05"],
  "project-sensor-fusion": ["phase3_day3_step_04", "phase3_day3_step_05"],
  "project-smart-decision": ["phase3_day4_step_04"],
  "project-visual-perception": ["phase3_day5_step_04", "phase3_day5_step_05"],
  "project-voice-light": ["phase3_day6_step_04", "phase3_day6_step_05"],
  "project-touch-menu": ["phase4_day4_step3", "phase4_day4_step4", "phase4_day4_step5"],
  "project-car-motion": ["phase4_day5_step2", "phase4_day5_step3", "phase4_day5_step4", "phase4_day5_step5"],
  "project-remote-car": ["phase4_day5_step2", "phase4_day5_step3", "phase4_day5_step4", "phase4_day5_step5"],
  "project-pathfinding-car": ["phase4_day7_step1", "phase4_day7_step2", "phase4_day7_step3", "phase4_day7_step4", "phase4_day7_step5"],
  "project-model-evaluation": ["phase1_day1_step2", "phase1_day1_step3", "phase1_day1_step4", "phase1_day1_step5"],
  "project-desktop-agent": ["phase1_day3_step2", "phase1_day3_step3", "phase1_day3_step4", "phase1_day3_step5"],
  "project-cad-manufacturing": ["phase2_day1_step1", "phase2_day1_step2", "phase2_day1_step3", "phase2_day1_step4", "phase2_day1_step5"],
}

function projectSteps(steps: OriginalLessonStep[], projectId: string) {
  const selectedCodes = projectStepCodes[projectId]
  if (selectedCodes?.length) {
    const selected = steps.filter((step) => selectedCodes.includes(step.code))
    if (selected.length) return selected
  }
  const direct = steps.filter((step) =>
    step.stepType === "challenge"
    || /项目|实战|综合|交付|提交|作品|协同|闭环/i.test(step.title),
  )
  return direct.length ? direct : steps.slice(-1)
}

function payloadFor(
  step: OriginalLessonStep,
  mode: SupportMode,
): StepPayload {
  if (mode === "guided") {
    const selectedLayer = step.personalization?.selectedLayer ?? "standard"
    if (selectedLayer === "detailed") return step.payloads.detailed ?? step.payloads.standard ?? step.payloads.compact ?? step.payloads.guide ?? {}
    if (selectedLayer === "compact") return step.payloads.compact ?? step.payloads.guide ?? step.payloads.standard ?? step.payloads.detailed ?? {}
    return step.payloads.standard ?? step.payloads.compact ?? step.payloads.guide ?? step.payloads.detailed ?? {}
  }
  return step.payloads.compact ?? step.payloads.guide ?? step.payloads.standard ?? step.payloads.detailed ?? {}
}

function cleanCourseTitle(title: string) {
  return title.replace(/^Day\s*\d+\s*[：:]?\s*/i, "")
}

function cleanResourceText(value: string) {
  return value
    .replace(/\bPhase\s*\d+\b/gi, "")
    .replace(/\bDay\s*\d+(?:\s*[–-]\s*\d+)?\s*[：:]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function boundedStepIndex(value: number, stepCount: number) {
  if (stepCount < 1) return 0
  const index = Number.isInteger(value) ? value : 0
  return Math.min(Math.max(index, 0), stepCount - 1)
}

export function CourseExecutor({
  routeStep,
  userId,
  routeId,
  onRouteStepComplete,
  locale,
  displayRouteStep,
}: {
  routeStep: PersonalizedRouteStep
  userId: string
  routeId: string
  onRouteStepComplete: () => void | Promise<void>
  locale: Locale
  displayRouteStep?: PersonalizedRouteStep
}) {
  const [lesson, setLesson] = useState<OriginalLessonDetail | null>(null)
  const [loadError, setLoadError] = useState("")
  const [mode, setMode] = useState<SupportMode | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set())
  const [checklistByStep, setChecklistByStep] = useState<ChecklistState>({})
  const [evidenceByStep, setEvidenceByStep] = useState<EvidenceState>({})
  const [stuckIds, setStuckIds] = useState<Set<number>>(new Set())
  const [syncState, setSyncState] = useState<"loading" | "saved" | "local">("loading")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [quizOpen, setQuizOpen] = useState(false)
  const finishingCourseRef = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const steps = useMemo(() => {
    if (!lesson) return []
    // Content migration is intentionally tolerant while older records are
    // being normalised. A malformed/partial content record must show the
    // explicit empty-step state below, never crash during a fast course swap.
    const lessonSteps = Array.isArray(lesson.steps) ? lesson.steps : []
    return routeStep.focus === "project" ? projectSteps(lessonSteps, routeStep.sourceId) : lessonSteps
  }, [lesson, routeStep.focus, routeStep.sourceId])
  // Switching courses can briefly replace a five-step lesson with a shorter
  // one while the old progress index is still in React state.  Clamp before
  // every render, not only in an effect after render.
  const currentIndex = boundedStepIndex(activeIndex, steps.length)
  const activeStep = steps[currentIndex]
  // Always pass the route through the locale mapper. This also protects the
  // Agent header when a caller briefly supplies a stale displayRouteStep while
  // the user switches course and language in the same render cycle.
  const displayStep = localizeRouteStep(locale, displayRouteStep ?? routeStep)
  const displayLoadError = locale === "en" && containsChinese(loadError) ? "The original course content could not be loaded. Please try again." : loadError
  const displayUploadError = locale === "en" && containsChinese(uploadError) ? "The requested change could not be saved. Please try again." : uploadError
  const rawPayload = activeStep && mode ? payloadFor(activeStep, mode) : null
  const payload = activeStep && rawPayload ? localizePayload(locale, rawPayload, activeStep, currentIndex) : null
  const checklist = (payload?.checklist ?? []).map(checklistItem)
  const checkedIndexes = activeStep ? checklistByStep[String(activeStep.id)] ?? [] : []
  const currentComplete = activeStep ? completedIds.has(activeStep.id) : false
  const troubleshootingItems = payload?.troubleshooting?.filter(Boolean) ?? []
  const hasTroubleshooting = troubleshootingItems.length > 0
  const lessonProgress = steps.length
    ? Math.round((completedIds.size / steps.length) * 100)
    : 0
  const agentContext = {
    trackId: routeId,
    routeStepId: routeStep.id,
    courseId: routeStep.courseId ?? lesson?.courseId ?? null,
    stageId: activeStep?.code || (activeStep ? `step-${activeStep.id}` : null),
    stepTitle: activeStep ? localizeStepTitle(locale, activeStep, currentIndex) : null,
    routeTitle: displayStep.title,
    routeKind: routeStep.kind,
    mode,
  }
  const agentDomContext = {
    "data-agent-track-id": routeId,
    "data-agent-route-step-id": routeStep.id,
    "data-agent-course-id": routeStep.courseId ?? lesson?.courseId ?? "",
    "data-agent-course-title": cleanCourseTitle(displayStep.title),
  }

  useEffect(() => {
    setActivityContext({ trackId: routeId, routeStepId: routeStep.id, lessonId: routeStep.lessonId, stepId: activeStep?.id || null })
  }, [routeId, routeStep.id, routeStep.lessonId, activeStep?.id])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("personalized-secure:course-context-change", {
      detail: {
        trackId: routeId,
        routeStepId: routeStep.id,
        courseId: routeStep.courseId ?? lesson?.courseId ?? "",
        title: cleanCourseTitle(displayStep.title),
        locale,
        context: agentContext,
      },
    }))
  }, [activeStep?.code, activeStep?.id, agentContext.courseId, agentContext.mode, agentContext.routeKind, agentContext.routeStepId, agentContext.routeTitle, agentContext.stageId, agentContext.stepTitle, agentContext.trackId, displayStep.title, lesson?.courseId, locale, routeId, routeStep.courseId, routeStep.id])

  useEffect(() => {
    let cancelled = false
    setLesson(null)
    setLoadError("")
    setMode(null)
    setActiveIndex(0)
    setCompletedIds(new Set())
    setChecklistByStep({})
    setEvidenceByStep({})
    setStuckIds(new Set())
    setSyncState("loading")

    Promise.all([
      routeStep.courseId
        ? getMySqlCourseDetail(routeStep.courseId)
        : Promise.reject(new Error("当前路径缺少课程数据库编号，无法读取课程内容。")),
      getCourseProgress(routeId, routeStep.id).catch(() => null),
    ])
      .then(([detail, progress]) => {
        if (cancelled) return
        setLesson(detail)
        if (progress) {
          setMode(progress.supportMode)
          const rawDetailSteps = Array.isArray(detail.steps) ? detail.steps : []
          const detailSteps = routeStep.focus === "project"
            ? projectSteps(rawDetailSteps, routeStep.sourceId)
            : rawDetailSteps
          setActiveIndex(boundedStepIndex(progress.activeCourseStepIndex, detailSteps.length))
          setCompletedIds(new Set(progress.completedCourseStepIds))
          setChecklistByStep(progress.checklistByStep)
          setEvidenceByStep(progress.evidenceByStep)
          setStuckIds(new Set(progress.stuckStepIds))
        }
        setSyncState("saved")
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message || "原课程加载失败。")
      })

    return () => { cancelled = true }
  }, [routeId, routeStep.id, routeStep.courseId, routeStep.focus, routeStep.sourceId])

  useEffect(() => {
    if (activeIndex !== currentIndex) setActiveIndex(currentIndex)
  }, [activeIndex, currentIndex])

  async function persist(overrides: Partial<LessonProgressUpdate> = {}) {
    if (!lesson) return
    const update: LessonProgressUpdate = {
      routeId,
      routeStepId: routeStep.id,
      lessonId: lesson.id,
      supportMode: mode,
      activeCourseStepIndex: currentIndex,
      completedCourseStepIds: [...completedIds],
      checklistByStep,
      evidenceByStep,
      stuckStepIds: [...stuckIds],
      ...overrides,
    }
    setSyncState("loading")
    try {
      await saveCourseProgress(update)
      setSyncState("saved")
    } catch {
      window.localStorage.setItem(
        `personalized-secure:course-progress:${userId}:${routeId}:${routeStep.id}`,
        JSON.stringify(update),
      )
      setSyncState("local")
    }
  }

  async function openCourseResource(resource: OriginalLessonDetail["resources"][number]) {
    try {
      await openMySqlCourseResource(resource)
      void trackPersonalizedEvent({
        eventType: "resource_opened",
        routeId,
        routeStepId: routeStep.id,
        lessonId: routeStep.lessonId,
        payload: {
          resourceId: resource.id,
          resourceTitle: resource.title,
          resourceType: resource.type,
        },
      }).catch(() => undefined)
    } catch (error) {
      setUploadError((error as Error).message || "课程资源暂时不可用。")
    }
  }

  function chooseMode(nextMode: SupportMode) {
    setMode(nextMode)
    void persist({ supportMode: nextMode })
    trackPersonalizedEvent({ eventType: "support_mode_selected", routeId, routeStepId: routeStep.id, lessonId: routeStep.lessonId, payload: { mode: nextMode } })
  }

  function selectCourseStep(index: number) {
    setActiveIndex(index)
    setUploadError("")
    void persist({ activeCourseStepIndex: index })
    const selectedStep = steps[index]
    if (selectedStep) trackPersonalizedEvent({ eventType: "step_opened", routeId, routeStepId: routeStep.id, lessonId: routeStep.lessonId, stepId: selectedStep.id, payload: { index, title: selectedStep.title } })
  }

  function toggleChecklist(index: number) {
    if (!activeStep) return
    const key = String(activeStep.id)
    const current = checklistByStep[key] ?? []
    const next = current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index]
    const nextChecklist = { ...checklistByStep, [key]: next }
    setChecklistByStep(nextChecklist)
    void persist({ checklistByStep: nextChecklist })
    trackPersonalizedEvent({ eventType: "checklist_updated", routeId, routeStepId: routeStep.id, lessonId: routeStep.lessonId, stepId: activeStep.id, payload: { itemIndex: index, checked: next.includes(index), checkedIndexes: next } })
  }

  function markStuck() {
    if (!activeStep) return
    const next = new Set([...stuckIds, activeStep.id])
    setStuckIds(next)
    setLesson((current) => current ? {
      ...current,
      steps: current.steps.map((step) => step.id === activeStep.id ? {
        ...step,
        personalization: {
          selectedLayer: "detailed",
          reasonCode: "help_requested",
          reasonText: locale === "en" ? "You requested help on this step, so more detailed instructions, troubleshooting and remedial guidance are now available." : "你刚刚在本步骤发起求助，系统已立即展开更细的操作、排错和补救说明。",
          ruleVersion: step.personalization?.ruleVersion ?? "step-scaffold-v1",
          snapshotHash: step.personalization?.snapshotHash ?? "pending-server-sync",
        },
      } : step),
    } : current)
    void persist({ stuckStepIds: [...next] })
    trackPersonalizedEvent({
      eventType: "help_requested",
      routeId,
      routeStepId: routeStep.id,
      lessonId: routeStep.lessonId,
      stepId: activeStep.id,
      payload: {
        title: activeStep.title,
        hasTroubleshooting,
        troubleshootingCount: troubleshootingItems.length,
      },
    })
    const request: LearningAgentHelpRequest = {
      id: Date.now(),
      message: locale === "en"
        ? `I am stuck on “${localizeStepTitle(locale, activeStep, currentIndex)}”. Use this course and step context, ask what observation or evidence you need, then suggest the next diagnostic action.`
        : `我在当前步骤「${activeStep.title}」卡住了。请结合本课程和这个步骤，先问我需要补充的现象或证据，再给我下一步排查建议。`,
    }
    window.dispatchEvent(new CustomEvent("personalized-secure:agent-help-request", { detail: request }))
  }

  function completeCurrentStep() {
    if (!activeStep) return
    const next = new Set([...completedIds, activeStep.id])
    setCompletedIds(next)
    void persist({ completedCourseStepIds: [...next] })
    trackPersonalizedEvent({ eventType: "step_completed", routeId, routeStepId: routeStep.id, lessonId: routeStep.lessonId, stepId: activeStep.id, payload: { title: activeStep.title, completedCourseStepIds: [...next] } })
  }

  async function completeCourseInMySql() {
    if (!lesson?.courseId) throw new Error("当前课程没有对应的数据库课程 ID。")
    await completeMySqlCourse(lesson.courseId)
    void trackPersonalizedEvent({
      eventType: "course_completed",
      routeId,
      routeStepId: routeStep.id,
      lessonId: lesson.id,
      payload: {
        courseId: lesson.courseId,
        title: routeStep.title,
        completedCourseStepIds: [...completedIds],
      },
    }).catch(() => undefined)
  }

  async function continueLearning() {
    if (!activeStep || !currentComplete) return
    if (currentIndex >= steps.length - 1) {
      setQuizOpen(true)
      return
    }
    const nextIndex = currentIndex + 1
    setActiveIndex(nextIndex)
    setUploadError("")
    void persist({ activeCourseStepIndex: nextIndex })
  }

  async function finishCourseAfterQuiz() {
    if (finishingCourseRef.current) return
    finishingCourseRef.current = true
    setUploadError("")
    try {
      await completeCourseInMySql()
      await onRouteStepComplete()
      setQuizOpen(false)
    } catch (error) {
      setUploadError((error as Error).message || (locale === "en" ? "The course completion could not be saved. Please try again." : "课程完成状态保存失败，请重试。"))
    } finally {
      finishingCourseRef.current = false
    }
  }

  async function uploadEvidence(file: File | undefined, targetStep = activeStep) {
    if (!file || !targetStep || !lesson) return
    setUploading(true)
    setUploadError("")
    try {
      const evidence = await uploadCourseEvidence({
        routeId,
        routeStepId: routeStep.id,
        lessonId: lesson.id,
        stepId: targetStep.id,
        file,
      })
      const key = String(targetStep.id)
      const nextEvidence = {
        ...evidenceByStep,
        [key]: [...(evidenceByStep[key] ?? []), evidence],
      }
      setEvidenceByStep(nextEvidence)
      void persist({ evidenceByStep: nextEvidence })
    } catch (error) {
      setUploadError((error as Error).message || "文件上传失败。")
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  if (loadError) {
    return (
      <section className="executor-state executor-error">
        <ShieldAlert />
        <h2>{t(locale, "noOriginalSteps")}</h2>
        <p>{displayLoadError}</p>
      </section>
    )
  }

  if (!lesson) {
    return (
      <section className="executor-state">
        <Loader2 className="spin" />
        <p>{t(locale, "loadingOriginalSteps")}</p>
      </section>
    )
  }

  if (!steps.length) {
    return (
      <section className="executor-state executor-error">
        <FileText />
        <h2>{t(locale, "noConfiguredSteps")}</h2>
        <p>{t(locale, "noConfiguredStepsBody")}</p>
      </section>
    )
  }

  if (!mode) {
    return (
      <section className="mode-gate" {...agentDomContext}>
        <header>
          <span>{routeStep.focus === "project" ? t(locale, "originalProject") : t(locale, "originalCourse")}</span>
          <h1>{cleanCourseTitle(displayStep.title)}</h1>
          <p>{t(locale, "chooseMode")}</p>
        </header>
        <div className="mode-choice-grid">
          <button type="button" className="mode-choice guided" onClick={() => chooseMode("guided")}>
            <span className="mode-choice-icon"><BookOpen /></span>
            <small>GUIDED MODE</small>
            <strong>{t(locale, "modeGuided")}</strong>
            <p>{t(locale, "guidedDesc")}</p>
            <span className="mode-choice-action">{t(locale, "guidedAction")} <ArrowRight /></span>
          </button>
          <button type="button" className="mode-choice self" onClick={() => chooseMode("self_directed")}>
            <span className="mode-choice-icon"><UserRound /></span>
            <small>SELF-DIRECTED</small>
            <strong>{t(locale, "modeSelf")}</strong>
            <p>{t(locale, "selfDesc")}</p>
            <span className="mode-choice-action">{t(locale, "selfAction")} <ArrowRight /></span>
          </button>
        </div>
        <footer>
          <span><Sparkles /> {t(locale, "guidedIncludes")} {steps.length} {t(locale, "realSteps")}</span>
          <span><FileCheck2 /> {t(locale, "fromDatabase")}</span>
        </footer>
      </section>
    )
  }

  if (!activeStep || !payload) return null

  const isStuck = stuckIds.has(activeStep.id)
  if (mode === "self_directed") {
    const evidenceStep = [...steps].reverse().find((step) => step.stepType === "challenge") ?? steps[steps.length - 1]
    const selfEvidence = evidenceByStep[String(evidenceStep.id)] ?? []
    const standardPayloads = steps.map((step, index) => localizePayload(locale, payloadFor(step, "self_directed"), step, index))
    const completionCriteria = [...new Set(standardPayloads
      .map((item) => item.completion_checkpoint)
      .filter((item): item is string => Boolean(item)))]
      .slice(0, 6)
    const safetyBoundaries = [...new Set(standardPayloads
      .map((item) => item.safety_check)
      .filter((item): item is string => Boolean(item)))]
      .slice(0, 4)
    const resources = (Array.isArray(lesson.resources) ? lesson.resources : [])
      .filter((resource) => resource.availability === "MIGRATED_OBJECT")

    async function completeChallenge() {
      const allComplete = new Set(steps.map((step) => step.id))
      setCompletedIds(allComplete)
      void persist({ completedCourseStepIds: [...allComplete] })
      setQuizOpen(true)
    }

    return (
      <section className="course-executor self-directed-executor" {...agentDomContext}>
        <header className="executor-topline">
          <div className="executor-course-lockup">
            <span>{routeStep.focus === "project" ? "PROJECT" : "CHALLENGE"}</span>
            <div><strong>{cleanCourseTitle(displayStep.title)}</strong><small>{t(locale, "selfInternalStepsHidden")}</small></div>
          </div>
          <div className="mode-switch" aria-label={t(locale, "chooseMode")}>
            <button type="button" onClick={() => chooseMode("guided")}><BookOpen /> {t(locale, "modeGuided")}</button>
            <button type="button" className="active" onClick={() => chooseMode("self_directed")}><UserRound /> {t(locale, "modeSelf")}</button>
          </div>
        </header>

        <div className="self-challenge-workspace">
          <section className="challenge-hero">
            <span><Target /></span>
            <div><small>{t(locale, "yourTask")}</small><h1>{displayStep.outcome}</h1><p>{displayStep.description}</p></div>
          </section>

          <div className="challenge-grid">
            <section className="challenge-card acceptance-card">
              <header><CheckCircle2 /><div><small>{t(locale, "shouldMeet")}</small><h2>{t(locale, "acceptanceCriteria")}</h2></div></header>
              <div>
                {(completionCriteria.length ? completionCriteria : [t(locale, "defaultCompletion")]).map((item) => (
                  <span key={item}><Check />{item}</span>
                ))}
              </div>
            </section>

            <section className="challenge-card resource-library">
              <header><BookOpen /><div><small>{t(locale, "openWhenNeeded")}</small><h2>{t(locale, "originalResources")}</h2></div></header>
              <div>
                {resources.map((resource, resourceIndex) => {
                  const displayResource = localizeResource(locale, resource, resourceIndex)
                  return (
                    <button key={resource.id} type="button" onClick={() => void openCourseResource(resource)}>
                      {resource.type === "html" ? <BookOpen /> : <FileText />}
                      <span><strong>{cleanResourceText(displayResource.title)}</strong><small>{cleanResourceText(displayResource.description ?? t(locale, "courseResource"))}</small></span>
                      <ExternalLink />
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          {safetyBoundaries.length > 0 && (
            <section className="challenge-card self-safety-card">
              <header><ShieldAlert /><div><small>{t(locale, "cannotSkip")}</small><h2>{t(locale, "safetyLimits")}</h2></div></header>
              <div>{safetyBoundaries.map((item) => <span key={item}>{item}</span>)}</div>
            </section>
          )}

          <section className="challenge-card self-submit-card">
            <header><Upload /><div><small>{locale === "zh" ? "作品、照片、日志或代码" : "Work, photos, logs or code"}</small><h2>{t(locale, "submitResult")}</h2></div></header>
            <p>{evidenceText(localizePayload(locale, payloadFor(evidenceStep, "self_directed"), evidenceStep, steps.indexOf(evidenceStep)).evidence_requirement, locale)}</p>
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={(event) => void uploadEvidence(event.target.files?.[0], evidenceStep)}
            />
            <button type="button" className="evidence-drop" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 className="spin" /> : <Upload />}
              <span>{uploading ? t(locale, "uploading") : t(locale, "uploadEvidence")}</span>
              <small>{t(locale, "finalEvidenceOnly")}</small>
            </button>
            {uploadError && <p className="upload-error" role="alert">{displayUploadError}</p>}
            {selfEvidence.length > 0 && (
              <div className="evidence-list">{selfEvidence.map((file) => <span key={file.id}><FileCheck2 /><strong>{file.fileName}</strong><CheckCircle2 /></span>)}</div>
            )}
          </section>

          <footer className="self-challenge-actions">
            <span>{syncState === "loading" ? t(locale, "saving") : syncState === "saved" ? t(locale, "challengeSaved") : t(locale, "savedLocal")}</span>
            <Button size="lg" onClick={() => void completeChallenge()}><Check />{t(locale, "submitAndFinish")}</Button>
          </footer>
        </div>
        {quizOpen && (
          <AdaptiveQuiz
            routeStep={routeStep}
            nextRouteStep={null}
            routeId={routeId}
            locale={locale}
            onClose={() => setQuizOpen(false)}
            onContinue={() => { void finishCourseAfterQuiz() }}
          />
        )}
      </section>
    )
  }

  return (
    <section className="course-executor" {...agentDomContext}>
      <header className="executor-topline">
        <div className="executor-course-lockup">
          <span>{routeStep.focus === "project" ? "PROJECT" : "COURSE"}</span>
          <div>
            <strong>{cleanCourseTitle(displayStep.title)}</strong>
            <small>{steps.length} {t(locale, "realSteps")} · {lessonProgress}%</small>
          </div>
        </div>
        <div className="mode-switch" aria-label={t(locale, "chooseMode")}>
          <button type="button" className="active" onClick={() => chooseMode("guided")}>
            <BookOpen /> {t(locale, "modeGuided")}
          </button>
          <button type="button" onClick={() => chooseMode("self_directed")}>
            <UserRound /> {t(locale, "modeSelf")}
          </button>
        </div>
      </header>

      <div className="executor-progress-track"><i style={{ width: `${lessonProgress}%` }} /></div>

      <div className="course-executor-grid">
        <aside className="course-step-rail">
          <div className="course-step-heading">
            <span>{t(locale, "stepList")}</span>
            <strong>{currentIndex + 1} / {steps.length}</strong>
          </div>
          <nav>
            {steps.map((step, index) => {
              const complete = completedIds.has(step.id)
              return (
                <button
                  key={step.id}
                  type="button"
                  className={cn(index === currentIndex && "active", complete && "complete")}
                  onClick={() => selectCourseStep(index)}
                >
                  <span>{complete ? <Check /> : index + 1}</span>
                  <div>
                    <small>{step.stepType}</small>
                    <strong>{localizeStepTitle(locale, step, index)}</strong>
                  </div>
                  <ChevronRight />
                </button>
              )
            })}
          </nav>
        </aside>

        <article className="step-workbench">
          <header className="step-workbench-header">
            <div>
              <span>STEP {String(currentIndex + 1).padStart(2, "0")}</span>
              <span><Clock3 /> {Math.max(1, Math.round(activeStep.estimatedSeconds / 60))} {t(locale, "minutes")}</span>
            </div>
            <h1>{payload.title || activeStep.title}</h1>
            <p>{payload.goal || activeStep.title}</p>
            {activeStep.personalization?.reasonText && (
              <aside className="step-personalization-reason"><Sparkles />{localizeText(locale, activeStep.personalization.reasonText, "This step has been expanded based on your support request.")}</aside>
            )}
          </header>

          <div className="guided-workspace">
              <section className="instruction-card">
                <span><Wrench /></span>
                <div>
                  <small>{t(locale, "doNow")}</small>
                  <p>{payload.instruction || t(locale, "defaultInstruction")}</p>
                </div>
              </section>

              {payload.scaffold_instruction && (
                <section className="step-scaffold-card">
                  <div><BookOpen /><strong>{t(locale, "scaffold")}</strong></div>
                  <p>{payload.scaffold_instruction}</p>
                </section>
              )}

              {activeStep.personalization?.selectedLayer === "detailed" && payload.remedial_task && (
                <section className="step-extension-card remedial">
                  <small>{locale === "zh" ? "需要时先做这个" : "Do this first if needed"}</small>
                  <strong>{locale === "zh" ? "补救任务" : "Remedial task"}</strong>
                  <p>{payload.remedial_task}</p>
                </section>
              )}

              {activeStep.personalization?.selectedLayer === "compact" && payload.challenge_task && (
                <section className="step-extension-card challenge">
                  <small>{locale === "zh" ? "完成后继续验证" : "Verify after completion"}</small>
                  <strong>{locale === "zh" ? "迁移挑战" : "Transfer challenge"}</strong>
                  <p>{payload.challenge_task}</p>
                </section>
              )}

              {checklist.length > 0 && (
                <section className="executor-section checklist-section">
                  <header>
                    <div><CheckCircle2 /><strong>{t(locale, "checklist")}</strong></div>
                    <span>{checkedIndexes.length} / {checklist.length}</span>
                  </header>
                  <div>
                    {checklist.map((item, index) => {
                      const checked = checkedIndexes.includes(index)
                      return (
                        <label key={`${item.item}-${index}`} className={cn(checked && "checked")}>
                          <input type="checkbox" checked={checked} onChange={() => toggleChecklist(index)} />
                          <span>{checked ? <Check /> : <Circle />}</span>
                          <div>
                            <strong>{item.item}</strong>
                            {item.detail && <small>{item.detail}</small>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </section>
              )}
          </div>

          {payload.safety_check && (
            <section className="safety-callout">
              <ShieldAlert />
              <div><strong>{t(locale, "safety")}</strong><p>{payload.safety_check}</p></div>
            </section>
          )}

          <section className="completion-checkpoint">
            <Target />
            <div>
              <small>{t(locale, "completion")}</small>
              <strong>{payload.completion_checkpoint || t(locale, "defaultCompletion")}</strong>
            </div>
          </section>

          {isStuck && hasTroubleshooting && (
            <section className="executor-section troubleshooting-section">
              <header>
                <div><Wrench /><strong>{t(locale, "troubleshooting")}</strong></div>
                <span>{troubleshootingItems.length} {t(locale, "items")}</span>
              </header>
              <div>
                {troubleshootingItems.map((item, index) => (
                  <p key={`${item}-${index}`}>
                    <strong>{index + 1}</strong>
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </section>
          )}

          <footer className="executor-actions">
            <div>
              <button type="button" className={cn("agent-help-trigger", isStuck && "active")} onClick={markStuck}>
                <Wrench /> {hasTroubleshooting ? (isStuck ? t(locale, "troubleshootingOpened") : t(locale, "troubleshootingOpen")) : t(locale, "askAgent")}
              </button>
              <small>
                {syncState === "loading" && t(locale, "savingStep")}
                {syncState === "saved" && (
                  hasTroubleshooting
                    ? (isStuck ? t(locale, "troubleshootingSaved") : t(locale, "troubleshootingHint"))
                    : t(locale, "noTroubleshootingHint")
                )}
                {syncState === "local" && t(locale, "savedLocal")}
              </small>
            </div>
            {!currentComplete ? (
              <Button size="lg" onClick={completeCurrentStep}>
                <Check data-icon="inline-start" /> {t(locale, "completeStep")}
              </Button>
            ) : (
              <Button size="lg" onClick={continueLearning}>
                {currentIndex < steps.length - 1 ? t(locale, "nextStep") : t(locale, "finishCourse")}
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
          </footer>
        </article>
        <CourseResourceSidebar
          locale={locale}
          resources={(Array.isArray(lesson.resources) ? lesson.resources : []).map((resource, index) => localizeResource(locale, resource, index))}
          onOpen={openCourseResource}
        />
      </div>
      {quizOpen && (
        <AdaptiveQuiz
          routeStep={routeStep}
          nextRouteStep={null}
          routeId={routeId}
          locale={locale}
          onClose={() => setQuizOpen(false)}
          onContinue={() => { void finishCourseAfterQuiz() }}
        />
      )}
    </section>
  )
}
