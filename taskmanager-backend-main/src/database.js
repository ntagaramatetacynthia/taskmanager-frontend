import { Sequelize, DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── 1. Create Sequelize instance ──────────────────────────────────────────────
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      define: { paranoid: true, timestamps: true, underscored: true, freezeTableName: true },
      // Skip Sequelize's throwaway first-connection version check (Postgres >= 9.5),
      // avoiding a redundant second SSL handshake to Render on startup.
      databaseVersion: '16.0.0',
      pool: { max: 10, min: 0, acquire: 120000, idle: 10000, evict: 5000 },
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        },
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        statement_timeout: 1000000,
        // node-postgres uses connectionTimeoutMillis (not connect_timeout).
        // Bounding each socket attempt to 30s allows stalled SSL handshakes on
        // a cold Render node to fail fast and be retried automatically.
        connectionTimeoutMillis: 30000
      },
      retry: {
        max: 5,
        // Do NOT set retry.timeout here: in retry-as-promised, options.timeout is a
        // hard overall timer that rejects with "TimeoutError: unknown timed out"
        // without retrying. Per-attempt timeouts are handled by connectionTimeoutMillis.
        // Only retry transient connection/lock errors — never retry SQL/constraint
        // errors inside a transaction, which would abort the Postgres transaction
        // on attempt 1 and mask the real error behind 25P02 on subsequent attempts.
        match: [
          Sequelize.ConnectionError,
          Sequelize.ConnectionRefusedError,
          Sequelize.ConnectionTimedOutError,
          Sequelize.ConnectionAcquireTimeoutError,
          Sequelize.HostNotFoundError,
          Sequelize.HostNotReachableError,
          Sequelize.InvalidConnectionError,
          Sequelize.TimeoutError,
          /timeout expired/i,
          /ETIMEDOUT/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /EHOSTUNREACH/,
          /EAI_AGAIN/,
          /Connection terminated unexpectedly/i,
          /SQLITE_BUSY/,
        ],
      }
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: './task_management.db',
      logging: false,
      define: { paranoid: true, timestamps: true, underscored: true, freezeTableName: true },
    });

// ── 2. Define models inline (no circular imports) ─────────────────────────────

const District = sequelize.define('District', {
  id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:   { type: DataTypes.STRING(100), allowNull: false, unique: true },
  code:   { type: DataTypes.STRING(10),  allowNull: false, unique: true },
  status: { type: DataTypes.STRING(50), defaultValue: 'active' },
}, { paranoid: true, timestamps: true });

const DistrictAdmin = sequelize.define('DistrictAdmin', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:           { type: DataTypes.STRING(100), allowNull: false },
  email:          { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
  password:       { type: DataTypes.STRING(255), allowNull: false },
  phone:          { type: DataTypes.STRING(15) },
  district_id:    { type: DataTypes.INTEGER, allowNull: false },
  status:         { type: DataTypes.STRING(50), defaultValue: 'active' },
  last_login:     { type: DataTypes.DATE },
  login_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  locked_until:   { type: DataTypes.DATE },
}, {
  paranoid: true, timestamps: true,
  hooks: {
    beforeCreate: async (r) => { if (r.password) r.password = await bcrypt.hash(r.password, 12); },
    beforeUpdate: async (r) => { if (r.changed('password')) r.password = await bcrypt.hash(r.password, 12); },
  },
});
DistrictAdmin.prototype.validatePassword      = function(pw) { return bcrypt.compare(pw, this.password); };
DistrictAdmin.prototype.incrementLoginAttempts = async function() {
  const updates = { login_attempts: this.login_attempts + 1 };
  if (this.login_attempts + 1 >= 5) updates.locked_until = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return this.update(updates);
};

