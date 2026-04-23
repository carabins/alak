import { describe, it, expect, afterAll } from 'bun:test'
import { callAction, AlaqHttpError } from '../src'

const PORT = 3987
const BASE_URL = `http://localhost:${PORT}`

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const body = await req.json()

    // Verification of headers
    if (req.headers.get('x-test') === 'fail') {
      return Response.json({ code: 'HEADER_FAIL', message: 'Bad header' }, { status: 400 })
    }

    if (url.pathname === '/get_player') {
      return Response.json({ id: 'p1', name: body.input.name })
    }

    if (url.pathname === '/fire_and_forget') {
      return new Response(null, { status: 202 })
    }

    if (url.pathname === '/error') {
      return Response.json({ code: 'BUSINESS_ERROR', message: 'Something went wrong' }, { status: 403 })
    }

    return new Response('Not Found', { status: 404 })
  },
})

describe('HttpClient Runtime (TS)', () => {
  afterAll(() => {
    server.stop()
  })

  it('1. performs successful action call', async () => {
    const res = await callAction<{ name: string }, { id: string }>(
      { baseUrl: BASE_URL },
      'get_player',
      { name: 'Gleb' }
    )
    expect(res.id).toBe('p1')
  })

  it('2. handles 202 Accepted (void output)', async () => {
    const res = await callAction({ baseUrl: BASE_URL }, 'fire_and_forget', {})
    expect(res).toBeUndefined()
  })

  it('3. handles typed errors from server', async () => {
    try {
      await callAction({ baseUrl: BASE_URL }, 'error', {})
      expect().unreachable()
    } catch (e: any) {
      expect(e).toBeInstanceOf(AlaqHttpError)
      expect(e.status).toBe(403)
      expect(e.code).toBe('BUSINESS_ERROR')
      expect(e.message).toBe('Something went wrong')
    }
  })

  it('4. supports dynamic headers', async () => {
    const options = {
      baseUrl: BASE_URL,
      headers: () => ({ 'x-test': 'fail' })
    }
    
    try {
      await callAction(options, 'any', {})
      expect().unreachable()
    } catch (e: any) {
      expect(e.code).toBe('HEADER_FAIL')
    }
  })
})
