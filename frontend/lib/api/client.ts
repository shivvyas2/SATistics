/**
 * FastAPI Backend Client
 * Handles all API calls to the FastAPI backend
 */

import type { RunnerReviewItem } from '@/games/subway-surfers/types/game'
import type { Profile } from '@/lib/profile'
import type { CustomQuestion, Material } from '@/lib/materials'
import { isProtectedPath } from '@/lib/routes'

export interface Video {
  id: string
  title: string
  channel: string
  duration: string
  url: string
  thumbnail: string
  published: string
  trusted: boolean
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const ACCESS_KEY = 'auth_token'
const REFRESH_KEY = 'auth_refresh_token'
const EXPIRES_KEY = 'auth_expires_at'
// Refresh this many seconds before the access token expires
const REFRESH_MARGIN_SECONDS = 60
// The cookie only tells the middleware someone is signed in. It lasts as long as browsers allow
// and is renewed on every refresh, so an active session never runs out
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60
// Auth calls that must not trigger a refresh themselves
const NO_REFRESH_ENDPOINTS = ['/api/auth/login', '/api/auth/signup', '/api/auth/refresh', '/api/auth/logout']

// Fired on window when the session has ended and the user is signed out
export const SESSION_ENDED_EVENT = 'satistics:session-ended'

export interface SessionTokens {
  access_token: string
  refresh_token?: string | null
  // Unix seconds
  expires_at?: number | null
}

type RefreshResult = 'ok' | 'ended' | 'unavailable'

// The expiry inside a JWT, for sessions stored before expires_at was kept
function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private refreshToken: string | null = null
  private expiresAt: number | null = null
  // One refresh at a time, shared by every request waiting on it
  private refreshing: Promise<RefreshResult> | null = null

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
    if (typeof window !== 'undefined') {
      this.loadStoredSession()
      // Another tab signed in, out, or refreshed: use its session instead of a stale copy
      window.addEventListener('storage', (event) => {
        if (event.key === null || [ACCESS_KEY, REFRESH_KEY, EXPIRES_KEY].includes(event.key)) this.loadStoredSession()
      })
    }
  }

  private loadStoredSession() {
    this.token = localStorage.getItem(ACCESS_KEY) || document.cookie.match(/auth_token=([^;]+)/)?.[1] || null
    this.refreshToken = localStorage.getItem(REFRESH_KEY)
    const expiresAt = Number(localStorage.getItem(EXPIRES_KEY))
    this.expiresAt = expiresAt || (this.token ? tokenExpiry(this.token) : null)
  }

  // Stores a new session, or signs out with null
  setSession(tokens: SessionTokens | null) {
    this.token = tokens?.access_token ?? null
    this.refreshToken = tokens ? tokens.refresh_token ?? this.refreshToken : null
    this.expiresAt = tokens ? tokens.expires_at ?? tokenExpiry(tokens.access_token) : null
    if (typeof window === 'undefined') return
    if (tokens) {
      localStorage.setItem(ACCESS_KEY, tokens.access_token)
      if (this.refreshToken) localStorage.setItem(REFRESH_KEY, this.refreshToken)
      if (this.expiresAt) localStorage.setItem(EXPIRES_KEY, String(this.expiresAt))
      document.cookie = `auth_token=${tokens.access_token}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
    } else {
      ;[ACCESS_KEY, REFRESH_KEY, EXPIRES_KEY].forEach((key) => localStorage.removeItem(key))
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  }

  getToken(): string | null {
    return this.token
  }

  private expiresSoon(): boolean {
    return this.expiresAt !== null && Date.now() / 1000 > this.expiresAt - REFRESH_MARGIN_SECONDS
  }

  // Gets a new access token with the refresh token. Concurrent callers share one attempt
  private refreshSession(): Promise<RefreshResult> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private async doRefresh(): Promise<RefreshResult> {
    // Another tab may have refreshed already; reusing its session keeps the two from
    // spending the same refresh token
    const before = this.token
    this.loadStoredSession()
    if (this.token && this.token !== before && !this.expiresSoon()) return 'ok'
    if (!this.refreshToken) return 'ended'
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
        mode: 'cors',
        credentials: 'include',
      })
      if (response.status === 401 || response.status === 400) return 'ended'
      if (!response.ok) return 'unavailable'
      this.setSession(await response.json())
      return 'ok'
    } catch {
      // Offline or the server is down: the session may still be fine
      return 'unavailable'
    }
  }

  // Signs out locally and, on a page that needs an account, goes to the sign-in page
  private endSession() {
    this.setSession(null)
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT))
    const { pathname, search } = window.location
    if (isProtectedPath(pathname)) {
      window.location.assign(`/login?expired=1&redirect=${encodeURIComponent(pathname + search)}`)
    }
  }

  // Sends a request with the session, refreshing it first when it's about to expire and
  // once more if the server says it has. A session that can't be refreshed is ended
  private async send(endpoint: string, init: RequestInit, retried = false): Promise<Response> {
    const usesSession = !NO_REFRESH_ENDPOINTS.includes(endpoint)
    if (usesSession && this.token && this.expiresSoon()) {
      if ((await this.refreshSession()) === 'ended') this.endSession()
    }

    const headers = new Headers(init.headers)
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)
    const response = await fetch(`${this.baseUrl}${endpoint}`, { ...init, headers, mode: 'cors', credentials: 'include' })

    if (response.status === 401 && usesSession && this.token && !retried) {
      const result = await this.refreshSession()
      if (result === 'ok') return this.send(endpoint, init, true)
      if (result === 'ended') this.endSession()
    }
    return response
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await this.send(endpoint, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) || {}) },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(typeof error.detail === 'string' ? error.detail : `HTTP error! status: ${response.status}`)
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }

      return {} as T
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Authentication endpoints
  // acceptedTerms: the person confirmed they're 13 or older and agreed to the Terms and Privacy Policy
  async signup(email: string, password: string, acceptedTerms: boolean): Promise<{ success: boolean; error?: string; access_token?: string; user?: any }> {
    const response = await this.request<{ success: boolean; error?: string; user?: any } & Partial<SessionTokens>>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, accepted_terms: acceptedTerms }),
    })
    
    // A session comes back when email confirmation is off
    if (response.access_token) {
      this.setSession(response as SessionTokens)
    }
    
    return response
  }

  async login(email: string, password: string) {
    const response = await this.request<SessionTokens & { user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (response.access_token) {
      this.setSession(response)
    }
    
    return response
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      })
    } finally {
      // Always sign out locally, even if the request fails
      this.setSession(null)
    }
  }

  async getCurrentUser() {
    return this.request('/api/auth/me')
  }

  // Game endpoints
  async saveScore(gameId: string, analytics: any) {
    return this.request('/api/games/save-score', {
      method: 'POST',
      body: JSON.stringify({
        gameId,
        analytics,
      }),
    })
  }

  // Statistics endpoints
  async getUserStats(): Promise<any | null> {
    try {
      const result = await this.request<any>('/api/stats/user')
      // Return null if result is empty object
      return result && Object.keys(result).length > 0 ? result : null
    } catch (error) {
      return null
    }
  }

  async getRecentSessions(limit: number = 10): Promise<any[]> {
    try {
      const result = await this.request<any[]>(`/api/stats/sessions?limit=${limit}`)
      return Array.isArray(result) ? result : []
    } catch (error) {
      return []
    }
  }

  // Everything stored about the signed-in user, as JSON
  async exportMyData(): Promise<unknown> {
    return this.request('/api/profile/export')
  }

  // Deletes the account and all its data; there is no undo
  async deleteAccount(): Promise<void> {
    await this.request('/api/profile', { method: 'DELETE' })
    this.setSession(null)
  }

  // Every question of one saved game with the answer picked, for the answer review
  async getSessionReview(sessionId: string): Promise<RunnerReviewItem[]> {
    const result = await this.request<{ items: RunnerReviewItem[] }>(`/api/stats/sessions/${encodeURIComponent(sessionId)}/review`)
    return result.items ?? []
  }

  // Question endpoints
  async getQuestions(topic?: string, difficulty?: string, limit: number = 10) {
    const params = new URLSearchParams()
    if (topic) params.append('topic', topic)
    if (difficulty) params.append('difficulty', difficulty)
    params.append('limit', limit.toString())
    
    return this.request(`/api/questions/?${params.toString()}`)
  }

  // Get AI-generated personalized questions
  async getAIQuestions(limit: number = 50, useWebSearch: boolean = true, exam: string = 'sat', section: string = 'quant', pace?: string) {
    const params = new URLSearchParams()
    params.append('use_agent', 'true')
    params.append('limit', limit.toString())
    params.append('use_web_search', useWebSearch.toString())
    params.append('exam', exam)
    params.append('section', section)
    if (pace) params.append('pace', pace)
    
    return this.request<{ questions: any[], total: number }>(`/api/questions/?${params.toString()}`)
  }

  // Profile endpoints
  async getProfile(): Promise<Profile | null> {
    const result = await this.request<{ profile: Profile | null }>('/api/profile')
    return result.profile
  }

  async saveProfile(profile: Profile): Promise<Profile> {
    const result = await this.request<{ profile: Profile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
    return result.profile
  }

  // Lesson videos for one course topic
  async getTopicVideos(exam: string, section: string, topic: string, limit = 6): Promise<Video[]> {
    const params = new URLSearchParams({ exam, section, topic, limit: String(limit) })
    const result = await this.request<{ videos: Video[] }>(`/api/learn/videos?${params.toString()}`)
    return result.videos ?? []
  }

  // Study material endpoints
  async uploadMaterial(input: { exam: string; section: string; name: string; text: string; generate: boolean; file: File | null }) {
    const form = new FormData()
    form.append('exam', input.exam)
    form.append('section', input.section)
    form.append('name', input.name)
    form.append('text', input.text)
    form.append('generate', String(input.generate))
    if (input.file) form.append('file', input.file)

    // Sent with fetch directly so the browser sets the multipart boundary itself
    const response = await this.send('/api/materials', { method: 'POST', body: form })
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    if (!response.ok) throw new Error(body.detail || `HTTP error! status: ${response.status}`)
    return body as { material: Material; questions: CustomQuestion[] }
  }

  async getMaterials(): Promise<Material[]> {
    const result = await this.request<{ materials: Material[] }>('/api/materials')
    return result.materials
  }

  async getMaterialQuestions(materialId: string): Promise<CustomQuestion[]> {
    const result = await this.request<{ questions: CustomQuestion[] }>(`/api/materials/${materialId}/questions`)
    return result.questions
  }

  async updateCustomQuestion(questionId: number, changes: Partial<Pick<CustomQuestion, 'correct_answer' | 'status'>>): Promise<CustomQuestion> {
    const result = await this.request<{ question: CustomQuestion }>(`/api/materials/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
    return result.question
  }

  async deleteCustomQuestion(questionId: number) {
    return this.request(`/api/materials/questions/${questionId}`, { method: 'DELETE' })
  }

  async approveAllQuestions(materialId: string) {
    return this.request<{ approved: number; needs_answer: number }>(`/api/materials/${materialId}/approve-all`, { method: 'POST' })
  }

  async deleteMaterial(materialId: string) {
    return this.request(`/api/materials/${materialId}`, { method: 'DELETE' })
  }

  async getTopics() {
    return this.request('/api/questions/topics')
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

