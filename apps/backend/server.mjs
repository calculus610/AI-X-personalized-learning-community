import Fastify from "fastify"
import cors from "@fastify/cors"
import cookie from "@fastify/cookie"
import jwt from "@fastify/jwt"
import multipart from "@fastify/multipart"
import argon2 from "argon2"
import mysql from "mysql2/promise"
import { Client as MinioClient } from "minio"
import { createHash, randomUUID } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { registerLearningRoutes } from "./learning-routes.mjs"
import { registerUserDataRoutes } from "./user-data-routes.mjs"
import { registerAgentRoutes } from "./agent-routes.mjs"
import { registerActivityRoutes } from "./activity-routes.mjs"
import { registerAdminRoutes } from "./admin-routes.mjs"
import { registerQuizRoutes } from "./quiz-routes.mjs"
import { registerCareerRoutes } from "./career-routes.mjs"

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}
const env = {
  port: Number(process.env.PORT || 3300), host: process.env.HOST || "127.0.0.1",
  dbHost: required("DATABASE_HOST"), dbPort: Number(process.env.DATABASE_PORT || 3306),
  dbName: required("DATABASE_NAME"), dbUser: required("DATABASE_USER"), dbPassword: required("DATABASE_PASSWORD"),
  jwtSecret: required("JWT_SECRET"), corsOrigin: process.env.CORS_ORIGIN || false,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "7d",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookiePath: process.env.COOKIE_PATH || "/",
  minioEndpoint: required("MINIO_ENDPOINT"), minioPort: Number(process.env.MINIO_PORT || 9000),
  minioUseSSL: process.env.MINIO_USE_SSL === "true", minioAccessKey: required("MINIO_ACCESS_KEY"),
  minioSecretKey: required("MINIO_SECRET_KEY"), minioBucket: required("MINIO_BUCKET"),
  memoryDbHost: process.env.MEMORY_DATABASE_HOST || process.env.DATABASE_HOST,
  memoryDbPort: Number(process.env.MEMORY_DATABASE_PORT || process.env.DATABASE_PORT || 3306),
  memoryDbName: process.env.MEMORY_DATABASE_NAME || process.env.DATABASE_NAME,
  memoryDbUser: process.env.MEMORY_DATABASE_USER || process.env.DATABASE_USER,
  memoryDbPassword: process.env.MEMORY_DATABASE_PASSWORD || process.env.DATABASE_PASSWORD,
  agentProviderUrl: process.env.AGENT_PROVIDER_URL || "",
  agentProviderApiKey: process.env.AGENT_PROVIDER_API_KEY || "",
  agentAppKey: process.env.AGENT_APP_KEY || "",
  hiAgentAppKeys: {
    phase1: process.env.HIAGENT_PHASE1_APP_KEY || "",
    phase2: process.env.HIAGENT_PHASE2_APP_KEY || "",
    phase34: process.env.HIAGENT_PHASE34_APP_KEY || "",
    phase5: process.env.HIAGENT_PHASE5_APP_KEY || "",
  },
}
const app = Fastify({ logger: true, bodyLimit: 14 * 1024 * 1024 })
const db = mysql.createPool({ host: env.dbHost, port: env.dbPort, database: env.dbName, user: env.dbUser, password: env.dbPassword, waitForConnections: true, connectionLimit: 10, charset: "utf8mb4" })
const memoryDb = mysql.createPool({ host: env.memoryDbHost, port: env.memoryDbPort, database: env.memoryDbName, user: env.memoryDbUser, password: env.memoryDbPassword, waitForConnections: true, connectionLimit: 10, charset: "utf8mb4" })
const objectStore = {
  bucket: env.minioBucket,
  client: new MinioClient({ endPoint: env.minioEndpoint, port: env.minioPort, useSSL: env.minioUseSSL, accessKey: env.minioAccessKey, secretKey: env.minioSecretKey }),
}
async function ensureObjectStore() {
  let lastError
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const exists = await objectStore.client.bucketExists(objectStore.bucket)
      if (!exists) await objectStore.client.makeBucket(objectStore.bucket)
      return
    } catch (error) {
      lastError = error
      if (attempt < 30) await delay(1000)
    }
  }
  throw lastError
}
await app.register(cors, { origin: env.corsOrigin, credentials: true })
await app.register(cookie)
await app.register(jwt, { secret: env.jwtSecret })
await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } })
const refreshHash = (value) => createHash("sha256").update(value).digest("hex")
const publicUser = (user) => ({ id: user.id, username: user.username, displayName: user.display_name, role: user.role })
const setRefreshCookie = (reply, value) => reply.setCookie("pv2_refresh", value, { httpOnly: true, sameSite: "lax", secure: env.cookieSecure, path: env.cookiePath, maxAge: 60 * 60 * 24 * 14 })
async function createSession(reply, user) {
  const id = randomUUID(), token = randomUUID() + randomUUID()
  await db.execute("INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 14 DAY))", [id, user.id, refreshHash(token)])
  setRefreshCookie(reply, token)
  return { accessToken: app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: env.accessTokenTtl }), user: publicUser(user) }
}
app.get("/health", async () => { await db.query("SELECT 1"); return { ok: true } })
async function registerHandler(request, reply) {
  const { username, password, displayName } = request.body || {}
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(String(username || ""))) return reply.code(400).send({ error: "invalid_username" })
  if (typeof password !== "string" || password.length === 0) return reply.code(400).send({ error: "password_required" })
  const id = randomUUID(), name = String(displayName || username).trim().slice(0, 120)
  try {
    const hash = await argon2.hash(password, { type: argon2.argon2id })
    await db.execute("INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)", [id, username, name, hash])
    return reply.code(201).send(await createSession(reply, { id, username, display_name: name, role: "student" }))
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return reply.code(409).send({ error: "username_taken" })
    throw error
  }
}
async function loginHandler(request, reply) {
  const { username, password } = request.body || {}
  const [rows] = await db.execute("SELECT * FROM users WHERE username=? AND status='active' LIMIT 1", [String(username || "")])
  const user = rows[0]
  const valid = Boolean(user && typeof password === "string" && await argon2.verify(user.password_hash, password))
  if (!valid) return reply.code(401).send({ error: "invalid_credentials" })
  await db.execute("UPDATE users SET last_login_at=UTC_TIMESTAMP(3) WHERE id=?", [user.id])
  return createSession(reply, user)
}
async function meHandler(request, reply) {
  try { await request.jwtVerify() } catch { return reply.code(401).send({ error: "unauthorized" }) }
  const [rows] = await db.execute("SELECT id, username, display_name, role FROM users WHERE id=? LIMIT 1", [request.user.sub])
  if (!rows[0]) return reply.code(401).send({ error: "unauthorized" })
  return { user: publicUser(rows[0]) }
}
async function logoutHandler(request, reply) {
  const token = request.cookies.pv2_refresh
  if (token) await db.execute("UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE refresh_token_hash=?", [refreshHash(token)])
  reply.clearCookie("pv2_refresh", { path: env.cookiePath })
  return { ok: true }
}
for (const prefix of ["/auth", "/api/auth"]) {
  app.post(`${prefix}/register`, registerHandler)
  app.post(`${prefix}/login`, loginHandler)
  app.get(`${prefix}/me`, meHandler)
  app.post(`${prefix}/logout`, logoutHandler)
}
registerLearningRoutes(app, db, objectStore)
registerUserDataRoutes(app, db, objectStore)
registerCareerRoutes(app, db)
registerAgentRoutes(app, db, memoryDb, env)
registerQuizRoutes(app, db)
registerActivityRoutes(app, db)
registerAdminRoutes(app, db, memoryDb)
await ensureObjectStore()
await app.listen({ port: env.port, host: env.host })
