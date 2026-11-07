/**
 * Read-only in-app viewer for an XLSX / XLS / CSV worksheet.
 *
 * Rules this component is built around:
 * - It never edits or re-encodes the file: the bytes are parsed for display only, so the
 *   downloaded original stays exactly the teacher's spreadsheet.
 * - It renders inline, in the same page and document. Opening the viewer in a new tab or
 *   window would fire the focus timer's blur/visibility interrupt, and reading the
 *   worksheet must not count as leaving the assessment.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, RotateCw } from 'lucide-react'
import clsx from 'clsx'
import { Alert, Spinner } from '../../components/ui/index.jsx'
import { formatFileSize } from './spreadsheetFormat'
import './spreadsheet-preview.css'

// A worksheet can be huge; the preview is a reading aid, not a data grid.
const MAX_ROWS = 300
const MAX_COLS = 30

function columnLabel(index) {
  let label = ''
  let value = index
  while (value >= 0) {
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26) - 1
  }
  return label
}

function toGrid(buffer) {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  return workbook.SheetNames.map((name) => {
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    })

    // Trailing empty rows are noise for a read-only preview.
    while (raw.length && raw[raw.length - 1].every((cell) => `${cell ?? ''}`.trim() === '')) {
      raw.pop()
    }

    const rowCount = raw.length
    const colCount = raw.reduce((max, row) => Math.max(max, row.length), 0)
    const truncated = rowCount > MAX_ROWS || colCount > MAX_COLS
    const rows = raw.slice(0, MAX_ROWS).map((row) => {
      const padded = row.slice(0, MAX_COLS).map((cell) => `${cell ?? ''}`)
      while (padded.length < Math.min(colCount, MAX_COLS)) padded.push('')
      return padded
    })

    return {
      name,
      rows,
      colCount: Math.max(1, Math.min(colCount, MAX_COLS)),
      truncated,
    }
  })
}

export default function SpreadsheetPreview({ fileName, loadFile, fileSize, onDownload, className }) {
  const [state, setState] = useState({ status: 'idle', sheets: [], error: '' })
  const [active, setActive] = useState(0)
  const [attempt, setAttempt] = useState(0)

  const load = (force) => {
    setAttempt((value) => (force ? value + 1 : value))
    setState((prev) => ({ ...prev, status: 'loading', error: '' }))
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const buffer = await loadFile()
        if (cancelled) return
        const sheets = toGrid(buffer)
        if (!sheets.length) throw new Error('This file has no sheets to show.')
        setState({ status: 'ready', sheets, error: '' })
        setActive(0)
      } catch (err) {
        if (cancelled) return
        setState({
          status: 'error',
          sheets: [],
          error:
            err?.response?.data?.message ||
            err?.message ||
            'This worksheet could not be opened. Try downloading it instead.',
        })
      }
    }

    setState((prev) => ({ ...prev, status: 'loading', error: '' }))
    run()
    return () => {
      cancelled = true
    }
    // `attempt` is the retry trigger; loadFile is stable per task.
  }, [loadFile, attempt])

  const sheet = state.sheets[active]
  const headerLetters = useMemo(
    () => Array.from({ length: sheet?.colCount || 1 }, (_, index) => columnLabel(index)),
    [sheet?.colCount]
  )

  const retry = useCallback(() => load(true), [])

  return (
    <div className={clsx('xlpv', className)}>
      <div className="xlpv__head">
        <span className="xlpv__icon" aria-hidden="true">
          <FileSpreadsheet size={15} />
        </span>
        <div className="xlpv__titleWrap">
          <p className="xlpv__title" title={fileName}>
            {fileName || 'Worksheet'}
          </p>
          <p className="xlpv__sub">
            Read-only preview
            {fileSize ? ` · ${formatFileSize(fileSize)}` : ''}
          </p>
        </div>
        {onDownload && (
          <button type="button" className="btn-secondary xlpv__download" onClick={onDownload}>
            Download original
          </button>
        )}
      </div>

      {state.sheets.length > 1 && (
        <div className="xlpv__tabs" role="tablist" aria-label="Worksheets">
          {state.sheets.map((entry, index) => (
            <button
              key={entry.name}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={clsx('xlpv__tab', index === active && 'xlpv__tab--active')}
              onClick={() => setActive(index)}
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}

      {state.status === 'loading' && (
        <div className="xlpv__state">
          <Spinner size="sm" />
          <span>Opening worksheet…</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="xlpv__state xlpv__state--error">
          <Alert type="error" message={state.error} />
          <button type="button" className="btn-secondary" onClick={retry}>
            <RotateCw size={13} /> Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && sheet && (
        <>
          <div className="xlpv__scroll">
            <table className="xlpv__table">
              <caption className="sr-only">{`Read-only contents of ${fileName || 'worksheet'}, sheet ${sheet.name}`}</caption>
              <thead>
                <tr>
                  <th scope="col" className="xlpv__corner" aria-label="Row" />
                  {headerLetters.map((letter) => (
                    <th key={letter} scope="col" className="xlpv__colHead">
                      {letter}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <th scope="row" className="xlpv__rowHead">
                      {rowIndex + 1}
                    </th>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="xlpv__cell">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="xlpv__foot">
            <span>
              Sheet {active + 1} of {state.sheets.length}
              {sheet.truncated ? ` · showing the first ${MAX_ROWS} rows and ${MAX_COLS} columns` : ''}
            </span>
            <span>Cells cannot be edited here. Download the file to work on it.</span>
          </div>
        </>
      )}
    </div>
  )
}
