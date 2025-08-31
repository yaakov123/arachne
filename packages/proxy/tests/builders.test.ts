import { describe, it, expect, beforeEach } from 'vitest'
import { RequestBuilder, ResponseBuilder } from '../src/plugins/builders'

describe('RequestBuilder', () => {
    let builder: RequestBuilder
    const testUrl = new URL('https://example.com/path?query=value')
    const testMethod = 'POST'
    const testHeaders = {
        'content-type': 'application/json',
        authorization: 'Bearer token',
    }
    const testBody = Buffer.from('{"test": "data"}')

    beforeEach(() => {
        builder = new RequestBuilder(testUrl, testMethod, testHeaders, testBody)
    })

    describe('header manipulation', () => {
        it('should add headers preserving existing values', () => {
            builder.addHeader('x-custom', 'value1')
            builder.addHeader('x-custom', 'value2')

            const result = builder.getHeader('x-custom')
            expect(result).toEqual(['value1', 'value2'])
        })

        it('should set headers replacing existing values', () => {
            builder.setHeader('content-type', 'text/plain')

            expect(builder.getHeader('content-type')).toBe('text/plain')
        })

        it('should remove headers', () => {
            builder.removeHeader('authorization')

            expect(builder.getHeader('authorization')).toBeUndefined()
        })

        it('should get headers case-insensitively', () => {
            expect(builder.getHeader('Content-Type')).toBe('application/json')
            expect(builder.getHeader('AUTHORIZATION')).toBe('Bearer token')
        })

        it('should return all headers', () => {
            const headers = builder.getHeaders()
            expect(headers).toEqual({
                'content-type': 'application/json',
                authorization: 'Bearer token',
            })
        })
    })

    describe('body manipulation', () => {
        it('should set body from Buffer', () => {
            const newBody = Buffer.from('new data')
            builder.setBody(newBody)

            expect(builder.getBody()).toEqual(newBody)
            expect(builder.getHeader('content-length')).toBe('8')
        })

        it('should set body from string', () => {
            builder.setBody('string data')

            expect(builder.getBody()).toEqual(Buffer.from('string data'))
            expect(builder.getHeader('content-length')).toBe('11')
        })

        it('should return cloned body to prevent mutations', () => {
            const body = builder.getBody()
            body?.write('modified')

            expect(builder.getBody()).toEqual(testBody)
        })
    })

    describe('URL manipulation', () => {
        it('should set URL from string', () => {
            builder.setUrl('https://newdomain.com/newpath')

            expect(builder.getUrl().toString()).toBe(
                'https://newdomain.com/newpath'
            )
        })

        it('should return cloned URL to prevent mutations', () => {
            const url = builder.getUrl()
            url.pathname = '/modified'

            expect(builder.getUrl().pathname).toBe('/path')
        })
    })

    describe('method manipulation', () => {
        it('should set method in uppercase', () => {
            builder.setMethod('get')

            expect(builder.getMethod()).toBe('GET')
        })

        it('should get current method', () => {
            expect(builder.getMethod()).toBe('POST')
        })
    })

    describe('final state', () => {
        it('should return complete final state', () => {
            builder.setHeader('x-test', 'value')
            builder.setBody('modified body')
            builder.setUrl('https://modified.com')
            builder.setMethod('PUT')

            const state = builder._getFinalState()

            expect(state.url.toString()).toBe('https://modified.com/')
            expect(state.method).toBe('PUT')
            expect(state.headers['x-test']).toBe('value')
            expect(state.body).toEqual(Buffer.from('modified body'))
        })

        it('should return cloned state to prevent mutations', () => {
            const state1 = builder._getFinalState()
            const state2 = builder._getFinalState()

            state1.headers['mutated'] = 'value'
            expect(state2.headers['mutated']).toBeUndefined()
        })
    })
})

describe('ResponseBuilder', () => {
    let builder: ResponseBuilder
    const testStatusCode = 200
    const testStatusMessage = 'OK'
    const testHeaders = {
        'content-type': 'application/json',
        'cache-control': 'no-cache',
    }
    const testBody = Buffer.from('{"response": "data"}')

    beforeEach(() => {
        builder = new ResponseBuilder(
            testStatusCode,
            testStatusMessage,
            testHeaders,
            testBody
        )
    })

    describe('header manipulation', () => {
        it('should add headers preserving existing values', () => {
            builder.addHeader('set-cookie', 'session=123')
            builder.addHeader('set-cookie', 'csrf=abc')

            const result = builder.getHeader('set-cookie')
            expect(result).toEqual(['session=123', 'csrf=abc'])
        })

        it('should set headers replacing existing values', () => {
            builder.setHeader('content-type', 'text/html')

            expect(builder.getHeader('content-type')).toBe('text/html')
        })

        it('should remove headers', () => {
            builder.removeHeader('cache-control')

            expect(builder.getHeader('cache-control')).toBeUndefined()
        })

        it('should get headers case-insensitively', () => {
            expect(builder.getHeader('Content-Type')).toBe('application/json')
            expect(builder.getHeader('CACHE-CONTROL')).toBe('no-cache')
        })
    })

    describe('body manipulation', () => {
        it('should set body from Buffer', () => {
            const newBody = Buffer.from('new response')
            builder.setBody(newBody)

            expect(builder.getBody()).toEqual(newBody)
            expect(builder.getHeader('content-length')).toBe('12')
        })

        it('should set body from string', () => {
            builder.setBody('string response')

            expect(builder.getBody()).toEqual(Buffer.from('string response'))
            expect(builder.getHeader('content-length')).toBe('15')
        })
    })

    describe('status manipulation', () => {
        it('should set status code', () => {
            builder.setStatusCode(404)

            expect(builder.getStatusCode()).toBe(404)
        })

        it('should set status message', () => {
            builder.setStatusMessage('Not Found')

            expect(builder.getStatusMessage()).toBe('Not Found')
        })
    })

    describe('final state', () => {
        it('should return complete final state', () => {
            builder.setStatusCode(201)
            builder.setStatusMessage('Created')
            builder.setHeader('location', '/resource/123')
            builder.setBody('{"id": 123}')

            const state = builder._getFinalState()

            expect(state.statusCode).toBe(201)
            expect(state.statusMessage).toBe('Created')
            expect(state.headers['location']).toBe('/resource/123')
            expect(state.body).toEqual(Buffer.from('{"id": 123}'))
        })

        it('should handle undefined status message', () => {
            const builderWithoutMessage = new ResponseBuilder(
                204,
                undefined,
                {}
            )
            const state = builderWithoutMessage._getFinalState()

            expect(state.statusMessage).toBeUndefined()
        })
    })
})
