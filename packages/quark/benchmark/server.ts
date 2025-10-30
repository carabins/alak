/**
 * Benchmark Results Server
 *
 * Простой HTTP сервер для сохранения результатов браузерных тестов
 *
 * Запуск: bun run benchmark/server.ts
 */

import { write, file } from 'bun'
import { join } from 'path'

const PORT = 3333
const RESULTS_DIR = join(import.meta.dir, 'results')

// Создаем директорию для результатов
await Bun.write(join(RESULTS_DIR, '.gitkeep'), '')

interface BenchmarkResult {
  name: string
  ops: number
  time: number
  opsPerMs: number
}

interface BenchmarkSubmission {
  userAgent: string
  bundleType: 'baseline' | 'optimized'
  timestamp: string
  browser: string
  results: BenchmarkResult[]
  summary: {
    totalOps: number
    avgOpsPerMs: number
  }
}

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // POST /submit - сохранить результаты
    if (url.pathname === '/submit' && req.method === 'POST') {
      try {
        const data: BenchmarkSubmission = await req.json()

        // Генерируем имя файла
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const browserShort = data.browser.split(' ')[0].toLowerCase()
        const filename = `${timestamp}_${browserShort}_${data.bundleType}.json`
        const filepath = join(RESULTS_DIR, filename)

        // Сохраняем результаты
        await Bun.write(filepath, JSON.stringify(data, null, 2))

        console.log(`✅ Saved: ${filename}`)
        console.log(`   Browser: ${data.browser}`)
        console.log(`   Bundle: ${data.bundleType}`)
        console.log(`   Avg: ${data.summary.avgOpsPerMs.toFixed(2)} ops/ms`)

        return new Response(JSON.stringify({ success: true, filename }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (error: any) {
        console.error('❌ Error saving results:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // GET /results - список всех результатов
    if (url.pathname === '/results' && req.method === 'GET') {
      try {
        const files = await Array.fromAsync(
          new Bun.Glob('*.json').scan({ cwd: RESULTS_DIR })
        )

        const results = []
        for (const filename of files) {
          if (filename === '.gitkeep') continue
          const filepath = join(RESULTS_DIR, filename)
          const content = await Bun.file(filepath).json()
          results.push({
            filename,
            ...content
          })
        }

        // Сортируем по времени (новые первые)
        results.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

        return new Response(JSON.stringify(results, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (error: any) {
        console.error('❌ Error reading results:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // GET / - статус сервера
    if (url.pathname === '/' && req.method === 'GET') {
      const files = await Array.fromAsync(
        new Bun.Glob('*.json').scan({ cwd: RESULTS_DIR })
      )
      const count = files.filter(f => f !== '.gitkeep').length

      return new Response(`
        <html>
          <head>
            <title>Benchmark Results Server</title>
            <style>
              body {
                font-family: system-ui;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: #1a1a1a;
                color: #e0e0e0;
              }
              h1 { color: #60a5fa; }
              code {
                background: #2a2a2a;
                padding: 2px 6px;
                border-radius: 3px;
                color: #10b981;
              }
              .count {
                font-size: 48px;
                font-weight: bold;
                color: #10b981;
                margin: 20px 0;
              }
              a {
                color: #60a5fa;
                text-decoration: none;
              }
              a:hover {
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            <h1>📊 Benchmark Results Server</h1>
            <p>Server is running on port <code>${PORT}</code></p>
            <div class="count">${count}</div>
            <p>${count} benchmark result${count !== 1 ? 's' : ''} collected</p>
            <h2>Endpoints:</h2>
            <ul>
              <li><code>POST /submit</code> - Submit benchmark results</li>
              <li><code>GET /results</code> - <a href="/results">View all results</a></li>
            </ul>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`🚀 Benchmark Results Server running on http://localhost:${PORT}`)
console.log(`📁 Results saved to: ${RESULTS_DIR}`)
console.log(``)
console.log(`Usage:`)
console.log(`  1. Start this server: bun run benchmark/server.ts`)
console.log(`  2. Open benchmark/compare.html in browser`)
console.log(`  3. Results will be saved automatically`)
console.log(``)
