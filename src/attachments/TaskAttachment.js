/**
 * TaskAttachment — a worksheet (XLSX / XLS / CSV) a teacher attaches to a task.
 *
 * Like FocusSession this is a NEW table that borrows the shared Sequelize instance, so
 * `sequelize.sync({ alter: false })` creates it on boot and no existing table is altered.
 *
 * One row per task per kind, so replacing a worksheet does not accumulate stale files.
 */
import { DataTypes } from 'sequelize';
import sequelize, { Task, User } from '../database.js';

const TaskAttachment = sequelize.define(
  'TaskAttachment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    task_id: { type: DataTypes.INTEGER, allowNull: false },
    uploaded_by: { type: DataTypes.INTEGER, allowNull: false },
    organization_id: { type: DataTypes.INTEGER },
    // 'worksheet' today; a separate kind keeps room for answer keys later.
    kind: { type: DataTypes.STRING(20), defaultValue: 'worksheet' },
    file_url: { type: DataTypes.STRING(500), allowNull: false },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    file_size: { type: DataTypes.INTEGER },
    file_type: { type: DataTypes.STRING(150) },
  },
  {
    paranoid: false,
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [{ fields: ['task_id', 'kind'], unique: true }],
  }
);

TaskAttachment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskAttachment.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

export default TaskAttachment;
