/**
 * Feedback — a message a parent/guardian sends to one of their child's teachers.
 *
 * Like TaskAttachment / FocusSession this is a NEW table on the shared Sequelize
 * instance, so `sequelize.sync({ alter: false })` creates it on boot and no existing
 * table is altered.
 */
import { DataTypes } from 'sequelize';
import sequelize, { User, Class, StudentProfile } from '../database.js';

const Feedback = sequelize.define(
  'Feedback',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    student_user_id: { type: DataTypes.INTEGER, allowNull: false },
    student_code: { type: DataTypes.STRING(50), allowNull: false },
    teacher_id: { type: DataTypes.INTEGER, allowNull: false },
    class_id: { type: DataTypes.INTEGER },
    subject_id: { type: DataTypes.INTEGER },
    organization_id: { type: DataTypes.INTEGER },
    // 'class_teacher' (default recipient) or 'subject_teacher' (parent override).
    recipient_type: { type: DataTypes.STRING(20), defaultValue: 'class_teacher' },
    parent_name: { type: DataTypes.STRING(100) },
    parent_phone: { type: DataTypes.STRING(20) },
    title: { type: DataTypes.STRING(200) },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING(20), defaultValue: 'unread' },
    read_at: { type: DataTypes.DATE },
  },
  {
    paranoid: false,
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [{ fields: ['teacher_id'] }, { fields: ['student_user_id'] }],
  }
);

Feedback.belongsTo(User, { foreignKey: 'teacher_id', as: 'teacher' });
Feedback.belongsTo(User, { foreignKey: 'student_user_id', as: 'student' });
Feedback.belongsTo(StudentProfile, { foreignKey: 'student_user_id', targetKey: 'user_id', as: 'studentProfile' });
Feedback.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

export default Feedback;
