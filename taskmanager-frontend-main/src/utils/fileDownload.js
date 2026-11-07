/**
 * Helpers for files that must be fetched with the auth token.
 *
 * A plain <a href="/uploads/..."> does not carry the Bearer token and, because it is a
 * relative path, resolves against the Vite origin instead of the API, so downloads saved
 * this way were 404s. Everything goes through axios + a Blob URL instead.
 */

const API_ORIGIN = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '')
).replace(/\/+$/, '')

/** Absolute URL for a legacy stored path such as "/uploads/submissions/abc.pdf". */
export function absoluteFileUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Pull the server-provided filename out of a Content-Disposition header. */
export function filenameFromHeaders(headers, fallback = 'download') {
  const raw = headers?.['content-disposition'] || headers?.['Content-Disposition']
  if (!raw) return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(raw)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(raw)
  return plain ? plain[1] : fallback
}

/** Trigger a browser save for an in-memory blob. */
export function saveBlob(blob, filename) {
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'download'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Safari needs the URL alive until the download has actually started.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
