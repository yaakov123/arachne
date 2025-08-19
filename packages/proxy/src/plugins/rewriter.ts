import { ProxyPlugin, RequestBodyContext, ResponseBodyContext } from './types.js'

// Demo plugin that rewrites text bodies for testing
export function createDemoRewritePlugin(): ProxyPlugin {
  return {
    name: 'demo-rewrite',
    async onRequestBody(ctx: RequestBodyContext) {
      // If JSON, add a marker field
      const ct = (ctx.contentType || '').toLowerCase()
      if (ct.includes('application/json')) {
        try {
          const json = JSON.parse(ctx.body.toString('utf8'))
          if (json && typeof json === 'object' && !Array.isArray(json)) {
            json.__rewritten_by = 'arachne-proxy-demo'
            ctx.setBody(JSON.stringify(json))
          }
        } catch {}
      }
    },
    async onResponseBody(ctx: ResponseBodyContext) {
      const ct = (ctx.contentType || '').toLowerCase()
      if (ct.startsWith('text/') || ct.includes('application/json')) {
        const s = ctx.body.toString('utf8')
        // Simple transform: append a footer comment/field
        if (ct.startsWith('text/')) {
          ctx.setBody(s + '\n<!-- rewritten by arachne-proxy demo -->')
        } else if (ct.includes('application/json')) {
          try {
            const json = JSON.parse(s)
            if (json && typeof json === 'object' && !Array.isArray(json)) {
              json.__rewritten_by = 'arachne-proxy-demo'
              ctx.setBody(JSON.stringify(json))
            }
          } catch {
            // leave as-is on parse failure
          }
        }
      }
    },
  }
}
