# Rwanda Task Management System

A comprehensive multi-tenant task management platform for schools and companies with district-level administration, built specifically for Rwanda's administrative structure.

## 🎯 Overview

This system enables:
- **Multi-tenant architecture** with organization-level data isolation
- **District-based administration** where District Admins approve and manage organizations
- **Role-based access control** (RBAC) with 5 user roles
- **Secure onboarding** using organization-specific access codes
- **Task management** with assignments, submissions, and grading
- **Payment tracking** and subscription management
- **Comprehensive audit logging** for compliance

## 🏗️ Architecture

### System Roles
- **District Admin**: Main system authority per district
- **Organization Admin**: Manages internal users and classes/departments
- **Teacher/Worker**: Assigns tasks and manages groups
- **Student/Intern**: Receives and submits tasks

### Multi-Tenant Design
- Each School/Company = Tenant
- Data isolation via `organizationId`
- District-level oversight and approval

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- A database: PostgreSQL 13+ (supply `DATABASE_URL`), or nothing at all for the built-in SQLite file
- npm or yarn

### Installation

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd task-manager
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your database credentials and settings
```

3. **Database Setup**

No manual database creation is needed. On boot, Sequelize connects using `DATABASE_URL` when it is set, and otherwise opens the local SQLite file `./task_management.db`. Tables are created automatically by `sequelize.sync({ alter: false })` in `src/server.js`, so there is no migrations folder to run.

```bash
# Load districts, demo organizations and demo accounts (optional, but needed to log in)
npm run seed
```

4. **Start Development Server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`
Health check: `http://localhost:3000/health`

## 📊 Database Schema

### Core Models
- **District**: Administrative districts
- **DistrictAdmin**: System administrators per district
- **Organization**: Schools/Companies (tenants)
- **User**: All system users with roles
- **Class**: Academic classes or work departments
- **Task**: Assignments and projects
- **Submission**: Task submissions with grading
- **Payment**: Subscription and payment tracking
- **AuditLog**: Complete activity tracking

### Key Features
- **Soft Deletes**: All models use `paranoid: true`
- **Timestamps**: Automatic `created_at`, `updated_at`
- **Indexes**: Optimized for performance
- **Constraints**: Foreign keys with proper cascading

### Connection Resolution
`src/database.js` is the single data-layer module used by the server. It picks the dialect at runtime:

| Condition | Dialect | Notes |
|---|---|---|
| `DATABASE_URL` is set | PostgreSQL | Used for Render/Heroku/Railway. SSL is required and `rejectUnauthorized` is off, with a 60s connect/retry timeout for cold starts |
| `DATABASE_URL` is not set | SQLite | File `./task_management.db` next to `package.json`, created on first boot. No server or credentials needed |

`src/config/database.js` and the `mysql2` dependency are legacy and are not imported by `src/server.js`; ignore them when configuring a new environment.

## 🔐 Authentication & Authorization

### JWT Authentication
```javascript
// Login endpoints
POST /api/auth/login                    // Regular users
POST /api/auth/district-admin/login     // District admins
POST /api/auth/organization-login       // Student/intern with org code
```

### Role-Based Access Control
```javascript
// Middleware usage
roleMiddleware(['organization_admin', 'teacher'])
districtScopeMiddleware  // District admin scope
organizationScopeMiddleware  // Organization scope
```

