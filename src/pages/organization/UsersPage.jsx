import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Search, Trash2, Edit2, Upload } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Badge, DataTable, Modal, Pagination, Spinner } from '../../components/ui/index.jsx'
import BulkUploadStudentsModal from '../../components/student/BulkUploadStudentsModal.jsx'
import { userAPI, classAPI } from '../../services/api'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const schema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone:    z.string().optional().or(z.literal('')),
  role:     z.enum(['teacher', 'worker', 'organization_admin']),
})

const ROLE_FILTERS = ['all', 'organization_admin', 'teacher', 'worker', 'student', 'intern']

export default function UsersPage() {
  const [users, setUsers]               = useState([])
  const [classes, setClasses]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('all')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [pages, setPages]               = useState(1)
  const [modal, setModal]                           = useState(false)
  const [bulkStudentModal, setBulkStudentModal]     = useState(false)
  const [submitting, setSubmitting]                 = useState(false)
  const [editingUser, setEditingUser]   = useState(null)
  const [loadingEdit, setLoadingEdit]   = useState(false)
  const [editForm, setEditForm]         = useState({
    name: '',
    email: '',
    phone: '',
    role: 'teacher',
    status: 'active',
    guardian_name: '',
    guardian_phone: '',
    class_id: '',
    department: '',
    position: '',
    employment_type: 'full_time',
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 10 }
      if (filter !== 'all') params.role = filter
      const { data } = await userAPI.getAll(params)
      setUsers(data.data || [])
      setPages(data.pagination?.pages || 1)
    } catch { setUsers([]) }
    finally { setLoading(false) }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    classAPI.getAll({ limit: 100 })
      .then(({ data }) => setClasses(data.data || []))
      .catch(() => {})
  }, [])

  const openEditUser = async (row) => {
    setEditingUser(row)
    setEditForm({
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      role: row.role || 'teacher',
      status: row.status || 'active',
      guardian_name: row.studentProfile?.guardian_name || '',
      guardian_phone: row.studentProfile?.guardian_phone || '',
      class_id: row.studentProfile?.class_id || '',
      department: row.employeeProfile?.department || '',
      position: row.employeeProfile?.position || '',
      employment_type: row.employeeProfile?.employment_type || 'full_time',
    })
    setLoadingEdit(true)
    try {
      const { data } = await userAPI.getById(row.id)
      const fresh = data.data || row
      setEditingUser(fresh)
      setEditForm({
        name: fresh.name || '',
        email: fresh.email || '',
        phone: fresh.phone || '',
        role: fresh.role || 'teacher',
        status: fresh.status || 'active',
        guardian_name: fresh.studentProfile?.guardian_name || '',
        guardian_phone: fresh.studentProfile?.guardian_phone || '',
        class_id: fresh.studentProfile?.class_id || '',
        department: fresh.employeeProfile?.department || '',
        position: fresh.employeeProfile?.position || '',
        employment_type: fresh.employeeProfile?.employment_type || 'full_time',
      })
    } catch {
      // Fallback to row data already populated
    } finally {
      setLoadingEdit(false)
    }
  }

  const onUpdateUser = async (e) => {
    e.preventDefault()
    if (!editingUser?.id) return
    setSubmitting(true)
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        status: editForm.status,
      }
      if (['student', 'intern'].includes(editForm.role)) {
        payload.guardian_name = editForm.guardian_name.trim() || null
        payload.guardian_phone = editForm.guardian_phone.trim() || null
        payload.class_id = editForm.class_id ? Number(editForm.class_id) : null
      } else if (['teacher', 'worker'].includes(editForm.role)) {
        payload.department = editForm.department.trim() || null
        payload.position = editForm.position.trim() || null
        payload.employment_type = editForm.employment_type
      }
      await userAPI.update(editingUser.id, payload)
      toast.success('User profile updated successfully')
      setEditingUser(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  const onCreate = async (values) => {
    setSubmitting(true)
    try {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
        ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
      }
      await userAPI.create(payload)
      toast.success('User created successfully')
      setModal(false)
      reset()
      load()
    } catch (err) {
      const details = err.response?.data?.details
      const detailMsg = Array.isArray(details) ? details.map(d => d.message).join(', ') : null
      toast.error(detailMsg || err.response?.data?.message || 'Failed to create user')
    } finally { setSubmitting(false) }
  }

  const onDelete = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return
    try {
      await userAPI.remove(id)
      toast.success('User deleted successfully')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user')
    }
  }

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    { key: 'name',  label: 'User',
      render: r => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{r.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-400">{r.email}</p>
          </div>
        </div>
      )
    },
    { key: 'phone',  label: 'Phone',  render: r => <span className="text-xs text-gray-500">{r.phone || r.studentProfile?.guardian_phone || '—'}</span> },
    { key: 'role',   label: 'Role',   render: r => <Badge status={r.role} /> },
    { key: 'status', label: 'Status', render: r => <Badge status={r.status} /> },
    { key: 'created_at', label: 'Added',
      render: r => <span className="text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span>
    },
    { key: 'actions', label: '',
      render: r => (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => openEditUser(r)}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-primary-900 transition-colors"
            title="Edit User & Profile"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(r.id, r.name)}
            className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete User"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )
    },
  ]

  return (
    <DashboardLayout title="Staff & Users" subtitle="Manage teachers, workers, students, and admins">
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input pl-9" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ROLE_FILTERS.map(r => (
              <button key={r} onClick={() => { setFilter(r); setPage(1) }}
                className={clsx('px-3 py-1.5 text-xs rounded-md font-medium capitalize transition-colors',
                  filter === r ? 'bg-primary-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >{r}</button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBulkStudentModal(true)}
            className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0 inline-flex items-center gap-1.5 border-primary-200 text-primary-900 font-medium hover:bg-blue-50"
          >
            <Upload size={13} /> Bulk Upload Students
          </button>
          <button onClick={() => { reset(); setModal(true) }} className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
            <UserPlus size={13} /> Add User
          </button>
        </div>

        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No users found" />
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>

      {/* Create User Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create New User">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name *</label>
              <input {...register('name')} placeholder="John Doe" className="input" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Role *</label>
              <select {...register('role')} className="input">
                <option value="teacher">Teacher</option>
                <option value="worker">Worker</option>
                <option value="organization_admin">Org Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input {...register('email')} type="email" placeholder="user@org.rw" className="input" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Password *</label>
              <input {...register('password')} type="password" placeholder="Min 6 chars" className="input" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Phone</label>
              <input {...register('phone')} placeholder="+250 788 000 000" className="input" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User & Profile Modal */}
      <Modal open={Boolean(editingUser)} onClose={() => setEditingUser(null)} title="Edit User & Profile">
        {loadingEdit ? (
          <div className="py-8 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={onUpdateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name *</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+250 788 000 000"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  className="input"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {['student', 'intern'].includes(editForm.role) && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Student & Guardian Profile ({editingUser?.studentProfile?.student_id || 'Student'})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Class</label>
                    <select
                      value={editForm.class_id}
                      onChange={e => setEditForm({ ...editForm, class_id: e.target.value })}
                      className="input"
                    >
                      <option value="">— Unassigned —</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Guardian Name</label>
                    <input
                      value={editForm.guardian_name}
                      onChange={e => setEditForm({ ...editForm, guardian_name: e.target.value })}
                      placeholder="Guardian full name"
                      className="input"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Guardian Phone (Parent Portal Login)</label>
                    <input
                      value={editForm.guardian_phone}
                      onChange={e => setEditForm({ ...editForm, guardian_phone: e.target.value })}
                      placeholder="0788000001"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            {['teacher', 'worker'].includes(editForm.role) && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Employee Profile ({editingUser?.employeeProfile?.employee_id || 'Staff'})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Department</label>
                    <input
                      value={editForm.department}
                      onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                      placeholder="Department"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Position</label>
                    <input
                      value={editForm.position}
                      onChange={e => setEditForm({ ...editForm, position: e.target.value })}
                      placeholder="Position"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <BulkUploadStudentsModal
        open={bulkStudentModal}
        onClose={() => setBulkStudentModal(false)}
        classes={classes}
        onUploadSuccess={() => {
          load()
        }}
      />
    </DashboardLayout>
  )
}
