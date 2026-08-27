const base = (process.env.SECURE_API_BASE || "http://127.0.0.1:3400").replace(/\/$/, "")
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const password = `verify-${suffix}`

async function request(path, options = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, options)
  const contentType = response.headers.get("content-type") || ""
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.arrayBuffer()
  if (response.status !== expected) {
    throw new Error(`${options.method || "GET"} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(body)}`)
  }
  return body
}

async function register(label) {
  return request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `isolation-${label}-${suffix}`,
      displayName: `Isolation ${label}`,
      password,
    }),
  }, 201)
}

const [a, b] = await Promise.all([register("a"), register("b")])
const auth = (token, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
})

const catalog = await request("/v1/catalog", { headers: auth(a.accessToken) })
const target = catalog.modules.flatMap((module) => module.courses)[0]
if (!target?.id) throw new Error("catalog has no selectable target")

const created = await request("/v1/tracks", {
  method: "POST",
  headers: auth(a.accessToken, true),
  body: JSON.stringify({ targetCourseIds: [target.id] }),
}, 201)
const trackId = created.track.id
const detail = await request(`/v1/tracks/${trackId}`, { headers: auth(a.accessToken) })
const node = detail.modules.flatMap((module) => module.courses)[0]
if (!node?.id) throw new Error("created track has no route node")

await request(`/v1/tracks/${trackId}`, { headers: auth(b.accessToken) }, 404)
await request(`/v1/progress/${trackId}`, {
  method: "PATCH",
  headers: auth(a.accessToken, true),
  body: JSON.stringify({ learnerId: b.user.id, activeStepIndex: 0, completedStepIds: [] }),
})
await request(`/v1/progress/${trackId}`, { headers: auth(a.accessToken) })
await request(`/v1/progress/${trackId}`, { headers: auth(b.accessToken) }, 404)

const nodeProgressPath = `/v1/tracks/${trackId}/nodes/${node.id}/progress`
await request(nodeProgressPath, {
  method: "PATCH",
  headers: auth(a.accessToken, true),
  body: JSON.stringify({
    learnerId: b.user.id,
    lessonId: node.lesson_id,
    supportMode: "guided",
    activeCourseStepIndex: 0,
    completedCourseStepIds: [],
    checklistByStep: {},
    stuckStepIds: [],
  }),
})
await request(nodeProgressPath, { headers: auth(a.accessToken) })
await request(nodeProgressPath, { headers: auth(b.accessToken) }, 404)

await request("/v1/profile/me", {
  method: "PATCH",
  headers: auth(a.accessToken, true),
  body: JSON.stringify({
    learnerId: b.user.id,
    aspiration: `private-${suffix}`,
    desiredSkills: "",
    futureIdentity: "",
    selectedInterestIds: [],
  }),
})
const [profileA, profileB] = await Promise.all([
  request("/v1/profile/me", { headers: auth(a.accessToken) }),
  request("/v1/profile/me", { headers: auth(b.accessToken) }),
])
if (profileA.aspiration !== `private-${suffix}` || profileB.aspiration === profileA.aspiration) {
  throw new Error("profile isolation failed")
}

await request("/v1/events", {
  method: "POST",
  headers: auth(a.accessToken, true),
  body: JSON.stringify({
    learnerId: b.user.id,
    eventId: crypto.randomUUID(),
    eventType: "step_opened",
    routeId: trackId,
    routeStepId: node.id,
    lessonId: node.lesson_id,
    stepId: 1,
    payload: { verification: true },
  }),
}, 201)

const crossEvidence = new FormData()
crossEvidence.set("routeId", trackId)
crossEvidence.set("routeStepId", node.id)
crossEvidence.set("lessonId", String(node.lesson_id))
crossEvidence.set("stepId", "1")
crossEvidence.set("file", new Blob(["not-owned"], { type: "text/plain" }), "not-owned.txt")
await request("/v1/evidence", {
  method: "POST",
  headers: auth(b.accessToken),
  body: crossEvidence,
}, 403)

const ownEvidence = new FormData()
ownEvidence.set("routeId", trackId)
ownEvidence.set("routeStepId", node.id)
ownEvidence.set("lessonId", String(node.lesson_id))
ownEvidence.set("stepId", "1")
ownEvidence.set("file", new Blob(["owned"], { type: "text/plain" }), "owned.txt")
const evidence = await request("/v1/evidence", {
  method: "POST",
  headers: auth(a.accessToken),
  body: ownEvidence,
}, 201)
await request(`/v1/evidence/${evidence.id}`, { headers: auth(a.accessToken) })
await request(`/v1/evidence/${evidence.id}`, { headers: auth(b.accessToken) }, 404)

console.log(JSON.stringify({
  ok: true,
  base,
  assertions: [
    "track ownership",
    "route progress ownership",
    "course progress ownership",
    "profile ownership",
    "client learnerId ignored",
    "evidence ownership",
  ],
  testUsers: [a.user.username, b.user.username],
}, null, 2))
