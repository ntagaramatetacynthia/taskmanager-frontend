/**
 * Parent authentication.
 *
 * Parent tokens are signed with a SEPARATE secret. The existing authMiddleware verifies
 * with JWT_SECRET and would otherwise treat any token as a User token, so a parent token
 * carrying the child's id would grant student access. Because the signature differs,
 * jwt.verify() in the existing middleware throws and every existing route answers 401.
 */
import jwt from 'jsonwebtoken';
import { User, StudentProfile, Organization } from '../database.js';

export const getParentSecret = () => {
  if (process.env.PARENT_JWT_SECRET) return process.env.PARENT_JWT_SECRET;
  if (!process.env.JWT_SECRET) throw new Error('PARENT_JWT_SECRET / JWT_SECRET not configured');
  // Fallback: derived, but never equal to JWT_SECRET.
  return `${process.env.JWT_SECRET}::parent-portal`;
};

export const signParentToken = (profile, user) =>
  jwt.sign(
    {
      type: 'parent',
      student_user_id: user.id,
      student_profile_id: profile.id,
      class_id: profile.class_id,
      organization_id: user.organization_id,
    },
    getParentSecret(),
    { expiresIn: process.env.PARENT_JWT_EXPIRES_IN || '1d' }
  );

export const parentAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, getParentSecret());
    if (decoded.type !== 'parent') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    const student = await User.findByPk(decoded.student_user_id, {
      include: [
        { model: StudentProfile, as: 'studentProfile' },
        { model: Organization, as: 'organization' },
      ],
    });

    if (!student || !student.studentProfile || student.studentProfile.id !== decoded.student_profile_id) {
      return res.status(401).json({ success: false, message: 'Invalid token or student not found.' });
    }
    if (student.organization?.status !== 'approved') {
      return res.status(403).json({ success: false, message: 'Organization not approved.' });
    }

    req.parent = {
      student,
      profile: student.studentProfile,
      organization_id: student.organization_id,
    };
    req.userType = 'parent';
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};
