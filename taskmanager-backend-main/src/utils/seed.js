import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Op } from 'sequelize';
import sequelize, {
  District,
  DistrictAdmin,
  Organization,
  User,
  Class,
  Subject,
  StudentProfile,
  EmployeeProfile,
  Task,
  Submission,
  Reminder,
  Payment,
  ApprovalRequest,
  AuditLog,
} from '../database.js';
import TaskAttachment from '../attachments/TaskAttachment.js';
import FocusSession from '../focus/FocusSession.js';
import Feedback from '../parent/Feedback.js';
import ParentLink from '../parent/ParentLink.js';

// Generate unique student ID: ST-xxxx (4-digit sequential)
async function generateStudentId(transaction) {
  // Get all existing student IDs that match the pattern
  const profiles = await StudentProfile.findAll({
    attributes: ['student_id'],
    where: {
      student_id: { [Op.like]: 'ST-%' }
    },
    paranoid: false,
    transaction
  });

  // Extract numbers and find max
  let maxNum = 0;
  profiles.forEach(profile => {
    const match = profile.student_id.match(/^ST-(\d{4})$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  // Next number
  const nextNum = maxNum + 1;
  const newId = `ST-${nextNum.toString().padStart(4, '0')}`;

  // Check if exists (to handle race conditions)
  const existing = await StudentProfile.findOne({ where: { student_id: newId }, transaction });
  if (existing) {
    // If collision, recurse (though unlikely with sequential)
    return await generateStudentId(transaction);
  }

  return newId;
}

const DISTRICTS = [
  // Kigali City
  { name: 'Gasabo',     code: 'GSB' },
  { name: 'Kicukiro',   code: 'KCK' },
  { name: 'Nyarugenge', code: 'NYR' },
  // Eastern Province
  { name: 'Bugesera',   code: 'BGS' },
  { name: 'Gatsibo',    code: 'GTS' },
  { name: 'Kayonza',    code: 'KYZ' },
  { name: 'Kirehe',     code: 'KRH' },
  { name: 'Ngoma',      code: 'NGM' },
  { name: 'Nyagatare',  code: 'NYG' },
  { name: 'Rwamagana',  code: 'RWM' },
  // Northern Province
  { name: 'Burera',     code: 'BUR' },
  { name: 'Gakenke',    code: 'GKK' },
  { name: 'Gicumbi',    code: 'GCM' },
  { name: 'Musanze',    code: 'MSZ' },
  { name: 'Rulindo',    code: 'RLD' },
  // Southern Province
  { name: 'Gisagara',   code: 'GSG' },
  { name: 'Huye',       code: 'HUY' },
  { name: 'Kamonyi',    code: 'KMN' },
  { name: 'Muhanga',    code: 'MHG' },
  { name: 'Nyamagabe',  code: 'NYM' },
  { name: 'Nyamasheke', code: 'NYS' },
  { name: 'Nyanza',     code: 'NYZ' },
  { name: 'Nyaruguru',  code: 'NYU' },
  { name: 'Ruhango',    code: 'RHG' },
  // Western Province
  { name: 'Karongi',    code: 'KRG' },
  { name: 'Ngororero',  code: 'NGR' },
  { name: 'Nyabihu',    code: 'NYB' },
  { name: 'Rubavu',     code: 'RBV' },
  { name: 'Rusizi',     code: 'RSZ' },
  { name: 'Rutsiro',    code: 'RTS' },
];

/**
 * Delete every row, children before parents so foreign keys are never violated.
 *
 * Ordering matters: on SQLite this was silently ignored because foreign keys
 * were not enforced, but Postgres rejects a parent delete while a child row
 * still points at it. Each table below is listed only after every table that
 * references it.
 */
async function clearData(transaction) {
  if (!transaction) {
    throw new Error('clearData(transaction) requires an active Sequelize transaction.');
  }

  // 1. AuditLog references User, DistrictAdmin, and Organization.
  await AuditLog.destroy({ where: {}, force: true, transaction });

  // 2. Task-dependent child records (TaskAttachment, FocusSession, Reminder, Submission)
  //    reference Task and User; they must be removed before Task and User.
  if (TaskAttachment && sequelize.models.TaskAttachment) {
    await TaskAttachment.destroy({ where: {}, force: true, transaction });
  }
  if (FocusSession && sequelize.models.FocusSession) {
    await FocusSession.destroy({ where: {}, force: true, transaction });
  }
  await Reminder.destroy({ where: {}, force: true, transaction });
  await Submission.destroy({ where: {}, force: true, transaction });

  // 3. Task references User (created_by), Class (class_id), and Subject (subject_id).
  await Task.destroy({ where: {}, force: true, transaction });

  // 4. Parent-portal child records reference StudentProfile, Class, Subject, User, and Organization.
  if (Feedback && sequelize.models.Feedback) {
    await Feedback.destroy({ where: {}, force: true, transaction });
  }
  if (ParentLink && sequelize.models.ParentLink) {
    await ParentLink.destroy({ where: {}, force: true, transaction });
  }

  // 5. Subject references Class (class_id) and User (teacher_id).
  await Subject.destroy({ where: {}, force: true, transaction });

  // 6. StudentProfile references Class (class_id) and User (user_id).
  await StudentProfile.destroy({ where: {}, force: true, transaction });

  // 7. EmployeeProfile self-references via supervisor_id and references User (user_id, supervisor_id).
  //    Clear supervisor_id across all rows (including soft-deleted rows) before hard-deleting.
  await EmployeeProfile.update(
    { supervisor_id: null },
    { where: {}, paranoid: false, transaction }
  );
  await EmployeeProfile.destroy({ where: {}, force: true, transaction });

  // 8. Class references Organization (organization_id) and User (manager_id).
  await Class.destroy({ where: {}, force: true, transaction });

  // 9. Organization and DistrictAdmin dependent records.
  await Payment.destroy({ where: {}, force: true, transaction });
  await ApprovalRequest.destroy({ where: {}, force: true, transaction });

  // 10. User self-references via created_by and references Organization (organization_id).
  //     Clear created_by across all rows (including soft-deleted rows) before hard-deleting.
  await User.update(
    { created_by: null },
    { where: {}, paranoid: false, transaction }
  );
  await User.destroy({ where: {}, force: true, transaction });

  // 11. Organization references District (district_id) and DistrictAdmin (approved_by).
  await Organization.destroy({ where: {}, force: true, transaction });

  // 12. DistrictAdmin references District (district_id).
  await DistrictAdmin.destroy({ where: {}, force: true, transaction });

  // 13. District is the root parent table (immediately repopulated by seedData).
  await District.destroy({ where: {}, force: true, transaction });
}

async function seedData(transaction) {
  if (!transaction) {
    throw new Error('seedData(transaction) requires an active Sequelize transaction.');
  }
  const t = { transaction };

  // Seed districts
  for (const d of DISTRICTS) {
    await District.findOrCreate({
      where: { code: d.code },
      defaults: { name: d.name, code: d.code, status: 'active' },
      ...t,
    });
  }
  console.log(`✅ ${DISTRICTS.length} districts seeded`);

  // Seed district admins (one per major district)
  const admins = [
    { name: 'Gasabo District Admin',   email: 'admin.gasabo@gov.rw',   districtCode: 'GSB' },
    { name: 'Kicukiro District Admin', email: 'admin.kicukiro@gov.rw', districtCode: 'KCK' },
    { name: 'Musanze District Admin',  email: 'admin.musanze@gov.rw',  districtCode: 'MSZ' },
    { name: 'Huye District Admin',     email: 'admin.huye@gov.rw',     districtCode: 'HUY' },
    { name: 'Rubavu District Admin',   email: 'admin.rubavu@gov.rw',   districtCode: 'RBV' },
  ];

  for (const a of admins) {
    const district = await District.findOne({ where: { code: a.districtCode }, ...t });
    if (!district) continue;

    const [, created] = await DistrictAdmin.findOrCreate({
      where: { email: a.email },
      defaults: {
        name:        a.name,
        email:       a.email,
        password:    'Admin@1234',   // hashed by model hook
        phone:       '+250788000000',
        district_id: district.id,
        status:      'active',
      },
      ...t,
    });

    if (created) console.log(`✅ Created admin: ${a.email}`);
  }

  // Seed a sample approved organization + org admin user
  const gasabo = await District.findOne({ where: { code: 'GSB' }, ...t });
  if (!gasabo) return;

  const [org] = await Organization.findOrCreate({
    where: { name: 'Demo School' },
    defaults: {
      name: 'Demo School',
      type: 'school',
      district_id: gasabo.id,
      status: 'approved',
      code: 'RWDEMO1',
      payment_status: 'paid',
      subscription_type: 'yearly',
      subscription_expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      contact_email: 'demo@school.rw',
      contact_phone: '+250788000001',
    },
    ...t,
  });

  await User.findOrCreate({
    where: { email: 'orgadmin@demo.rw' },
    defaults: {
      name: 'Demo Org Admin',
      email: 'orgadmin@demo.rw',
      password: 'Admin@1234',
      role: 'organization_admin',
      organization_id: org.id,
      status: 'active',
    },
    ...t,
  });

  // Create a teacher
  const [teacher] = await User.findOrCreate({
    where: { email: 'teacher@demo.rw' },
    defaults: {
      name: 'Demo Teacher',
      email: 'teacher@demo.rw',
      password: 'Teacher@1234',
      role: 'teacher',
      organization_id: org.id,
      status: 'active',
    },
    ...t,
  });

  // Create a class l3sod
  const [cls] = await Class.findOrCreate({
    where: { name: 'l3sod' },
    defaults: {
      name: 'l3sod',
      code: 'L3SOD2024',
      description: 'Demo Class L3SOD',
      manager_id: teacher.id,
      type: 'class',
      academic_year: '2024',
      semester: '1',
      max_students: 50,
      current_students: 0,
      organization_id: org.id,
      status: 'active',
    },
    ...t,
  });

  // Create some students
  const students = [
    { name: 'Alice Uwimana',   email: 'alice@l3sod.demo.rw', password: 'Student@1234', guardian_name: 'Jean Uwimana',      guardian_phone: '0788000001' },
    { name: 'Bob Nkurunziza',  email: 'bob@l3sod.demo.rw',   password: 'Student@1234', guardian_name: 'Marie Nkurunziza',  guardian_phone: '0788000002' },
    { name: 'Carol Mukamana',  email: 'carol@l3sod.demo.rw', password: 'Student@1234', guardian_name: 'Eric Mukamana',     guardian_phone: '0788000003' },
    { name: 'David Rugamba',   email: 'david@l3sod.demo.rw', password: 'Student@1234', guardian_name: 'Claire Rugamba',    guardian_phone: '0788000004' },
    { name: 'Eve Niyonsaba',   email: 'eve@l3sod.demo.rw',   password: 'Student@1234', guardian_name: 'Patrick Niyonsaba', guardian_phone: '0788000005' },
  ];

  for (const s of students) {
    const user = await User.create({
      name: s.name,
      email: s.email,
      password: s.password,
      role: 'student',
      organization_id: org.id,
      status: 'active',
    }, t);

    const studentId = await generateStudentId(transaction);

    await StudentProfile.create({
      user_id: user.id,
      student_id: studentId,
      class_id: cls.id,
      guardian_name: s.guardian_name,
      guardian_phone: s.guardian_phone,
      status: 'active',
    }, t);

    await Class.increment('current_students', { where: { id: cls.id }, ...t });
  }

  console.log('✅ Demo organization, org admin, teacher, class l3sod, and 5 students created');
}

function logSeedError(err) {
  const dbError = err?.parent || err?.original || null;
  const column =
    dbError?.column ||
    (Array.isArray(err?.fields)
      ? err.fields.join(', ')
      : err?.fields && typeof err.fields === 'object'
        ? Object.keys(err.fields).join(', ')
        : null);

  console.error('❌ Seed failed:', err?.message || err);
  console.error('  Error Name:      ', err?.name || 'UnknownError');
  if (dbError?.code)       console.error('  PostgreSQL Code: ', dbError.code);
  if (dbError?.constraint) console.error('  Constraint Name: ', dbError.constraint);
  if (dbError?.table || err?.table) {
    console.error('  Table:           ', dbError?.table || err?.table);
  }
  if (column)              console.error('  Column(s):       ', column);
  if (dbError?.detail)     console.error('  Detail:          ', dbError.detail);
  if (err?.sql || dbError?.sql) {
    console.error('  Original SQL:    ', err?.sql || dbError?.sql);
  }
  if (dbError && dbError.message && dbError.message !== err?.message) {
    console.error('  Database Error:  ', dbError.message);
  }
  if (Array.isArray(err?.errors)) {
    err.errors.forEach((e) =>
      console.error('  Validation Error:', e.message, e.path ? `(field: ${e.path})` : '')
    );
  }
}

async function seed() {
  let transaction = null;
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Create any missing tables before touching data. Seeding clears and
    // repopulates every model, so a table that has never been synced on a
    // freshly provisioned database (e.g. AuditLog, ParentLink) would abort the run.
    await sequelize.sync();
    console.log('✅ Schema ready');

    // Clear and repopulate inside a single explicit transaction so either the
    // entire seed lands or the transaction rolls back cleanly on the first error.
    transaction = await sequelize.transaction();

    console.log('🧹 Clearing existing data...');
    await clearData(transaction);
    console.log('✅ Data cleared');

    await seedData(transaction);

    await transaction.commit();

    console.log('\n🎉 Seeding complete!\n');
    console.log('─────────────────────────────────────────');
    console.log('District Admin Login  → POST /api/auth/district-admin/login');
    console.log('  Email:    admin.gasabo@gov.rw');
    console.log('  Password: Admin@1234');
    console.log('Org Admin Login       → POST /api/auth/login');
    console.log('  Email:    orgadmin@demo.rw');
    console.log('  Password: Admin@1234');
    console.log('Parent Portal Login   → /parent/login (POST /api/parent/login)');
    console.log('  Org Code:       RWDEMO1');
    console.log('  Student ID:     ST-0001');
    console.log('  Guardian Phone: 0788000001');
    console.log('─────────────────────────────────────────\n');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logSeedError(err);

    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
        console.error('\n↩️  Nothing was changed — the transaction was rolled back cleanly.');
      } catch (rollbackErr) {
        console.error('\n⚠️  Failed to roll back transaction:', rollbackErr.message);
      }
    } else if (transaction) {
      console.error('\n↩️  Nothing was changed — the transaction was already rolled back.');
    }

    try {
      await sequelize.close();
    } catch {
      // Ignore close error on exit
    }
    process.exit(1);
  }
}

export { clearData, seedData, seed };

const isMainModule =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMainModule) {
  seed();
}
