/**
 * One-off execution script: Update existing @org.rw emails to @gmail.com
 *
 * Runs the migration safely inside a transaction and outputs the updated records.
 */
import sequelize from '../src/database.js';
import { up } from '../src/migrations/006-update-org-rw-emails-to-gmail.js';

async function run() {
  console.log('🔄 Connecting to database and running email migration...');
  await sequelize.authenticate();
  console.log('✅ Connected to database.');

  const queryInterface = sequelize.getQueryInterface();
  const summary = await up(queryInterface, sequelize.constructor);

  console.log('🎉 Migration finished with result:', summary);
  await sequelize.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
