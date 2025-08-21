import {
    ProxyPlugin,
    RequestContext,
    ResponseContext,
    ConnectContext,
} from './types.js'

export function createLoggerPlugin(): ProxyPlugin {
    return {
        name: 'logger',
        async onConnect(ctx: ConnectContext) {
            console.log(
                `[connect] ${ctx.id} ${ctx.hostname}:${ctx.port} from ${ctx.clientIp ?? 'unknown'}`
            )
        },
        async onRequest(ctx: RequestContext) {
            console.log(
                `[request] ${ctx.id} ${ctx.method} ${ctx.url.toString()} from ${ctx.clientIp ?? 'unknown'}`
            )
        },
        async onResponse(ctx: ResponseContext) {
            console.log(
                `[response] ${ctx.id} ${ctx.statusCode} ${ctx.method} ${ctx.url.toString()}`
            )
        },
        onError(err, ctx) {
            console.error('[proxy-error]', err, ctx)
        },
    }
}
