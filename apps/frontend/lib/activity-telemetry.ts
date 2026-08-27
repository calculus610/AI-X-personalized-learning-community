"use client"

export type ActivityContext = { trackId?: string | null; routeStepId?: string | null; lessonId?: number | null; stepId?: number | null }
export type ActivityEvent = ActivityContext & {
  eventId: string; sessionId: string; tabId: string; eventName: string; pagePath: string; clientOccurredAt: string
  componentId?: string | null; actionTarget?: string | null; elementType?: string | null
  normalizedX?: number | null; normalizedY?: number | null; viewportWidth?: number; viewportHeight?: number
  scrollX?: number; scrollY?: number; isVisible: boolean; isFocused: boolean; isIdle: boolean
  activeMs?: number; idleMs?: number; payload?: Record<string, unknown>
}

const OUTBOX_KEY = "personalized-secure:activity-outbox:v1"
let currentContext: ActivityContext = {}

export function setActivityContext(context: ActivityContext) { currentContext = { ...context } }
export function getActivityContext() { return { ...currentContext } }

function apiBase() { return process.env.NEXT_PUBLIC_PERSONALIZED_V2_API_BASE?.replace(/\/$/, "") || "/personalized-secure-api/v1" }
function readOutbox(): ActivityEvent[] {
  try { const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); return Array.isArray(parsed) ? parsed.slice(-2000) : [] } catch { return [] }
}
function writeOutbox(events: ActivityEvent[]) { localStorage.setItem(OUTBOX_KEY, JSON.stringify(events.slice(-2000))) }
export function queueActivityEvent(event: ActivityEvent) { writeOutbox([...readOutbox(), event]) }

export async function flushActivityEvents(token: string, keepalive = false) {
  const events = readOutbox().slice(0, 100)
  if (!events.length) return
  const response = await fetch(`${apiBase()}/activity-events/batch`, {
    method: "POST", keepalive, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  })
  if (!response.ok) throw new Error(`activity_events_failed:${response.status}`)
  const sent = new Set(events.map((event) => event.eventId))
  writeOutbox(readOutbox().filter((event) => !sent.has(event.eventId)))
}
