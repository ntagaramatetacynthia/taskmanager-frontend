import axios from 'axios'

// Parent portal API. Deliberately a SEPARATE axios instance from services/api.js:
//  - it carries the parent token (signed with PARENT_JWT_SECRET), never the staff token
//  - its 401 handling only clears the parent session, not the whole localStorage
const BASE_URL = import.meta.env.VITE_API_URL || 'https://taskmanager-backend-1-9yaq.onrender.com'

export const PARENT_TOKEN_KEY = 'parentToken'
export const PARENT_INFO_KEY  = 'parentInfo'

const parentApi = axios.create({
  baseURL: `${BASE_URL}/api/parent`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

parentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(PARENT_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

parentApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLogin = (err.config?.url || '').includes('/login')
    if (err.response?.status === 401 && !isLogin) {
      clearParentSession()
      window.location.href = '/parent/login'
    }
    return Promise.reject(err)
  }
)

export const getParentSession = () => {
  const token = localStorage.getItem(PARENT_TOKEN_KEY)
  if (!token) return null
  try { return { token, info: JSON.parse(localStorage.getItem(PARENT_INFO_KEY) || 'null') } }
  catch { return { token, info: null } }
}

export const setParentSession = (token, info) => {
  localStorage.setItem(PARENT_TOKEN_KEY, token)
  localStorage.setItem(PARENT_INFO_KEY, JSON.stringify(info || null))
}

export const clearParentSession = () => {
  localStorage.removeItem(PARENT_TOKEN_KEY)
  localStorage.removeItem(PARENT_INFO_KEY)
}

export const parentAPI = {
  // Render cold starts can take ~50s, same allowance as the other login calls.
  login:        (data) => parentApi.post('/login', data, { timeout: 90000 }),
  dashboard:    ()     => parentApi.get('/dashboard'),
  teachers:     ()     => parentApi.get('/teachers'),
  myFeedback:   ()     => parentApi.get('/feedback'),
  sendFeedback: (data) => parentApi.post(`${BASE_URL}/api/parents/feedback`, data),
}

export default parentApi
