import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Phone, User, GraduationCap, CheckCircle2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { teacherAPI } from '../../services/api'
import { Badge, SectionHeader, Spinner, EmptyState } from '../ui/index.jsx'

export default function FeedbackInbox() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)
  const [markingId, setMarkingId] = useState(null)

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await teacherAPI.getFeedback()
      setMessages(data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load parent feedback inbox')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeedback()
  }, [loadFeedback])

  const handleMarkRead = async (id) => {
    setMarkingId(id)
    try {
      await teacherAPI.markFeedbackRead(id)
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, status: 'read', read_at: new Date().toISOString() } : msg))
      )
      toast.success('Marked as read')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update message status')
    } finally {
      setMarkingId(null)
    }
  }

  const unreadCount = messages.filter((m) => m.status === 'unread').length

  return (
    <div className="card mb-6" id="teacher-feedback-inbox">
      <SectionHeader
        title={`Parent Feedback Inbox${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        subtitle="Live messages from parents and guardians with direct student & contact details"
        action={
          <button
            type="button"
            onClick={loadFeedback}
            disabled={loading}
            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="py-10 flex justify-center">
          <Spinner />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No parent feedback yet"
          description="Messages sent by parents and guardians from the Parent Portal will appear here automatically."
        />
      ) : (
        <div className="divide-y divide-gray-100">
          {messages.map((item) => {
            const studentName = item.student?.name || item.student_name || 'Unknown Student'
            const studentCode =
              item.studentProfile?.student_id ||
              item.student?.studentProfile?.student_id ||
              item.student_code ||
              '—'
            const className = item.class?.name || '—'
            const guardianName =
              item.studentProfile?.guardian_name ||
              item.student?.studentProfile?.guardian_name ||
              item.parent_name ||
              item.guardian_name ||
              'Parent / Guardian'
            const guardianPhone =
              item.studentProfile?.guardian_phone ||
              item.student?.studentProfile?.guardian_phone ||
              item.parent_phone ||
              item.guardian_phone ||
              null
            const isUnread = item.status === 'unread'

            return (
              <div
                key={item.id}
                className={`py-4 px-3 rounded-lg transition-colors ${
                  isUnread ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {item.title || 'Parent Message'}
                    </h4>
                    <Badge status={isUnread ? 'pending' : 'approved'} />
                    <span className="text-xs text-gray-400">
                      {item.created_at || item.createdAt
                        ? new Date(item.created_at || item.createdAt).toLocaleString()
                        : ''}
                    </span>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      disabled={markingId === item.id}
                      onClick={() => handleMarkRead(item.id)}
                      className="text-xs font-medium text-primary-900 hover:underline inline-flex items-center gap-1"
                    >
                      <CheckCircle2 size={13} />
                      {markingId === item.id ? 'Marking...' : 'Mark as read'}
                    </button>
                  )}
                </div>

                <p className="text-sm text-gray-700 whitespace-pre-line mb-3">{item.message}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 bg-white/80 border border-gray-100 rounded-lg px-3 py-2">
                  <div className="inline-flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-primary-900" />
                    <span className="font-medium text-gray-900">{studentName}</span>
                    <span className="text-gray-400">({studentCode})</span>
                    {className !== '—' && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                        {className}
                      </span>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-1.5">
                    <User size={14} className="text-gray-400" />
                    <span>Guardian: <strong className="text-gray-800">{guardianName}</strong></span>
                  </div>

                  <div className="inline-flex items-center gap-1.5">
                    <Phone size={14} className="text-gov-green" />
                    {guardianPhone ? (
                      <a
                        href={`tel:${guardianPhone}`}
                        className="font-semibold text-primary-900 hover:underline"
                      >
                        {guardianPhone}
                      </a>
                    ) : (
                      <span className="text-gray-400">No phone on file</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
