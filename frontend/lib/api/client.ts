/**
 * FastAPI Backend Client
 * Handles all API calls to the FastAPI backend
 */

import type { Profile } from '@/lib/profile'
import type { CustomQuestion, Material } from '@/lib/materials'

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

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
    // Load token from localStorage or cookies on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
      // If not in localStorage, try to get from cookie
      if (!this.token) {
        const cookieMatch = document.cookie.match(/auth_token=([^;]+)/)
        if (cookieMatch) {
          this.token = cookieMatch[1]
          // Sync back to localStorage
          localStorage.setItem('auth_token', this.token)
        }
      }
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token)
        // Also set cookie for middleware auth check
        document.cookie = `auth_token=${token}; path=/; max-age=604800; SameSite=Lax`
      } else {
        localStorage.removeItem('auth_token')
        // Clear cookie on logout
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
    }
  }

  getToken(): string | null {
    return this.token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const config: RequestInit = {
      ...options,
      headers,
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'include', // Include credentials for CORS
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(error.detail || `HTTP error! status: ${response.status}`)
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
  async signup(email: string, password: string): Promise<{ success: boolean; error?: string; access_token?: string; user?: any }> {
    const response = await this.request<{ success: boolean; error?: string; access_token?: string; user?: any }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    
    // If access token is returned (email confirmation disabled), store it
    if (response.access_token) {
      this.setToken(response.access_token)
    }
    
    return response
  }

  async login(email: string, password: string) {
    const response = await this.request<{ access_token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    
    // Store token
    if (response.access_token) {
      this.setToken(response.access_token)
    }
    
    return response
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      })
    } finally {
      // Always clear token even if request fails
      this.setToken(null)
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
    const response = await fetch(`${this.baseUrl}/api/materials`, {
      method: 'POST',
      body: form,
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    })
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