const Organization = sequelize.define('Organization', {
  id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:                { type: DataTypes.STRING(200), allowNull: false },
  type:                { type: DataTypes.STRING(50), allowNull: false },
  district_id:         { type: DataTypes.INTEGER, allowNull: false },
  status:              { type: DataTypes.STRING(50), defaultValue: 'pending' },
  code:                { type: DataTypes.STRING(20), unique: true },
  payment_status:      { type: DataTypes.STRING(50), defaultValue: 'pending' },
  subscription_type:   { type: DataTypes.STRING(50), defaultValue: 'monthly' },
  subscription_expires:{ type: DataTypes.DATE },
  contact_email:       { type: DataTypes.STRING(150), allowNull: false, validate: { isEmail: true } },
  contact_phone:       { type: DataTypes.STRING(15) },
  address:             { type: DataTypes.TEXT },
  max_users:           { type: DataTypes.INTEGER, defaultValue: 100 },
  current_users:       { type: DataTypes.INTEGER, defaultValue: 0 },
  approved_by:         { type: DataTypes.INTEGER },
  approved_at:         { type: DataTypes.DATE },
  rejection_reason:    { type: DataTypes.TEXT },
}, { paranoid: true, timestamps: true });
Organization.prototype.isSubscriptionActive = function() {
  return this.payment_status === 'paid' && this.subscription_expires && new Date(this.subscription_expires) > new Date();
};
Organization.prototype.canAddUsers = function() {
  return this.current_users < this.max_users;
};

const User = sequelize.define('User', {
  id:                       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:                     { type: DataTypes.STRING(100), allowNull: false },
  email:                    { type: DataTypes.STRING(150), allowNull: false, validate: { isEmail: true } },
  password:                 { type: DataTypes.STRING(255), allowNull: false },
  phone:                    { type: DataTypes.STRING(15) },
  role:                     { type: DataTypes.STRING(50), allowNull: false },
  organization_id:          { type: DataTypes.INTEGER, allowNull: false },
  status:                   { type: DataTypes.STRING(50), defaultValue: 'pending' },
  email_verified:           { type: DataTypes.BOOLEAN, defaultValue: false },
  email_verification_token: { type: DataTypes.STRING(255) },
  password_reset_token:     { type: DataTypes.STRING(255) },
  password_reset_expires:   { type: DataTypes.DATE },
  last_login:               { type: DataTypes.DATE },
  login_attempts:           { type: DataTypes.INTEGER, defaultValue: 0 },
  locked_until:             { type: DataTypes.DATE },
  profile_picture:          { type: DataTypes.STRING(500) },
  created_by:               { type: DataTypes.INTEGER },
}, {
  paranoid: true, timestamps: true,
  indexes: [{ fields: ['email', 'organization_id'], unique: true }],
  hooks: {
    beforeCreate: async (r) => { if (r.password) r.password = await bcrypt.hash(r.password, 12); },
    beforeUpdate: async (r) => { if (r.changed('password')) r.password = await bcrypt.hash(r.password, 12); },
  },
});
User.prototype.validatePassword      = function(pw) { return bcrypt.compare(pw, this.password); };
User.prototype.incrementLoginAttempts = async function() {
  const updates = { login_attempts: this.login_attempts + 1 };
  if (this.login_attempts + 1 >= 5) updates.locked_until = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return this.update(updates);
};

const Class = sequelize.define('Class', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:            { type: DataTypes.STRING(100), allowNull: false },
  code:            { type: DataTypes.STRING(20),  allowNull: false },
  description:     { type: DataTypes.TEXT },
  organization_id: { type: DataTypes.INTEGER, allowNull: false },
  manager_id:      { type: DataTypes.INTEGER, allowNull: false },
  type:            { type: DataTypes.STRING(50), defaultValue: 'class' },
  academic_year:   { type: DataTypes.STRING(10) },
  semester:        { type: DataTypes.STRING(50), defaultValue: '1' },
  max_students:    { type: DataTypes.INTEGER, defaultValue: 50 },
  current_students:{ type: DataTypes.INTEGER, defaultValue: 0 },
  status:          { type: DataTypes.STRING(50), defaultValue: 'active' },
}, { paranoid: true, timestamps: true });

