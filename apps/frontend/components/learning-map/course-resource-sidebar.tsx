import { useMemo } from "react"
import { BookOpen, ExternalLink, FileText } from "lucide-react"
import type { OriginalLessonResource } from "@/lib/course-executor-contract"
import type { Locale } from "@/lib/bilingual-ui"

export function CourseResourceSidebar({ resources, onOpen, locale }: {
  resources: OriginalLessonResource[]
  onOpen: (resource: OriginalLessonResource) => Promise<void>
  locale: Locale
}) {
  const grouped = useMemo(() => resources.filter((resource) => resource.availability === "MIGRATED_OBJECT"), [resources])

  async function openResource(resource: OriginalLessonResource) {
    await onOpen(resource)
  }

  return (
    <aside className="course-resource-sidebar" aria-label={locale === "en" ? "Current course resources" : "当前课程资源"}>
      <section className="course-sidebar-card course-files-card">
        <header><BookOpen /><div><small>{locale === "en" ? "Current course" : "当前课程"}</small><h2>{locale === "en" ? "Course resources" : "课程资源"}</h2></div><span>{resources.length}</span></header>
        {grouped.length === 0 && <div className="course-sidebar-state">{locale === "en" ? "No migrated resources are linked to this course yet." : "当前课程暂未绑定已迁移的资源。"}</div>}
        <div className="bound-resource-list">
          {grouped.map((resource) => (
            <button key={resource.id} type="button" onClick={() => void openResource(resource)}>
              <span>{resource.type === "html" ? <BookOpen /> : <FileText />}</span>
              <div><small>{resource.type.toUpperCase()}</small><strong>{resource.title}</strong>{resource.description && <p>{resource.description}</p>}</div>
              <ExternalLink />
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}
