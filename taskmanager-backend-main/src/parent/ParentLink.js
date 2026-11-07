/**
 * ParentLink — a parent's self-registration request to follow one student.
 *
 * A parent signs up with org code + Student ID + their own phone + name. The link starts
 * as 'pending' and only allows login once the child's class teacher (or an org admin)
 * approves it. NEW table on the shared Sequelize instance: `sync({ alter: false })`
 * creates it on boot and no existing table is altered.
 */
import { DataTypes } from 'sequelize';
import sequelize, { User, Class, StudentProfile } from '../database.js';

const ParentLink = sequelize.define(
  'ParentLink',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    student_user_id: { type: DataTypes.INTEGER, allowNull: false },
    student_profile_id: { type: DataTypes.INTEGER, allowNull: false },
    student_code: { type: DataTypes.STRING(50), allowNull: false },
    class_id: { type: DataTypes.INTEGER },
    organization_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_name: { type: DataTypes.STRING(100), allowNull: false },
    // Stored as entered (for display) and normalized (for matching at login).
    phone: { type: DataTypes.STRING(20), allowNull: false },
    phone_normalized: { type: DataTypes.STRING(20), allowNull: false },
    relationship: { type: DataTypes.STRING(30), defaultValue: 'parent' },
    email: { type: DataTypes.STRING(150) },
    status: { type: DataTypes.STRING(20), defaultValue: 'pending' }, // pending | approved | rejected
    reviewed_by: { type: DataTypes.INTEGER },
    reviewed_at: { type: DataTypes.DATE },
    rejection_reason: { type: DataTypes.TEXT },
  },
  {
    paranoid: false,
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [
      { fields: ['student_profile_id', 'phone_normalized'], unique: true },
      { fields: ['organization_id', 'status'] },
      { fields: ['class_id'] },
    ],
  }
);

ParentLink.belongsTo(User, { foreignKey: 'student_user_id', as: 'student' });
ParentLink.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
ParentLink.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });
ParentLink.belongsTo(StudentProfile, { foreignKey: 'student_profile_id', as: 'studentProfile' });

export default ParentLink;
