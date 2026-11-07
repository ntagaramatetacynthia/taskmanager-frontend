import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, Eye, EyeOff, Shield, Building2, Users } from 'lucide-react'
import { authAPI } from '../../services/api'
import { getApiErrorMessage } from '../../utils/apiError'
import { useAuth } from '../../context/AuthContext'
import { Spinner, Alert } from '../../components/ui/index.jsx'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

const TABS = [
  { id: 'user',           label: 'User Login',          icon: Users,     desc: 'Teachers, Students, Workers' },
  { id: 'district_admin', label: 'District Admin',       icon: Shield,    desc: 'District authority login'    },
]

const ROLE_ROUTES = {
  district_admin:    '/district',
  organization_admin:'/org',
  teacher:           '/teacher',
  worker:            '/teacher',
  student:           '/student',
  intern:            '/student',
}

export default function LoginPage() {
  const [tab, setTab]         = useState('user')
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')
  const { login }             = useAuth()
  const navigate              = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema)
  })

  const onSubmit = async (values) => {
    setError('')
    try {
      const fn = tab === 'district_admin' ? authAPI.districtAdminLogin : authAPI.login
      console.log('[LoginPage] endpoint:', tab, 'payload:', values);
      const { data } = await fn(values)


      login(data.data.token, {
        ...data.data.user,
        userType: data.data.user.type || tab
      })

      toast.success('Welcome back!')
      const role = data.data.user.role || data.data.user.type
      navigate(ROLE_ROUTES[role] || '/dashboard')
    } catch (err) {
      console.error('[LoginPage] login error:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        code: err.code,
        configUrl: err.config?.url,
      })
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'))
    }

  }

  return (
    <div className="min-h-screen bg-gov-light flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-primary-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gov-gold rounded-lg flex items-center justify-center">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Rwanda TMS</p>
            <p className="text-blue-300 text-sm">Task Management System</p>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-white leading-snug">
            Empowering Rwanda's<br />
            <span className="text-gov-gold">Schools & Companies</span>
          </h2>
          <p className="text-blue-200 mt-4 text-sm leading-relaxed max-w-sm">
            A government-grade multi-tenant platform for task management, accountability, and district-level oversight.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: Shield,    text: 'District-level administration & oversight' },
              { icon: Building2, text: 'Multi-tenant for schools and companies'    },
              { icon: Users,     text: 'Role-based access for all stakeholders'    },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white/10 rounded-md flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-gov-gold" />
                </div>
                <p className="text-blue-100 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-400 text-xs">© 2024 Rwanda Task Management System. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary-900 rounded-lg flex items-center justify-center">
              <GraduationCap size={18} className="text-white" />
            </div>
            <p className="font-bold text-gray-900">Rwanda TMS</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="text-sm text-gray-500 mt-1">Select your role and enter your credentials</p>

          {/* Tabs */}
          <div className="flex gap-2 mt-6 p-1 bg-gray-100 rounded-lg">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all',
                  tab === id
                    ? 'bg-white text-primary-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {error && <Alert type="error" message={error} />}

            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pr-10"
                  autoComplete="current-password"
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

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
              {isSubmitting ? <Spinner size="sm" /> : 'Sign In'}
            </button>
          </form>

          {/* Org code login link */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Student or Intern?{' '}
              <Link to="/join" className="text-primary-900 font-medium hover:underline">
                Join with Organization Code
              </Link>
            </p>
          </div>

          {/* Parent portal link */}
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">
              Parent or Guardian?{' '}
              <Link to="/parent/login" className="text-primary-900 font-medium hover:underline">
                Open Parent Portal
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              New organization?{' '}
              <Link to="/register" className="text-primary-900 font-medium hover:underline">
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">
              Registered but waiting for approval?{' '}
              <Link to="/org-status" className="text-primary-900 font-medium hover:underline">
                Check status & get your code
              </Link>
            </p>
          </div>


        </div>
      </div>
    </div>
  )
}
