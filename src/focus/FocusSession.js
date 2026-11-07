/**
 * FocusSession — server-side record of a student's verified focus work on one task.
 *
 * This is a NEW table. Nothing in `src/database.js` is modified by this file: it borrows
 * the existing Sequelize instance, so `sequelize.sync({ alter: false })` creates the table
 * on boot without touching any existing table.
 *
 * Time accounting rules (see focusService.accrue):
 * - `focused_ms` is only ever advanced from server timestamps while status is RUNNING.
 * - Completing a session is idempotent: a repeated request returns the stored row instead
 *   of creating or re-stamping a second one.
 */
import { DataTypes } from 'sequelize';
import sequelize, { Task, User } from '../database.js';

const FocusSession = sequelize.define(
  'FocusSession',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    task_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    organization_id: { type: DataTypes.INTEGER },
    // Snapshot of the task policy at session start, so a later task edit cannot
    // retroactively invalidate work the student already did.
    mode: { type: DataTypes.STRING(20), defaultValue: 'accumulated' },
    required_ms: { type: DataTypes.BIGINT, defaultValue: 0 },
    // RUNNING | PAUSED | COMPLETED | ABANDONED
    status: { type: DataTypes.STRING(20), defaultValue: 'RUNNING' },
    focused_ms: { type: DataTypes.BIGINT, defaultValue: 0 },
    paused_ms: { type: DataTypes.BIGINT, defaultValue: 0 },
    blocks_completed: { type: DataTypes.INTEGER, defaultValue: 0 },
    interruptions: { type: DataTypes.JSON, defaultValue: [] },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    started_at: { type: DataTypes.DATE },
    last_tick_at: { type: DataTypes.DATE },
    paused_at: { type: DataTypes.DATE },
    completed_at: { type: DataTypes.DATE },
    ended_at: { type: DataTypes.DATE },
  },
  {
    // The shared model defaults are paranoid:true; focus history must be permanent.
    paranoid: false,
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  }
);

FocusSession.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
FocusSession.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

export default FocusSession;