const Subject = sequelize.define('Subject', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:         { type: DataTypes.STRING(100), allowNull: false },
  code:         { type: DataTypes.STRING(20),  allowNull: false },
  description:  { type: DataTypes.TEXT },
  class_id:     { type: DataTypes.INTEGER, allowNull: false },
  teacher_id:   { type: DataTypes.INTEGER, allowNull: false },
  credits:      { type: DataTypes.INTEGER, defaultValue: 1 },
  hours_per_week:{ type: DataTypes.INTEGER, defaultValue: 1 },
  status:       { type: DataTypes.STRING(50), defaultValue: 'active' },
}, { paranoid: true, timestamps: true });

const StudentProfile = sequelize.define('StudentProfile', {
  id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id:             { type: DataTypes.INTEGER, allowNull: false, unique: true },
  student_id:          { type: DataTypes.STRING(50), allowNull: false, unique: true },
  class_id:            { type: DataTypes.INTEGER, allowNull: true },
  admission_date:      { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  academic_year:       { type: DataTypes.STRING(10) },
  semester:            { type: DataTypes.STRING(50), defaultValue: '1' },
  guardian_name:       { type: DataTypes.STRING(100) },
  guardian_phone:      { type: DataTypes.STRING(15) },
  status:              { type: DataTypes.STRING(50), defaultValue: 'active' },
}, { paranoid: true, timestamps: true });

const EmployeeProfile = sequelize.define('EmployeeProfile', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id:         { type: DataTypes.INTEGER, allowNull: false, unique: true },
  employee_id:     { type: DataTypes.STRING(50), allowNull: false, unique: true },
  department:      { type: DataTypes.STRING(100), allowNull: false },
  position:        { type: DataTypes.STRING(100), allowNull: false },
  hire_date:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  employment_type: { type: DataTypes.STRING(50), allowNull: false },
  supervisor_id:   { type: DataTypes.INTEGER },
  status:          { type: DataTypes.STRING(50), defaultValue: 'active' },
}, { paranoid: true, timestamps: true });

const Task = sequelize.define('Task', {
  id:                      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:                   { type: DataTypes.STRING(200), allowNull: false },
  description:             { type: DataTypes.TEXT, allowNull: false },
  instructions:            { type: DataTypes.TEXT },
  due_date:                { type: DataTypes.DATE, allowNull: false },
  created_by:              { type: DataTypes.INTEGER, allowNull: false },
  class_id:                { type: DataTypes.INTEGER },
  subject_id:              { type: DataTypes.INTEGER },
  priority:                { type: DataTypes.STRING(50), defaultValue: 'medium' },
  type:                    { type: DataTypes.STRING(50), defaultValue: 'assignment' },
  status:                  { type: DataTypes.STRING(50), defaultValue: 'draft' },
  max_score:               { type: DataTypes.INTEGER, defaultValue: 100 },
  submission_type:         { type: DataTypes.STRING(50), defaultValue: 'both' },
  late_submission_allowed: { type: DataTypes.BOOLEAN, defaultValue: true },
  late_penalty_percentage: { type: DataTypes.INTEGER, defaultValue: 10 },
  // Per-task focus policy. NULL focus_minutes = no focus requirement (legacy tasks).
  focus_minutes:           { type: DataTypes.INTEGER },
  focus_mode:              { type: DataTypes.STRING(20), defaultValue: 'accumulated' },
  total_submissions:       { type: DataTypes.INTEGER, defaultValue: 0 },
  graded_submissions:      { type: DataTypes.INTEGER, defaultValue: 0 }
}, { paranoid: true, timestamps: true });

// Task prototype methods
Task.prototype.isOverdue = function() {
  return new Date() > new Date(this.due_date);
};

Task.prototype.canSubmit = function() {
  if (this.status !== 'published') return false;
  if (!this.late_submission_allowed && this.isOverdue()) return false;
  return true;
};

