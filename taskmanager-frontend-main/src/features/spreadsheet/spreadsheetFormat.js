/** Display helpers for worksheet attachments. */

export function formatFileSize(bytes) {
  const value = Number(bytes) || 0
  if (value <= 0) return '0 KB'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

/** "budget.xlsx" -> "Excel workbook", ".csv" -> "CSV file". */
export function describeSpreadsheet(filename) {
  const extension = String(filename || '').split('.').pop()?.toLowerCase()
  if (extension === 'csv') return 'CSV file'
  if (extension === 'xls') return 'Excel 97-2003 workbook'
  if (extension === 'xlsx') return 'Excel workbook'
  return 'Spreadsheet'
}
