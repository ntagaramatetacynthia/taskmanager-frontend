import { useState, useRef } from 'react'
import { Upload, CheckCircle, XCircle, Download } from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { Alert } from '../../components/ui/index.jsx'
import { userAPI } from '../../services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import * as XLSX from 'xlsx'


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function normalizeHeader(v) {
  return String(v ?? '').trim().toLowerCase()
}

function normalizeCell(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  return String(v).trim()
}

function getFirstSheetName(workbook) {
  const names = workbook?.SheetNames || []
  return names[0] || null
}

export default function ImportPage() {
  const [file, setFile]               = useState(null)
  const [dragging, setDragging]       = useState(false)
  const [parsed, setParsed]           = useState(null) // { total, valid, invalid, rows }
  const [uploading, setUploading]     = useState(false)
  const [result, setResult]           = useState(null)
  const inputRef                      = useRef(null)


  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }

  const processFile = async (f) => {
    const allowed = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]

    setParsed(null)


    if (!allowed.includes(f.type) && !f.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast.error('Only CSV or Excel files are allowed')
      return
    }

    setFile(f)
    setResult(null)

    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = getFirstSheetName(workbook)
      if (!sheetName) {
        toast.error('No worksheet found in the Excel file')
        return
      }

      const sheet = workbook.Sheets[sheetName]
      const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

      // Remove leading empty rows
      const rows = allRows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
      if (!rows.length) {
        toast.error('Excel file is empty')
        return
      }

      const headerRow = rows[0].map(normalizeCell)
      const colIndex = {
        id: headerRow.findIndex((h) => h === 'id'),
        name: headerRow.findIndex((h) => h === 'name'),
        email: headerRow.findIndex((h) => h === 'email'),
        role: headerRow.findIndex((h) => h === 'role')
      }

      const requiredMissing = ['id', 'name', 'email', 'role'].filter((k) => colIndex[k] === -1)
      if (requiredMissing.length) {
        toast.error(`Missing required headers: ${requiredMissing.join(', ')}`)
        return
      }

      const userRows = []
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        const id = normalizeCell(r[colIndex.id])
        const name = normalizeCell(r[colIndex.name])
        const email = normalizeCell(r[colIndex.email])
        const role = normalizeCell(r[colIndex.role])

        const missingRequired = !id || !name || !role
        const emailInvalid = !EMAIL_RE.test(email)

        const status = missingRequired || emailInvalid ? 'invalid' : 'valid'
        userRows.push({
          id,
          name,
          email,
          role,
          status
        })
      }

      const total = userRows.length
      const valid = userRows.filter((x) => x.status === 'valid').length
      const invalid = total - valid

      setParsed({ total, valid, invalid, rows: userRows })
    } catch (e) {
      console.error(e)
      toast.error('Failed to parse Excel file')
    }
  }

  const handleUpload = async () => {
    if (!file) return
    if (!parsed) {
      toast.error('Please upload a valid Excel file first')
      return
    }

    const validRows = parsed.rows.filter((r) => r.status === 'valid')
    if (!validRows.length) {
      toast.error('No valid rows found to import')
      return
    }

    setUploading(true)
    try {
      const payload = { users: validRows.map(({ status, ...u }) => u) }
      const res = await userAPI.bulkImport(payload)
      const serverMessage = res?.data?.message
      setResult({
        success: true,
        imported: validRows.length,
        failed: parsed.invalid,
        message: serverMessage
      })
      toast.success(`${validRows.length} records imported successfully`)
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Import failed' })
      toast.error('Import failed')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => { setFile(null); setParsed(null); setResult(null) }

  return (

    <DashboardLayout title="Import Data" subtitle="Bulk import students or employees via CSV/Excel">
      <div className="max-w-3xl">
        {/* Template download */}
        <div className="card mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Download Template</p>
            <p className="text-xs text-gray-500 mt-0.5">Use our template to ensure correct formatting</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <Download size={13} /> Students CSV
            </button>
            <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <Download size={13} /> Employees CSV
            </button>
          </div>
        </div>

        {/* Drop zone */}
        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={clsx(
              'card border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-14 transition-all',
              dragging ? 'border-primary-900 bg-primary-50' : 'border-gray-300 hover:border-primary-900 hover:bg-gray-50'
            )}
          >
            <Upload size={32} className={clsx('mb-3', dragging ? 'text-primary-900' : 'text-gray-400')} />
            <p className="text-sm font-semibold text-gray-700">Drop your file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports CSV, XLS, XLSX · Max 10MB</p>
        <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => processFile(e.target.files?.[0])}
            />

          </div>
        )}

        {/* Parsed Preview */}
        {parsed && !result && (
          <div className="card">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{parsed.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gov-green">{parsed.valid}</p>
                <p className="text-xs text-gray-500 mt-0.5">Valid</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-red-600">{parsed.invalid}</p>
                <p className="text-xs text-gray-500 mt-0.5">Invalid</p>
              </div>
            </div>

            {parsed.invalid > 0 && (
              <Alert
                type="warning"
                message={`${parsed.invalid} rows are invalid and will be skipped. Fix the errors and re-upload to import everything.`}
              />
            )}

            {/* Actual Excel data */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="table-header">ID</th>
                    <th className="table-header">Name</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parsed.rows.map((row, i) => (
                    <tr key={`${row.id}-${i}`} className={row.status === 'invalid' ? 'bg-red-50/50' : ''}>
                      <td className="table-cell font-mono">{row.id || <span className="text-red-500">Missing</span>}</td>
                      <td className="table-cell">{row.name || <span className="text-red-500">Missing</span>}</td>
                      <td className="table-cell text-gray-500">{row.email || <span className="text-red-500">Missing</span>}</td>
                      <td className="table-cell capitalize">{row.role || <span className="text-red-500">Missing</span>}</td>
                      <td className="table-cell">
                        {row.status === 'valid'
                          ? <CheckCircle size={14} className="text-emerald-500" />
                          : <XCircle size={14} className="text-red-500" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-5">
              <button onClick={reset} className="btn-secondary text-xs py-1.5 px-3">Change File</button>
              <button onClick={handleUpload} disabled={uploading || !parsed.valid} className="btn-primary px-6">
                {uploading ? 'Importing...' : `Import ${parsed.valid} Valid Records`}
              </button>
            </div>
          </div>
        )}


        {/* Result */}
        {result && (
          <div className="card text-center py-10">
            {result.success ? (
              <>
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-emerald-600" />
                </div>
                <p className="font-semibold text-gray-900">Import Successful</p>
                <p className="text-sm text-gray-500 mt-1">{result.imported} records imported · {result.failed} skipped</p>
                <button onClick={reset} className="btn-primary mt-5 px-6">Import Another File</button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle size={28} className="text-red-600" />
                </div>
                <p className="font-semibold text-gray-900">Import Failed</p>
                <p className="text-sm text-gray-500 mt-1">{result.message}</p>
                <button onClick={reset} className="btn-secondary mt-5 px-6">Try Again</button>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
