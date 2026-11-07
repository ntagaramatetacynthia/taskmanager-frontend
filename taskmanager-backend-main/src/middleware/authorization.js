import { Task, Class } from '../database.js';

export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    // 1. Verify user authentication exists
    if (!req.user && !req.admin && req.userType !== 'district_admin') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // 2. Extract and normalize role from token session
    const rawRole = req.userType === 'district_admin'
      ? 'district_admin'
      : (req.user?.role || '');

    const userRole = String(rawRole).toLowerCase().trim().replace(/[\s-]+/g, '_');

    // Canonical role aliases map (e.g. Teacher, Staff/Worker, Org Admin)
    const aliasMap = {
      teacher: ['teacher', 'instructor', 'faculty'],
      worker: ['worker', 'staff', 'employee'],
      staff: ['staff', 'worker', 'employee'],
      organization_admin: ['organization_admin', 'org_admin', 'admin', 'super_admin'],
      admin: ['admin', 'organization_admin', 'org_admin', 'district_admin', 'super_admin'],
      district_admin: ['district_admin', 'admin', 'super_admin'],
      student: ['student', 'learner', 'pupil'],
      intern: ['intern', 'trainee']
    };

    // Normalize allowed roles
    const normalizedAllowed = allowedRoles.map(r =>
      String(r).toLowerCase().trim().replace(/[\s-]+/g, '_')
    );

    // Get all equivalent roles for the user
    const userEquivalentRoles = new Set([
      userRole,
      ...(aliasMap[userRole] || [])
    ]);

    // Check if user has any of the allowed roles (directly or via alias)
    const isAllowed = normalizedAllowed.some(allowed => {
      if (userEquivalentRoles.has(allowed)) return true;
      const allowedEquivalents = aliasMap[allowed] || [];
      return allowedEquivalents.some(eq => userEquivalentRoles.has(eq));
    });

    if (isAllowed) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. Insufficient permissions.'
    });
  };
};

export const districtScopeMiddleware = async (req, res, next) => {
  try {
    if (req.userType !== 'district_admin') {
      return res.status(403).json({
        success: false,
        message: 'District admin access required.'
      });
    }
    
    // Add district scope to queries
    req.districtScope = {
      district_id: req.admin.district_id
    };
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error applying district scope.'
    });
  }
};

export const organizationScopeMiddleware = async (req, res, next) => {
  try {
    if (req.userType === 'district_admin') {
      // District admins can access all organizations in their district
      req.organizationScope = {
        district_id: req.admin.district_id
      };
    } else if (req.user) {
      // Regular users can only access their organization
      req.organizationScope = {
        organization_id: req.user.organization_id
      };
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error applying organization scope.'
    });
  }
};

export const ownershipMiddleware = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findByPk(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found.'
        });
      }
      
      // Check ownership based on user type
      if (req.userType === 'district_admin') {
        // District admins can access resources in their district
        if (resource.district_id && resource.district_id !== req.admin.district_id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Resource not in your district.'
          });
        }
      } else if (req.user) {
        // Regular users can only access resources in their organization
        if (resource.organization_id && resource.organization_id !== req.user.organization_id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Resource not in your organization.'
          });
        }
        
        // Additional checks for specific roles
        if (resource.created_by && resource.created_by !== req.user.id) {
          const allowedRoles = ['organization_admin', 'teacher'];
          if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
              success: false,
              message: 'Access denied. You can only access your own resources.'
            });
          }
        }
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error checking resource ownership.'
      });
    }
  };
};

/**
 * Task deletion authorization middleware.
 * Verifies that the authenticated user:
 * 1. Has an Admin ('organization_admin', 'admin', 'district_admin', 'super_admin') or Teacher ('teacher') role,
 * OR
 * 2. Is the original creator of the task (req.user.id === task.created_by).
 */
export const taskDeleteAuthorization = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.admin?.id;
    const userRole = (req.userType === 'district_admin' ? 'district_admin' : req.user?.role) || '';

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authenticated user found.'
      });
    }

    const taskId = req.params.id;
    const task = await Task.findByPk(taskId, {
      include: [{ model: Class, as: 'class' }]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Organization scoping check
    if (req.user?.organization_id && task.class?.organization_id) {
      if (Number(task.class.organization_id) !== Number(req.user.organization_id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Task belongs to another organization.'
        });
      }
    }

    const normalizedRole = String(userRole).toLowerCase().trim();
    const isAdminOrTeacher = [
      'organization_admin',
      'admin',
      'district_admin',
      'super_admin',
      'teacher'
    ].includes(normalizedRole);

    const creatorId = task.created_by ?? task.creator_id;
    const isCreator = Boolean(creatorId && String(creatorId) === String(userId));

    if (!isAdminOrTeacher && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    // Attach task to request object for controller reuse
    req.task = task;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking task permissions.',
      error: error.message
    });
  }
};