const Submission = sequelize.define('Submission', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  task_id:        { type: DataTypes.INTEGER, allowNull: false },
  student_id:     { type: DataTypes.INTEGER, allowNull: false },
  content:        { type: DataTypes.TEXT },
  file_url:       { type: DataTypes.STRING(500) },
  file_name:      { type: DataTypes.STRING(255) },
  file_size:      { type: DataTypes.INTEGER },
  status:         { type: DataTypes.STRING(50), defaultValue: 'draft' },
  submitted_at:   { type: DataTypes.DATE },
  is_late:        { type: DataTypes.BOOLEAN, defaultValue: false },
  score:          { type: DataTypes.DECIMAL(5, 2) },
  max_score:      { type: DataTypes.INTEGER, defaultValue: 100 },
  percentage:     { type: DataTypes.DECIMAL(5, 2) },
  grade:          { type: DataTypes.STRING(5) },
  feedback:       { type: DataTypes.TEXT },
  graded_by:      { type: DataTypes.INTEGER },
  graded_at:      { type: DataTypes.DATE },
  attempt_number: { type: DataTypes.INTEGER, defaultValue: 1 },
}, {
  paranoid: true,
  timestamps: true,
  hooks: {
    beforeUpdate: (submission) => {
      if (submission.score && submission.max_score) {
        submission.percentage = (submission.score / submission.max_score) * 100;
      }
    }
  },
  indexes: [{ fields: ['task_id', 'student_id'], unique: true }],
});

// Submission prototype methods
Submission.prototype.calculateGrade = function() {
  if (!this.percentage) return null;
  if (this.percentage >= 90) return 'A';
  if (this.percentage >= 80) return 'B';
  if (this.percentage >= 70) return 'C';
  if (this.percentage >= 60) return 'D';
  return 'F';
};

const Reminder = sequelize.define('Reminder', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  task_id:       { type: DataTypes.INTEGER, allowNull: false },
  user_id:       { type: DataTypes.INTEGER, allowNull: false },
  reminder_time: { type: DataTypes.DATE, allowNull: false },
  type:          { type: DataTypes.STRING(50), defaultValue: 'email' },
  message:       { type: DataTypes.TEXT },
  status:        { type: DataTypes.STRING(50), defaultValue: 'pending' },
  sent_at:       { type: DataTypes.DATE },
  retry_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
  created_by:    { type: DataTypes.INTEGER },
}, { paranoid: true, timestamps: true });

