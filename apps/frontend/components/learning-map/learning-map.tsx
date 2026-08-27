"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowUpRight, Languages, LogOut, RotateCcw, Sparkles, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { courses, interests, legacyCourseIdByDatabaseCourseId, targetDatabaseCourseByInterestId, type KnowledgeNode } from "@/lib/learning-map-data"
import {
  getVisibleGraph,
  type GraphCourseReference,
  type PersonalizedRouteStep,
  type RequiredPrerequisite,
} from "@/lib/learning-map-utils"
import {
  flushPersonalizedEventOutbox,
  completeMySqlCourse,
  trackPersonalizedEvent,
} from "@/lib/personalization-api"
import { t, type Locale } from "@/lib/bilingual-ui"
import { containsChinese, localizeInterestLabel, localizeKnowledgeNode, localizeModuleName } from "@/lib/localized-learning-content"
import { DetailPanel, type PanelTab } from "./detail-panel"
import { InterestField } from "./interest-field"
import { KnowledgeGraph } from "./knowledge-graph"
import { PersonalizedRoute } from "./personalized-route"

const MAX_INTERESTS = 5
const mysqlApiBase = () => process.env.NEXT_PUBLIC_PERSONALIZED_V2_API_BASE?.replace(/\/$/, "") || "/personalized-v2/api/v1"

type MysqlGraphSource = {
  courses: GraphCourseReference[]
  requiredPrerequisites: RequiredPrerequisite[]
}

type MysqlTrackDetail = {
  track: { id: string }
  modules: Array<{
    id: string
    name: string
    courses: Array<{
      id: string
      course_id: string
      module_id: string
      lesson_id: number | null
      title_snapshot: string
      status: "LOCKED" | "AVAILABLE" | "COMPLETED"
    }>
  }>
}

type MysqlCatalog = {
  modules: Array<{ courses: Array<{ id: string; lesson_id: number | null }> }>
}

function availableInterestIds(source?: MysqlGraphSource) {
  if (!source) return undefined
  return new Set(interests.flatMap((interest) => {
    const targetCourseId = targetDatabaseCourseByInterestId[interest.id]
    return targetCourseId && source.courses.some((course) => course.id === targetCourseId) ? [interest.id] : []
  }))
}

// graph-source contains exactly the published courses the learner has not
// completed.  A goal whose concrete MySQL target is absent is therefore a
// completed goal, not an unknown or empty state.
function masteredInterestIds(source?: MysqlGraphSource) {
  if (!source) return new Set<string>()
  const availableCourseIds = new Set(source.courses.map((course) => course.id))
  return new Set(interests.flatMap((interest) => {
    const targetCourseId = targetDatabaseCourseByInterestId[interest.id]
    return targetCourseId && !availableCourseIds.has(targetCourseId) ? [interest.id] : []
  }))
}

const phaseByModuleId: Record<string, 1 | 2 | 3 | 4> = {
  ai_agent: 1,
  ai_manufacturing: 2,
  embedded_perception: 3,
  embodied_projects: 4,
}

