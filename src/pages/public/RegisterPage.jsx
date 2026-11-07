import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, ArrowLeft, CheckCircle, CreditCard, X, Copy, ArrowRight } from 'lucide-react'
import { orgAPI } from '../../services/api'
import { DISTRICTS_BY_PROVINCE } from '../../utils/rwandaData'
import { Spinner, Alert } from '../../components/ui/index.jsx'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const schema = z.object({
  name:              z.string().min(2, 'Organization name required'),
  type:              z.enum(['school', 'company'], { required_error: 'Select a type' }),
  district_id:       z.coerce.number().positive('Select a district'),
  contact_email:     z.string().email('Enter a valid email'),
  contact_phone:     z.string().min(10, 'Enter a valid phone number'),
  address:           z.string().optional(),
  subscription_type: z.enum(['monthly', 'quarterly', 'yearly']),
})

const PRICES = {
  school:  { monthly: 50000, quarterly: 135000, yearly: 480000 },
  company: { monthly: 75000, quarterly: 202500, yearly: 720000 },
}

export default function RegisterPage() {
  const [payModal, setPayModal] = useState(false)
  const [payStep, setPayStep]   = useState('idle')   // idle | processing | done
  const [orgData, setOrgData]   = useState(null)
  const [result, setResult]     = useState(null)     // { code, name, email }
  const [error, setError]       = useState('')
  const navigate                = useNavigate()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { subscription_type: 'monthly', type: 'school' }
  })

  const orgType = watch('type', 'school')
  const subType = watch('subscription_type', 'monthly')
  const price   = PRICES[orgType]?.[subType] || 0

  const onSubmit = (values) => {
    setError('')
    setOrgData(values)
    setPayModal(true)
  }

  const simulatePayment = async () => {
    setPayStep('processing')
    // Simulate payment processing delay
    await new Promise(r => setTimeout(r, 2000))
    try {
      const { data } = await orgAPI.register(orgData)
      setResult({ code: data.data.code, name: data.data.organization.name, email: orgData.contact_email })
      setPayStep('done')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
      setPayModal(false)
      setPayStep('idle')
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(result.code)
    toast.success('Code copied!')
  }

  return (
    <div className="min-h-screen bg-gov-light py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} /> Back to Home
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary-900 rounded-lg flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Register Organization</h1>
              <p className="text-xs text-gray-500">Schools and companies in Rwanda</p>
            </div>
          </div>

          {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Organization Name *</label>
              <input {...register('name')} placeholder="e.g. Kigali Secondary School" className="input" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type *</label>
                <select {...register('type')} className="input">
                  <option value="school">🏫 School</option>
                  <option value="company">🏢 Company</option>
                </select>
              </div>
              <div>
                <label className="label">District *</label>
                <select {...register('district_id')} className="input">
                  <option value="">— Select district —</option>
                  {Object.entries(DISTRICTS_BY_PROVINCE).map(([province, dists]) => (
                    <optgroup key={province} label={province}>
                      {dists.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.district_id && <p className="text-xs text-red-500 mt-1">{errors.district_id.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Contact Email *</label>
                <input {...register('contact_email')} type="email" placeholder="admin@org.rw" className="input" />
                {errors.contact_email && <p className="text-xs text-red-500 mt-1">{errors.contact_email.message}</p>}
              </div>
              <div>
                <label className="label">Phone *</label>
                <input {...register('contact_phone')} placeholder="+250 788 000 000" className="input" />
                {errors.contact_phone && <p className="text-xs text-red-500 mt-1">{errors.contact_phone.message}</p>}
              </div>
            </div>

            <div>
              <label className="label">Address</label>
              <input {...register('address')} placeholder="Kigali, Rwanda" className="input" />
            </div>

            <div>
              <label className="label">Subscription Plan *</label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {['monthly', 'quarterly', 'yearly'].map(plan => {
                  const amt      = PRICES[orgType]?.[plan] || 0
                  const discount = plan === 'quarterly' ? '10% off' : plan === 'yearly' ? '20% off' : null
                  return (
                    <label key={plan} className={clsx(
                      'relative flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all',
                      subType === plan ? 'border-primary-900 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    )}>
                      <input {...register('subscription_type')} type="radio" value={plan} className="sr-only" />
                      <span className="text-xs font-semibold text-gray-700 capitalize">{plan}</span>
                      <span className="text-sm font-bold text-primary-900 mt-0.5">{amt.toLocaleString()} RWF</span>
                      {discount && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full mt-1">{discount}</span>}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total due</p>
                <p className="text-xl font-bold text-primary-900">{price.toLocaleString()} RWF</p>
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary px-6 py-2.5">
                {isSubmitting ? <Spinner size="sm" /> : 'Proceed to Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">

            {/* Step 1: Payment */}
            {payStep === 'idle' && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-gray-900">Complete Payment</h3>
                  <button onClick={() => setPayModal(false)} className="p-1 rounded-md text-gray-400 hover:bg-gray-100">
                    <X size={18} />
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-5">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Organization</span>
                    <span className="font-medium">{orgData?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-medium capitalize">{orgData?.subscription_type}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                    <span>Total</span>
                    <span className="text-primary-900">{price.toLocaleString()} RWF</span>
                  </div>
                </div>
                <div className="space-y-2 mb-5">
                  {['Mobile Money (MTN/Airtel)', 'Bank Transfer', 'Credit Card'].map(method => (
                    <button key={method} className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-900 hover:bg-primary-50 transition-all text-sm text-left">
                      <CreditCard size={16} className="text-gray-400" />
                      {method}
                    </button>
                  ))}
                </div>
                <button onClick={simulatePayment} className="btn-primary w-full justify-center py-2.5">
                  Pay {price.toLocaleString()} RWF
                </button>
              </>
            )}

            {/* Step 2: Processing */}
            {payStep === 'processing' && (
              <div className="text-center py-8">
                <Spinner size="lg" className="mx-auto mb-4" />
                <p className="font-semibold text-gray-900">Processing Payment & Registering...</p>
                <p className="text-sm text-gray-500 mt-1">Please wait, do not close this window</p>
              </div>
            )}

            {/* Step 3: Done — show code + go to setup */}
            {payStep === 'done' && result && (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={28} className="text-emerald-600" />
                </div>
                <p className="font-bold text-gray-900 text-lg">You're Approved!</p>
                <p className="text-sm text-gray-500 mt-1 mb-5">
                  Payment confirmed. Your organization is now active.
                </p>

                {/* Org code display */}
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">Your Organization Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-center text-2xl font-bold tracking-widest text-emerald-800 bg-white border border-emerald-300 rounded-lg py-3">
                      {result.code}
                    </code>
                    <button onClick={copyCode} className="p-3 bg-white border border-emerald-300 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors" title="Copy">
                      <Copy size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2">
                    Share this code with your students/employees so they can join.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-left">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Next Step: Set Up Your Admin Account</p>
                  <p className="text-xs text-blue-700">Create your password to start managing your organization.</p>
                </div>

                <button
                  onClick={() => navigate('/setup-account', { state: { code: result.code, email: result.email } })}
                  className="btn-primary w-full justify-center py-2.5 flex items-center gap-2"
                >
                  Set Up My Account <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
