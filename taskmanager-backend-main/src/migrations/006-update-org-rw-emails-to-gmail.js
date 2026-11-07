/**
 * Migration 006: Update existing @org.rw emails to @gmail.com
 *
 * Safely updates records in User, DistrictAdmin, StudentProfile, and EmployeeProfile
 * using a single atomic transaction. Passwords, hashes, and foreign keys remain untouched.
 */
import { Op } from 'sequelize';
import sequelize, { User, DistrictAdmin, StudentProfile, EmployeeProfile } from '../database.js';

export const up = async (queryInterface, Sequelize) => {
  const transaction = await sequelize.transaction();
  try {
    const summary = {
      usersUpdated: 0,
      districtAdminsUpdated: 0,
      studentProfilesUpdated: 0,
      employeeProfilesUpdated: 0,
    };

    // 1. Update User records ending with @org.rw
    const users = await User.findAll({
      where: {
        email: { [Op.iLike]: '%@org.rw' }
      },
      paranoid: false,
      transaction,
    });

    for (const u of users) {
      const newEmail = u.email.replace(/@org\.rw$/i, '@gmail.com');
      await u.update({ email: newEmail }, { transaction });
      summary.usersUpdated++;
    }

    // 2. Update DistrictAdmin records ending with @org.rw
    const admins = await DistrictAdmin.findAll({
      where: {
        email: { [Op.iLike]: '%@org.rw' }
      },
      paranoid: false,
      transaction,
    });

    for (const a of admins) {
      const newEmail = a.email.replace(/@org\.rw$/i, '@gmail.com');
      await a.update({ email: newEmail }, { transaction });
      summary.districtAdminsUpdated++;
    }

    // 3. Update StudentProfile guardian_email if ending with @org.rw
    if (StudentProfile.rawAttributes.guardian_email) {
      const sps = await StudentProfile.findAll({
        where: {
          guardian_email: { [Op.iLike]: '%@org.rw' }
        },
        paranoid: false,
        transaction,
      });

      for (const sp of sps) {
        if (sp.guardian_email) {
          const newEmail = sp.guardian_email.replace(/@org\.rw$/i, '@gmail.com');
          await sp.update({ guardian_email: newEmail }, { transaction });
          summary.studentProfilesUpdated++;
        }
      }
    }

    // 4. Update EmployeeProfile if it has an email column ending with @org.rw
    if (EmployeeProfile.rawAttributes.email) {
      const eps = await EmployeeProfile.findAll({
        where: {
          email: { [Op.iLike]: '%@org.rw' }
        },
        paranoid: false,
        transaction,
      });

      for (const ep of eps) {
        if (ep.email) {
          const newEmail = ep.email.replace(/@org\.rw$/i, '@gmail.com');
          await ep.update({ email: newEmail }, { transaction });
          summary.employeeProfilesUpdated++;
        }
      }
    }

    await transaction.commit();
    console.log('✅ Email migration completed successfully:', summary);
    return summary;
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Email migration failed and rolled back:', error.message);
    throw error;
  }
};

export const down = async (queryInterface, Sequelize) => {
  const transaction = await sequelize.transaction();
  try {
    const users = await User.findAll({
      where: {
        email: { [Op.iLike]: '%@gmail.com' }
      },
      paranoid: false,
      transaction,
    });

    for (const u of users) {
      const oldEmail = u.email.replace(/@gmail\.com$/i, '@org.rw');
      await u.update({ email: oldEmail }, { transaction });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export default { up, down };
