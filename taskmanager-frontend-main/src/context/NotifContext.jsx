import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { userAPI } from '../services/api'
import { useAuth } from './AuthContext'


const NotifContext = createContext(null)

function formatNotif(reminder) {
  const createdAt = reminder.created_at || reminder.sent_at || new Date().toISOString()
  const due = reminder.reminder_time

  const title = 'Task Reminder'
  const body = reminder.task_id ? `Reminder for task #${reminder.task_id}` : 'Deadline reminder'

  return {
    id: reminder.id,
    type: reminder.type === 'email' ? 'reminder' : (reminder.type || 'reminder'),
    title,
    body,
    time: new Date(createdAt).toLocaleString(),
    read: reminder.status !== 'pending'
  }
}

export function NotifProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const unread = notifications.filter(n => !n.read).length

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await userAPI.getNotifications({ limit: 20 })
      const list = (data || []).map(formatNotif)
      setNotifications(list)
    } catch (e) {
      console.error('Failed to load notifications', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    let mounted = true
    let inFlight = false

    const tick = async () => {
      if (!mounted) return
      if (inFlight) return
      inFlight = true
      try {
        await loadNotifications()
      } finally {
        inFlight = false
      }
    }

    tick()
    const t = setInterval(tick, 45000)

    return () => {
      mounted = false
      clearInterval(t)
    }
  }, [user, loadNotifications])



  const markRead = useCallback(async (id) => {
    try {
      await userAPI.markNotificationRead(id)
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    } catch (e) {
      console.error('Failed to mark notification read', e)
      toast.error('Failed to update notification')
    }
  }, [])

  const markAllRead = useCallback(async () => {
    // Best effort: mark all visible unread notifications read sequentially.
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    await Promise.all(unreadIds.map(id => userAPI.markNotificationRead(id).catch(() => null)))
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [notifications])

  const addNotification = useCallback((notif) => {
    // Not used with backend-driven notifications, but keep for compatibility.
    setNotifications(prev => [{ ...notif, id: notif.id ?? Date.now(), read: !!notif.read }, ...prev])
  }, [])

  return (
    <NotifContext.Provider value={{ notifications, unread, markRead, markAllRead, addNotification, loading }}>
      {children}
    </NotifContext.Provider>
  )
}

export const useNotif = () => useContext(NotifContext)

