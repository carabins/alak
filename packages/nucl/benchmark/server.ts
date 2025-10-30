/**
 * Simple HTTP server for browser benchmarks
 * Saves results to files for analysis
 */

import { writeFileSync } from 'fs'
import { join } from 'path'

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    let path = url.pathname

    // Handle POST request to save results
    if (req.method === 'POST' && path === '/save-results') {
      try {
        const results = await req.json()

        // Save JSON
        const jsonPath = join(import.meta.dir, 'BROWSER_RESULTS.json')
        writeFileSync(jsonPath, JSON.stringify(results, null, 2))

        // Generate and save Markdown report
        const mdReport = generateMarkdownReport(results)
        const mdPath = join(import.meta.dir, 'BROWSER_RESULTS.md')
        writeFileSync(mdPath, mdReport)

        console.log('💾 Results saved:')
        console.log('   JSON: BROWSER_RESULTS.json')
        console.log('   MD:   BROWSER_RESULTS.md')

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      } catch (error) {
        console.error('Error saving results:', error)
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    }

    // Default to compare.html
    if (path === '/') {
      path = '/compare.html'
    }

    // Serve files from benchmark directory
    const filePath = import.meta.dir + path

    try {
      const file = Bun.file(filePath)

      // Check if file exists
      if (!(await file.exists())) {
        return new Response('File not found', { status: 404 })
      }

      // Determine content type
      let contentType = 'text/plain'
      if (path.endsWith('.html')) contentType = 'text/html'
      else if (path.endsWith('.js')) contentType = 'application/javascript'
      else if (path.endsWith('.css')) contentType = 'text/css'
      else if (path.endsWith('.json')) contentType = 'application/json'

      return new Response(file, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return new Response('Error: ' + error, { status: 500 })
    }
  }
})

function generateMarkdownReport(data: any): string {
  const { timestamp, userAgent, results, summary } = data

  let md = `# Nucl vs Quark - Browser Benchmark Results\n\n`
  md += `**Date:** ${new Date(timestamp).toLocaleString()}\n`
  md += `**Browser:** ${userAgent}\n\n`

  md += `## Summary\n\n`
  md += `| Implementation | Avg Ops/ms | vs Quark |\n`
  md += `|----------------|----------:|----------:|\n`
  md += `| Quark (baseline) | ${summary.avgQuark.toLocaleString()} | 0% |\n`
  md += `| Nucl (bare) | ${summary.avgNucl.toLocaleString()} | ${summary.nuclDelta}% |\n`
  md += `| Nucl+plugins | ${summary.avgPlugins.toLocaleString()} | ${summary.pluginsDelta}% |\n`
  md += `| HeavyNucl | ${summary.avgHeavy.toLocaleString()} | ${summary.heavyDelta}% |\n\n`

  md += `## Detailed Results\n\n`
  md += `| Test | Quark | Nucl | Nucl+plugins | HeavyNucl |\n`
  md += `|------|------:|-----:|-------------:|----------:|\n`

  for (const result of results) {
    md += `| ${result.name} `
    md += `| ${result.quark.opsPerMs.toLocaleString()} `
    md += `| ${result.nucl.opsPerMs.toLocaleString()} `
    md += `| ${result.plugins.opsPerMs.toLocaleString()} `
    md += `| ${result.heavy.opsPerMs.toLocaleString()} |\n`
  }

  return md
}

console.log('🚀 Benchmark server started!')
console.log('')
console.log('📊 Open in your browser:')
console.log(`   http://localhost:${server.port}`)
console.log('')
console.log('Press Ctrl+C to stop')
