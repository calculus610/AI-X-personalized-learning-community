"use client"

import { useEffect, useState } from "react"
import { Bot, CheckCircle2, Clock3, FileCheck2, Loader2, RefreshCw, X } from "lucide-react"
import type { Locale } from "@/lib/bilingual-ui"
import { t } from "@/lib/bilingual-ui"
import { getLearningTimeline, trackPersonalizedEvent, type LearningTimelineEvent } from "@/lib/personalization-api"
import { cn } from "@/lib/utils"

function iconFor(source: LearningTimelineEvent["source"]) {
  if (source === "agent") return <Bot />
  if (source === "evidence") return <FileCheck2 />
  return <CheckCircle2 />
}

function formatTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

export function EvidenceChainPanel({
  open,
  locale,
  routeId,
  routeStepId,
  onClose,
}: {
  open: boolean
  locale: Locale
  routeId: string
  routeStepId?: string
  onClose: () => void
}) {
  const [events, setEvents] = useState<LearningTimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function loadTimeline() {
    if (!routeId) return
    setLoading(true)
    setError("")
    try {
      const result = await getLearningTimeline({ routeId, routeStepId, limit: 260 })
      setEvents(result.events)
    } catch (timelineError) {
      setError((timelineError as Error).message || "timeline_load_failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void trackPersonalizedEvent({
      eventType: "timeline_opened",
      routeId,
      routeStepId,
      payload: { scope: routeStepId ? "route_step" : "route" },
    }).catch(() => undefined)
    void loadTimeline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routeId, routeStepId])

  if (!open) return null

  return (
    <aside className="evidence-chain-panel" aria-label={t(locale, "evidenceChain")}>
      <header>
        <div>
          <small>{t(locale, "evidenceChainSubtitle")}</small>
          <h2>{t(locale, "evidenceChain")}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"><X /></button>
      </header>

      <div className="evidence-chain-toolbar">
        <span><Clock3 /> {events.length}</span>
        <button type="button" onClick={() => void loadTimeline()} disabled={loading}>
          {loading ? <Loader2 className="spin" /> : <RefreshCw />}
          {loading ? t(locale, "loading") : t(locale, "refresh")}
        </button>
      </div>

      {error && <p className="evidence-chain-error">{error}</p>}

      {!loading && !events.length ? (
        <p className="evidence-chain-empty">{t(locale, "timelineEmpty")}</p>
      ) : (
        <ol className="evidence-chain-list">
          {events.map((event) => (
            <li key={`${event.source}-${event.id}`} className={cn(`source-${event.source}`)}>
              <span className="timeline-dot">{iconFor(event.source)}</span>
              <div>
                <time>{formatTime(event.occurredAt, locale)}</time>
                <strong>{locale === "zh" ? event.eventLabel : event.eventName.replaceAll("_", " ")}</strong>
                {event.title && <small>{event.title}</small>}
                {event.detail && <p>{event.detail}</p>}
                {event.stepId && <em>Step {event.stepId}</em>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
