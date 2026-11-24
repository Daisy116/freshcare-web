import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createAdminSessionApp } from '../adminSessionServer.mjs'

const sessionSecret = 'test-session-secret-with-more-than-32-characters'
const appOrigin = 'http://localhost:5173'

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return `http://127.0.0.1:${server.address().port}`
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

function createUpstream() {
  const calls = []
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString('utf8')
    calls.push({ path: request.url, method: request.method, authorization: request.headers.authorization, body })

    if (request.url === '/webhook/freshcare/admin/login') {
      response.statusCode = request.headers.authorization === 'Basic c3RhZmY6c2VjcmV0' ? 200 : 401
      return response.end()
    }

    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ success: true, forwardedPath: request.url, forwardedBody: body }))
  })
  return { server, calls }
}

async function startSessionServer(databasePath, n8nBaseUrl) {
  const { app, store } = createAdminSessionApp({
    sessionSecret,
    databasePath,
    n8nBaseUrl,
    appOrigin,
    fetchImpl: fetch,
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  return { server, store, baseUrl: `http://127.0.0.1:${server.address().port}` }
}

async function stopSessionServer(instance) {
  await close(instance.server)
  instance.store.close()
}

function cookieFrom(response) {
  const setCookie = response.headers.getSetCookie()[0]
  assert.ok(setCookie?.includes('HttpOnly'))
  assert.ok(setCookie?.includes('SameSite=Lax'))
  return setCookie.split(';')[0]
}

test('protects management APIs and persists an encrypted session across backend restarts', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'freshcare-session-'))
  const databasePath = join(directory, 'sessions.sqlite')
  const upstream = createUpstream()
  const upstreamBase = await listen(upstream.server)
  let sessionServer

  t.after(async () => {
    if (sessionServer) await stopSessionServer(sessionServer)
    await close(upstream.server)
    await rm(directory, { recursive: true, force: true })
  })

  sessionServer = await startSessionServer(databasePath, upstreamBase)
  const unauthenticated = await fetch(`${sessionServer.baseUrl}/api/admin/tickets`)
  assert.equal(unauthenticated.status, 401)
  assert.equal(upstream.calls.length, 0)

  const csrfResponse = await fetch(`${sessionServer.baseUrl}/api/admin/session/csrf`)
  assert.equal(csrfResponse.status, 200)
  const preAuthCookie = cookieFrom(csrfResponse)
  const csrfBody = await csrfResponse.json()
  const rejectedLogin = await fetch(`${sessionServer.baseUrl}/api/admin/session/login`, {
    method: 'POST',
    headers: {
      Origin: appOrigin,
      'Content-Type': 'application/json',
      Cookie: preAuthCookie,
    },
    body: JSON.stringify({ username: 'staff', password: 'secret' }),
  })
  assert.equal(rejectedLogin.status, 403)

  const loginResponse = await fetch(`${sessionServer.baseUrl}/api/admin/session/login`, {
    method: 'POST',
    headers: {
      Origin: appOrigin,
      'X-CSRF-Token': csrfBody.csrfToken,
      'Content-Type': 'application/json',
      Cookie: preAuthCookie,
    },
    body: JSON.stringify({ username: 'staff', password: 'secret' }),
  })
  assert.equal(loginResponse.status, 200)
  const cookie = cookieFrom(loginResponse)
  const loginBody = await loginResponse.json()
  assert.notEqual(cookie, preAuthCookie)
  assert.equal(upstream.calls[0].path, '/webhook/freshcare/admin/login')
  assert.equal(upstream.calls[0].authorization, 'Basic c3RhZmY6c2VjcmV0')

  const databaseBytes = Buffer.concat([
    await readFile(databasePath),
    await readFile(`${databasePath}-wal`),
  ])
  assert.equal(databaseBytes.includes(Buffer.from('Basic c3RhZmY6c2VjcmV0')), false)
  assert.equal(databaseBytes.includes(Buffer.from('secret')), false)

  const assignment = await fetch(`${sessionServer.baseUrl}/api/admin/assign-ticket`, {
    method: 'POST',
    headers: {
      Origin: appOrigin,
      'X-CSRF-Token': loginBody.csrfToken,
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ ticket_id: 'FC-100', review_department: 'quality' }),
  })
  assert.equal(assignment.status, 200)
  assert.equal(upstream.calls.at(-1).path, '/webhook/freshcare/assign-ticket')
  assert.equal(upstream.calls.at(-1).authorization, 'Basic c3RhZmY6c2VjcmV0')
  assert.deepEqual(JSON.parse(upstream.calls.at(-1).body), { ticket_id: 'FC-100', review_department: 'quality' })

  const csrfRejected = await fetch(`${sessionServer.baseUrl}/api/admin/assign-ticket`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket_id: 'FC-101' }),
  })
  assert.equal(csrfRejected.status, 403)

  await stopSessionServer(sessionServer)
  sessionServer = await startSessionServer(databasePath, upstreamBase)
  const restored = await fetch(`${sessionServer.baseUrl}/api/admin/session/verify`, { headers: { Cookie: cookie } })
  assert.equal(restored.status, 200)
  const restoredBody = await restored.json()
  assert.equal(restoredBody.success, true)

  const logoutResponse = await fetch(`${sessionServer.baseUrl}/api/admin/session/logout`, {
    method: 'POST',
    headers: { Origin: appOrigin, 'X-CSRF-Token': restoredBody.csrfToken, Cookie: cookie },
  })
  assert.equal(logoutResponse.status, 200)
  const revoked = await fetch(`${sessionServer.baseUrl}/api/admin/session/verify`, { headers: { Cookie: cookie } })
  assert.equal(revoked.status, 401)
})

test('limits repeated failed login attempts', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'freshcare-session-rate-limit-'))
  const upstream = createUpstream()
  const upstreamBase = await listen(upstream.server)
  const databasePath = join(directory, 'sessions.sqlite')
  const instance = await startSessionServer(databasePath, upstreamBase)
  t.after(async () => {
    await stopSessionServer(instance)
    await close(upstream.server)
    await rm(directory, { recursive: true, force: true })
  })

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const csrfResponse = await fetch(`${instance.baseUrl}/api/admin/session/csrf`)
    const cookie = cookieFrom(csrfResponse)
    const { csrfToken } = await csrfResponse.json()
    const response = await fetch(`${instance.baseUrl}/api/admin/session/login`, {
      method: 'POST',
      headers: { Origin: appOrigin, 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ username: 'staff', password: 'wrong' }),
    })
    assert.equal(response.status, attempt < 5 ? 401 : 429)
  }
})
