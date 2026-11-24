import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import session from 'express-session'

const SESSION_COOKIE_NAME = 'freshcare.sid'
const ADMIN_LOGIN_PATH = '/webhook/freshcare/admin/login'
const ADMIN_API_PATHS = new Map([
  ['/tickets', '/webhook/freshcare/admin/tickets'],
  ['/tickets/start-review', '/webhook/freshcare/admin/tickets/start-review'],
  ['/assign-ticket', '/webhook/freshcare/assign-ticket'],
  ['/request-supplement', '/webhook/freshcare/request-supplement'],
  ['/ticket-detail', '/webhook/freshcare/admin/ticket-detail'],
])

function createEncryptedSessionStore(databasePath, encryptionKey) {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 })
  const database = new DatabaseSync(databasePath)
  chmodSync(databasePath, 0o600)
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS admin_sessions (
      sid TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      encrypted_data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
  `)
  const cleanupExpiredSessions = database.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?')
  cleanupExpiredSessions.run(Date.now())

  function encrypt(value) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
  }

  function decrypt(value) {
    const [iv, authTag, encrypted] = value.split('.')
    if (!iv || !authTag || !encrypted) throw new Error('Invalid encrypted session data')
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'))
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8'))
  }

  class EncryptedSQLiteStore extends session.Store {
    get(sid, callback) {
      try {
        const row = database.prepare('SELECT expires_at, encrypted_data FROM admin_sessions WHERE sid = ?').get(sid)
        if (!row) return callback(null, null)
        if (row.expires_at <= Date.now()) {
          database.prepare('DELETE FROM admin_sessions WHERE sid = ?').run(sid)
          return callback(null, null)
        }
        return callback(null, decrypt(row.encrypted_data))
      } catch (error) {
        database.prepare('DELETE FROM admin_sessions WHERE sid = ?').run(sid)
        return callback(error)
      }
    }

    set(sid, value, callback = () => {}) {
      try {
        cleanupExpiredSessions.run(Date.now())
        const expiresAt = value.cookie?.expires
          ? new Date(value.cookie.expires).getTime()
          : Date.now() + 8 * 60 * 60 * 1000
        database.prepare(`
          INSERT INTO admin_sessions (sid, expires_at, encrypted_data) VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET expires_at = excluded.expires_at, encrypted_data = excluded.encrypted_data
        `).run(sid, expiresAt, encrypt(value))
        callback(null)
      } catch (error) {
        callback(error)
      }
    }

    touch(sid, value, callback = () => {}) {
      try {
        cleanupExpiredSessions.run(Date.now())
        const expiresAt = value.cookie?.expires
          ? new Date(value.cookie.expires).getTime()
          : Date.now() + 8 * 60 * 60 * 1000
        database.prepare('UPDATE admin_sessions SET expires_at = ? WHERE sid = ?').run(expiresAt, sid)
        callback(null)
      } catch (error) {
        callback(error)
      }
    }

    destroy(sid, callback = () => {}) {
      try {
        database.prepare('DELETE FROM admin_sessions WHERE sid = ?').run(sid)
        callback(null)
      } catch (error) {
        callback(error)
      }
    }

    close() {
      database.close()
    }
  }

  return new EncryptedSQLiteStore()
}

function sessionPromise(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    request.session.save((error) => error ? rejectPromise(error) : resolvePromise())
  })
}

function regenerateSession(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    request.session.regenerate((error) => error ? rejectPromise(error) : resolvePromise())
  })
}

function destroySession(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!request.session) return resolvePromise()
    request.session.destroy((error) => error ? rejectPromise(error) : resolvePromise())
  })
}

function jsonError(response, status, message) {
  response.status(status).json({ success: false, message })
}

function createLoginLimiter({ limit, windowMs }) {
  const failures = new Map()
  const pending = new Map()
  return {
    begin(key) {
      const recent = (failures.get(key) ?? []).filter((timestamp) => timestamp > Date.now() - windowMs)
      failures.set(key, recent)
      if (recent.length + (pending.get(key) ?? 0) >= limit) return false
      pending.set(key, (pending.get(key) ?? 0) + 1)
      return true
    },
    finish(key, failed = false) {
      const activeAttempts = pending.get(key) ?? 0
      if (activeAttempts <= 1) pending.delete(key)
      else pending.set(key, activeAttempts - 1)
      if (!failed) return
      const recent = (failures.get(key) ?? []).filter((timestamp) => timestamp > Date.now() - windowMs)
      recent.push(Date.now())
      failures.set(key, recent)
      if (failures.size > 10_000) {
        for (const [storedKey, timestamps] of failures) {
          if (timestamps.every((timestamp) => timestamp <= Date.now() - windowMs)) failures.delete(storedKey)
        }
      }
    },
  }
}

function validateOrigin(request, allowedOrigin) {
  const origin = request.get('origin')
  if (origin && origin !== allowedOrigin) return false
  const fetchSite = request.get('sec-fetch-site')
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none'
}

function hasValidCsrfToken(request) {
  const expected = request.session?.csrfToken
  const provided = request.get('x-csrf-token')
  if (typeof expected !== 'string' || typeof provided !== 'string') return false
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
}

export function createAdminSessionApp({
  sessionSecret,
  databasePath,
  n8nBaseUrl = 'http://localhost:5678',
  appOrigin = 'http://localhost:5173',
  secureCookie = false,
  sessionTtlHours = 8,
  loginLimit = 5,
  loginWindowMs = 15 * 60 * 1000,
  trustProxy = false,
  fetchImpl = fetch,
} = {}) {
  if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters.')
  }
  if (!databasePath) throw new Error('ADMIN_SESSION_DB_PATH must be configured.')
  if (!Number.isInteger(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > 168) {
    throw new Error('ADMIN_SESSION_TTL_HOURS must be an integer between 1 and 168.')
  }
  const upstreamBase = new URL(n8nBaseUrl)
  if (!['http:', 'https:'].includes(upstreamBase.protocol)) throw new Error('N8N_BASE_URL must use HTTP or HTTPS.')
  const allowedOriginUrl = new URL(appOrigin)
  if (!['http:', 'https:'].includes(allowedOriginUrl.protocol)) throw new Error('ADMIN_APP_ORIGIN must use HTTP or HTTPS.')
  const allowedOrigin = allowedOriginUrl.origin
  const encryptionKey = createHash('sha256').update('freshcare-admin-session-data:').update(sessionSecret).digest()
  const store = createEncryptedSessionStore(databasePath, encryptionKey)
  const app = express()
  const loginLimiter = createLoginLimiter({ limit: loginLimit, windowMs: loginWindowMs })
  const cookieOptions = {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/api/admin',
  }

  app.disable('x-powered-by')
  app.set('trust proxy', trustProxy ? 1 : false)
  app.use(express.json({ limit: '16kb' }))
  app.use((request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(session({
    name: SESSION_COOKIE_NAME,
    secret: sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { ...cookieOptions, maxAge: sessionTtlHours * 60 * 60 * 1000 },
  }))

  async function callLoginWebhook(authorization) {
    return fetchImpl(new URL(ADMIN_LOGIN_PATH, upstreamBase), {
      method: 'POST',
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(10_000),
    })
  }

  app.get('/api/admin/session/csrf', async (request, response, next) => {
    try {
      request.session.csrfToken ??= randomBytes(32).toString('base64url')
      await sessionPromise(request)
      response.json({ success: true, csrfToken: request.session.csrfToken })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/admin/session/login', async (request, response) => {
    if (!validateOrigin(request, allowedOrigin)) return jsonError(response, 403, '登入來源驗證失敗。')
    if (!hasValidCsrfToken(request)) return jsonError(response, 403, '安全驗證已失效，請重新嘗試。')
    const { username, password } = request.body ?? {}
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
      return jsonError(response, 400, '請輸入員工帳號及通行密碼。')
    }
    const ip = request.ip
    if (!loginLimiter.begin(ip)) return jsonError(response, 429, '登入嘗試次數過多，請稍後再試。')

    const authorization = `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`
    try {
      const upstreamResponse = await callLoginWebhook(authorization)
      if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
        loginLimiter.finish(ip, true)
        return jsonError(response, 401, '帳號或密碼錯誤，請重新確認。')
      }
      if (upstreamResponse.status !== 200) {
        loginLimiter.finish(ip, true)
        return jsonError(response, 502, '登入服務暫時無法使用，請稍後重試。')
      }

      await regenerateSession(request)
      request.session.basicAuthorization = authorization
      request.session.csrfToken = randomBytes(32).toString('base64url')
      await sessionPromise(request)
      loginLimiter.finish(ip)
      response.json({ success: true, csrfToken: request.session.csrfToken })
    } catch (error) {
      loginLimiter.finish(ip, true)
      console.error('Admin Session login failed:', error.message)
      jsonError(response, 502, '無法連線至登入服務，請確認 n8n 是否啟動後重試。')
    }
  })

  app.get('/api/admin/session/verify', async (request, response) => {
    if (!request.session.basicAuthorization) {
      return jsonError(response, 401, '登入工作階段已失效。')
    }
    try {
      const upstreamResponse = await callLoginWebhook(request.session.basicAuthorization)
      if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
        await destroySession(request)
        response.clearCookie(SESSION_COOKIE_NAME, cookieOptions)
        return jsonError(response, 401, '登入工作階段已失效，請重新登入。')
      }
      if (upstreamResponse.status !== 200) {
        return jsonError(response, 503, '目前無法驗證登入工作階段，請稍後重試。')
      }
      request.session.csrfToken ??= randomBytes(32).toString('base64url')
      await sessionPromise(request)
      response.json({ success: true, csrfToken: request.session.csrfToken })
    } catch {
      jsonError(response, 503, '目前無法驗證登入工作階段，請稍後重試。')
    }
  })

  app.post('/api/admin/session/logout', async (request, response, next) => {
    if (!validateOrigin(request, allowedOrigin)) return jsonError(response, 403, '登出來源驗證失敗。')
    if (!hasValidCsrfToken(request)) return jsonError(response, 403, '安全驗證已失效，請重新嘗試。')
    try {
      await destroySession(request)
      response.clearCookie(SESSION_COOKIE_NAME, cookieOptions)
      response.json({ success: true })
    } catch (error) {
      next(error)
    }
  })

  app.use('/api/admin', async (request, response, next) => {
    if (request.path.startsWith('/session/')) return jsonError(response, 404, '找不到此 API。')
    if (!request.session.basicAuthorization) return jsonError(response, 401, '請先登入後台。')
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (!validateOrigin(request, allowedOrigin)) return jsonError(response, 403, '請求來源驗證失敗。')
      if (!hasValidCsrfToken(request)) return jsonError(response, 403, '安全驗證已失效，請重新登入。')
    }

    const upstreamPath = ADMIN_API_PATHS.get(request.path)
    const allowedMethod = request.path === '/tickets' || request.path === '/ticket-detail'
      ? request.method === 'GET'
      : request.method === 'POST'
    if (!upstreamPath || !allowedMethod) return jsonError(response, 404, '找不到此 API。')

    try {
      const target = new URL(upstreamPath, upstreamBase)
      target.search = new URLSearchParams(request.query).toString()
      const headers = { Authorization: request.session.basicAuthorization }
      if (request.get('accept')) headers.Accept = request.get('accept')
      if (request.method === 'POST') headers['Content-Type'] = request.get('content-type') ?? 'application/json'
      const upstreamResponse = await fetchImpl(target, {
        method: request.method,
        headers,
        ...(request.method === 'POST' ? { body: JSON.stringify(request.body ?? {}) } : {}),
        signal: AbortSignal.timeout(30_000),
      })
      const body = await upstreamResponse.text()
      if (upstreamResponse.status === 401) {
        await destroySession(request)
        response.clearCookie(SESSION_COOKIE_NAME, cookieOptions)
      }
      const contentType = upstreamResponse.headers.get('content-type')
      if (contentType) response.setHeader('Content-Type', contentType)
      response.status(upstreamResponse.status)
      if (!body) return response.end()
      return response.send(body)
    } catch (error) {
      next(error)
    }
  })

  app.use((error, _request, response, _next) => {
    console.error('Admin Session API request failed:', error.message)
    if (response.headersSent) return
    jsonError(response, 500, '後台服務發生錯誤，請稍後重試。')
  })

  return { app, store }
}

function readConfig() {
  const port = Number(process.env.SESSION_API_PORT ?? 3001)
  const ttlHours = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? 8)
  const databasePath = resolve(process.env.ADMIN_SESSION_DB_PATH ?? './data/admin-sessions.sqlite')
  const secureCookie = process.env.ADMIN_SESSION_COOKIE_SECURE === 'true'
    || (process.env.ADMIN_SESSION_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SESSION_API_PORT must be a valid port.')
  return {
    port,
    databasePath,
    secureCookie,
    trustProxy: process.env.ADMIN_SESSION_TRUST_PROXY === 'true',
    host: process.env.ADMIN_SESSION_HOST ?? '127.0.0.1',
    sessionTtlHours: ttlHours,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
    n8nBaseUrl: process.env.N8N_BASE_URL ?? 'http://localhost:5678',
    appOrigin: process.env.ADMIN_APP_ORIGIN ?? 'http://localhost:5173',
  }
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  try {
    const { host, port, ...options } = readConfig()
    const { app, store } = createAdminSessionApp(options)
    const server = app.listen(port, host, () => console.log(`FreshCare Admin Session API listening on ${host}:${port}`))
    const shutdown = () => server.close(() => {
      store.close()
      process.exit(0)
    })
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
