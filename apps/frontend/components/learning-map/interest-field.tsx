"use client"

import type { CSSProperties } from "react"
import { ArrowRight, Check, CircleCheckBig, LoaderCircle, Pause, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { t, type Locale } from "@/lib/bilingual-ui"
import { interests } from "@/lib/learning-map-data"
import { localizeInterestLabel, localizeText } from "@/lib/localized-learning-content"
import type { InterestLearningState } from "@/lib/personalization-api"
import { cn } from "@/lib/utils"

export function InterestField({
  selected,
  maxSelected,
  learningState,
  stateLoading,
  availableInterestIds,
  masteredInterestIds,
  errorMessage,
  locale,
  onToggle,
  onContinue,
}: {
  selected: string[]
  maxSelected: number
  learningState: InterestLearningState | null
  stateLoading: boolean
  availableInterestIds?: Set<string>
  masteredInterestIds?: Set<string>
  errorMessage?: string
  locale: Locale
  onToggle: (id: string) => void
  onContinue: () => void
}) {
  const selectedItems = interests.filter((interest) => selected.includes(interest.id))
  const progressByInterest = new Map((learningState?.items ?? []).map((item) => [item.interestId, item]))
  const masteredIds = new Set([
    ...(learningState?.masteredInterestIds ?? []),
    ...(masteredInterestIds ?? []),
  ])
  const visibleInterests = interests.filter((interest) =>
    !masteredIds.has(interest.id) && (!availableInterestIds || availableInterestIds.has(interest.id)),
  )
  const masteredItems = interests.filter((interest) => masteredIds.has(interest.id))
  const inProgressIds = new Set([
    ...selected,
    ...(learningState?.items.filter((item) => item.status === "selected" || item.status === "paused").map((item) => item.interestId) ?? []),
  ])
  const inProgressCount = inProgressIds.size

  return (
    <section className="interest-field" aria-label={locale === "zh" ? "选择学习兴趣" : "Choose learning interests"}>
      <div className="intro-copy">
        <p className="eyebrow">{locale === "zh" ? "从兴趣进入课程" : "Start from your interests"}</p>
        <h1>{locale === "zh" ? "把想学的方向，一项项真正打通" : "Turn your interests into a concrete learning route"}</h1>
        <p>
          {locale === "zh"
            ? "选择 1–5 个方向。系统只推荐尚未完成的课程；完成步骤、Quiz 和学习记录后，方向进度会自动更新。"
            : "Choose 1–5 directions. The system only recommends unfinished courses, and progress updates as you complete steps, quizzes and learning records."}
        </p>
      </div>

      <aside className="interest-state-summary" aria-label={locale === "zh" ? "学习方向状态" : "Learning direction status"}>
        <div>
          <span>{locale === "zh" ? "可探索" : "Available"}</span>
          <strong>{visibleInterests.length}</strong>
        </div>
        <div>
          <span>{locale === "zh" ? "学习中" : "In progress"}</span>
          <strong>{inProgressCount}</strong>
        </div>
        <div className="is-mastered">
          <span>{locale === "zh" ? "已打通" : "Mastered"}</span>
          <strong>{masteredItems.length}</strong>
        </div>
        {stateLoading && <small><LoaderCircle />{locale === "zh" ? "正在同步学习记录" : "Syncing learning records"}</small>}
      </aside>

      <div className="bubble-field" aria-label={locale === "zh" ? "兴趣与目标" : "Interests and goals"}>
        {visibleInterests.map((interest) => {
          const originalIndex = interests.findIndex((item) => item.id === interest.id)
          const progress = progressByInterest.get(interest.id)
          const active = selected.includes(interest.id)
          const paused = progress?.status === "paused"
          const disabled = !active && selected.length >= maxSelected
          const progressPercent = progress?.progressPercent ?? 0
          const label = localizeInterestLabel(locale, interest.id, interest.label)
          const style = {
            left: `${interest.x}%`,
            top: `${interest.y}%`,
            animationDelay: `${(originalIndex % 6) * -0.72}s`,
            "--interest-progress": `${progressPercent * 3.6}deg`,
          } as CSSProperties
          return (
            <button
              key={interest.id}
              type="button"
              aria-pressed={active}
              aria-label={`${label}, ${progress?.completedCourseCount ?? 0}/${progress?.totalCourseCount ?? 0} ${locale === "zh" ? "门课程已达标" : "courses completed"}`}
              title={localizeText(locale, interest.summary, label)}
              disabled={disabled}
              onClick={() => onToggle(interest.id)}
              className={cn(
                "interest-bubble",
                active && "is-selected",
                paused && "is-paused",
                progressPercent > 0 && "has-progress",
              )}
              style={style}
            >
              <span className="bubble-status">
                {active ? <Check aria-hidden="true" /> : paused ? <Pause aria-hidden="true" /> : <span />}
              </span>
              <span className="bubble-copy">
                <strong>{label}</strong>
                {progressPercent > 0 && (
                  <small>{progress?.completedCourseCount}/{progress?.totalCourseCount} {locale === "zh" ? "门达标" : "completed"} · {progressPercent}%</small>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {masteredItems.length > 0 && (
        <div className="mastered-interest-dock" aria-label={locale === "zh" ? "已打通方向" : "Mastered directions"}>
          <span><CircleCheckBig />{locale === "zh" ? "已打通" : "Mastered"} {masteredItems.length}</span>
          <div>
            {masteredItems.slice(0, 3).map((item) => <strong key={item.id}>{localizeInterestLabel(locale, item.id, item.label)}</strong>)}
            {masteredItems.length > 3 && <strong>+{masteredItems.length - 3}</strong>}
          </div>
        </div>
      )}

      <div className={cn("selection-tray", selected.length > 0 && "has-selection", errorMessage && "has-error")}>
        <div className="tray-copy">
          <span className="tray-icon"><Sparkles /></span>
          <div>
            <strong>{selected.length ? (locale === "zh" ? `本轮选择 ${selected.length} 个方向` : `${selected.length} directions selected`) : (locale === "zh" ? "选择下一批想学习的方向" : "Choose the next directions to learn")}</strong>
            <small>
              {errorMessage
                ? errorMessage
                : selected.length
                  ? selectedItems.map((item) => localizeInterestLabel(locale, item.id, item.label)).join(" · ")
                  : (locale === "zh" ? "旧路径和已完成课程都会保留，不会因为更换兴趣而清空。" : "Existing routes and completed courses are kept when you change interests.")}
            </small>
          </div>
        </div>
        <Button size="lg" onClick={onContinue} disabled={!selected.length}>
          {locale === "zh" ? "查看课程连接" : "View course connections"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </section>
  )
}
