import jwt from 'jsonwebtoken';
import { User, DistrictAdmin, Organization, District } from '../database.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type === 'district_admin') {
      const admin = await DistrictAdmin.findByPk(decoded.id, {
        include: [{ model: District, as: 'district' }]
      });
      
      if (!admin || admin.status !== 'active') {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token or account inactive.' 
        });
      }
      
      req.admin = admin;
      req.userType = 'district_admin';
    } else {
      const user = await User.findByPk(decoded.id, {
        include: [{ model: Organization, as: 'organization' }]
      });
      
      if (!user || user.status !== 'active') {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token or account inactive.' 
        });
      }
      
      req.user = user;
      req.userType = 'user';
    }
    
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type === 'district_admin') {
        req.admin = await DistrictAdmin.findByPk(decoded.id);
        req.userType = 'district_admin';
      } else {
        req.user = await User.findByPk(decoded.id);
        req.userType = 'user';
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};