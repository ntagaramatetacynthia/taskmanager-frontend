import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, CheckCircle, XCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { orgAPI, authAPI } from '../../services/api'
import { getApiErrorMessage } from '../../utils/apiError'
import { useAuth } from '../../context/AuthContext'
import { Spinner, Alert } from '../../components/ui/index.jsx'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const schema = z.object({
  organization_code: z.string().min(6, 'Enter a valid organization code'),
  student_id:        z.string().min(2, 'Enter your student/employee ID'),
  password:          z.string().min(6, 'Password must be at least 6 characters'),
})

export default function JoinPage() {
  const [orgInfo, setOrgInfo]   = useState(null)
  const [codeStatus, setCodeStatus] = useState(null) // 'valid' | 'invalid' | 'checking'
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const { login }               = useAuth()
  const navigate                = useNavigate()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema)
  })

  const code = watch('organization_code', '')

  const checkCode = async () => {
    if (code.length < 6) return
    setCodeStatus('checking')
    try {
      const { data } = await orgAPI.checkCode(code)
      setOrgInfo(data.data.organization)
      setCodeStatus('valid')
    } catch {
      setOrgInfo(null)
      setCodeStatus('invalid')
    }
  }

  const onSubmit = async (values) => {
    setError('')
    try {
      const { data } = await authAPI.orgCodeLogin(values)
      login(data.data.token, { ...data.data.user, userType: 'user' })
      toast.success('Welcome!')
      navigate('/student')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed. Check your credentials.'))
    }
  }

  return (
    <div className="min-h-screen bg-gov-light flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} /> Back to Login
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-900 rounded-lg flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Join Organization</h1>
              <p className="text-xs text-gray-500">For students and interns</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <Alert type="error" message={error} />}

            {/* Organization Code */}
            <div>
              <label className="label">Organization Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    {...register('organization_code')}
                    placeholder="e.g. GSB-2025"
                    className={clsx(
                      'input pr-8',
                      codeStatus === 'valid'   && 'border-emerald-400 focus:ring-emerald-500',
                      codeStatus === 'invalid' && 'border-red-400 focus:ring-red-500',
                    )}
                    onChange={(e) => {
                      register('organization_code').onChange(e)
                      setCodeStatus(null)
                      setOrgInfo(null)
                    }}
                  />
                  {codeStatus === 'valid'   && <CheckCircle size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />}
                  {codeStatus === 'invalid' && <XCircle    size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500"     />}
                </div>
                <button
                  type="button"
                  onClick={checkCode}
                  disabled={codeStatus === 'checking' || code.length < 6}
                  className="btn-secondary px-3 flex-shrink-0"
                >
                  {codeStatus === 'checking' ? <Spinner size="sm" /> : 'Verify'}
                </button>
              </div>
              {errors.organization_code && <p className="text-xs text-red-500 mt-1">{errors.organization_code.message}</p>}

              {/* Org info card */}
              {orgInfo && (
                <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-800">{orgInfo.name}</p>
                  </div>
                  <p className="text-xs text-emerald-600 mt-0.5 ml-5">
                    {orgInfo.type === 'school' ? '🏫 School' : '🏢 Company'} · {orgInfo.district}
                  </p>
                </div>
              )}
              {codeStatus === 'invalid' && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <XCircle size={12} /> Invalid or expired organization code
                </p>
              )}
            </div>

            {/* Student ID */}
            <div>
              <label className="label">Student / Employee ID</label>
              <input
                {...register('student_id')}
                placeholder="e.g. STD2024001"
                className="input"
              />
              {errors.student_id && <p className="text-xs text-red-500 mt-1">{errors.student_id.message}</p>}
              <p className="text-xs text-gray-400 mt-1">ID issued by your school or company</p>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || codeStatus !== 'valid'}
              className="btn-primary w-full justify-center py-2.5"
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
