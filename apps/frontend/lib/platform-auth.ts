export const PLATFORM_TOKEN_KEY = "aix_token"
export const PLATFORM_USER_KEY = "aix_user"
export const PLATFORM_AUTH_EVENT = "aix-auth-changed"

export type PlatformUser = Record<string, unknown>

export type PlatformSession = {
  token: string
  user: PlatformUser
}

function notifyAuthChanged() {
  window.dispatchEvent(new CustomEvent(PLATFORM_AUTH_EVENT))
}

export function readPlatformSession(): PlatformSession | null {
  const token = window.localStorage.getItem(PLATFORM_TOKEN_KEY)
  if (!token) return null
  try {
    const rawUser = window.localStorage.getItem(PLATFORM_USER_KEY)
    return { token, user: rawUser ? JSON.parse(rawUser) as PlatformUser : {} }
  } catch {
    return { token, user: {} }
  }
}

export function savePlatformSession(session: PlatformSession) {
  window.localStorage.setItem(PLATFORM_TOKEN_KEY, session.token)
  window.localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(session.user))
  notifyAuthChanged()
}

export function clearPlatformSession() {
  window.localStorage.removeItem(PLATFORM_TOKEN_KEY)
  window.localStorage.removeItem(PLATFORM_USER_KEY)
  notifyAuthChanged()
}

export function getPlatformUserLabel(user: PlatformUser) {
  for (const key of ["displayName", "display_name", "full_name", "name", "username"]) {
    if (typeof user[key] === "string" && user[key]) return String(user[key])
  }
  return "学生账号"
}

export function getPlatformUserIdentity(user: PlatformUser) {
  // Browser cache namespaces must use the immutable database user id.
  // Usernames are mutable display/login attributes and are deliberately not
  // accepted as a fallback.
  for (const key of ["id", "user_id"]) {
    const value = user[key]
    if ((typeof value === "string" || typeof value === "number") && String(value)) {
      const safe = String(value).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 150)
      if (safe) return safe
    }
  }
  return null
}

export async function refreshPlatformSessionUser(token: string): Promise<PlatformSession> {
  const response = await fetch(`${personalizedAuthBase()}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const body = await response.json().catch(() => ({})) as {
    user?: PlatformUser
    detail?: string
    message?: string
    error?: string
  }
  if (!response.ok || !body.user || !getPlatformUserIdentity(body.user)) {
    throw new Error(body.detail || body.message || body.error || "invalid_session")
  }
  const session = { token, user: body.user }
  savePlatformSession(session)
  return session
}

function personalizedAuthBase() {
  const explicit = process.env.NEXT_PUBLIC_PERSONALIZED_AUTH_BASE?.replace(/\/$/, "")
  if (explicit) return explicit
  const learningBase = process.env.NEXT_PUBLIC_PERSONALIZED_V2_API_BASE?.replace(/\/$/, "")
  if (learningBase) return learningBase.replace(/\/v1$/, "")
  return "/personalized-secure-api"
}

export async function loginToOriginalPlatform(username: string, password: string) {
  const authBase = personalizedAuthBase()
  const response = await fetch(`${authBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role: "student" }),
  })
  const body = await response.json().catch(() => ({})) as {
    token?: string
    access_token?: string
    accessToken?: string
    user?: PlatformUser
    detail?: string
    message?: string
  }
  if (!response.ok) {
    throw new Error(body.detail || body.message || "用户名或密码不正确。")
  }
  const token = body.token || body.access_token || body.accessToken
  if (!token) throw new Error("登录成功，但原平台没有返回有效登录凭证。")
  let session = { token, user: body.user ?? { username } }
  if (!getPlatformUserIdentity(session.user)) {
    session = await refreshPlatformSessionUser(token)
  }
  savePlatformSession(session)
  return session
}

export async function registerOnOriginalPlatform(input: {
  username: string
  password: string
}) {
  const authBase = personalizedAuthBase()
  const response = await fetch(`${authBase}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: input.username,
      password: input.password,
      displayName: input.username,
      role: "student",
    }),
  })
  const body = await response.json().catch(() => ({})) as {
    accessToken?: string
    token?: string
    user?: PlatformUser
    detail?: string
    message?: string
    error?: string
  }
  if (!response.ok) throw new Error(body.detail || body.message || body.error || "注册失败，请检查账号信息。")
  const token = body.accessToken || body.token
  if (!token || !body.user) throw new Error("注册成功，但服务没有返回有效登录凭证。")
  const session = { token, user: body.user }
  savePlatformSession(session)
  return session
}
