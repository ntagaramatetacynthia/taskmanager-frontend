import axios from 'axios'

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/api\/?$/, '')
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3000'
  }
  return 'https://taskmanager-frontend-1-vzke.onrender.com'
}

const BASE_URL = getBaseUrl()

// The backend runs on a free Render instance that spins down when idle and needs
// ~50s to cold start, so auth calls wait longer than regular requests.
const AUTH_TIMEOUT = 90000

const api = axios.create({
  baseURL: BASE_URL ? `${BASE_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only auto-redirect on 401 for authenticated requests (not login endpoints)
    const url = err.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/district-admin/login') || url.includes('/auth/organization-login')
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login:              (data) => api.post('/auth/login', data, { timeout: AUTH_TIMEOUT }),
  districtAdminLogin: (data) => api.post('/auth/district-admin/login', data, { timeout: AUTH_TIMEOUT }),
  orgCodeLogin:       (data) => api.post('/auth/organization-login', data, { timeout: AUTH_TIMEOUT }),
  getProfile:         ()     => api.get('/auth/profile'),
  updateProfile:      (data) => api.put('/auth/profile', data),
  logout:             ()     => api.post('/auth/logout'),
  changePassword:     (data) => api.put('/auth/change-password', data),
}

export const teacherAPI = {
  getFeedback:      ()   => api.get('/teachers/feedback'),
  markFeedbackRead: (id) => api.patch(`/teachers/feedback/${id}/read`),
}

export const districtAPI = {
  getPending: ()         => api.get('/district/organizations/pending'),
  getAll:     (params)   => api.get('/district/organizations', { params }),
  approve:    (id, data) => api.put(`/district/organizations/approve/${id}`, data),
  reject:     (id, data) => api.put(`/district/organizations/reject/${id}`, data),
  suspend:    (id, data) => api.put(`/district/organizations/suspend/${id}`, data),
  getStats:   ()         => api.get('/district/stats'),
  getPayments:(params)   => api.get('/district/payments', { params }),
}

export const orgAPI = {
  getDistricts:  ()       => api.get('/organizations/districts'),
  checkCode:     (code)   => api.get(`/organizations/check-code/${code}`),
  checkMyStatus: (email)  => api.get('/organizations/my-status', { params: { email } }),
  setupAccount:  (data)   => api.post('/organizations/setup-account', data),
  register:      (data)   => api.post('/organizations/register', data),
  getProfile:    ()       => api.get('/organizations/profile'),
  updateProfile: (data)   => api.put('/organizations/profile', data),
  getStats:      ()       => api.get('/organizations/stats'),
}

export const userAPI = {
  create:         (data)           => api.post('/users', data),
  getAll:         (params)         => api.get('/users', { params }),
  getById:        (id)             => api.get(`/users/${id}`),
  update:         (id, d)          => api.put(`/users/${id}`, d),
  remove:         (id)             => api.delete(`/users/${id}`),
  bulkImport:     (form)           => api.post('/users/bulk-import', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getStudentDashboard: ()          => api.get('/users/student/dashboard'),
  getNotifications: (params)      => api.get('/users/notifications', { params }),
  markNotificationRead: (id)      => api.patch(`/users/notifications/${id}/read`),
}


export const studentAPI = {
  bulkUpload:       (formData) => api.post('/students/bulk-upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadTemplate: ()         => api.get('/students/template', { responseType: 'blob' }),
  remove:           (id)       => api.delete(`/students/${id}`),
}

export const classAPI = {
  create:        (data)              => api.post('/classes', data),
  getAll:        (params)            => api.get('/classes', { params }),
  getById:       (id)                => api.get(`/classes/${id}`),
  update:        (id, d)             => api.put(`/classes/${id}`, d),
  remove:        (id)                => api.delete(`/classes/${id}`),
  getStats:      (id)                => api.get(`/classes/${id}/stats`),
  addStudent:    (id, student_id)    => api.post(`/classes/${id}/students`, { student_id }),
  removeStudent: (id, studentId)     => api.delete(`/classes/${id}/students/${studentId}`),
  addSubject:    (id, data)          => api.post(`/classes/${id}/subjects`, data),
}

// Verified focus sessions are owned by the API: the client may only ask to start, pause,
// resume or complete one. Focused time itself is accrued server-side.
export const focusAPI = {
  status:       (taskId)          => api.get(`/focus/tasks/${taskId}/status`),
  start:        (taskId)          => api.post(`/focus/tasks/${taskId}/sessions`),
  heartbeat:    (sessionId)       => api.post(`/focus/sessions/${sessionId}/heartbeat`),
  pause:        (sessionId, body) => api.post(`/focus/sessions/${sessionId}/pause`, body || {}),
  resume:       (sessionId)       => api.post(`/focus/sessions/${sessionId}/resume`),
  complete:     (sessionId)       => api.post(`/focus/sessions/${sessionId}/complete`),
  abandon:      (sessionId)       => api.post(`/focus/sessions/${sessionId}/abandon`),
  taskSessions: (taskId)          => api.get(`/focus/tasks/${taskId}/sessions`),
}

export const taskAPI = {
  create:         (data)         => api.post('/tasks', data),
  getAll:         (params)       => api.get('/tasks', { params }),
  getById:        (id)           => api.get(`/tasks/${id}`),
  update:         (id, d)        => api.put(`/tasks/${id}`, d),
  remove:         (id)           => api.delete(`/tasks/${id}`),
  submit:         (id, form)     => api.post(`/tasks/${id}/submit`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  grade:          (id, subId, d) => api.put(`/tasks/${id}/submissions/${subId}/grade`, d),
  getSubmissions: (id)           => api.get(`/tasks/${id}/submissions`),
  // Worksheet attached by the teacher. The bytes are fetched through axios (not a plain
  // <a href>) so the request carries the auth token and stays authorized.
  uploadAttachment: (id, form)   => api.post(`/tasks/${id}/attachment`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeAttachment: (id)         => api.delete(`/tasks/${id}/attachment`),
  fetchAttachment:  (id)         => api.get(`/tasks/${id}/attachment`, { responseType: 'blob' }),
  fetchSubmissionFile: (id, subId) => api.get(`/tasks/${id}/submissions/${subId}/file`, { responseType: 'blob' }),
}

export default api
