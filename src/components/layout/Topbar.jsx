import { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown, Check, CheckCheck, X, Menu } from 'lucide-react'
import { useNotif } from '../../context/NotifContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

const NOTIF_ICONS = {
  task:     { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Task'     },
  approval: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Approval' },
  reminder: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Reminder' },
}

export default function Topbar({ title, subtitle, onMobileMenuToggle, isMobileMenuOpen }) {
  const { notifications, unread, markRead, markAllRead } = useNotif()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notifRef   = useRef(null)
  const profileRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))   setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 md:left-60 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 z-20">
      {/* Left: Title */}
      <div>
        <h1 className="text-base font-semibold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">

        {/* Mobile Menu Button */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-lg shadow-panel border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                <button onClick={markAllRead} className="text-xs text-primary-900 hover:underline flex items-center gap-1">
                  <CheckCheck size={12} /> Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No notifications</p>
                ) : notifications.map(n => {
                  const style = NOTIF_ICONS[n.type] || NOTIF_ICONS.task
                  return (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={clsx(
                        'flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                        !n.read && 'bg-blue-50/40'
                      )}
                    >
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold', style.bg, style.text)}>
                        {style.label[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 truncate">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 bg-primary-900 rounded-full mt-1 flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary-900 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-10 w-44 bg-white rounded-lg shadow-panel border border-gray-200 py-1 overflow-hidden">
              <button
                onClick={() => { navigate('/settings'); setProfileOpen(false) }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Profile & Settings
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
