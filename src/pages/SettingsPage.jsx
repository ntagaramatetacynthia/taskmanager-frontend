import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Lock, Bell, Edit2, Save } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { SectionHeader } from '../components/ui/index.jsx'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const pwSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password:     z.string().min(6, 'Min 6 characters'),
  confirm_password: z.string().min(1, 'Required'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match', path: ['confirm_password']
})

const TABS = [
  { id: 'profile',  label: 'Profile',       icon: User  },
  { id: 'security', label: 'Security',       icon: Lock  },
  { id: 'notif',    label: 'Notifications',  icon: Bell  },
]

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth()
  const [tab, setTab]                   = useState('profile')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile]   = useState(false)
  const [profileForm, setProfileForm]   = useState({
    name: '',
    phone: '',
  })

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(pwSchema)
  })

  const onSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await authAPI.updateProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || null,
      })
      await refreshProfile?.()
      setEditingProfile(false)
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const onChangePassword = async (values) => {
    try {
      await authAPI.changePassword(values)
      toast.success('Password changed successfully')
      reset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    }
  }

  return (
    <DashboardLayout title="Settings" subtitle="Manage your account preferences">
      <div className="max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === id
                  ? 'border-primary-900 text-primary-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === 'profile' && (
          <form onSubmit={onSaveProfile} className="card space-y-4">
            <SectionHeader
              title="Profile Information"
              action={
                !editingProfile ? (
                  <button
                    type="button"
                    onClick={() => setEditingProfile(true)}
                    className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <Edit2 size={13} /> Edit Profile
                  </button>
                ) : null
              }
            />
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-full bg-primary-900 flex items-center justify-center">
                <span className="text-white text-xl font-bold">{user?.name?.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <p className="text-xs text-gray-400 capitalize mt-0.5">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="input"
                  readOnly={!editingProfile}
                  required
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input value={user?.email || ''} className="input bg-gray-50" readOnly />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  value={profileForm.phone}
                  onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="input"
                  placeholder="Not set"
                  readOnly={!editingProfile}
                />
              </div>
              <div>
                <label className="label">Organization</label>
                <input value={user?.organization?.name || user?.district?.name || ''} className="input bg-gray-50" readOnly />
              </div>
            </div>
            {editingProfile && (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(false)
                    setProfileForm({ name: user?.name || '', phone: user?.phone || '' })
                  }}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                >
                  <Save size={13} /> {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        )}

        {/* Security tab */}
        {tab === 'security' && (
          <div className="card">
            <SectionHeader title="Change Password" />
            <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
              <div>
                <label className="label">Current Password *</label>
                <input {...register('current_password')} type="password" className="input" />
                {errors.current_password && <p className="text-xs text-red-500 mt-1">{errors.current_password.message}</p>}
              </div>
              <div>
                <label className="label">New Password *</label>
                <input {...register('new_password')} type="password" className="input" />
                {errors.new_password && <p className="text-xs text-red-500 mt-1">{errors.new_password.message}</p>}
              </div>
              <div>
                <label className="label">Confirm New Password *</label>
                <input {...register('confirm_password')} type="password" className="input" />
                {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Notifications tab */}
        {tab === 'notif' && (
          <div className="card space-y-4">
            <SectionHeader title="Notification Preferences" />
            {[
              { label: 'New task assigned',       desc: 'When a teacher assigns you a new task'     },
              { label: 'Deadline reminders',      desc: '24 hours before a task is due'             },
              { label: 'Submission graded',       desc: 'When your submission receives a grade'     },
              { label: 'Organization approvals',  desc: 'Status updates on approval requests'       },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary-900" />
              </div>
            ))}
            <button className="btn-primary text-xs py-1.5 px-4">Save Preferences</button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
