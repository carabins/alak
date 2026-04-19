import { createLinkServer } from '../server/index'
import { jsonCodec } from '../src/codec'

const linkServer = createLinkServer({
  port: 3456,
  codec: jsonCodec, // HTML client can't use msgpackr without bundler
  onAction(action, path, args, peerId) {
    console.log(`[action] ${peerId}: ${action} ${path}`, args)
    return { ok: true }
  },
})

// Serve the HTML client
Bun.serve({
  port: 3457,
  async fetch(req) {
    const file = Bun.file(import.meta.dir + '/client.html')
    return new Response(file, {
      headers: { 'Content-Type': 'text/html' },
    })
  },
})

console.log(`🔗 Link server:  ws://localhost:3456`)
console.log(`🌐 Open client:  http://localhost:3457`)
console.log(`   Open 2+ tabs to see peer discovery`)
