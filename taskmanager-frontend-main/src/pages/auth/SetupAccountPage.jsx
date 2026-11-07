import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { orgAPI, authAPI } from '../../services/api'
import { getApiErrorMessage } from '../../utils/apiError'
import { useAuth } from '../../context/AuthContext'
import { Spinner, Alert } from '../../components/ui/index.jsx'
import toast from 'react-hot-toast'

const schema = z.object({
  organization_code: z.string().min(6, 'Enter your organization code'),
  contact_email:     z.string().email('Enter a valid email'),
  admin_name:        z.string().min(2, 'Enter your full name'),
  password:          z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password:  z.string().min(1, 'Confirm your password'),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export default function SetupAccountPage() {
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')
  const navigate              = useNavigate()
  const location              = useLocation()
  const { login }             = useAuth()
  const prefill               = location.state || {}

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      organization_code: prefill.code  || '',
      contact_email:     prefill.email || '',
    }
  })

  const onSubmit = async (values) => {
    setError('')
    try {
      await orgAPI.setupAccount({
        organization_code: values.organization_code.trim().toUpperCase(),
        contact_email:     values.contact_email,
        admin_name:        values.admin_name,
        password:          values.password,
      })
      // Auto-login after setup
      const { data } = await authAPI.login({
        email:    values.contact_email,
        password: values.password,
      })
      login(data.data.token, {
        ...data.data.user,
        userType: data.data.user.type || 'user',
      })
      toast.success('Account ready! Welcome to your dashboard.')
      navigate('/org')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Setup failed. Please check your details.'))
    }
  }

  return (
    <div className="min-h-screen bg-gov-light flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/org-status" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-900 rounded-lg flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Set Up Admin Account</h1>
              <p className="text-xs text-gray-500">Create your organization admin password</p>
            </div>
          </div>

          {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Organization Code *</label>
              <input
                {...register('organization_code')}
                placeholder="e.g. GSB-8821"
                className="input font-mono tracking-widest uppercase"
              />
              {errors.organization_code && <p className="text-xs text-red-500 mt-1">{errors.organization_code.message}</p>}
              <p className="text-xs text-gray-400 mt-1">The code you received after approval</p>
            </div>

            <div>
              <label className="label">Contact Email *</label>
              <input
                {...register('contact_email')}
                type="email"
                placeholder="admin@yourorg.rw"
                className="input"
              />
              {errors.contact_email && <p className="text-xs text-red-500 mt-1">{errors.contact_email.message}</p>}
              <p className="text-xs text-gray-400 mt-1">Must match the email used during registration</p>
            </div>

            <div>
              <label className="label">Your Full Name *</label>
              <input
                {...register('admin_name')}
                placeholder="e.g. Jean Bosco Uwimana"
                className="input"
              />
              {errors.admin_name && <p className="text-xs text-red-500 mt-1">{errors.admin_name.message}</p>}
            </div>

            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 6 characters"
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

            <div>
              <label className="label">Confirm Password *</label>
              <input
                {...register('confirm_password')}
                type="password"
                placeholder="Repeat password"
                className="input"
              />
              {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5 mt-2">
              {isSubmitting ? <Spinner size="sm" /> : 'Create Admin Account'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-900 font-medium hover:underline">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
