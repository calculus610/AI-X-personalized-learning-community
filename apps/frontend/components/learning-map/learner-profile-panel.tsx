"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  Loader2,
  Network,
  Target,
  UserRound,
  X,
} from "lucide-react"
import { interests } from "@/lib/learning-map-data"
import type { LearnerProfileView } from "@/lib/learner-profile-contract"
import { getLearnerProfile } from "@/lib/personalization-api"

function RadarChart({ dimensions }: { dimensions: LearnerProfileView["dimensions"] }) {
  const center = { x: 180, y: 160 }
  const radius = 98
  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + index * (Math.PI / 3)
    return `${center.x + Math.cos(angle) * radius * ratio},${center.y + Math.sin(angle) * radius * ratio}`
  }
  const labelPoint = (index: number) => {
    const angle = -Math.PI / 2 + index * (Math.PI / 3)
    return { x: center.x + Math.cos(angle) * 135, y: center.y + Math.sin(angle) * 135 }
  }
  const normalized = Array.from({ length: 6 }, (_, index) => dimensions[index]?.score ?? 0)
  return (
    <div className="profile-radar-wrap">
      <svg className="profile-radar" viewBox="0 0 360 320" role="img" aria-label="六维能力雷达图">
        <defs>
          <linearGradient id="profile-radar-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5D34D0" stopOpacity=".66" />
            <stop offset=".55" stopColor="#FF006E" stopOpacity=".34" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity=".58" />
          </linearGradient>
        </defs>
        {[.2, .4, .6, .8, 1].map((ratio) => (
          <polygon key={ratio} className="profile-radar-grid" points={Array.from({ length: 6 }, (_, index) => point(index, ratio)).join(" ")} />
        ))}
        {Array.from({ length: 6 }, (_, index) => {
          const [x2, y2] = point(index, 1).split(",")
          return <line key={index} className="profile-radar-axis" x1={center.x} y1={center.y} x2={x2} y2={y2} />
        })}
        <polygon className="profile-radar-area" points={normalized.map((score, index) => point(index, Number(score) / 100)).join(" ")} />
        {normalized.map((score, index) => {
          const [cx, cy] = point(index, Number(score) / 100).split(",")
          return <circle key={index} className="profile-radar-point" cx={cx} cy={cy} r="4.5" />
        })}
        {Array.from({ length: 6 }, (_, index) => {
          const label = labelPoint(index)
          const anchor = label.x < center.x - 8 ? "end" : label.x > center.x + 8 ? "start" : "middle"
          return <text key={index} x={label.x} y={label.y} textAnchor={anchor}>{dimensions[index]?.label ?? "待测维度"}</text>
        })}
      </svg>
    </div>
  )
}

