import data from "./original-course-executor-data.json"
import type { OriginalLessonDetail, OriginalLessonResource } from "./course-executor-contract"
import { withAppBasePath } from "./app-path"

const database = data as { source: string; lessons: OriginalLessonDetail[] }

function normalizeResourceUrl(resource: OriginalLessonResource) {
  const url = resource.url
  if (!url || url === "#") return null
  if (url.startsWith("/course-assets/github/")) {
    return withAppBasePath(`/original-course-assets/${url.slice("/course-assets/github/".length)}`)
  }
  if (url.startsWith("/course-assets/")) {
    return withAppBasePath(`/original-course-assets/${url.slice("/course-assets/".length)}`)
  }
  return url.startsWith("/") || /^https?:\/\//i.test(url) ? url : null
}

export function getOriginalLesson(lessonId: number): OriginalLessonDetail | null {
  const lesson = database.lessons.find((item) => item.id === lessonId)
  if (!lesson) return null
  return {
    ...lesson,
    resources: lesson.resources
      .map((resource) => ({ ...resource, url: normalizeResourceUrl(resource) ?? "" }))
      .filter((resource) => Boolean(resource.url)),
  }
}

export function getOriginalCourseStats() {
  return {
    source: database.source,
    lessonCount: database.lessons.length,
    stepCount: database.lessons.reduce((total, lesson) => total + lesson.steps.length, 0),
  }
}
