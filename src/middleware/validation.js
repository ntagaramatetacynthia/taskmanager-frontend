import Joi from 'joi';

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: true, abortEarly: false });
    
    if (error) {
      console.error('Validation error details:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }))
      });
    }
    
    // Replace body with validated data (stripped unknown fields)
    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // Organization registration
  organizationRegistration: Joi.object({
    name: Joi.string().trim().min(2).max(200).required(),
    type: Joi.string().lowercase().valid('school', 'company').required(),
    district_id: Joi.number().integer().positive().required(),
    contact_email: Joi.string().trim().lowercase().email().required(),
    contact_phone: Joi.string().trim().optional().allow(''),
    address: Joi.string().trim().max(500).optional().allow(''),
    subscription_type: Joi.string().lowercase().valid('monthly', 'quarterly', 'yearly').optional().default('monthly')
  }).unknown('allow'),

  // User creation
  userCreation: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().trim().pattern(/^[+]?[0-9\s\-()]+$/).allow('', null).optional(),
    role: Joi.string().valid('organization_admin', 'teacher', 'student', 'worker', 'intern').required(),
    employee_id: Joi.string().trim().allow('', null).optional(),
    position: Joi.string().trim().allow('', null).optional(),
    department: Joi.string().trim().allow('', null).optional(),
    employment_type: Joi.string().valid('full_time', 'part_time', 'contract', 'intern').allow('', null).optional(),
    class_id: Joi.when('role', {
      is: Joi.valid('student', 'intern'),
      then: Joi.number().integer().positive().allow('', null).optional(),
      otherwise: Joi.allow('', null).optional()
    })
  }),

  // Login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    user_type: Joi.string().valid('user', 'district_admin').default('user')
  }),

  // Organization code login
  organizationCodeLogin: Joi.object({
    organization_code: Joi.string().min(6).max(20).required(),
    student_id: Joi.string().required(),
    password: Joi.string().min(6).required()
  }),

  // Task creation
  taskCreation: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().required(),
    // The create-task form always sends the field, blank when unused; an optional text
    // field must accept an empty string or the whole submission 400s.
    instructions: Joi.string().allow('').optional(),
    due_date: Joi.date().greater('now').required(),
    class_id: Joi.number().integer().positive().optional(),
    subject_id: Joi.number().integer().positive().optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    type: Joi.string().valid('assignment', 'project', 'quiz', 'exam', 'homework', 'task').default('assignment'),
    max_score: Joi.number().integer().min(1).max(1000).default(100),
    submission_type: Joi.string().valid('file', 'text', 'both').default('both'),
    late_submission_allowed: Joi.boolean().default(true),
    late_penalty_percentage: Joi.number().integer().min(0).max(100).default(10),
    // Per-task focus requirement (the "Required Focus Duration" dropdown).
    focus_minutes: Joi.number().integer().min(1).max(180).allow(null).optional(),
    focus_mode: Joi.string().valid('accumulated', 'continuous').default('accumulated'),
    group_task: Joi.boolean().default(false),
    max_group_size: Joi.number().integer().min(1).max(10).default(1)
  }),

  // Class creation
  classCreation: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    code: Joi.string().min(2).max(20).required(),
    description: Joi.string().optional(),
    manager_id: Joi.number().integer().positive().optional(),
    type: Joi.string().valid('class', 'department', 'team').default('class'),
    academic_year: Joi.string().pattern(/^\d{4}-\d{4}$/).optional(),
    semester: Joi.string().valid('1', '2', '3').default('1'),
    max_students: Joi.number().integer().min(1).max(200).default(50)
  }),

  // Approval decision
  approvalDecision: Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    approval_notes: Joi.string().optional(),
    rejection_reason: Joi.when('status', {
      is: 'rejected',
      then: Joi.string().required(),
      otherwise: Joi.forbidden()
    }),
    conditions: Joi.string().optional()
  }),

  // Password reset
  passwordReset: Joi.object({
    email: Joi.string().email().required(),
    user_type: Joi.string().valid('user', 'district_admin').default('user')
  }),

  // Password update
  passwordUpdate: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(6).required(),
    confirm_password: Joi.string().valid(Joi.ref('new_password')).required()
  })
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};