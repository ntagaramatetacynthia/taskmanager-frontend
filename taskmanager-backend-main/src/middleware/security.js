import rateLimit from 'express-rate-limit';

// ── Rate limiters ─────────────────────────────────────────────────────────────
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100000,

  message:  { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
  // Prevent express-rate-limit from crashing on proxy headers.
  // Render/Proxies may set X-Forwarded-For.
  trustProxy: false,
});


export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20, // relaxed for development
  message:  { success: false, message: 'Too many login attempts. Please try again later.' },
  skipSuccessfulRequests: true,
});

export const organizationRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      10, // relaxed for development
  message:  { success: false, message: 'Too many registration attempts. Please try again later.' },
});

// ── Security headers ──────────────────────────────────────────────────────────
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
};

// ── Audit logger (safe — won't crash if DB not ready) ─────────────────────────
export const auditLogger = (action, resourceType) => {
  return async (req, res, next) => {
    // Fire-and-forget after response — import lazily to avoid circular deps
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      setImmediate(async () => {
        try {
          const { AuditLog } = await import('../database.js');
          await AuditLog.create({
            action,
            resource_type:    resourceType,
            resource_id:      req.params?.id ? parseInt(req.params.id) : null,
            ip_address:       (req.ip || '').replace('::ffff:', ''),
            user_agent:       req.get('User-Agent') || '',
            severity:         res.statusCode >= 400 ? 'error' : 'info',
            category:         getCategoryFromAction(action),
            success:          res.statusCode < 400,
            user_id:          req.user?.id          || null,
            district_admin_id:req.admin?.id         || null,
            organization_id:  req.user?.organization_id || null,
            metadata: {
              method: req.method,
              url:    req.originalUrl,
              status: res.statusCode,
            },
          });
        } catch {
          // Silently ignore — audit log failure must never break the request
        }
      });
      return originalJson(body);
    };
    next();
  };
};

// ── Error handler ─────────────────────────────────────────────────────────────
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  err.errors.map(e => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
      field:   err.errors[0]?.path,
    });
  }

  if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token.'  });
  if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'Token expired.'  });

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

// ── 404 handler ───────────────────────────────────────────────────────────────
export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCategoryFromAction(action) {
  if (action.includes('login') || action.includes('logout')) return 'authentication';
  if (action.includes('approve') || action.includes('reject'))  return 'authorization';
  if (action.includes('create') || action.includes('update') || action.includes('delete')) return 'data_modification';
  return 'data_access';
}