const Payment = sequelize.define('Payment', {
  id:                      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organization_id:         { type: DataTypes.INTEGER, allowNull: false },
  amount:                  { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency:                { type: DataTypes.STRING(3), defaultValue: 'RWF' },
  payment_method:          { type: DataTypes.STRING(50), defaultValue: 'pending' },
  transaction_id:          { type: DataTypes.STRING(100) },
  status:                  { type: DataTypes.STRING(50), defaultValue: 'pending' },
  payment_date:            { type: DataTypes.DATE },
  due_date:                { type: DataTypes.DATE, allowNull: false },
  subscription_type:       { type: DataTypes.STRING(50), allowNull: false },
  subscription_start:      { type: DataTypes.DATE },
  subscription_end:        { type: DataTypes.DATE },
  invoice_number:          { type: DataTypes.STRING(50), unique: true },
  description:             { type: DataTypes.TEXT },
  discount_amount:         { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  tax_amount:              { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total_amount:            { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  processed_by:            { type: DataTypes.INTEGER },
}, { paranoid: true, timestamps: true });

const ApprovalRequest = sequelize.define('ApprovalRequest', {
  id:                    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organization_id:       { type: DataTypes.INTEGER, allowNull: false },
  request_type:          { type: DataTypes.STRING(50), defaultValue: 'registration' },
  status:                { type: DataTypes.STRING(50), defaultValue: 'pending' },
  priority:              { type: DataTypes.STRING(50), defaultValue: 'medium' },
  submitted_documents:   { type: DataTypes.JSON },
  business_justification:{ type: DataTypes.TEXT },
  reviewed_by:           { type: DataTypes.INTEGER },
  reviewed_at:           { type: DataTypes.DATE },
  approval_notes:        { type: DataTypes.TEXT },
  rejection_reason:      { type: DataTypes.TEXT },
  conditions:            { type: DataTypes.TEXT },
  sla_due_date:          { type: DataTypes.DATE },
  escalated:             { type: DataTypes.BOOLEAN, defaultValue: false },
  escalated_to:          { type: DataTypes.INTEGER },
}, {
  paranoid: true, timestamps: true,
  hooks: {
    beforeCreate: (r) => {
      if (r.request_type === 'registration') {
        r.sla_due_date = new Date(Date.now() + 72 * 60 * 60 * 1000);
      }
    },
  },
});

// ApprovalRequest prototype methods
ApprovalRequest.prototype.isOverdue = function() {
  return this.sla_due_date && new Date() > new Date(this.sla_due_date) && this.status === 'pending';
};

ApprovalRequest.prototype.shouldEscalate = function() {
  return this.isOverdue() && !this.escalated;
};

const AuditLog = sequelize.define('AuditLog', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id:          { type: DataTypes.INTEGER },
  district_admin_id:{ type: DataTypes.INTEGER },
  organization_id:  { type: DataTypes.INTEGER },
  action:           { type: DataTypes.STRING(100), allowNull: false },
  resource_type:    { type: DataTypes.STRING(50),  allowNull: false },
  resource_id:      { type: DataTypes.INTEGER },
  ip_address:       { type: DataTypes.STRING(45) },
  user_agent:       { type: DataTypes.TEXT },
  severity:         { type: DataTypes.STRING(50), defaultValue: 'info' },
  category:         { type: DataTypes.STRING(50), allowNull: false },
  description:      { type: DataTypes.TEXT },
  metadata:         { type: DataTypes.JSON },
  success:          { type: DataTypes.BOOLEAN, defaultValue: true },
  error_message:    { type: DataTypes.TEXT },
}, { timestamps: true, updatedAt: false, paranoid: false });

// ── 3. Associations ───────────────────────────────────────────────────────────
District.hasMany(DistrictAdmin,  { foreignKey: 'district_id', as: 'admins'        });
District.hasMany(Organization,   { foreignKey: 'district_id', as: 'organizations' });

DistrictAdmin.belongsTo(District,      { foreignKey: 'district_id', as: 'district'              });
DistrictAdmin.hasMany(Organization,    { foreignKey: 'approved_by', as: 'approvedOrganizations' });
DistrictAdmin.hasMany(ApprovalRequest, { foreignKey: 'reviewed_by', as: 'reviewedRequests'      });
DistrictAdmin.hasMany(Payment,         { foreignKey: 'processed_by', as: 'processedPayments'    });

Organization.belongsTo(District,      { foreignKey: 'district_id', as: 'district'       });
Organization.belongsTo(DistrictAdmin, { foreignKey: 'approved_by', as: 'approver'        });
Organization.hasMany(User,            { foreignKey: 'organization_id', as: 'users'       });
Organization.hasMany(Class,           { foreignKey: 'organization_id', as: 'classes'     });
Organization.hasMany(Payment,         { foreignKey: 'organization_id', as: 'payments'    });
Organization.hasOne(ApprovalRequest,  { foreignKey: 'organization_id', as: 'approvalRequest' });

User.belongsTo(Organization,  { foreignKey: 'organization_id', as: 'organization'    });
User.belongsTo(User,          { foreignKey: 'created_by',      as: 'creator'         });
User.hasMany(User,            { foreignKey: 'created_by',      as: 'createdUsers'    });
User.hasMany(Class,           { foreignKey: 'manager_id',      as: 'managedClasses'  });
User.hasMany(Subject,         { foreignKey: 'teacher_id',      as: 'subjects'        });
User.hasMany(Task,            { foreignKey: 'created_by',      as: 'createdTasks'    });
User.hasMany(Submission,      { foreignKey: 'student_id',      as: 'submissions'     });
User.hasMany(Submission,      { foreignKey: 'graded_by',       as: 'gradedSubmissions' });
User.hasMany(Reminder,        { foreignKey: 'user_id',         as: 'reminders'       });
User.hasMany(Reminder,        { foreignKey: 'created_by',      as: 'createdReminders' });
User.hasOne(StudentProfile,   { foreignKey: 'user_id',         as: 'studentProfile'  });
User.hasOne(EmployeeProfile,  { foreignKey: 'user_id',         as: 'employeeProfile' });

Class.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
Class.belongsTo(User,         { foreignKey: 'manager_id',      as: 'manager'      });
Class.hasMany(Subject,        { foreignKey: 'class_id',        as: 'subjects'     });
Class.hasMany(StudentProfile, { foreignKey: 'class_id',        as: 'students'     });
Class.hasMany(Task,           { foreignKey: 'class_id',        as: 'tasks'        });

Subject.belongsTo(Class, { foreignKey: 'class_id',   as: 'class'   });
Subject.belongsTo(User,  { foreignKey: 'teacher_id', as: 'teacher' });
Subject.hasMany(Task,    { foreignKey: 'subject_id', as: 'tasks'   });

StudentProfile.belongsTo(User,  { foreignKey: 'user_id',  as: 'user'  });
StudentProfile.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

EmployeeProfile.belongsTo(User,          { foreignKey: 'user_id',       as: 'user'        });
EmployeeProfile.belongsTo(User,          { foreignKey: 'supervisor_id', as: 'supervisor'  });
EmployeeProfile.hasMany(EmployeeProfile, { foreignKey: 'supervisor_id', as: 'subordinates' });

Task.belongsTo(User,     { foreignKey: 'created_by',  as: 'creator' });
Task.belongsTo(Class,    { foreignKey: 'class_id',    as: 'class'   });
Task.belongsTo(Subject,  { foreignKey: 'subject_id',  as: 'subject' });
Task.hasMany(Submission, { foreignKey: 'task_id',     as: 'submissions' });
Task.hasMany(Reminder,   { foreignKey: 'task_id',     as: 'reminders'   });

Submission.belongsTo(Task, { foreignKey: 'task_id',    as: 'task'    });
Submission.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
Submission.belongsTo(User, { foreignKey: 'graded_by',  as: 'grader'  });

Reminder.belongsTo(Task, { foreignKey: 'task_id',    as: 'task'    });
Reminder.belongsTo(User, { foreignKey: 'user_id',    as: 'user'    });
Reminder.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

Payment.belongsTo(Organization,  { foreignKey: 'organization_id', as: 'organization' });
Payment.belongsTo(DistrictAdmin, { foreignKey: 'processed_by',    as: 'processor'    });

ApprovalRequest.belongsTo(Organization,  { foreignKey: 'organization_id', as: 'organization' });
ApprovalRequest.belongsTo(DistrictAdmin, { foreignKey: 'reviewed_by',     as: 'reviewer'     });
ApprovalRequest.belongsTo(DistrictAdmin, { foreignKey: 'escalated_to',    as: 'escalatedTo'  });

AuditLog.belongsTo(User,          { foreignKey: 'user_id',           as: 'user'          });
AuditLog.belongsTo(DistrictAdmin, { foreignKey: 'district_admin_id', as: 'districtAdmin' });
AuditLog.belongsTo(Organization,  { foreignKey: 'organization_id',   as: 'organization'  });

// ── 4. Exports ────────────────────────────────────────────────────────────────
export {
  sequelize,
  District, DistrictAdmin, Organization, User,
  Class, Subject, StudentProfile, EmployeeProfile,
  Task, Submission, Reminder, Payment, ApprovalRequest, AuditLog,
};

export default sequelize;
