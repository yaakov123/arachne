import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type {
  CertResponse,
  HealthResponse,
  HostRecord,
  InventoryTree,
  ProxyStartResponse,
  ProxyStopResponse,
  CACreateResponse,
  CATrustResponse,
} from '@arachne/api-types'
import { HttpRoutes } from '@arachne/api-types'

export interface ApiClientOptions {
  basePath?: string // e.g. '' (use proxy) or 'http://127.0.0.1:8080'
  token?: string
}

export class ApiClient {
  private http: AxiosInstance
  private token?: string

  constructor(opts: ApiClientOptions = {}) {
    this.token = opts.token
    this.http = axios.create({
      baseURL: opts.basePath ?? '',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  setToken(token?: string) {
    this.token = token
  }

  private authHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : undefined
  }

  async health(): Promise<HealthResponse> {
    const { data } = await this.http.get<HealthResponse>(HttpRoutes.health)
    return data
  }

  async getInventory(): Promise<InventoryTree> {
    const { data } = await this.http.get<InventoryTree>(HttpRoutes.inventory, {
      headers: this.authHeaders(),
    })
    return data
  }

  async getHosts(): Promise<string[]> {
    const { data } = await this.http.get<string[]>(HttpRoutes.hosts, {
      headers: this.authHeaders(),
    })
    return data
  }

  async getHost(host: string): Promise<HostRecord> {
    const { data } = await this.http.get<HostRecord>(HttpRoutes.host(host), {
      headers: this.authHeaders(),
    })
    return data
  }

  async getCert(): Promise<CertResponse> {
    const { data } = await this.http.get<CertResponse>(HttpRoutes.cert, {
      headers: this.authHeaders(),
    })
    return data
  }

  // Proxy management methods
  async startProxy(): Promise<ProxyStartResponse> {
    const { data } = await this.http.post<ProxyStartResponse>(HttpRoutes.proxyStart, {}, {
      headers: this.authHeaders(),
    })
    return data
  }

  async stopProxy(): Promise<ProxyStopResponse> {
    const { data } = await this.http.post<ProxyStopResponse>(HttpRoutes.proxyStop, {}, {
      headers: this.authHeaders(),
    })
    return data
  }

  // Certificate Authority management methods
  async createCA(): Promise<CACreateResponse> {
    const { data } = await this.http.post<CACreateResponse>(HttpRoutes.caCreate, {}, {
      headers: this.authHeaders(),
    })
    return data
  }

  async trustCA(): Promise<CATrustResponse> {
    const { data } = await this.http.post<CATrustResponse>(HttpRoutes.caTrust, {}, {
      headers: this.authHeaders(),
    })
    return data
  }

  async untrustCA(): Promise<CATrustResponse> {
    const { data } = await this.http.post<CATrustResponse>(HttpRoutes.caUntrust, {}, {
      headers: this.authHeaders(),
    })
    return data
  }
}

export const api = new ApiClient()
