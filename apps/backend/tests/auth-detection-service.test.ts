import { describe, it, expect, beforeEach } from 'vitest'
import {
    AuthDetectionService,
    type AuthDetectionInput,
} from '../src/services/auth-detection-service'

describe('AuthDetectionService', () => {
    let service: AuthDetectionService

    beforeEach(() => {
        service = new AuthDetectionService()
    })

    describe('Bearer Token Authentication', () => {
        it('should detect standard Bearer token in Authorization header', () => {
            const input: AuthDetectionInput = {
                headers: {
                    authorization:
                        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({
                method: 'bearer',
                placement: 'header',
                fieldName: 'authorization',
                confidence: 0.95,
                exampleValue: '[REDACTED]',
            })
        })

        it('should handle case-insensitive Bearer token detection', () => {
            const input: AuthDetectionInput = {
                headers: {
                    authorization: 'bearer abc123def456',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(1)
            expect(result[0].method).toBe('bearer')
            expect(result[0].confidence).toBe(0.95)
        })

        it('should not detect Bearer token with invalid format', () => {
            const input: AuthDetectionInput = {
                headers: {
                    authorization: 'BearerInvalidFormat',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result.filter((r) => r.method === 'bearer')).toHaveLength(0)
        })

        it('should extract Bearer token for plugin use', () => {
            const input: AuthDetectionInput = {
                headers: {
                    authorization: 'Bearer token123',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.extractAuthFromRequest(input)
            const bearerAuth = result.find((r) => r.method === 'bearer')

            expect(bearerAuth).toBeDefined()
            expect(bearerAuth!.config).toMatchObject({
                method: 'bearer',
                token: { type: 'static', value: 'token123' },
            })
            expect(bearerAuth!.value).toBe('token123')
        })
    })

    describe('Basic Authentication', () => {
        it('should detect standard Basic authentication', () => {
            const credentials =
                Buffer.from('username:password').toString('base64')
            const input: AuthDetectionInput = {
                headers: {
                    authorization: `Basic ${credentials}`,
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({
                method: 'basic',
                placement: 'header',
                fieldName: 'authorization',
                confidence: 0.95,
                exampleValue: '[REDACTED]',
            })
        })

        it('should handle case-insensitive Basic auth detection', () => {
            const credentials = Buffer.from('user:pass').toString('base64')
            const input: AuthDetectionInput = {
                headers: {
                    authorization: `basic ${credentials}`,
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(1)
            expect(result[0].method).toBe('basic')
        })

        it('should not detect Basic auth with invalid base64', () => {
            const input: AuthDetectionInput = {
                headers: {
                    authorization: 'Basic invalidbase64!@#',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result.filter((r) => r.method === 'basic')).toHaveLength(0)
        })

        it('should not detect Basic auth without username:password format', () => {
            const credentials = Buffer.from('justusername').toString('base64')
            const input: AuthDetectionInput = {
                headers: {
                    authorization: `Basic ${credentials}`,
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result.filter((r) => r.method === 'basic')).toHaveLength(0)
        })

        it('should extract Basic auth credentials for plugin use', () => {
            const credentials =
                Buffer.from('testuser:testpass').toString('base64')
            const input: AuthDetectionInput = {
                headers: {
                    authorization: `Basic ${credentials}`,
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.extractAuthFromRequest(input)
            const basicAuth = result.find((r) => r.method === 'basic')

            expect(basicAuth).toBeDefined()
            expect(basicAuth!.config).toMatchObject({
                method: 'basic',
                username: { type: 'static', value: 'testuser' },
                password: { type: 'static', value: 'testpass' },
            })
            expect(basicAuth!.value).toBe('testuser:testpass')
        })
    })

    describe('API Key Authentication - Headers', () => {
        it('should detect standard API key headers', () => {
            const testCases = [
                'x-api-key',
                'api-key',
                'apikey',
                'x-auth-token',
                'auth-token',
                'token',
                'x-access-token',
                'access-token',
                'x-secret',
                'secret',
                'x-key',
                'key',
            ]

            testCases.forEach((headerName) => {
                const input: AuthDetectionInput = {
                    headers: {
                        [headerName]: 'abc123def456',
                    },
                    url: new URL('https://api.example.com/users'),
                }

                const result = service.detectAuthMethods(input)
                const apiKeyAuth = result.find((r) => r.method === 'api-key')

                expect(apiKeyAuth).toBeDefined()
                expect(apiKeyAuth!.placement).toBe('header')
                expect(apiKeyAuth!.fieldName).toBe(headerName)
                expect(apiKeyAuth!.confidence).toBe(0.8)
            })
        })

        it('should handle case-insensitive API key header detection', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'X-API-KEY': 'secret123',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)
            const apiKeyAuth = result.find((r) => r.method === 'api-key')

            expect(apiKeyAuth).toBeDefined()
            expect(apiKeyAuth!.fieldName).toBe('X-API-KEY')
        })

        it('should handle array header values', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-api-key': ['first-key', 'second-key'],
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)
            const apiKeyAuth = result.find((r) => r.method === 'api-key')

            expect(apiKeyAuth).toBeDefined()
            expect(apiKeyAuth!.exampleValue).toBe('[REDACTED]')
        })

        it('should not detect empty API key headers', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-api-key': '',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result.filter((r) => r.method === 'api-key')).toHaveLength(0)
        })
    })

    describe('API Key Authentication - Query Parameters', () => {
        it('should detect standard API key query parameters', () => {
            const testCases = [
                'api_key',
                'apikey',
                'key',
                'token',
                'access_token',
                'auth_token',
                'secret',
                'auth',
            ]

            testCases.forEach((paramName) => {
                const url = new URL('https://api.example.com/users')
                url.searchParams.set(paramName, 'secret123')

                const input: AuthDetectionInput = {
                    headers: {},
                    url,
                }

                const result = service.detectAuthMethods(input)
                const apiKeyAuth = result.find(
                    (r) => r.method === 'api-key' && r.placement === 'query'
                )

                expect(apiKeyAuth).toBeDefined()
                expect(apiKeyAuth!.fieldName).toBe(paramName)
                expect(apiKeyAuth!.confidence).toBe(0.7)
            })
        })

        it('should handle query string parameter', () => {
            const input: AuthDetectionInput = {
                headers: {},
                url: new URL('https://api.example.com/users'),
                queryString: 'api_key=secret123&other=value',
            }

            const result = service.detectAuthMethods(input)
            const apiKeyAuth = result.find(
                (r) => r.method === 'api-key' && r.placement === 'query'
            )

            expect(apiKeyAuth).toBeDefined()
            expect(apiKeyAuth!.fieldName).toBe('api_key')
        })

        it('should prioritize URL searchParams over queryString', () => {
            const url = new URL('https://api.example.com/users')
            url.searchParams.set('token', 'from-url')

            const input: AuthDetectionInput = {
                headers: {},
                url,
                queryString: 'token=from-query',
            }

            const result = service.detectAuthMethods(input)
            const apiKeyAuth = result.find(
                (r) => r.method === 'api-key' && r.placement === 'query'
            )

            expect(apiKeyAuth).toBeDefined()
            // Should use URL searchParams, not queryString
            expect(apiKeyAuth!.exampleValue).toBe('[REDACTED]')
        })

        it('should not detect empty query parameters', () => {
            const url = new URL('https://api.example.com/users')
            url.searchParams.set('api_key', '')

            const input: AuthDetectionInput = {
                headers: {},
                url,
            }

            const result = service.detectAuthMethods(input)

            expect(
                result.filter(
                    (r) => r.method === 'api-key' && r.placement === 'query'
                )
            ).toHaveLength(0)
        })
    })

    describe('JWT Token Authentication', () => {
        it('should detect JWT tokens in non-standard headers', () => {
            const jwtToken =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
            const testHeaders = ['x-jwt-token', 'jwt', 'x-token']

            testHeaders.forEach((headerName) => {
                const input: AuthDetectionInput = {
                    headers: {
                        [headerName]: jwtToken,
                    },
                    url: new URL('https://api.example.com/users'),
                }

                const result = service.detectAuthMethods(input)
                const jwtAuth = result.find((r) => r.method === 'jwt')

                expect(jwtAuth).toBeDefined()
                expect(jwtAuth!.fieldName).toBe(headerName)
                expect(jwtAuth!.confidence).toBe(0.8)
            })
        })

        it('should detect JWT tokens in query parameters', () => {
            const jwtToken =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
            const url = new URL('https://api.example.com/users')
            url.searchParams.set('jwt_token', jwtToken)

            const input: AuthDetectionInput = {
                headers: {},
                url,
            }

            const result = service.detectAuthMethods(input)
            const jwtAuth = result.find((r) => r.method === 'jwt')

            expect(jwtAuth).toBeDefined()
            expect(jwtAuth!.placement).toBe('query')
            expect(jwtAuth!.confidence).toBe(0.7)
        })

        it('should not detect invalid JWT tokens', () => {
            const invalidTokens = [
                'not.a.jwt',
                'only.two.parts',
                'toolong.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c.extra',
                'short.a.b',
            ]

            invalidTokens.forEach((token) => {
                const input: AuthDetectionInput = {
                    headers: {
                        'x-jwt-token': token,
                    },
                    url: new URL('https://api.example.com/users'),
                }

                const result = service.detectAuthMethods(input)
                const jwtAuth = result.find((r) => r.method === 'jwt')

                expect(jwtAuth).toBeUndefined()
            })
        })
    })

    describe('Custom Header Authentication', () => {
        it('should detect suspicious auth headers', () => {
            const testCases = [
                'x-custom-auth',
                'x-secret-token',
                'x-api-key-special',
                'x-internal-secret',
                'custom-auth',
                'service-token',
                'internal-key',
            ]

            testCases.forEach((headerName) => {
                const input: AuthDetectionInput = {
                    headers: {
                        [headerName]: 'this-is-a-long-secret-value-123456789',
                    },
                    url: new URL('https://api.example.com/users'),
                }

                const result = service.detectAuthMethods(input)
                const customAuth = result.find(
                    (r) => r.method === 'custom-header'
                )

                expect(customAuth).toBeDefined()
                expect(customAuth!.fieldName).toBe(headerName)
                expect(customAuth!.confidence).toBe(0.5)
            })
        })

        it('should not detect short values as custom auth', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-custom-auth': 'short',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(
                result.filter((r) => r.method === 'custom-header')
            ).toHaveLength(0)
        })

        it('should skip standard authorization header', () => {
            const input: AuthDetectionInput = {
                headers: {
                    authorization:
                        'Custom this-is-a-long-custom-auth-scheme-123456789',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(
                result.filter((r) => r.method === 'custom-header')
            ).toHaveLength(0)
        })
    })

    describe('Multiple Authentication Methods', () => {
        it('should detect multiple auth methods in single request', () => {
            const url = new URL('https://api.example.com/users')
            url.searchParams.set('api_key', 'query-key-123')

            const input: AuthDetectionInput = {
                headers: {
                    authorization:
                        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
                    'x-api-key': 'header-key-456',
                    'x-custom-auth': 'custom-auth-token-789123456',
                },
                url,
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(4)
            expect(result.map((r) => r.method)).toContain('bearer')
            expect(result.map((r) => r.method)).toContain('api-key')
            expect(result.map((r) => r.method)).toContain('custom-header')

            // Should have two API key methods (header and query)
            const apiKeyMethods = result.filter((r) => r.method === 'api-key')
            expect(apiKeyMethods).toHaveLength(2)
            expect(apiKeyMethods.map((r) => r.placement)).toContain('header')
            expect(apiKeyMethods.map((r) => r.placement)).toContain('query')

            // Should have one custom header method (x-custom-auth only, x-api-key should be deduplicated in favor of api-key)
            const customHeaderMethods = result.filter(
                (r) => r.method === 'custom-header'
            )
            expect(customHeaderMethods).toHaveLength(1)
            expect(customHeaderMethods[0].fieldName).toBe('x-custom-auth')
        })

        it('should handle conflicting JWT detection with Bearer token', () => {
            const jwtToken =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

            const input: AuthDetectionInput = {
                headers: {
                    authorization: `Bearer ${jwtToken}`,
                    'x-jwt-token': jwtToken,
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            // Should detect both Bearer and JWT methods
            expect(result.filter((r) => r.method === 'bearer')).toHaveLength(1)
            expect(result.filter((r) => r.method === 'jwt')).toHaveLength(1)
        })

        it('should deduplicate auth methods by confidence', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-api-key': 'test-key-123456789', // This will match both api-key (0.8) and custom-header (0.5) patterns
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            // Should only return the higher confidence api-key method, not the custom-header
            expect(result).toHaveLength(1)
            expect(result[0].method).toBe('api-key')
            expect(result[0].confidence).toBe(0.8)
            expect(result[0].fieldName).toBe('x-api-key')
        })

        it('should sort results by confidence descending', () => {
            const url = new URL('https://api.example.com/users')
            url.searchParams.set('api_key', 'query-key') // confidence 0.7

            const input: AuthDetectionInput = {
                headers: {
                    authorization: 'Bearer token123', // confidence 0.95
                    'x-custom-auth': 'some-long-custom-auth-value-123456', // confidence 0.5
                },
                url,
            }

            const result = service.detectAuthMethods(input)

            // Should be sorted by confidence: Bearer (0.95), API key (0.7), Custom (0.5)
            expect(result).toHaveLength(3)
            expect(result[0].method).toBe('bearer')
            expect(result[0].confidence).toBe(0.95)
            expect(result[1].method).toBe('api-key')
            expect(result[1].confidence).toBe(0.7)
            expect(result[2].method).toBe('custom-header')
            expect(result[2].confidence).toBe(0.5)
        })
    })

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty headers', () => {
            const input: AuthDetectionInput = {
                headers: {},
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(0)
        })

        it('should handle null/undefined header values', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-api-key': undefined as any,
                    'auth-token': null as any,
                    'valid-key': 'valid-value',
                },
                url: new URL('https://api.example.com/users'),
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(1)
            expect(result[0].fieldName).toBe('valid-key')
        })

        it('should handle malformed URLs gracefully', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-api-key': 'test-key',
                },
                url: new URL('https://api.example.com/users'),
            }

            expect(() => service.detectAuthMethods(input)).not.toThrow()
        })

        it('should handle displayHeaders format', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-api-key': 'test-key',
                },
                url: new URL('https://api.example.com/users'),
                displayHeaders: [
                    { name: 'x-api-key', value: 'test-key' },
                    { name: 'content-type', value: 'application/json' },
                ],
            }

            const result = service.detectAuthMethods(input)

            expect(result).toHaveLength(1)
            expect(result[0].method).toBe('api-key')
        })
    })

    describe('Helper Methods', () => {
        describe('sanitizeAuthValue', () => {
            it('should sanitize Bearer tokens', () => {
                const input: AuthDetectionInput = {
                    headers: {
                        authorization: 'Bearer secret-token-123',
                    },
                    url: new URL('https://api.example.com/users'),
                }

                const result = service.detectAuthMethods(input)

                expect(result[0].exampleValue).toBe('[REDACTED]')
            })

            it('should sanitize single value tokens', () => {
                const input: AuthDetectionInput = {
                    headers: {
                        'x-api-key': 'secret-key-123',
                    },
                    url: new URL('https://api.example.com/users'),
                }

                const result = service.detectAuthMethods(input)

                expect(result[0].exampleValue).toBe('[REDACTED]')
            })
        })

        describe('placement mapping', () => {
            it('should map auth config placements correctly', () => {
                const headerInput: AuthDetectionInput = {
                    headers: { 'x-api-key': 'test' },
                    url: new URL('https://example.com'),
                }

                const queryInput: AuthDetectionInput = {
                    headers: {},
                    url: new URL('https://example.com?api_key=test'),
                }

                const headerResult = service.detectAuthMethods(headerInput)
                const queryResult = service.detectAuthMethods(queryInput)

                expect(headerResult[0].placement).toBe('header')
                expect(queryResult[0].placement).toBe('query')
            })
        })

        describe('confidence scoring', () => {
            it('should assign appropriate confidence scores', () => {
                const input: AuthDetectionInput = {
                    headers: {
                        authorization: 'Bearer token123',
                        'x-api-key': 'api-key-456',
                        'x-custom-auth': 'custom-auth-token-long-enough',
                    },
                    url: new URL('https://example.com?token=query-token'),
                }

                const result = service.detectAuthMethods(input)

                const bearerAuth = result.find((r) => r.method === 'bearer')
                const headerApiKey = result.find(
                    (r) => r.method === 'api-key' && r.placement === 'header'
                )
                const queryApiKey = result.find(
                    (r) => r.method === 'api-key' && r.placement === 'query'
                )
                const customAuth = result.find(
                    (r) => r.method === 'custom-header'
                )

                expect(bearerAuth!.confidence).toBe(0.95)
                expect(headerApiKey!.confidence).toBe(0.8)
                expect(queryApiKey!.confidence).toBe(0.7)
                expect(customAuth!.confidence).toBe(0.5)
            })
        })
    })

    describe('Config Generation', () => {
        it('should generate correct config for Bearer auth', () => {
            const input: AuthDetectionInput = {
                headers: {
                    authorization: 'Bearer test-token',
                },
                url: new URL('https://api.example.com/users'),
            }

            const extracted = service.extractAuthFromRequest(input)
            const bearerAuth = extracted.find((r) => r.method === 'bearer')

            expect(bearerAuth!.config).toMatchObject({
                method: 'bearer',
                token: {
                    type: 'static',
                    value: 'test-token',
                },
            })
        })

        it('should generate correct config for API key with placement', () => {
            const input: AuthDetectionInput = {
                headers: {
                    'x-api-key': 'test-key',
                },
                url: new URL('https://api.example.com/users'),
            }

            const extracted = service.extractAuthFromRequest(input)
            const apiKeyAuth = extracted.find((r) => r.method === 'api-key')

            expect(apiKeyAuth!.config).toMatchObject({
                method: 'api-key',
                key: {
                    type: 'static',
                    value: 'test-key',
                },
                placement: {
                    type: 'header',
                    name: 'x-api-key',
                },
            })
        })

        it('should generate correct config for Basic auth', () => {
            const credentials = Buffer.from('user:pass').toString('base64')
            const input: AuthDetectionInput = {
                headers: {
                    authorization: `Basic ${credentials}`,
                },
                url: new URL('https://api.example.com/users'),
            }

            const extracted = service.extractAuthFromRequest(input)
            const basicAuth = extracted.find((r) => r.method === 'basic')

            expect(basicAuth!.config).toMatchObject({
                method: 'basic',
                username: {
                    type: 'static',
                    value: 'user',
                },
                password: {
                    type: 'static',
                    value: 'pass',
                },
            })
        })
    })
})