export function LearnerProfilePanel({
  userId,
  selectedInterestIds,
  open,
  onOpenChange,
}: {
  userId: string
  selectedInterestIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [profile, setProfile] = useState<LearnerProfileView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!userId || !open) return
    setLoading(true)
    setError("")
    getLearnerProfile()
      .then(setProfile)
      .catch(() => setError("画像暂时无法读取，请稍后重试。"))
      .finally(() => setLoading(false))
  }, [userId, open])

  const interestLabels = useMemo(() => interests
    .filter((item) => selectedInterestIds.includes(item.id) || profile?.selectedInterestIds.includes(item.id))
    .map((item) => item.label), [profile, selectedInterestIds])

  if (!open) return null
  const evidence = profile?.evidenceSummary ?? { completedCourseSteps: 0, checkedItems: 0, evidenceFiles: 0, quizAttempts: 0 }
  const dimensions = profile?.dimensions ?? []
  const interactions = profile?.interactionSummary ?? { total: 0, agentInteractions: 0, helpRequests: 0, stepCompletions: 0, evidenceUploads: 0 }

  return (
    <div className="learner-profile-backdrop" role="dialog" aria-modal="true" aria-labelledby="learner-profile-title">
      <section className="learner-profile-panel profile-dashboard-panel">
        <header>
          <span><UserRound /></span>
          <div>
            <small>基于课程、Step、证据、Agent 和 Quiz 记录</small>
            <h1 id="learner-profile-title">我的学习画像</h1>
            <p>这张画像只使用已经发生的学习证据，不把提问本身当成能力分数。</p>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭学习者画像"><X /></button>
        </header>

        {loading ? (
          <div className="profile-loading"><Loader2 className="spin" />正在读取你的学习记录…</div>
        ) : error ? (
          <div className="profile-loading"><p className="profile-error">{error}</p></div>
        ) : (
          <div className="profile-dashboard-body">
            <section className="profile-dashboard-main">
              <div className="profile-identity-card profile-dashboard-hero">
                <small>当前学习者</small>
                <div className="profile-hero-row">
                  <div>
                    <h2>{profile?.displayName ?? "当前用户"}</h2>
                    <p>{profile?.profileLevel ?? "初始状态"} · {profile?.averageQuizScore === null || profile?.averageQuizScore === undefined ? "完成 Quiz 后形成能力证据" : `Quiz 平均 ${profile.averageQuizScore} 分`}</p>
                  </div>
                  <div className="profile-score-ring"><strong>{profile?.averageQuizScore ?? "—"}</strong><small>Quiz 平均</small></div>
                </div>
              </div>

              <section className="profile-dashboard-card">
                <header><Network /><div><small>当前学习方向</small><strong>兴趣与路径起点</strong></div></header>
                <div className="profile-interest-cluster profile-dashboard-interests">
                  {interestLabels.length ? interestLabels.map((label) => <span key={label}>{label}</span>) : <p>还没有记录兴趣方向。</p>}
                </div>
              </section>

              <section className="profile-dashboard-card">
                <header><Target /><div><small>六维能力画像</small><strong>按 Quiz 证据累计平均</strong></div></header>
                <RadarChart dimensions={dimensions} />
                <div className="profile-dimension-list">
                  {dimensions.map((dimension) => (
                    <div className="profile-dimension" key={dimension.id}>
                      <div><span>{dimension.label}</span><strong>{dimension.score === null ? "待测" : `${dimension.score}分`}</strong></div>
                      <i><b style={{ width: `${dimension.score ?? 0}%` }} /></i>
                      <small>{dimension.status === "unmeasured" ? "暂无答题证据" : dimension.status === "low_confidence" ? `${dimension.evidenceCount} 条证据 · 低置信度` : `${dimension.evidenceCount} 条答题证据`}</small>
                    </div>
                  ))}
                </div>
              </section>
            </section>

            <aside className="profile-dashboard-side">
              <section className="profile-dashboard-card profile-summary-card">
                <header><Activity /><div><small>当前真实数据</small><strong>学习证据摘要</strong></div></header>
                <div className="profile-summary-grid">
                  <span><strong>{evidence.quizAttempts}</strong><small>已提交 Quiz</small></span>
                  <span><strong>{profile?.averageQuizScore ?? "—"}</strong><small>Quiz 平均分</small></span>
                  <span><strong>{profile?.weakKnowledgePoints.length ?? 0}</strong><small>薄弱知识点</small></span>
                  <span><strong>{interactions.total}</strong><small>学习事件</small></span>
                  <span><strong>{evidence.evidenceFiles}</strong><small>证据记录</small></span>
                  <span><strong>{interactions.agentInteractions + interactions.helpRequests}</strong><small>协作与求助</small></span>
                </div>
              </section>

              <section className="profile-dashboard-card profile-mastery-card">
                <header><BookOpenCheck /><div><small>随 Quiz 持续更新</small><strong>薄弱知识点</strong></div></header>
                {profile?.weakKnowledgePoints.length ? (
                  <div>{profile.weakKnowledgePoints.map((item) => <span key={item.knowledgePointId}><label>{item.knowledgePointLabel}<small>{Math.round(item.score * 100)}%</small></label><i><b style={{ width: `${Math.round(item.score * 100)}%` }} /></i></span>)}</div>
                ) : <p><CheckCircle2 />{profile?.mastery.length ? "当前没有低于 60% 的知识点。" : "完成第一项 Quiz 后，知识点掌握度会出现在这里。"}</p>}
              </section>

              <section className="profile-dashboard-card profile-recommendation-card">
                <header><Target /><div><small>系统建议</small><strong>下一步怎么学</strong></div></header>
                <ul>{(profile?.recommendations ?? ["完成一次 Quiz 后，系统会开始生成学习建议。"]).map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}
