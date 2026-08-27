"use client"

import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Database,
  FolderKanban,
  Network,
  Route,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { courses, interests, type CourseTopic, type KnowledgeNode } from "@/lib/learning-map-data"
import { buildPersonalizedRoute, recommendationReason, typeLabels } from "@/lib/learning-map-utils"
import { t, type Locale } from "@/lib/bilingual-ui"
import {
  localizeInterestLabel,
  localizeKnowledgeNode,
  localizeRouteStep,
  localizeText,
} from "@/lib/localized-learning-content"
import { cn } from "@/lib/utils"

export type PanelTab = "overview" | "node" | "path"

function cleanResourceTitle(title: string) {
  return title
    .replace(/^Day\s*\d+(?:\s*[–-]\s*\d+)?\s*/i, "")
    .replace(/^Phase\s*\d+\s*/i, "")
    .trim()
}

function displayCourse(locale: Locale, course: CourseTopic) {
  const routeLike = {
    id: course.id,
    kind: "course" as const,
    sourceId: course.id,
    courseId: Object.entries({
      "phase1_day1": "model-evaluation",
      "phase1_day2": "agent-handoff",
      "phase1_day3": "desktop-agent",
      "phase1_day4": "device-gateway",
      "phase2_day1": "ai-cad",
      "phase2_day2": "blender-automation",
      "phase2_day3": "laser-uv",
      "phase2_day4": "cam-toolpath",
      "phase2_day5": "manufacturing-quality",
      "phase3_day1": "electronics-basics",
      "phase3_day2": "sensors-oled",
      "phase3_day3": "edge-sensor-fusion",
      "phase3_day4": "ultrasonic-decision",
      "phase3_day5": "camera-vision",
      "phase3_day6": "audio-edge-ai",
      "phase4_day1": "audio-control",
      "phase4_day2": "edge-ai-training",
      "phase4_day3": "multimodal-edge-ai",
      "phase4_day4": "touch-interface",
      "phase4_day5": "multi-actuator",
      "phase4_day6": "ai-device-linkage",
      "phase4_day7": "build-smart-car",
    }).find(([, legacyId]) => legacyId === course.id)?.[0],
    title: course.title,
    description: course.description,
    outcome: course.module,
    interests: course.interests,
    matchedInterestIds: course.interests,
    recommendationReason: "",
    resources: course.resources,
    lessonId: course.lessonId,
    phaseNumber: course.phaseNumber,
    knowledgeNodeIds: course.knowledgeNodeIds,
    focus: "lesson" as const,
    course,
  }
  return localizeRouteStep(locale, routeLike)
}

function CourseCard({
  course,
  reason,
  locale,
  onOpen,
}: {
  course: CourseTopic
  reason: string
  locale: Locale
  onOpen: () => void
}) {
  const display = displayCourse(locale, course)
  return (
    <article className="course-card">
      <button type="button" className="course-card-main" onClick={onOpen}>
        <div className="course-card-top">
          <span><Database />{locale === "zh" ? "原平台已有内容" : "Original-platform content"}</span>
          <span>{course.resources.length} {locale === "zh" ? "份学习资源" : "resources"}</span>
        </div>
        <h4>{display.title}</h4>
        <p>{localizeText(locale, reason, "Recommended because it connects to your selected learning goals.")}</p>
        <div className="course-step-preview">
          {course.resources.slice(0, 2).map((resource, index) => (
            <span key={resource.url}><b>{index + 1}</b>{localizeText(locale, cleanResourceTitle(resource.title), `Resource ${index + 1}`)}</span>
          ))}
          {course.resources.length > 2 && <small>+{course.resources.length - 2} {locale === "zh" ? "份原平台资源" : "more resources"}</small>}
        </div>
        <span className="course-outcome">{display.description}</span>
      </button>
      <div className="course-card-footer course-card-in-route">
        <span><Route />{locale === "zh" ? "生成后自动排入你的学习路径" : "Added to your learning route after generation"}</span>
        <ArrowRight />
      </div>
    </article>
  )
}

