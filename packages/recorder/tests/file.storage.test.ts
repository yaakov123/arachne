import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { FileStorageAdapter } from '../src/storage/file'

let tmpDir: string

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arachne-recorder-test-'))
})

afterAll(async () => {
  await fs.rmdir(tmpDir)
})

describe('FileStorageAdapter', () => {
  it('records requests and normalizes path', async () => {
    const adapter = new FileStorageAdapter({ normalizePaths: true, outDir: tmpDir })
    const ctx: any = {
      id: 'req-1',
      url: new URL('http://api.example.test/users/12345/profile?a=1'),
      method: 'get',
      headers: { 'X-Foo': 'bar' }
    }
    adapter.recordRequest(ctx)

    const snap = adapter.snapshot()
    const host = snap.hosts['api.example.test']
    expect(host).toBeDefined()

    const key = 'GET /users/{id}/profile'
    expect(host.endpoints[key]).toBeDefined()

    const ep = host.endpoints[key]
    expect(ep.method).toBe('GET')
    expect(ep.path).toBe('/users/{id}/profile')
    expect(ep.hits).toBe(1)
    expect(ep.interactions.length).toBe(1)

    const int = ep.interactions[0]
    expect(int.id).toBe('req-1')
    expect(int.request.query.some((q: any) => q.key === 'a' && q.value === '1')).toBe(true)
    expect(int.request.headers.some((h: any) => h.key === 'x-foo' && h.value === 'bar')).toBe(true)
  })

  it('truncates captured request body by maxCaptureBytes', async () => {
    const adapter = new FileStorageAdapter({ outDir: tmpDir, maxCaptureBytes: 5 })
    const url = new URL('http://api.example.test/resource/42')
    const ctx: any = { id: 'req-2', url, method: 'post', headers: {} }

    adapter.recordRequest(ctx)
    adapter.recordRequestBody(ctx, 'ABCDEFGHIJK')

    const snap = adapter.snapshot()
    const ep = snap.hosts['api.example.test'].endpoints['POST /resource/42']
    const int = ep.interactions.find((i: any) => i.id === 'req-2')!
    expect(int.request.body).toBe('ABCDE')
  })
})