### Security Features
- **Rate Limiting**: Prevents brute force attacks
- **Account Locking**: After failed login attempts
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Joi schemas for all endpoints
- **Audit Logging**: Complete activity tracking

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/login                     # User login
POST   /api/auth/district-admin/login      # District admin login
POST   /api/auth/organization-login        # Organization code login
GET    /api/auth/profile                   # Get current user profile
POST   /api/auth/logout                    # Logout
PUT    /api/auth/change-password           # Change password
```

### District Administration
```
GET    /api/district/organizations/pending # Get pending approvals
GET    /api/district/organizations         # Get all district organizations
PUT    /api/district/organizations/approve/:id  # Approve organization
PUT    /api/district/organizations/reject/:id   # Reject organization
PUT    /api/district/organizations/suspend/:id  # Suspend organization
GET    /api/district/stats                 # District statistics
```

### Organization Management
```
GET    /api/organizations/districts        # Get all districts (public)
GET    /api/organizations/check-code/:code # Check org code validity (public)
POST   /api/organizations/register         # Register new organization (public)
GET    /api/organizations/profile          # Get organization profile
PUT    /api/organizations/profile          # Update organization profile
GET    /api/organizations/stats            # Organization statistics
```

### User Management
```
POST   /api/users                         # Create user (org admin only)
GET    /api/users                         # List users
GET    /api/users/:id                     # Get user profile
PUT    /api/users/:id                     # Update user
DELETE /api/users/:id                     # Delete user (soft delete)
```

### Class/Department Management
```
POST   /api/classes                       # Create class/department
GET    /api/classes                       # List classes
GET    /api/classes/:id                   # Get class details
PUT    /api/classes/:id                   # Update class
DELETE /api/classes/:id                   # Delete class
```

### Task Management
```
POST   /api/tasks                         # Create task
GET    /api/tasks                         # List tasks
GET    /api/tasks/:id                     # Get task details
PUT    /api/tasks/:id                     # Update task
DELETE /api/tasks/:id                     # Delete task
POST   /api/tasks/:id/submit              # Submit task
PUT    /api/tasks/:id/submissions/:submissionId/grade  # Grade submission
```

## 🔄 System Workflows

### 1. Organization Registration Flow
1. Organization submits registration with district selection
2. Payment is made
3. Status = 'pending'
4. District Admin receives approval request
5. District Admin approves → system generates unique organization code
6. District Admin rejects → request closed
7. Organization receives code and can onboard users

### 2. User Registration Flow

**Students/Interns:**
1. Enter Organization Code
2. Enter Student/Employee ID
3. System validates ID from pre-loaded records
4. Pre-filled info displayed
5. User completes account setup

**Teachers/Workers:**
1. Created by Organization Admin
2. Receive login credentials
3. Complete profile setup

### 3. Task Management Flow
1. Teacher creates task with due date and requirements
2. Task published to class/department
3. Students receive notifications
4. Students submit work (files/text)
5. Teacher grades submissions
6. Results and feedback provided

## 🛡️ Security Features

### Rate Limiting
- General API: 100 requests per 15 minutes
- Authentication: 5 attempts per 15 minutes
- Registration: 3 attempts per hour

### Input Validation
```javascript
// Example validation schema
organizationRegistration: Joi.object({
  name: Joi.string().min(2).max(200).required(),
  type: Joi.string().valid('school', 'company').required(),
  district_id: Joi.number().integer().positive().required(),
  contact_email: Joi.string().email().required()
})
```

### Audit Logging
All actions are logged with:
- User/Admin identification
- Action performed
- Resource affected
- IP address and user agent
- Success/failure status
- Detailed metadata

## 💰 Payment & Subscription

### Subscription Types
- **Monthly**: Base rate
- **Quarterly**: 10% discount
- **Yearly**: 20% discount

### Pricing (RWF)
**Schools:**
- Monthly: 50,000 RWF
- Quarterly: 135,000 RWF
- Yearly: 480,000 RWF

**Companies:**
- Monthly: 75,000 RWF
- Quarterly: 202,500 RWF
- Yearly: 720,000 RWF

## 📈 Analytics & Reporting

### District Admin Dashboard
- Total organizations per district
- Approval/rejection rates
- Payment collection status
- User activity metrics

### Organization Dashboard
- Total users by role
- Task completion rates
- Submission statistics
- Payment history

## 🔧 Development

### Project Structure
```
src/
├── config/          # Database and app configuration
├── models/          # Sequelize models
├── migrations/      # Database migrations
├── controllers/     # Business logic
├── routes/          # API routes
├── middleware/      # Authentication, validation, security
├── services/        # External services (email, file upload)
├── utils/           # Helper functions
└── server.js        # Main application entry
```

### Available Scripts
```bash
npm start           # Production server
npm run dev         # Development server with nodemon
npm run migrate     # Legacy script: repository has no migrations folder, schema syncs on boot
npm run migrate:undo # Legacy script: same caveat as above
npm run seed        # Load districts, demo organizations and demo accounts
```

### Environment Variables
```env
# Database — PostgreSQL, used when present (SSL is enabled automatically)
# Omit this line to fall back to the local SQLite file ./task_management.db
DATABASE_URL=postgresql://user:password@host:5432/rwanda_task_management

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# Organization access-code prefix
ORG_CODE_PREFIX=RW

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## 🚀 Production Deployment

### Prerequisites
- Ubuntu 20.04+ server
- PostgreSQL 13+ (managed instance, or a persistent disk if you keep SQLite)
- Node.js 18+
- Nginx (reverse proxy)
- SSL certificate

### Deployment Steps
1. Clone repository to server
2. Install dependencies: `npm ci --production`
3. Set production environment variables (including `DATABASE_URL`)
4. Boot once so Sequelize creates the schema; run `npm run seed` only if you need the demo data
5. Run it under a process manager: `pm2 start src/server.js --name "rwanda-task-mgmt"`
6. Configure Nginx reverse proxy
7. Set up SSL certificate

### Production Considerations
- Use environment-specific database
- Enable database connection pooling
- Set up log rotation
- Configure backup strategy
- Monitor with PM2 or similar
- Use Redis for session storage (if needed)

## 📝 API Testing

### Postman Collection
A comprehensive Postman collection is available with:
- All API endpoints
- Authentication flows
- Role-based access testing
- Error scenario testing

### Testing Scenarios
1. **Authentication Flow**
   - District admin login
   - User login
   - Organization code login
   - Invalid credentials handling

2. **Organization Registration**
   - Valid registration
   - Duplicate name handling
   - Invalid district handling

3. **Approval Workflow**
   - Pending organization approval
   - Rejection with reason
   - Code generation

4. **RBAC Testing**
   - Role-specific access
   - Cross-organization access prevention
   - District scope enforcement

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation

---

**Built for Rwanda's Educational and Corporate Sectors** 🇷🇼