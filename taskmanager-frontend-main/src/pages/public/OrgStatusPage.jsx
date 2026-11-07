import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowLeft, Search, CheckCircle, Clock, XCircle, Copy, ArrowRight } from 'lucide-react'
import { orgAPI } from '../../services/api'
import { Spinner, Alert } from '../../components/ui/index.jsx'
import toast from 'react-hot-toast'

export default function OrgStatusPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [org, setOrg]         = useState(null)
  const [error, setError]     = useState('')
  const navigate              = useNavigate()

  const check = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError(''); setOrg(null)
    try {
      const { data } = await orgAPI.checkMyStatus(email)
      setOrg(data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'No organization found with this email.')
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(org.code)
    toast.success('Code copied!')
  }

  return (
    <div className="min-h-screen bg-gov-light flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} /> Back to Home
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-900 rounded-lg flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Check Registration Status</h1>
              <p className="text-xs text-gray-500">Enter your organization's contact email</p>
            </div>
          </div>

          <form onSubmit={check} className="flex gap-2 mb-5">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contact@yourorg.rw"
              className="input flex-1"
              required
            />
            <button type="submit" disabled={loading} className="btn-primary px-4 flex-shrink-0">
              {loading ? <Spinner size="sm" /> : <Search size={15} />}
            </button>
          </form>

          {error && <Alert type="error" message={error} />}

          {org && (
            <div className="space-y-4">
              {/* Org info */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold text-gray-900">{org.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{org.type} · {org.district}</p>
              </div>

              {/* Status */}
              {org.status === 'pending' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={16} className="text-amber-600" />
                    <p className="font-semibold text-amber-800">Registration Processing</p>
                  </div>
                  <p className="text-xs text-amber-700">
                    Your registration is being processed. Please try again in a moment.
                  </p>
                </div>
              )}

              {org.status === 'rejected' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle size={16} className="text-red-600" />
                    <p className="font-semibold text-red-800">Registration Rejected</p>
                  </div>
                  {org.rejection_reason && (
                    <p className="text-xs text-red-700 mt-1">Reason: {org.rejection_reason}</p>
                  )}
                  <Link to="/register" className="inline-flex items-center gap-1 text-xs text-red-700 font-medium mt-2 hover:underline">
                    Apply again →
                  </Link>
                </div>
              )}

              {org.status === 'approved' && (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-emerald-600" />
                      <p className="font-semibold text-emerald-800">Approved!</p>
                    </div>
                    <p className="text-xs text-emerald-700 mb-3">
                      Your organization has been approved. Here is your unique organization code:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-center text-xl font-bold tracking-widest bg-white border-2 border-emerald-300 text-emerald-800 rounded-lg py-3 px-4">
                        {org.code}
                      </code>
                      <button
                        onClick={copyCode}
                        className="p-3 bg-white border border-emerald-300 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Copy code"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-emerald-600 mt-2">
                      Share this code with your students/interns so they can join.
                    </p>
                  </div>

                  {!org.account_setup ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Set Up Your Admin Account</p>
                      <p className="text-xs text-blue-700 mb-3">
                        Create your admin password to start managing your organization.
                      </p>
                      <button
                        onClick={() => navigate('/setup-account', { state: { code: org.code, email } })}
                        className="btn-primary w-full justify-center py-2 text-sm flex items-center gap-2"
                      >
                        Set Up Account <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm font-semibold text-gray-800 mb-1">Account Ready</p>
                      <p className="text-xs text-gray-500 mb-3">Your admin account is set up. Log in to manage your organization.</p>
                      <Link to="/login" className="btn-primary w-full justify-center py-2 text-sm flex items-center gap-2">
                        Go to Login <ArrowRight size={14} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Just registered?{' '}
              <Link to="/register" className="text-primary-900 font-medium hover:underline">Register here</Link>
              {' · '}
              <Link to="/login" className="text-primary-900 font-medium hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
