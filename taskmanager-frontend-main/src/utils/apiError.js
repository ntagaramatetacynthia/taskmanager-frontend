/**
 * Maps an axios error to a message that reflects what actually went wrong.
 *
 * A blank "Login failed" is misleading: an unreachable or cold-starting backend
 * (Render free instances take ~50s to wake) is not the same problem as wrong
 * credentials, and the user cannot act on a message that hides the difference.
 */
const TIMEOUT_CODES = ['ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT']

export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data
  const serverMessage = data?.message || data?.error || data?.detail

  // A real answer from the API always wins — it knows why it rejected the request.
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage

  const code = err?.code
  if (TIMEOUT_CODES.includes(code) || /timeout/i.test(err?.message || '')) {
    return 'The server did not respond in time. It may be starting up — please try again in a moment.'
  }
  if (code === 'ERR_NETWORK' || code === 'ERR_INTERNET_DISCONNECTED') {
    return 'Cannot reach the server. Check your connection and try again.'
  }

  const status = err?.response?.status
  if (status === 401 || status === 403) return 'Incorrect email or password.'
  if (status === 404) return 'The request could not be found on the server.'
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.'
  if (status >= 500) return 'The server ran into a problem. Please try again shortly.'

  return fallback
}
