import { useState, useRef } from 'react'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { Modal, Spinner, Alert } from '../ui/index.jsx'
import { studentAPI } from '../../services/api'

export default function BulkUploadStudentsModal({ open, onClose, classes = [], defaultClassId = null, onUploadSuccess }) {
  const [file, setFile]             = useState(null)
  const [selectedClass, setSelectedClass] = useState(defaultClassId || '')
  const [uploading, setUploading]   = useState(false)
  const [errorList, setErrorList]   = useState([])
  const [generalError, setGeneralError] = useState('')
  const [result, setResult]         = useState(null)
  const fileInputRef                = useRef(null)

  const resetState = () => {
    setFile(null)
    setErrorList([])
    setGeneralError('')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    resetState()
    onClose?.()
  }

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const name = selected.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      toast.error('Please select an Excel (.xlsx, .xls) or CSV file.')
      e.target.value = ''
      return
    }

    setFile(selected)
    setErrorList([])
    setGeneralError('')
    setResult(null)
  }

  // Generate & download sample Excel template directly or via API
  const handleDownloadTemplate = async () => {
    try {
      try {
        const response = await studentAPI.downloadTemplate()
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'RTMS_Student_Upload_Template.xlsx')
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        toast.success('Template downloaded')
        return
      } catch {
        // Fallback: client-side XLSX generation
      }

      const sampleData = [
        {
          FirstName: 'Jean',
          LastName: 'Mugisha',
          GuardianPhone: '+250788111222',
          GuardianName: 'Paul Mugisha',
          ClassCode: classes[0]?.code || 'L3SOD2024',
        },
        {
          FirstName: 'Alice',
          LastName: 'Keza',
          GuardianPhone: '+250788333444',
          GuardianName: 'Marie Keza',
          ClassCode: classes[0]?.code || 'L3SOD2024',
        },
        {
          FirstName: 'David',
          LastName: 'Kwizera',
          GuardianPhone: '+250788555666',
          GuardianName: 'Joseph Kwizera',
          ClassCode: classes[0]?.code || 'L3SOD2024',
        },
      ]

      const worksheet = XLSX.utils.json_to_sheet(sampleData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
      XLSX.writeFile(workbook, 'RTMS_Student_Upload_Template.xlsx')
      toast.success('Template downloaded')
    } catch (err) {
      toast.error('Failed to download template')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    setUploading(true)
    setErrorList([])
    setGeneralError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (selectedClass) {
        formData.append('class_id', selectedClass)
      }

      const { data } = await studentAPI.bulkUpload(formData)
      setResult(data)
      toast.success(data.message || `Successfully created ${data.count} students!`)
      onUploadSuccess?.(data)
    } catch (err) {
      const res = err.response?.data
      if (res?.errors && Array.isArray(res.errors)) {
        setErrorList(res.errors)
        setGeneralError(res.message || 'Validation failed for some rows in the spreadsheet.')
      } else {
        setGeneralError(res?.message || 'Failed to upload students. Please check file format.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Upload Students" size="lg">
      <div className="space-y-4" id="bulk-student-upload-modal">
        {/* Template info banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-sm">
          <div>
            <p className="font-semibold text-primary-900">Spreadsheet Template</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Required columns: <strong className="text-gray-800">FirstName</strong>,{' '}
              <strong className="text-gray-800">LastName</strong>,{' '}
              <strong className="text-gray-800">GuardianPhone</strong>.
              Optional: <strong>GuardianName</strong>, <strong>ClassCode</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 flex-shrink-0 bg-white hover:bg-gray-50 border-blue-300 text-primary-900 font-medium"
          >
            <Download size={14} /> Download Template (.xlsx)
          </button>
        </div>

        {generalError && (
          <Alert type="error" message={generalError} />
        )}

        {/* Detailed validation errors list */}
        {errorList.length > 0 && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800 mb-2">
              <AlertCircle size={14} />
              <span>Row-by-row validation issues ({errorList.length}):</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
              {errorList.map((errItem, i) => (
                <li key={i}>{errItem}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Success confirmation */}
        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <CheckCircle2 size={18} />
              <span>{result.message}</span>
            </div>
            <p className="text-xs text-gray-600">
              Generated accounts use standard <strong>@gmail.com</strong> emails with default password{' '}
              <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-800 font-mono">
                {result.default_password || 'Student@1234'}
              </code>.
            </p>
            {result.students?.length > 0 && (
              <div className="mt-3 max-h-36 overflow-y-auto divide-y divide-emerald-100 bg-white/80 rounded border border-emerald-200 text-xs">
                {result.students.slice(0, 10).map((st) => (
                  <div key={st.id} className="p-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{st.name}</span>{' '}
                      <span className="text-gray-400 font-mono">({st.student_id})</span>
                    </div>
                    <span className="text-gray-500 font-mono">{st.email}</span>
                  </div>
                ))}
                {result.students.length > 10 && (
                  <div className="p-2 text-center text-xs text-gray-500">
                    ...and {result.students.length - 10} more students
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {classes.length > 0 && (
            <div>
              <label className="label">Default Class Assignment (Optional)</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="input"
              >
                <option value="">— Auto-match from spreadsheet or unassigned —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Applied to rows without a specific ClassCode column.
              </p>
            </div>
          )}

          <div>
            <label className="label">Select Spreadsheet (.xlsx, .xls, .csv) *</label>
            <div className="border-2 border-dashed border-gray-300 hover:border-primary-900 rounded-xl p-5 text-center transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                id="bulk-student-file-input"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="bulk-student-file-input" className="cursor-pointer flex flex-col items-center">
                <FileSpreadsheet size={36} className={file ? 'text-gov-green mb-2' : 'text-gray-400 mb-2'} />
                {file ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB — Click to change</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Click to browse or drop spreadsheet here</p>
                    <p className="text-xs text-gray-400 mt-0.5">Supports .xlsx, .xls, and .csv files (max 10MB)</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={handleClose} className="btn-secondary">
              {result ? 'Close' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {uploading ? (
                <>
                  <Spinner size="sm" /> Uploading & Processing...
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload Students
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
