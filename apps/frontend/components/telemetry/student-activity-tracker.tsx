"use client"

import { useEffect } from "react"
import { flushActivityEvents, getActivityContext, queueActivityEvent, type ActivityEvent } from "@/lib/activity-telemetry"

const IDLE_AFTER_MS = 90_000
const HEARTBEAT_MS = 15_000

function isExtensionElement(element: Element | null) {
  if (!element) return false
  const tag = element.tagName.toLowerCase()
  return tag.includes("grammarly") || tag.includes("1password") || tag.includes("lastpass")
    || Boolean(element.closest("[data-grammarly-part],[data-extension-id],[id^='wpaicg'],[class*='write-with-ai']"))
}

function id(key: string) {
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const next = crypto.randomUUID(); sessionStorage.setItem(key, next); return next
}

export function StudentActivityTracker({ token }: { token: string }) {
  useEffect(() => {
    const sessionId = id("personalized-secure:activity-session")
    const tabId = id("personalized-secure:tab-id")
    const startedAt = Date.now()
    let idleStartedAt: number | null = null
    let idleTotal = 0
    let idleTimer = 0
    let flushing = false

    const emit = (eventName: string, extra: Partial<ActivityEvent> = {}, keepalive = false) => {
      const now = Date.now()
      const currentIdle = idleStartedAt ? now - idleStartedAt : 0
      queueActivityEvent({
        eventId: crypto.randomUUID(), sessionId, tabId, eventName, pagePath: location.pathname,
        clientOccurredAt: new Date(now).toISOString(), isVisible: document.visibilityState === "visible",
        isFocused: document.hasFocus(), isIdle: idleStartedAt !== null,
        activeMs: Math.max(0, now - startedAt - idleTotal - currentIdle), idleMs: idleTotal + currentIdle,
        ...getActivityContext(), ...extra,
      })
      if (!flushing) {
        flushing = true
        void flushActivityEvents(token, keepalive).catch(() => undefined).finally(() => { flushing = false })
      }
    }
    const beginIdle = () => { if (!idleStartedAt) { idleStartedAt = Date.now(); emit("idle_started") } }
    const resetIdle = () => {
      if (idleStartedAt) { idleTotal += Date.now() - idleStartedAt; idleStartedAt = null; emit("idle_ended") }
      clearTimeout(idleTimer); idleTimer = window.setTimeout(beginIdle, IDLE_AFTER_MS)
    }
    const click = (event: MouseEvent) => {
      resetIdle()
      const source = event.target instanceof Element ? event.target : null
      if (isExtensionElement(source)) return
      const target = source?.closest("[data-track-id],button,a,input,select,textarea,[role]") as HTMLElement | null
      const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight)
      emit("click", {
        componentId: target?.closest<HTMLElement>("[data-component-id]")?.dataset.componentId || null,
        actionTarget: target?.dataset.trackId || target?.getAttribute("aria-label")?.slice(0,128) || target?.getAttribute("name")?.slice(0,128) || null,
        elementType: target?.tagName.toLowerCase() || source?.tagName.toLowerCase() || null,
        normalizedX: Math.max(0, Math.min(1, event.clientX / width)), normalizedY: Math.max(0, Math.min(1, event.clientY / height)),
        viewportWidth: width, viewportHeight: height, scrollX: Math.round(scrollX), scrollY: Math.round(scrollY),
      })
    }
    const activity = () => resetIdle()
    const visibility = () => emit("visibility_changed", { payload: { state: document.visibilityState } }, true)
    const focus = () => { resetIdle(); emit("window_focused") }
    const blur = () => emit("window_blurred", {}, true)
    const pagehide = () => emit("session_ended", {}, true)
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus() && !idleStartedAt) emit("heartbeat")
    }, HEARTBEAT_MS)

    emit("session_started")
    emit("page_entered")
    resetIdle()
    document.addEventListener("click", click, true)
    for (const name of ["mousemove", "keydown", "touchstart"] as const) document.addEventListener(name, activity, { passive: true })
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("focus", focus); window.addEventListener("blur", blur); window.addEventListener("pagehide", pagehide)
    window.addEventListener("online", () => void flushActivityEvents(token).catch(() => undefined))
    return () => {
      emit("page_left", {}, true); clearInterval(heartbeat); clearTimeout(idleTimer)
      document.removeEventListener("click", click, true)
      for (const name of ["mousemove", "keydown", "touchstart"] as const) document.removeEventListener(name, activity)
      document.removeEventListener("visibilitychange", visibility)
      window.removeEventListener("focus", focus); window.removeEventListener("blur", blur); window.removeEventListener("pagehide", pagehide)
    }
  }, [token])
  return null
}