export function LearningMap({ token, userId, userLabel, onLogout, locale, onToggleLocale }: { token: string; userId: string; userLabel: string; onLogout: () => void; locale: Locale; onToggleLocale: () => void }) {
  const selectionStorageKey = `personalized-secure:selected:${userId}`
  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const parsed = JSON.parse(window.localStorage.getItem(selectionStorageKey) ?? "[]")
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_INTERESTS) : []
    } catch {
      return []
    }
  })
  const [stage, setStage] = useState<"discover" | "graph" | "route">("discover")
  const [current, setCurrent] = useState<KnowledgeNode>()
  const [route, setRoute] = useState<PersonalizedRouteStep[]>([])
  const [routeId, setRouteId] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<PanelTab>("overview")
  const [routeError, setRouteError] = useState("")
  const [mysqlGraph, setMysqlGraph] = useState<MysqlGraphSource>()
  const graph = useMemo(() => getVisibleGraph(selected, mysqlGraph), [selected, mysqlGraph])
  const displayGraph = useMemo(() => ({
    ...graph,
    visibleNodes: graph.visibleNodes.map((node) => localizeKnowledgeNode(locale, node)),
    moduleGroups: graph.moduleGroups.map((group) => ({ ...group, name: localizeModuleName(locale, group.name) })),
  }), [graph, locale])
  const availableGoals = useMemo(() => availableInterestIds(mysqlGraph), [mysqlGraph])
  const masteredGoals = useMemo(() => masteredInterestIds(mysqlGraph), [mysqlGraph])
  const displayRouteError = locale === "en" && routeError && containsChinese(routeError)
    ? "The course catalog or route could not be loaded. Please try again later."
    : routeError

  const refreshMysqlGraph = useCallback(async () => {
    try {
      const response = await fetch(`${mysqlApiBase()}/graph-source`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      if (!response.ok) throw new Error(`graph_source_unavailable:${response.status}`)
      const source = await response.json() as MysqlGraphSource
      setMysqlGraph(source)
      return source
    } catch {
      setMysqlGraph(undefined)
      return undefined
    }
  }, [token])

  useEffect(() => { void refreshMysqlGraph() }, [refreshMysqlGraph])

  useEffect(() => {
    if (stage !== "route") {
      window.dispatchEvent(new CustomEvent("personalized-secure:course-context-change", { detail: { context: null } }))
    }
  }, [stage])

  useEffect(() => {
    if (!availableGoals) return
    setSelected((current) => current.filter((interestId) => availableGoals.has(interestId)))
  }, [availableGoals])

  useEffect(() => {
    try {
      window.localStorage.setItem(selectionStorageKey, JSON.stringify(selected))
    } catch {
      // Browser storage is only a convenience for retaining unfinished picks.
    }
  }, [selected, selectionStorageKey])

  useEffect(() => {
    void flushPersonalizedEventOutbox().catch(() => undefined)
    const retrySync = () => { void flushPersonalizedEventOutbox().catch(() => undefined) }
    window.addEventListener("online", retrySync)
    return () => window.removeEventListener("online", retrySync)
  }, [])

  function toggle(id: string) {
    if (!selected.includes(id) && selected.length >= MAX_INTERESTS) return
    const action = selected.includes(id) ? "removed" : "selected"
    const beforeInterestIds = [...selected]
    const afterInterestIds = action === "removed"
      ? selected.filter((item) => item !== id)
      : [...selected, id]
    void trackPersonalizedEvent({
      eventType: "route_interest_selected",
      payload: { interestId: id, action, beforeInterestIds, afterInterestIds, source: "interest_bubble" },
    }).catch(() => undefined)
    setSelected(afterInterestIds)
    setCurrent(undefined)
    setRoute([])
    setRouteId("")
    setRouteError("")
    setPanelTab("overview")
  }

  function logout() {
    void trackPersonalizedEvent({ eventType: "logout" }).catch(() => undefined)
    onLogout()
  }

  function toggleLocale() {
    const nextLocale = locale === "zh" ? "en" : "zh"
    onToggleLocale()
    void trackPersonalizedEvent({
      eventType: "language_changed",
      payload: { locale: nextLocale },
    }).catch(() => undefined)
  }

  function openGraph() {
    if (!selected.length) return
    setStage("graph")
    setCurrent(undefined)
    setPanelTab("overview")
  }

  function reset() {
    let remaining = [...selected]
    for (const interestId of selected) {
      const beforeInterestIds = [...remaining]
      remaining = remaining.filter((item) => item !== interestId)
      void trackPersonalizedEvent({
        eventType: "route_interest_selected",
        payload: { interestId, action: "removed", beforeInterestIds, afterInterestIds: [...remaining], source: "reset" },
      }).catch(() => undefined)
    }
    setSelected([])
    setStage("discover")
    setCurrent(undefined)
    setRoute([])
    setRouteId("")
    setDrawerOpen(false)
    setPanelTab("overview")
    setRouteError("")
  }

  async function returnToDiscover() {
    await refreshMysqlGraph()
    setStage("discover")
    void flushPersonalizedEventOutbox().catch(() => undefined)
  }

  async function returnToGraph() {
    const source = await refreshMysqlGraph()
    // Completion may leave no selectable goal in the current route. Do not
    // strand the learner on an empty graph; the directory is the next action.
    const remaining = source
      ? selected.filter((interestId) => source.courses.some((course) => course.id === targetDatabaseCourseByInterestId[interestId]))
      : selected
    if (!remaining.length) {
      setSelected([])
      setStage("discover")
      return
    }
    setSelected(remaining)
    setStage("graph")
  }

  async function syncFinishedRoute(routeSteps: PersonalizedRouteStep[]) {
    // Completion is idempotent on the API. This also repairs earlier route
    // steps that were confirmed before the MySQL completion endpoint existed.
    const unresolvedLessonIds = routeSteps
      .filter((step) => !step.courseId && step.lessonId > 0)
      .map((step) => step.lessonId)
    const catalog = unresolvedLessonIds.length
      ? await fetch(`${mysqlApiBase()}/catalog`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error(`课程目录读取失败：${response.status}`)
          return response.json() as Promise<MysqlCatalog>
        })
      : undefined
    const catalogCourseIdByLessonId = new Map(
      (catalog?.modules ?? []).flatMap((module) => module.courses.flatMap((course) =>
        course.lesson_id === null ? [] : [[course.lesson_id, course.id] as const],
      )),
    )
    const courseIds = routeSteps.flatMap((step) => {
      const courseId = step.courseId ?? catalogCourseIdByLessonId.get(step.lessonId)
      return courseId ? [courseId] : []
    })
    if (!courseIds.length) throw new Error("无法解析本轮课程的数据库编号。")
    await Promise.all([...new Set(courseIds)].map((courseId) => completeMySqlCourse(courseId)))
    const source = await refreshMysqlGraph()
    if (!source) throw new Error("课程完成已保存，但课程目录暂时无法刷新。")
  }

  async function generatePath() {
    if (!selected.length || isGenerating) return
    setIsGenerating(true)
    setRouteError("")
    try {
      // The graph canvas can render before its MySQL id mapping arrives. Path
      // generation must wait for (or refresh) that mapping instead of asking
      // the learner to retry.
      // Never derive a new route from a previously rendered graph: a course
      // can have just been completed in another view or browser tab.
      const graphSource = await refreshMysqlGraph()
      if (!graphSource) throw new Error("课程目录读取失败，请稍后重试。")
      const availableCourseIds = new Set(graphSource.courses.map((course) => course.id))
      const targetCourseIds = selected
        .map((interestId) => targetDatabaseCourseByInterestId[interestId])
        .filter((id): id is string => Boolean(id) && availableCourseIds.has(id))
        .slice(0, MAX_INTERESTS)
      if (!targetCourseIds.length) throw new Error("没有找到可生成路径的课程目标")

      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      const created = await fetch(`${mysqlApiBase()}/tracks`, {
        method: "POST",
        headers,
        body: JSON.stringify({ targetCourseIds }),
      })
      const createdBody = await created.json().catch(() => ({})) as { error?: string; track?: { id?: string } }
      if (created.status === 401) {
        onLogout()
        throw new Error("登录已过期，请重新登录后生成学习路径。")
      }
      if (!created.ok || !createdBody.track?.id) throw new Error(createdBody.error || `路径创建失败：${created.status}`)
      const detailResponse = await fetch(`${mysqlApiBase()}/tracks/${createdBody.track.id}`, { headers, cache: "no-store" })
      const detail = await detailResponse.json().catch(() => ({})) as MysqlTrackDetail & { error?: string }
      if (!detailResponse.ok) throw new Error(detail.error || `路径读取失败：${detailResponse.status}`)

      const lessonIdByCourseId = new Map(graphSource.courses.map((course) => [course.id, course.lessonId]))
      // A path keeps completed prerequisite nodes for server-side unlock and
      // progress calculation.  They are history, not work to repeat: only
      // render unfinished nodes in the learner's executable route.
      const steps = detail.modules.flatMap((module) => module.courses
        .filter((node) => node.status !== "COMPLETED")
        .map((node) => {
        // `lesson_id` travels with a path node, including completed nodes that
        // are deliberately not present in graph-source any more.  The fallback
        // keeps clients working while an older API instance is being replaced.
        const lessonId = node.lesson_id ?? lessonIdByCourseId.get(node.course_id)
        const legacyCourse = courses.find((course) => course.id === legacyCourseIdByDatabaseCourseId[node.course_id])
        return {
          id: node.id,
          kind: "course" as const,
          sourceId: legacyCourse?.id ?? node.course_id,
          title: node.title_snapshot,
          courseId: node.course_id,
          description: legacyCourse?.description.replace(/^原平台课程：/, "") ?? "按当前学习路径完成本课程。",
          outcome: module.name,
          interests: legacyCourse?.interests ?? [],
          matchedInterestIds: legacyCourse?.interests.filter((id) => selected.includes(id)) ?? [],
          recommendationReason: node.status === "LOCKED" ? "先完成前置课程后即可解锁。" : "这是你的当前学习路径中的课程。",
          resources: [],
          lessonId: lessonId ?? 0,
          phaseNumber: legacyCourse?.phaseNumber ?? phaseByModuleId[node.module_id] ?? 3,
          knowledgeNodeIds: legacyCourse?.knowledgeNodeIds ?? [],
          focus: "lesson" as const,
          course: legacyCourse,
        }
        }))
      if (!steps.length || steps.some((step) => !step.lessonId)) throw new Error("路径中存在未映射的课程内容")
      setRoute(steps)
      setRouteId(detail.track.id)
      setStage("route")
      setDrawerOpen(false)
      void trackPersonalizedEvent({
        eventType: "route_generated",
        routeId: detail.track.id,
        payload: {
          selectedInterestIds: selected,
          targetCourseIds,
          renderedStepCount: steps.length,
        },
      }).catch(() => undefined)
    } catch (error) {
      setRoute([])
      setRouteId("")
      setRouteError((error as Error).message || "学习路径生成失败，请稍后重试。")
    } finally {
      setIsGenerating(false)
    }
  }

  function selectNode(node: KnowledgeNode) {
    setCurrent(node)
    setPanelTab("node")
    setDrawerOpen(true)
  }

  if (stage === "route") {
    return (
      <>
        <PersonalizedRoute
          steps={route}
          selectedInterests={selected}
          routeId={routeId}
          userId={userId}
          onBack={returnToGraph}
          onAdjust={returnToDiscover}
          onRouteFinished={syncFinishedRoute}
          userLabel={userLabel}
          onLogout={logout}
          locale={locale}
          onToggleLocale={toggleLocale}
        />
      </>
    )
  }

  return (
    <>
      <main className="learning-space">
        <header className="topbar">
        <div className="platform-account-area">
          <div className="platform-account-inline">
            <span><UserRound /></span>
            <div><small>{t(locale, "currentAccount")}</small><strong>{userLabel}</strong></div>
            <button type="button" onClick={logout} title={t(locale, "logout")} aria-label={t(locale, "logout")}><LogOut /></button>
          </div>
        </div>
        {stage === "discover" ? (
          <div className="top-actions">
            <button type="button" className="language-toggle" onClick={toggleLocale} aria-label="Switch language">
              <Languages /> {locale === "zh" ? "EN" : "中"}
            </button>
            <span className="selection-count">{t(locale, "selectedCount")} {selected.length} / {MAX_INTERESTS}</span>
            <Button size="lg" onClick={openGraph} disabled={!selected.length}>
              {t(locale, "connectInterests")}
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </div>
        ) : (
          <div className="top-actions">
            <button type="button" className="language-toggle" onClick={toggleLocale} aria-label="Switch language">
              <Languages /> {locale === "zh" ? "EN" : "中"}
            </button>
            <Button variant="ghost" size="lg" onClick={() => setStage("discover")}>
              <ArrowLeft data-icon="inline-start" />
              {t(locale, "adjustSelection")}
            </Button>
            <Button variant="ghost" size="lg" onClick={reset}>
              <RotateCcw data-icon="inline-start" />
              {t(locale, "restart")}
            </Button>
            <Button size="lg" onClick={generatePath} disabled={isGenerating}>
              <Sparkles data-icon="inline-start" />
              {isGenerating ? t(locale, "generating") : t(locale, "generatePath")}
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </div>
        )}
        </header>

        {routeError && stage !== "discover" && <div className="route-sync-error" role="alert">{displayRouteError}</div>}

        {stage === "discover" ? (
          <InterestField
            selected={selected}
            maxSelected={MAX_INTERESTS}
            learningState={null}
            stateLoading={false}
            availableInterestIds={availableGoals}
            masteredInterestIds={masteredGoals}
            errorMessage={displayRouteError}
            locale={locale}
            onToggle={toggle}
            onContinue={openGraph}
          />
        ) : (
          <div id="main-space" className="workspace">
          <section className="map-area">
            <header className="map-context">
              <div>
                <p className="eyebrow">{t(locale, "dreamEyebrow")}</p>
                <h1>{t(locale, "dreamTitle")}</h1>
              </div>
              <div className="selected-dock" aria-label={t(locale, "selectedInterests")}>
                {selected.map((id) => {
                  const item = interests.find((interest) => interest.id === id)
                  return <button key={id} type="button" onClick={() => toggle(id)} title={t(locale, "remove")}>{localizeInterestLabel(locale, id, item?.label)}</button>
                })}
              </div>
            </header>
            <KnowledgeGraph
              nodes={displayGraph.visibleNodes}
              edges={displayGraph.visibleEdges}
              moduleGroups={displayGraph.moduleGroups}
              selectedNode={current?.id}
              pathIds={route.flatMap((step) => step.course ? [step.course.id] : [])}
              locale={locale}
              onSelect={selectNode}
            />
          </section>

          <DetailPanel
            selected={selected}
            visibleNodes={displayGraph.visibleNodes}
            current={current ? localizeKnowledgeNode(locale, current) : undefined}
            open={drawerOpen}
            activeTab={panelTab}
            locale={locale}
            onTabChange={setPanelTab}
            onOpen={() => setDrawerOpen((value) => !value)}
            onRemove={toggle}
            onSelect={selectNode}
            onGeneratePath={generatePath}
          />
          </div>
        )}
      </main>
    </>
  )
}
