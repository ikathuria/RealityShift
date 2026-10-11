import { describe, it, expect, vi } from 'vitest'
import { fakeSupabase } from './test/fakeSupabase.js'

let current = fakeSupabase(() => ({ data: [] }))
vi.mock('./lib/supabase.js', () => ({ getSupabase: () => current.client }))

const worker = (await import('./index.js')).default
const env = { SUPABASE_URL: 'x', SUPABASE_SERVICE_KEY: 'y', WORKER_SECRET: 's3cret', SITE_URL: 'https://ikathuria.github.io/RealityShift' } as never
const ctx = { waitUntil: () => undefined } as never
const ORIGIN = 'https://ikathuria.github.io'

const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://api.example${path}`, init), env, ctx)

describe('CORS on /api/*', () => {
  it('answers preflight for the fork routes', async () => {
    const res = await call('/api/fork/simulate-year', { method: 'OPTIONS', headers: { Origin: ORIGIN } })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('adds ACAO to normal and error responses, but not for unknown origins', async () => {
    const ok = await call('/api/health', { headers: { Origin: ORIGIN } })
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    const unauth = await call('/api/fork/create', { method: 'POST', headers: { Origin: 'http://localhost:5173' } })
    expect(unauth.status).toBe(401)
    expect(unauth.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    const evil = await call('/api/health', { headers: { Origin: 'https://evil.example' } })
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('secret routes', () => {
  it('reject a wrong or missing x-worker-secret', async () => {
    expect((await call('/api/countries')).status).toBe(401)
    expect((await call('/api/countries', { headers: { 'x-worker-secret': 'nope' } })).status).toBe(401)
  })
  it('list countries from the latest view', async () => {
    current = fakeSupabase(q => (q.table === 'latest_country_states' ? { data: [{ country_code: 'IND' }, { country_code: 'USA' }] } : { data: [] }))
    const res = await call('/api/countries', { headers: { 'x-worker-secret': 's3cret' } })
    expect(await res.json()).toEqual({ codes: ['IND', 'USA'] })
    expect(current.log[0].range).toEqual([0, 999])
  })
})

describe('/share/:worldId', () => {
  it('404s anything that is not live or a UUID', async () => {
    const res = await call('/share/%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E')
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('<script>')
  })
  it('404s an unknown world id', async () => {
    current = fakeSupabase(() => ({ data: [] }))
    expect((await call('/share/3f2504e0-4f89-41d3-9a0c-0305e82c3301')).status).toBe(404)
  })
  it('renders a generic card for a private fork without reading its media', async () => {
    current = fakeSupabase(q => (q.table === 'worlds' ? { data: [{ id: 'w', is_public: false, is_live: false, player_country_code: 'USA', title: 'secret plan', forked_at_year: 2026 }] } : { data: [] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await call('/share/3f2504e0-4f89-41d3-9a0c-0305e82c3301')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('secret plan')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('/api/media/index/:worldId', () => {
  it('404s an invalid id and a private fork needs the owner', async () => {
    expect((await call('/api/media/index/..%2F..%2Fetc')).status).toBe(404)
    current = fakeSupabase(q => (q.table === 'worlds' ? { data: [{ player_id: 'owner', is_public: false, is_live: false }] } : { data: [] }))
    expect((await call('/api/media/index/3f2504e0-4f89-41d3-9a0c-0305e82c3301')).status).toBe(401)
  })
  it('404s when media storage is not configured', async () => {
    const res = await call('/api/media/index/live', { headers: { Origin: ORIGIN } })
    expect(res.status).toBe(404)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
  })
})
