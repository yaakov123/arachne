/**
 * HTTP Method and Status Code Color Utilities
 * Provides consistent color schemes across the application
 */

export interface ColorScheme {
  background: string
  color: string
}

/**
 * Get color scheme for HTTP methods
 */
export function getMethodColorScheme(method: string): ColorScheme {
  switch (method.toUpperCase()) {
    case 'GET':
      return { background: '#e3f2fd', color: '#1976d2' }
    case 'POST':
      return { background: '#e8f5e8', color: '#388e3c' }
    case 'PUT':
      return { background: '#fff3e0', color: '#f57c00' }
    case 'PATCH':
      return { background: '#fce4ec', color: '#c2185b' }
    case 'DELETE':
      return { background: '#ffebee', color: '#d32f2f' }
    case 'HEAD':
      return { background: '#f3e5f5', color: '#7b1fa2' }
    case 'OPTIONS':
      return { background: '#e0f2f1', color: '#00796b' }
    default:
      return { background: '#f5f5f5', color: '#616161' }
  }
}

/**
 * Get CSS class name for HTTP methods
 */
export function getMethodClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'method-get'
    case 'POST': return 'method-post'
    case 'PUT': return 'method-put'
    case 'PATCH': return 'method-patch'
    case 'DELETE': return 'method-delete'
    case 'HEAD': return 'method-head'
    case 'OPTIONS': return 'method-options'
    default: return 'method-other'
  }
}

/**
 * Get color scheme for HTTP status codes
 */
export function getStatusColorScheme(statusCode: number): ColorScheme {
  if (statusCode >= 200 && statusCode < 300) {
    return { background: '#e8f5e8', color: '#388e3c' }
  }
  if (statusCode >= 300 && statusCode < 400) {
    return { background: '#fff3e0', color: '#f57c00' }
  }
  if (statusCode >= 400 && statusCode < 500) {
    return { background: '#ffebee', color: '#d32f2f' }
  }
  if (statusCode >= 500) {
    return { background: '#ffebee', color: '#b71c1c' }
  }
  return { background: '#e3f2fd', color: '#1976d2' }
}

/**
 * Get CSS class name for HTTP status codes
 */
export function getStatusClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return 'status-success'
  if (statusCode >= 300 && statusCode < 400) return 'status-redirect'
  if (statusCode >= 400 && statusCode < 500) return 'status-client-error'
  if (statusCode >= 500) return 'status-server-error'
  return 'status-info'
}

/**
 * Get text color for HTTP status codes (for TrafficEntry usage)
 */
export function getStatusTextColor(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return '#388e3c'
  if (statusCode >= 300 && statusCode < 400) return '#f57c00'
  if (statusCode >= 400 && statusCode < 500) return '#d32f2f'
  if (statusCode >= 500) return '#b71c1c'
  return '#1976d2'
}
