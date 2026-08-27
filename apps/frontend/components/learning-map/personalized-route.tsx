"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleCheckBig,
  Check,
  FolderKanban,
  Loader2,
  LogOut,
  Languages,
  Route,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PersonalizedRouteStep } from "@/lib/learning-map-utils"
import {
  getLearningProgress,
  saveLearningProgress,
  trackPersonalizedEvent,
} from "@/lib/personalization-api"
import { t, type Locale } from "@/lib/bilingual-ui"
import { localizeRouteStep } from "@/lib/localized-learning-content"
import { cn } from "@/lib/utils"
import { setActivityContext } from "@/lib/activity-telemetry"
import { CourseExecutor } from "./course-executor"

export function PersonalizedRoute({
  steps,
  selectedInterests,
  routeId,
  userId,
  onBack,
  onAdjust,
  onRouteFinished,
  userLabel,
  onLogout,
  locale,
  onToggleLocale,
}: {
  steps: PersonalizedRouteStep[]
  selectedInterests: string[]
  routeId: string
  userId: string
  onBack: () => void
  onAdjust: () => void
  onRouteFinished: (routeSteps: PersonalizedRouteStep[]) => Promise<void>
  userLabel: string
  onLogout: () => void
  locale: Locale
  onToggleLocale: () => void
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [syncStatus, setSyncStatus] = useState<"loading" | "saved" | "local">("loading")
  const [completionSync, setCompletionSync] = useState<"idle" | "syncing" | "ready" | "error">("idle")

  const activeStep = steps[activeStepIndex]
  const localizedActiveStep = activeStep ? localizeRouteStep(locale, activeStep) : undefined
  const projects = steps.filter((step) => step.kind === "project")
  const courseCount = steps.filter((step) => step.kind === "course").length
  const progress = steps.length ? Math.round((completed.size / steps.length) * 100) : 0
  const finished = steps.length > 0 && completed.size === steps.length
  useEffect(() => {
    setActivityContext({ trackId: routeId || null, routeStepId: activeStep?.id || null, lessonId: activeStep?.lessonId || null, stepId: null })
    return () => setActivityContext({})
  }, [routeId, activeStep?.id, activeStep?.lessonId])
  useEffect(() => {
    if (!routeId) return
    let cancelled = false
    const localKey = `personalized-secure:route-progress:${userId}:${routeId}`

    try {
      const local = window.localStorage.getItem(localKey)
      if (local) {
        const parsed = JSON.parse(local) as { activeStepIndex?: number; completedStepIds?: string[] }
        if (Array.isArray(parsed.completedStepIds)) setCompleted(new Set(parsed.completedStepIds))
        if (Number.isInteger(parsed.activeStepIndex)
          && parsed.activeStepIndex! >= 0
          && parsed.activeStepIndex! < steps.length) {
          setActiveStepIndex(parsed.activeStepIndex!)
        }
      }
    } catch {
      // A malformed local cache must not block the course.
    }

    getLearningProgress(routeId)
      .then((progress) => {
        if (cancelled) return
        if (progress) {
          setCompleted(new Set(progress.completedStepIds))
          if (progress.activeStepIndex < steps.length) setActiveStepIndex(progress.activeStepIndex)
        }
        setSyncStatus("saved")
      })
      .catch(() => {
        if (!cancelled) setSyncStatus("local")
      })

    return () => {
      cancelled = true
    }
  }, [routeId, steps.length, userId])

  useEffect(() => {
    if (!routeId) return
    void trackPersonalizedEvent({
      eventType: "route_opened",
      routeId,
      routeStepId: activeStep?.id,
      lessonId: activeStep?.lessonId,
      payload: { stepCount: steps.length, activeStepIndex },
    }).catch(() => undefined)
    // Track only when the loaded route identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  useEffect(() => {
    if (completed.size !== steps.length || completionSync !== "idle") return
    let cancelled = false
    setCompletionSync("syncing")
    onRouteFinished(steps.filter((step) => step.kind === "course"))
      .then(() => { if (!cancelled) setCompletionSync("ready") })
      .catch(() => { if (!cancelled) setCompletionSync("error") })
    return () => { cancelled = true }
  }, [completed, completionSync, onRouteFinished, steps])

  async function persistProgress(nextCompleted: Set<string>, nextStepIndex: number) {
    if (!routeId) return
    const completedStepIds = [...nextCompleted]
    window.localStorage.setItem(
      `personalized-secure:route-progress:${userId}:${routeId}`,
      JSON.stringify({ activeStepIndex: nextStepIndex, completedStepIds }),
    )

    setSyncStatus("loading")
    try {
      await saveLearningProgress({
        routeId,
        activeStepIndex: nextStepIndex,
        completedStepIds,
      })
      setSyncStatus("saved")
    } catch {
      setSyncStatus("local")
    }
  }

  function selectStep(index: number) {
    const step = steps[index]
    setActiveStepIndex(index)
    void persistProgress(completed, index)
    if (step) {
      void trackPersonalizedEvent({
        eventType: "route_step_opened",
        routeId,
        routeStepId: step.id,
        lessonId: step.lessonId,
        payload: { index, title: step.title, courseId: step.courseId, kind: step.kind },
      }).catch(() => undefined)
    }
  }

  async function completeAndContinue() {
    if (!activeStep) return
    const nextCompleted = new Set([...completed, activeStep.id])
    const nextStepIndex = Math.min(activeStepIndex + 1, steps.length - 1)
    if (nextCompleted.size === steps.length) {
      // The current course already confirms itself before invoking this callback.
      // Earlier steps may have been confirmed by an older local-only build, so
      // synchronise the whole confirmed route once at the terminal boundary.
      await onRouteFinished(steps.filter((step) => step.kind === "course"))
      void trackPersonalizedEvent({
        eventType: "route_completed",
        routeId,
        routeStepId: activeStep.id,
        lessonId: activeStep.lessonId,
        payload: { completedStepIds: [...nextCompleted], totalSteps: steps.length },
      }).catch(() => undefined)
      setCompletionSync("ready")
    }
    setCompleted(nextCompleted)
    setActiveStepIndex(nextStepIndex)
    void persistProgress(nextCompleted, nextStepIndex)
  }

  function retryCompletionSync() {
    setCompletionSync("idle")
  }

  if (!activeStep) {
    return (
      <main className="learning-space empty-route-page">
        <div>
          <Route />
          <h1>{t(locale, "noMatchedRouteTitle")}</h1>
          <p>{t(locale, "noMatchedRouteBody")}</p>
          <Button onClick={onAdjust}>{t(locale, "adjustMyChoices")}</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="learning-space personalized-route-page">
      <header className="route-topbar">
        <Button variant="ghost" size="lg" onClick={finished ? onAdjust : onBack}>
          <ArrowLeft data-icon="inline-start" />
          {finished ? t(locale, "returnCatalog") : t(locale, "returnGraph")}
        </Button>
        <div className="route-title-lockup">
          <span><Route /></span>
          <div>
            <p>Personal learning route</p>
            <strong>{t(locale, "personalRoute")}</strong>
          </div>
        </div>
        <div className="route-topbar-actions">
          <span>{courseCount} {t(locale, "learningContent")} · {projects.length} {t(locale, "project")}</span>
          <button type="button" className="language-toggle" onClick={onToggleLocale} aria-label="Switch language">
            <Languages /> {locale === "zh" ? "EN" : "中"}
          </button>
          <Button variant="outline" size="lg" onClick={onAdjust}>{t(locale, "adjustInterests")}</Button>
          <div className="platform-account-inline compact">
            <span><UserRound /></span>
            <div><small>{t(locale, "currentAccount")}</small><strong>{userLabel}</strong></div>
            <button type="button" onClick={onLogout} title={t(locale, "logout")} aria-label={t(locale, "logout")}><LogOut /></button>
          </div>
        </div>
      </header>

      <div className="personal-route-shell">
        <aside className="route-rail-panel">
          <section className="route-progress-card">
            <div>
              <span>{t(locale, "routeProgress")}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="route-progress-track"><i style={{ width: `${progress}%` }} /></div>
            <p>{t(locale, "routeProgressHelp")}</p>
          </section>

          <div className="route-rail-heading">
            <div>
              <p className="eyebrow">Learning steps</p>
              <h2>{t(locale, "learningSteps")}</h2>
            </div>
            <span>{steps.length}</span>
          </div>

          <nav className="route-step-list" aria-label={t(locale, "learningSteps")}>
            {steps.map((step, index) => {
              const localizedStep = localizeRouteStep(locale, step)
              const isActive = index === activeStepIndex
              const isComplete = completed.has(step.id)
              return (
                <button
                  key={step.id}
                  type="button"
                  className={cn(
                    "route-step-button",
                    isActive && "active",
                    isComplete && "complete",
                    step.kind === "project" && "is-project",
                  )}
                  onClick={() => selectStep(index)}
                >
                  <span className="route-step-index">
                    {isComplete ? <Check /> : index + 1}
                  </span>
                  <span className="route-step-copy">
                    <small>{step.kind === "project" ? t(locale, "project") : t(locale, "learningContent")}</small>
                    <strong>{localizedStep.title}</strong>
                  </span>
                  {step.kind === "project" ? <FolderKanban /> : <BookOpen />}
                </button>
              )
            })}
          </nav>
        </aside>

        <section className="route-learning-stage">
          {finished && (
            <section className="route-finished-screen" role="status">
              <span className="route-finished-icon">
                {completionSync === "syncing" ? <Loader2 className="spin" /> : <CircleCheckBig />}
              </span>
              <div>
                <p>{completionSync === "syncing" ? t(locale, "syncCatalog") : completionSync === "error" ? t(locale, "syncFailed") : t(locale, "routeFinished")}</p>
                <h1>{completionSync === "syncing" ? t(locale, "savingCompletion") : completionSync === "error" ? t(locale, "completionUnsynced") : t(locale, "pathCompleted")}</h1>
                <span>{completionSync === "error" ? t(locale, "routeCompleteErrorHint") : t(locale, "routeCompleteHint")}</span>
                {completionSync === "ready" && <ul className="route-finished-stats"><li>{courseCount} {t(locale, "coursesRecorded")}</li><li>{t(locale, "nextGoalsHint")}</li></ul>}
              </div>
              {completionSync === "error"
                ? <Button size="lg" onClick={retryCompletionSync}>{t(locale, "retrySync")} <ArrowRight data-icon="inline-end" /></Button>
                : <Button size="lg" disabled={completionSync !== "ready"} onClick={onAdjust}>{t(locale, "continueChoose")} <ArrowRight data-icon="inline-end" /></Button>}
            </section>
          )}

          {!finished && (
            <CourseExecutor
              key={activeStep.id}
              routeStep={activeStep}
              userId={userId}
              routeId={routeId}
              onRouteStepComplete={completeAndContinue}
              locale={locale}
              displayRouteStep={localizedActiveStep}
            />
          )}
        </section>

      </div>
    </main>
  )
}