export function DetailPanel({
  selected,
  visibleNodes,
  current,
  open,
  activeTab,
  locale,
  onTabChange,
  onOpen,
  onRemove,
  onSelect,
  onGeneratePath,
}: {
  selected: string[]
  visibleNodes: KnowledgeNode[]
  current?: KnowledgeNode
  open: boolean
  activeTab: PanelTab
  locale: Locale
  onTabChange: (tab: PanelTab) => void
  onOpen: () => void
  onRemove: (id: string) => void
  onSelect: (node: KnowledgeNode) => void
  onGeneratePath: () => void
}) {
  const displayNodes = visibleNodes.map((node) => localizeKnowledgeNode(locale, node))
  const displayCurrent = current ? localizeKnowledgeNode(locale, current) : undefined
  const courseNodes = visibleNodes.filter((node) => node.type === "course")
  const matchedCourses = courseNodes
    .map((node) => courses.find((course) => course.id === node.id))
    .filter((course): course is CourseTopic => Boolean(course))
  const currentCourses = current
    ? courses.filter((course) => current.relatedCourseIds.includes(course.id))
    : []
  const conceptCount = visibleNodes.filter((node) => node.type === "knowledge" || node.type === "ability").length
  const routePreview = buildPersonalizedRoute(selected).map((step) => localizeRouteStep(locale, step))
  const projectCount = routePreview.filter((step) => step.kind === "project").length

  function openCourse(course: CourseTopic) {
    const node = visibleNodes.find((item) => item.id === course.id)
    if (node) onSelect(node)
  }

  return (
    <aside className={cn("detail-panel", open && "is-open")} aria-label={locale === "zh" ? "我的个性化课程" : "My personalized course"}>
      <button className="drawer-handle" type="button" onClick={onOpen} aria-expanded={open}>
        <span />
        <b>{locale === "zh" ? "查看我的个性化课程" : "View my personalized course"}</b>
        <ChevronDown />
      </button>

      <header className="panel-header">
        <div>
          <p className="eyebrow">Personal route</p>
          <h2>{locale === "zh" ? "我的个性化课程" : "My personalized course"}</h2>
        </div>
        <div className="map-mark"><Route /></div>
      </header>

      <nav className="panel-tabs" aria-label={locale === "zh" ? "个性化课程视图" : "Personalized course views"}>
        <button type="button" className={activeTab === "overview" ? "active" : ""} onClick={() => onTabChange("overview")}>{locale === "zh" ? "概览" : "Overview"}</button>
        <button type="button" className={activeTab === "node" ? "active" : ""} onClick={() => onTabChange("node")}>{locale === "zh" ? "节点详情" : "Node details"}</button>
        <button type="button" className={activeTab === "path" ? "active" : ""} onClick={() => onTabChange("path")}>{locale === "zh" ? "路径预览" : "Route preview"}</button>
      </nav>

      <div className="panel-content">
        {activeTab === "overview" && (
          <>
            <div className="metrics">
              <div><strong>{selected.length}</strong><span>{locale === "zh" ? "你的选择" : "Choices"}</span></div>
              <div><strong>{conceptCount}</strong><span>{locale === "zh" ? "知识连接" : "Connections"}</span></div>
              <div><strong>{matchedCourses.length}</strong><span>{locale === "zh" ? "匹配内容" : "Matches"}</span></div>
            </div>

            <section className="panel-section">
              <div className="section-title"><h3>{locale === "zh" ? "当前方向" : "Current directions"}</h3><span>{selected.length}</span></div>
              <div className="selection-list">
                {selected.map((id) => (
                  <button key={id} type="button" onClick={() => onRemove(id)}>
                    {localizeInterestLabel(locale, id, interests.find((item) => item.id === id)?.label)}
                    <X />
                  </button>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <div className="section-title">
                <div>
                  <h3>{locale === "zh" ? "优先匹配" : "Priority matches"}</h3>
                  <p>{locale === "zh" ? "全部来自原平台，生成后会自动排成连续步骤。" : "All content comes from the original platform and will be arranged into continuous steps."}</p>
                </div>
                <span>{matchedCourses.length}</span>
              </div>
              <div className="course-list">
                {matchedCourses.slice(0, 3).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    locale={locale}
                    reason={recommendationReason(visibleNodes.find((node) => node.id === course.id)!, selected)}
                    onOpen={() => openCourse(course)}
                  />
                ))}
              </div>
            </section>

            <section className="panel-section map-principle">
              <Network />
              <div>
                <strong>{locale === "zh" ? "个性化的是学习顺序与项目组合" : "Personalization changes the order and project mix"}</strong>
                <p>{locale === "zh" ? "系统从原平台挑选与你相关的课程和项目，排成一条可以连续完成的学习路线。" : "The system selects relevant original-platform courses and projects, then arranges them into a route you can complete."}</p>
              </div>
            </section>
          </>
        )}

        {activeTab === "node" && (
          displayCurrent ? (
            <section className="panel-section current-detail">
              <div className="node-detail-heading">
                <span className={cn("node-type-badge", `is-${displayCurrent.type}`)}>{locale === "zh" ? typeLabels[displayCurrent.type] : displayCurrent.type}</span>
                <h3>{displayCurrent.label}</h3>
                <p>{displayCurrent.description}</p>
              </div>

              <div className="detail-reason">
                <Sparkles />
                <p><strong>{locale === "zh" ? "为什么会出现在这里？" : "Why is this here?"}</strong>{localizeText(locale, recommendationReason(current!, selected), "It connects to your selected interests and route goals.")}</p>
              </div>

              {currentCourses.length > 0 && (
                <>
                  <div className="section-title">
                    <h3>{displayCurrent.type === "course" ? (locale === "zh" ? "它会成为一个学习步骤" : "It becomes a learning step") : (locale === "zh" ? "它映射到这些原平台内容" : "It maps to these original-platform items")}</h3>
                    <span>{currentCourses.length}</span>
                  </div>
                  <div className="course-list">
                    {currentCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        locale={locale}
                        reason={displayCurrent.type === "course"
                          ? displayCourse(locale, course).description
                          : localizeText(locale, `知识节点「${displayCurrent.label}」与这部分原平台内容直接关联。`, "This knowledge node is directly connected to the original-platform content.")}
                        onOpen={() => openCourse(course)}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : (
            <div className="empty-state">
              <div className="empty-orbit"><Network /></div>
              <h3>{locale === "zh" ? "点一个节点看看" : "Select a node to inspect it"}</h3>
              <p>{locale === "zh" ? "这里会显示知识点与原平台课程、项目之间的真实映射。" : "This panel shows how knowledge nodes map to original-platform courses and projects."}</p>
            </div>
          )
        )}

        {activeTab === "path" && (
          <section className="panel-section path-preview-section">
            <div className="path-heading">
              <span className="path-spark"><Sparkles /></span>
              <div>
                <h3>{locale === "zh" ? "已经为你排好完整路线" : "Your complete route is ready"}</h3>
                <p>{routePreview.length - projectCount} {locale === "zh" ? "个学习内容与" : "learning items and"} {projectCount} {locale === "zh" ? "个实践项目会在同一页面连续进行。" : "projects will run continuously on one page."}</p>
              </div>
            </div>

            <ol className="compact-route-preview">
              {routePreview.map((step, index) => (
                <li key={step.id}>
                  <span>{index + 1}</span>
                  <div>
                    <small>{step.kind === "project" ? t(locale, "project") : t(locale, "learningContent")}</small>
                    <strong>{step.title}</strong>
                  </div>
                  {step.kind === "project" ? <FolderKanban /> : <BookOpen />}
                </li>
              ))}
            </ol>

            <Button size="lg" onClick={onGeneratePath}>
              <Route data-icon="inline-start" />
              {locale === "zh" ? "打开我的学习路径" : "Open my learning route"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </section>
        )}
      </div>

      <footer className="panel-footer">
        <Database />
        <span>{locale === "zh" ? "内容来源：原学习平台课程、实验说明与项目资源；当前页面只负责个性化组合。" : "Source: original-platform courses, lab instructions and project resources. This page only personalizes the combination."}</span>
      </footer>
    </aside>
  )
}
