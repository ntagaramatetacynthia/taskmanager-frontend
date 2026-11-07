/**
 * Adds the per-task focus policy columns.
 *
 * `sequelize.sync({ alter: false })` never adds columns to a table that already exists,
 * so this must be applied once per environment. It is idempotent: it inspects the table
 * first and skips columns that are already present, so it is safe to re-run and works on
 * both PostgreSQL (current deployment) and SQLite (local fallback).
 *
 * Note: this repository's `.sequelizerc` is a database config, not a CLI path config, so
 * `npx sequelize-cli db:migrate` is not wired up. Apply it with:
 *   node -e "import('./src/migrations/005-add-focus-config-to-tasks.js').then(async (m) => { const { default: s } = await import('./src/database.js'); await s.authenticate(); await m.up(s.getQueryInterface(), (await import('sequelize')).default); console.log('applied'); process.exit(0); })"
 */
import { Task } from '../database.js';

// Models use freezeTableName, so the physical table is "Task" (singular, case sensitive
// in PostgreSQL). Read it from the model instead of hard-coding a guess.
const tableName = () => Task.getTableName();

export const up = async (queryInterface, Sequelize) => {
  const table = await queryInterface.describeTable(tableName());

  if (!table.focus_minutes) {
    // NULL means "no focus requirement" so tasks created before this feature keep working.
    await queryInterface.addColumn(tableName(), 'focus_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  }

  if (!table.focus_mode) {
    await queryInterface.addColumn(tableName(), 'focus_mode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'accumulated',
    });
  }
};

export const down = async (queryInterface) => {
  const table = await queryInterface.describeTable(tableName());
  if (table.focus_mode) await queryInterface.removeColumn(tableName(), 'focus_mode');
  if (table.focus_minutes) await queryInterface.removeColumn(tableName(), 'focus_minutes');
};
