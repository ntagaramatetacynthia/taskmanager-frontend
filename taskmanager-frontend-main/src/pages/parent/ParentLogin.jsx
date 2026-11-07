import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Building2, IdCard, Phone, ArrowLeft } from 'lucide-react'
import { parentAPI, setParentSession } from '../../services/parentApi'
import { Alert, Spinner } from '../../components/ui/index.jsx'

export default function ParentLogin() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ organization_code: '', student_id: '', guardian_phone: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await parentAPI.login({
        organization_code: form.organization_code.trim().toUpperCase(),
        student_id:        form.student_id.trim(),
        guardian_phone:    form.guardian_phone.trim(),
      })
      setParentSession(data.data.token, data.data.parent)
      navigate('/parent/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gov-light px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-900 mb-4">
          <ArrowLeft size={16} /> Back to staff &amp; student login
        </Link>

        <div className="card shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary-900 text-white flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-900">Parent Portal</h1>
              <p className="text-sm text-gray-500">Follow your child's progress</p>
            </div>
          </div>

          {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

          <form id="parent-login-form" onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="parent-org-code" className="label">Organization Code</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="parent-org-code" name="organization_code" className="input pl-9 uppercase"
                  placeholder="e.g. RW-KGL-2026" value={form.organization_code} onChange={onChange}
                  autoComplete="organization" required />
              </div>
            </div>

            <div>
              <label htmlFor="parent-student-id" className="label">Student ID</label>
              <div className="relative">
                <IdCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="parent-student-id" name="student_id" className="input pl-9"
                  placeholder="Your child's student ID" value={form.student_id} onChange={onChange} required />
              </div>
            </div>

            <div>
              <label htmlFor="parent-phone" className="label">Guardian Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="parent-phone" name="guardian_phone" type="tel" className="input pl-9"
                  placeholder="07X XXX XXXX" value={form.guardian_phone} onChange={onChange}
                  autoComplete="tel" required />
              </div>
              <p className="text-xs text-gray-500 mt-1">Use the phone number registered with the school.</p>
            </div>

            <button id="parent-login-submit" type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><Spinner size="sm" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
