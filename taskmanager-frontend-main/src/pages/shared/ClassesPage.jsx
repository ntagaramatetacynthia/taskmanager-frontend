import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Trash2, Edit2, Users, ChevronRight, UserPlus, UserMinus, BookOpen, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Badge, DataTable, Modal, Pagination, Alert, SectionHeader, PageLoader } from '../../components/ui/index.jsx'
import BulkUploadStudentsModal from '../../components/student/BulkUploadStudentsModal.jsx'
import { classAPI, userAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const schema = z.object({
  name:         z.string().min(2, 'Name required'),
  code:         z.string().min(2, 'Code required').max(20),
  type:         z.enum(['class', 'department', 'team']),
  manager_id:   z.coerce.number().positive('Select a teacher').optional().or(z.literal('')),
  max_students: z.coerce.number().min(1).max(500).optional(),
  description:  z.string().optional(),
})

export default function ClassesPage() {
  const { role, user } = useAuth()
  const isOrgAdmin = role === 'organization_admin'
  const isTeacher  = role === 'teacher'

  const [classes, setClasses]         = useState([])
  const [teachers, setTeachers]       = useState([])
  const [students, setStudents]       = useState([]) // all students in org
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [pages, setPages]             = useState(1)
  const [modal, setModal]             = useState(null) // 'create' | { edit } | { delete } | { detail }
  const [bulkModal, setBulkModal]     = useState(false)
  const [bulkTargetClass, setBulkTargetClass] = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [detailClass, setDetailClass] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [addStudentId, setAddStudentId]   = useState('')
  const [createStudentMode, setCreateStudentMode] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', email: '', password: '', phone: '' })
  const [editClassForm, setEditClassForm] = useState({
    id: null,
    name: '',
    code: '',
    type: 'class',
    manager_id: '',
    max_students: 40,
    status: 'active',
    description: '',
  })


  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: 'class', max_students: 40 }
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await classAPI.getAll({ page, limit: 10 })
      setClasses(data.data || [])
      setPages(data.pagination?.pages || 1)
    } catch { setClasses([]) }
    finally { setLoading(false) }
  }, [page])

  // Load teachers and students for dropdowns
  const loadUsersOnce = useCallback(async () => {
    if (!isOrgAdmin && !isTeacher) return
    try {
      const [t, s] = await Promise.all([
        userAPI.getAll({ role: 'teacher', limit: 100 }),
        userAPI.getAll({ role: 'student', limit: 200 }),
      ])
      setTeachers(t.data.data || [])
      setStudents(s.data.data || [])
    } catch {}
  }, [isOrgAdmin, isTeacher])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadUsersOnce() }, [loadUsersOnce])

  const openCreate = () => { reset({ type: 'class', max_students: 40 }); setError(''); setModal('create') }

  const openEdit = async (cls) => {
    setError('')
    setEditClassForm({
      id: cls.id,
      name: cls.name || '',
      code: cls.code || '',
      type: cls.type || 'class',
      manager_id: cls.manager_id || cls.manager?.id || '',
      max_students: cls.max_students ?? 40,
      status: cls.status || 'active',
      description: cls.description || '',
    })
    setModal('edit')
    try {
      const { data } = await classAPI.getById(cls.id)
      const fresh = data.data || cls
      setEditClassForm({
        id: fresh.id,
        name: fresh.name || '',
        code: fresh.code || '',
        type: fresh.type || 'class',
        manager_id: fresh.manager_id || fresh.manager?.id || '',
        max_students: fresh.max_students ?? 40,
        status: fresh.status || 'active',
        description: fresh.description || '',
      })
    } catch {
      // Fallback to row data already populated
    }
  }

  const onUpdateClass = async (e) => {
    e.preventDefault()
    if (!editClassForm.id) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: editClassForm.name.trim(),
        code: editClassForm.code.trim(),
        type: editClassForm.type,
        max_students: Number(editClassForm.max_students) || 40,
        status: editClassForm.status,
        description: editClassForm.description,
        ...(editClassForm.manager_id ? { manager_id: Number(editClassForm.manager_id) } : {}),
      }
      await classAPI.update(editClassForm.id, payload)
      toast.success('Class updated successfully')
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update class')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (cls) => {
    setModal('detail')
    setDetailLoading(true)
    setAddStudentId('')
    try {
      const { data } = await classAPI.getById(cls.id)
      setDetailClass(data.data)
    } catch { toast.error('Failed to load class details') }
    finally { setDetailLoading(false) }
  }

  const onSubmit = async (values) => {
    setSubmitting(true); setError('')
    const payload = {
      name:         values.name,
      code:         values.code,
      type:         values.type,
      max_students: values.max_students,
      description:  values.description,
      ...(values.manager_id ? { manager_id: parseInt(values.manager_id) } : {}),
    }
    try {
      await classAPI.create(payload)
      toast.success('Class created')
      setModal(null); load()
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to create class')
    } finally { setSubmitting(false) }
  }

  const onDelete = async () => {
    setSubmitting(true)
    try {
      await classAPI.remove(modal.delete.id)
      toast.success('Class deleted')
      setModal(null); load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally { setSubmitting(false) }
  }

  const onAddStudent = async () => {
    if (!addStudentId) return
    try {
      await classAPI.addStudent(detailClass.id, parseInt(addStudentId))
      toast.success('Student added to class')
      setAddStudentId('')
      // Refresh detail
      const { data } = await classAPI.getById(detailClass.id)
      setDetailClass(data.data)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student')
    }
  }

  const onCreateAndAddStudent = async () => {
    try {
      const studentData = {
        name: newStudent.name,
        email: newStudent.email,
        password: newStudent.password,
        phone: newStudent.phone || undefined,
        role: 'student',
        class_id: detailClass.id
      }

      const { data: createdUser } = await userAPI.create(studentData)
      const generatedId = createdUser.data.studentProfile?.student_id
      toast.success(`Student created with ID: ${generatedId}`)

      setNewStudent({ name: '', email: '', password: '', phone: '' })
      setCreateStudentMode(false)

      // Refresh detail and students list
      const { data } = await classAPI.getById(detailClass.id)
      setDetailClass(data.data)
      load()
      // Refresh students list
      const s = await userAPI.getAll({ role: 'student', limit: 200 })
      setStudents(s.data.data || [])
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create and add student';
      toast.error(errorMessage);
    }
  }


  const onRemoveStudent = async (studentUserId) => {
    if (!studentUserId) {
      toast.error('Missing student ID. Cannot remove student.')
      return
    }
    if (!confirm('Remove this student from the class?')) return
    try {
      await classAPI.removeStudent(detailClass.id, studentUserId)
      toast.success('Student removed from class')
      const { data } = await classAPI.getById(detailClass.id)
      setDetailClass(data.data)
      load()
      const s = await userAPI.getAll({ role: 'student', limit: 200 })
      setStudents(s.data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to remove student')
    }
  }

  const onDeleteStudent = async (studentUserId, studentName) => {
    if (!studentUserId) {
      toast.error('Missing student ID. Cannot delete student.')
      return
    }
    if (!confirm(`Permanently delete student ${studentName || ''}? This will remove duplicate records.`)) return
    try {
      await userAPI.remove(studentUserId)
      toast.success('Student deleted successfully')
      const { data } = await classAPI.getById(detailClass.id)
      setDetailClass(data.data)
      load()
      const s = await userAPI.getAll({ role: 'student', limit: 200 })
      setStudents(s.data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete student')
    }
  }

  // Students not yet in this class
  const availableStudents = students.filter(s =>
    !detailClass?.students?.some(sp => sp.user_id === s.id)
  )

  const filtered = classes.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    { key: 'name', label: 'Class',
      render: r => (
        <div onClick={() => openDetail(r)} className="cursor-pointer hover:bg-gray-50 rounded p-1 -m-1 transition-colors">
          <p className="text-sm font-medium text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-400">{r.code} · {r.type}</p>
        </div>
      )
    },
    { key: 'manager', label: 'Teacher',
      render: r => <span className="text-xs text-gray-600">{r.manager?.name || '—'}</span>
    },
    { key: 'current_students', label: 'Students',
      render: r => <span className="text-sm font-semibold">{r.current_students ?? 0} / {r.max_students ?? '—'}</span>
    },
    { key: 'status', label: 'Status', render: r => <Badge status={r.status} /> },
    { key: 'actions', label: '',
      render: r => (
        <div className="flex items-center gap-1.5">
          <button onClick={() => openDetail(r)} className="p-1.5 rounded-md bg-blue-50 text-primary-900 hover:bg-blue-100 transition-colors" title="View & Manage">
            <Users size={13} />
          </button>
          {(isOrgAdmin || isTeacher) && (
            <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-primary-900 transition-colors" title="Edit Class">
              <Edit2 size={13} />
            </button>
          )}
          {isOrgAdmin && (
            <button onClick={() => setModal({ delete: r })} className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )
    },
  ]

  return (
    <DashboardLayout
      title={isOrgAdmin ? 'Classes & Departments' : 'Manage Classes & Students'}
      subtitle="Manage classes, teachers and students"
    >
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classes..." className="input pl-9" />
          </div>
          {(isOrgAdmin || isTeacher) && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkTargetClass(null)
                  setBulkModal(true)
                }}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 border-primary-200 text-primary-900 font-medium hover:bg-blue-50"
              >
                <Upload size={13} /> Bulk Upload Students
              </button>
              <button onClick={openCreate} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Plus size={13} /> New Class
              </button>
            </div>
          )}
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No classes found" />
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>

      {/* Create Class Modal */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Create Class">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert type="error" message={error} />}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Class Name *</label>
              <input {...register('name')} placeholder="e.g. Mathematics Grade 10" className="input" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Code *</label>
              <input {...register('code')} placeholder="e.g. MATH10" className="input uppercase" />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="label">Type *</label>
              <select {...register('type')} className="input">
                <option value="class">Class</option>
                <option value="department">Department</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div>
              <label className="label">Assign Teacher</label>
              <select {...register('manager_id')} className="input">
                <option value="">— Select teacher —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Defaults to you if not selected</p>
            </div>
            <div>
              <label className="label">Max Students</label>
              <input {...register('max_students')} type="number" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <input {...register('description')} placeholder="Optional" className="input" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Class Modal */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit Class">
        <form onSubmit={onUpdateClass} className="space-y-4">
          {error && <Alert type="error" message={error} />}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Class Name *</label>
              <input
                value={editClassForm.name}
                onChange={e => setEditClassForm({ ...editClassForm, name: e.target.value })}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">Code *</label>
              <input
                value={editClassForm.code}
                onChange={e => setEditClassForm({ ...editClassForm, code: e.target.value })}
                required
                className="input uppercase"
              />
            </div>
            <div>
              <label className="label">Type *</label>
              <select
                value={editClassForm.type}
                onChange={e => setEditClassForm({ ...editClassForm, type: e.target.value })}
                className="input"
              >
                <option value="class">Class</option>
                <option value="department">Department</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div>
              <label className="label">Assign Teacher</label>
              <select
                value={editClassForm.manager_id}
                onChange={e => setEditClassForm({ ...editClassForm, manager_id: e.target.value })}
                className="input"
              >
                <option value="">— Select teacher —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Max Students</label>
              <input
                type="number"
                min={1}
                max={500}
                value={editClassForm.max_students}
                onChange={e => setEditClassForm({ ...editClassForm, max_students: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                value={editClassForm.status}
                onChange={e => setEditClassForm({ ...editClassForm, status: e.target.value })}
                className="input"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <input
                value={editClassForm.description}
                onChange={e => setEditClassForm({ ...editClassForm, description: e.target.value })}
                placeholder="Optional"
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Class Detail & Student Management Modal */}
      <Modal open={modal === 'detail'} onClose={() => setModal(null)} title={detailClass?.name || 'Class Details'}>
        {detailLoading ? <PageLoader /> : detailClass && (
          <div className="space-y-5">
            {/* Class info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-primary-900">{detailClass.current_students ?? 0}</p>
                <p className="text-xs text-gray-500">Students</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gov-green">{detailClass.tasks?.length ?? 0}</p>
                <p className="text-xs text-gray-500">Tasks</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-gray-700 truncate">{detailClass.manager?.name || '—'}</p>
                <p className="text-xs text-gray-500">Teacher</p>
              </div>
            </div>

            {/* Add student */}
            <div>
              <SectionHeader title="Add Student to Class" />
              <div className="mt-2 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreateStudentMode(false)}
                    className={`btn-secondary text-xs py-1.5 px-3 ${!createStudentMode ? 'bg-primary-900 text-white' : ''}`}
                  >
                    Add Existing
                  </button>
                  <button
                    onClick={() => setCreateStudentMode(true)}
                    className={`btn-secondary text-xs py-1.5 px-3 ${createStudentMode ? 'bg-primary-900 text-white' : ''}`}
                  >
                    Create New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkTargetClass(detailClass.id)
                      setBulkModal(true)
                    }}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 border-primary-200 text-primary-900 font-medium hover:bg-blue-50"
                  >
                    <Upload size={12} /> Bulk Upload Excel
                  </button>
                </div>

                {createStudentMode ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={newStudent.name}
                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                        placeholder="Student Name"
                        className="input"
                      />
                      <input
                        value={newStudent.email}
                        onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                        placeholder="Email"
                        type="email"
                        className="input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={newStudent.password}
                        onChange={e => setNewStudent({ ...newStudent, password: e.target.value })}
                        placeholder="Password"
                        type="password"
                        className="input"
                      />
                      <input
                        value={newStudent.phone}
                        onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })}
                        placeholder="Phone (optional)"
                        className="input"
                      />
                    </div>
                    <button
                      onClick={onCreateAndAddStudent}
                      disabled={!newStudent.name || !newStudent.email || !newStudent.password}
                      className="btn-primary w-full flex items-center justify-center gap-1.5"
                    >
                      <UserPlus size={14} /> Create & Add Student
                    </button>

                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={addStudentId}
                      onChange={e => setAddStudentId(e.target.value)}
                      className="input flex-1"
                    >
                      <option value="">— Select student —</option>
                      {availableStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                    <button
                      onClick={onAddStudent}
                      disabled={!addStudentId}
                      className="btn-primary px-4 flex items-center gap-1.5 flex-shrink-0"
                    >
                      <UserPlus size={14} /> Add
                    </button>
                  </div>
                )}

                {!createStudentMode && availableStudents.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">All students are already assigned to this class.</p>
                )}
              </div>
            </div>

            {/* Students list */}
            <div>
              <SectionHeader title={`Students (${detailClass.students?.length ?? 0})`} />
              {!detailClass.students?.length ? (
                <p className="text-sm text-gray-400 py-4 text-center">No students in this class yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto mt-2">
                  {detailClass.students.map(sp => (
                    <div key={sp.user_id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{sp.user?.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{sp.user?.name}</p>
                          <p className="text-xs text-gray-400">{sp.student_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onRemoveStudent(sp.user_id || sp.user?.id || sp.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                          title="Remove from class"
                        >
                          <UserMinus size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteStudent(sp.user_id || sp.user?.id || sp.id, sp.user?.name)}
                          className="p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete Student"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subjects/Lessons */}
            {detailClass.subjects?.length > 0 && (
              <div>
                <SectionHeader title="Subjects / Lessons" />
                <div className="space-y-1.5 mt-2">
                  {detailClass.subjects.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-primary-900" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{sub.name}</p>
                          <p className="text-xs text-gray-400">{sub.code}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{sub.teacher?.name || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!modal?.delete} onClose={() => setModal(null)} title="Delete Class">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{modal?.delete?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button onClick={onDelete} disabled={submitting} className="btn-danger">
            {submitting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>

      <BulkUploadStudentsModal
        open={bulkModal}
        onClose={() => {
          setBulkModal(false)
          setBulkTargetClass(null)
        }}
        classes={classes}
        defaultClassId={bulkTargetClass}
        onUploadSuccess={async () => {
          load()
          if (detailClass?.id) {
            try {
              const { data } = await classAPI.getById(detailClass.id)
              setDetailClass(data.data)
            } catch {}
          }
        }}
      />
    </DashboardLayout>
  )
}
