"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { Archive, Check, ChevronRight, History, Loader2, LogOut, Plus, RotateCcw } from "lucide-react"

type Course = { id: string; title: string; summary: string; module_id: string; content_version: number; tags: Array<{ type: string; value: string }> }
type Module = { id: string; name: string; description: string; color: string; courses: Course[] }
type Track = { id: string; title: string; status: string; progressPercent: number; completedCount: number; totalCount: number }
type PathNode = { id: string; course_id: string; title_snapshot: string; module_id: string; status: "LOCKED" | "AVAILABLE" | "COMPLETED"; learning_level: number }
type TrackDetail = { track: Track; targets: Array<{ id: string; title: string }>; modules: Array<{ id: string; name: string; description: string; color: string; courses: PathNode[] }> }
type HistoryCourse = { id: string; title: string; completed_at: string; content_version: number }

const apiBase = () => process.env.NEXT_PUBLIC_PERSONALIZED_V2_API_BASE?.replace(/\/$/, "") || "/personalized-v2/api/v1"

export function MysqlLearningPlatform({ token, userLabel, onLogout }: { token: string; userLabel: string; onLogout: () => void }) {
  const [catalog, setCatalog] = useState<Module[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [history, setHistory] = useState<HistoryCourse[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [current, setCurrent] = useState<TrackDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [largePlan, setLargePlan] = useState<{ todoCount: number } | null>(null)

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const failure = new Error(String(body.error || `请求失败：${response.status}`)) as Error & { body?: Record<string, unknown> }
      failure.body = body
      throw failure
    }
    return body as T
  }, [token])

  const load = useCallback(async (trackId?: string) => {
    setLoading(true); setError("")
    try {
      const [catalogResult, trackResult, historyResult] = await Promise.all([
        request<{ modules: Module[] }>("/catalog"), request<{ tracks: Track[] }>("/tracks"), request<{ courses: HistoryCourse[] }>("/history"),
      ])
      setCatalog(catalogResult.modules); setTracks(trackResult.tracks); setHistory(historyResult.courses)
      const nextTrackId = trackId ?? trackResult.tracks[0]?.id
      if (nextTrackId) setCurrent(await request<TrackDetail>(`/tracks/${nextTrackId}`)); else setCurrent(null)
    } catch (failure) { setError((failure as Error).message) } finally { setLoading(false) }
  }, [request])

  useEffect(() => { void load() }, [load])
  const courseById = useMemo(() => new Map(catalog.flatMap((module) => module.courses).map((course) => [course.id, course])), [catalog])

  function toggle(courseId: string) {
    setSelected((currentSelection) => currentSelection.includes(courseId)
      ? currentSelection.filter((id) => id !== courseId)
      : currentSelection.length < 5 ? [...currentSelection, courseId] : currentSelection)
  }

  async function createTrack(confirmLargePlan = false) {
    if (!selected.length || creating) return
    setCreating(true); setError("")
    try {
      const result = await request<{ track: Track }>("/tracks", { method: "POST", body: JSON.stringify({ targetCourseIds: selected, confirmLargePlan }) })
      setSelected([]); setLargePlan(null); await load(result.track.id)
    } catch (failure) {
      const error = failure as Error & { body?: Record<string, unknown> }
      if (error.message === "LARGE_PLAN_CONFIRMATION_REQUIRED") setLargePlan({ todoCount: Number(error.body?.todoCount ?? 0) })
      else setError(error.message)
    } finally { setCreating(false) }
  }

  async function complete(courseId: string) { await request(`/courses/${courseId}/complete`, { method: "POST" }); await load(current?.track.id) }
  async function revoke(courseId: string) { await request(`/courses/${courseId}/revoke-completion`, { method: "POST" }); await load(current?.track.id) }
  async function archive() { if (!current) return; await request(`/tracks/${current.track.id}/archive`, { method: "POST" }); setSelected([]); await load() }

  return (
    <main className="mysql-learning-platform">
      <header className="mysql-topbar">
        <div><small>MYSQL-DRIVEN LEARNING DEMO</small><strong>从目标到路径</strong></div>
        <div><span>{userLabel}</span><button type="button" onClick={onLogout}><LogOut />退出登录</button></div>
      </header>

      {error && <p className="mysql-error" role="alert">{error}</p>}
      {loading ? <div className="mysql-loading"><Loader2 className="spin" />正在从课程数据库读取数据…</div> : (
        <div className="mysql-layout">
          <section className="mysql-catalog">
            <header><div><small>课程目录</small><h1>选择你想完成的目标</h1><p>所有课程和前置关系均由 MySQL 返回；已完成课程不会再次出现在这里。</p></div><span>{selected.length} / 5</span></header>
            {catalog.map((module) => <section key={module.id} className="mysql-module" style={{ "--module-color": module.color } as CSSProperties}>
              <header><div><h2>{module.name}</h2><p>{module.description}</p></div><span>{module.courses.length} 门可选</span></header>
              <div className="mysql-course-grid">{module.courses.map((course) => {
                const isSelected = selected.includes(course.id)
                return <button key={course.id} type="button" className={isSelected ? "selected" : ""} onClick={() => toggle(course.id)}>
                  <span>{isSelected ? <Check /> : <Plus />}</span><strong>{course.title}</strong><small>{course.summary}</small>
                </button>
              })}</div>
            </section>)}
            <footer className="mysql-selection-bar">
              <div>{selected.length ? selected.map((id) => <span key={id}>{courseById.get(id)?.title}</span>) : "尚未选择目标课程"}</div>
              <button type="button" disabled={!selected.length || creating} onClick={() => void createTrack()}>{creating ? <Loader2 className="spin" /> : <ChevronRight />}生成学习路径</button>
            </footer>
            {largePlan && <section className="mysql-warning"><strong>这个计划包含 {largePlan.todoCount} 门待学课程。</strong><p>系统没有截断任何必修前置课程。你可以拆分目标，或确认继续。</p><button type="button" onClick={() => void createTrack(true)}>确认生成完整路径</button></section>}
          </section>

          <aside className="mysql-side">
            <section className="mysql-tracks"><header><div><small>我的学习计划</small><h2>进行中的计划</h2></div></header>
              {tracks.length ? tracks.map((track) => <button key={track.id} type="button" className={current?.track.id === track.id ? "active" : ""} onClick={() => void load(track.id)}><strong>{track.title}</strong><small>{track.completedCount} / {track.totalCount} · {track.progressPercent}%</small><i><b style={{ width: `${track.progressPercent}%` }} /></i></button>) : <p>选择课程后，第一份学习计划会出现在这里。</p>}
            </section>
            {current && <section className="mysql-path"><header><div><small>当前路径</small><h2>{current.track.title}</h2></div><button type="button" onClick={() => void archive()}><Archive />放弃并归档</button></header>
              <p className="mysql-targets">目标：{current.targets.map((target) => target.title).join("、")}</p>
              {current.modules.map((module) => module.courses.length > 0 && <section key={module.id}><h3>{module.name}</h3>{module.courses.map((node) => <article key={node.id} className={node.status.toLowerCase()}><div><small>{node.status === "COMPLETED" ? "已完成" : node.status === "AVAILABLE" ? "现在可学习" : "等待前置课程"}</small><strong>{node.title_snapshot}</strong></div>{node.status === "AVAILABLE" && <button type="button" onClick={() => void complete(node.course_id)}>确认完成</button>}{node.status === "COMPLETED" && <button type="button" onClick={() => void revoke(node.course_id)}><RotateCcw />撤销</button>}</article>)}</section>)}
            </section>}
            <section className="mysql-history"><header><History /><h2>学习历史</h2></header>{history.length ? history.map((course) => <span key={course.id}><Check />{course.title}</span>) : <p>完成的课程会保存在这里。</p>}</section>
          </aside>
        </div>
      )}
    </main>
  )
}
