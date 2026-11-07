import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from './database.js';

// Import middleware
import { generalLimiter, securityHeaders, errorHandler, notFoundHandler } from './middleware/security.js';

// Import routes
import authRoutes from './routes/auth.js';
import districtRoutes from './routes/district.js';
import organizationRoutes from './routes/organization.js';
import userRoutes from './routes/user.js';
import classRoutes from './routes/class.js';
import taskRoutes from './routes/task.js';
import focusRoutes from './focus/focusRoutes.js';
import parentRoutes from './parent/parentRoutes.js';
import studentRoutes from './routes/student.js';
import ParentController from './parent/parentController.js';
import { authMiddleware } from './middleware/auth.js';
import { roleMiddleware } from './middleware/authorization.js';

// Import services (optional — comment out if not configured)
import ReminderService from './services/ReminderService.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// trust proxy intentionally not enabled to avoid permissive rate-limit trust.
// If you deploy behind a proxy and want IP-based limiting, use a stricter trust setting.


// Default to 3000 to match the documented local setup (see README / .env.example).
const PORT = process.env.PORT || 3000;


// Security middleware
app.use(securityHeaders);
app.use(generalLimiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://taskmanager-frontend-wbwa.onrender.com',
    ]

app.use(cors({
  // Allow requests from allowed origins OR localhost (dev)
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return cb(null, true)

    // Always allow local dev
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return cb(null, true)
    }

    if (!allowedOrigins.includes(origin)) {
      return cb(new Error('Not allowed by CORS'))
    }

    return cb(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Ensure CORS headers are returned even for preflight.
  // Some proxy setups require an explicit success for OPTIONS.
  optionsSuccessStatus: 204,
}));

// Explicitly handle CORS preflight.
app.options('*', (req, res) => {
  res.sendStatus(204);
});



// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Rwanda Task Management System API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/district', districtRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/parents', parentRoutes);

// Teacher Feedback Inbox routes (/api/teachers/feedback)
app.get('/api/teachers/feedback',
  authMiddleware,
  roleMiddleware(['teacher', 'organization_admin']),
  (req, res) => ParentController.teacherInbox(req, res)
);
app.patch('/api/teachers/feedback/:id/read',
  authMiddleware,
  roleMiddleware(['teacher', 'organization_admin']),
  (req, res) => ParentController.markRead(req, res)
);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Database connection and server startup
const startServer = async () => {
  const maxRetries = 5;
  let retryCount = 0;

  const attemptConnection = async () => {
    try {
      // Test database connection
      await sequelize.authenticate();
      console.log('✅ Database connection established successfully.');

      // Sync database
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized successfully.');

      // Start server
      const server = app.listen(PORT, () => {
        console.log(` Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV}`);
        console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
        console.log(`💊 Health Check: http://localhost:${PORT}/health`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use. Run: npx kill-port ${PORT}`);
        } else {
          console.error('❌ Server error:', err.message);
        }
        process.exit(1);
      });

      // Start reminder service (uncomment when configured)
      ReminderService.start();

    } catch (error) {
      retryCount++;
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff
      
      if (retryCount < maxRetries) {
        console.warn(`⚠️ Connection attempt ${retryCount} failed: ${error.message}`);
        console.log(`🔄 Retrying in ${waitTime}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(attemptConnection, waitTime);
      } else {
        console.error('❌ Unable to start server after', maxRetries, 'attempts:', error.message);
        console.error('🔗 DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
        process.exit(1);
      }
    }
  };

  attemptConnection();
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

// Start the server
startServer();

export default app;