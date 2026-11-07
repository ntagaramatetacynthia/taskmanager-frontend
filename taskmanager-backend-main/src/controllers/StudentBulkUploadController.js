import xlsx from 'xlsx';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize, { User, StudentProfile, Class, Organization } from '../database.js';

// Normalize row keys to lower-case without spaces or underscores
function normalizeRowKeys(rawRow) {
  const normalized = {};
  for (const [key, val] of Object.entries(rawRow)) {
    const cleanKey = String(key).toLowerCase().replace(/[\s_-]+/g, '');
    normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
  }

  // Extract columns with fallback aliases
  const firstName =
    normalized.firstname ??
    normalized.fname ??
    normalized.first ??
    normalized.givenname ??
    '';

  const lastName =
    normalized.lastname ??
    normalized.lname ??
    normalized.last ??
    normalized.surname ??
    normalized.familyname ??
    '';

  const guardianPhone =
    normalized.guardianphone ??
    normalized.parentphone ??
    normalized.guardiannumber ??
    normalized.parentnumber ??
    normalized.phone ??
    normalized.contactphone ??
    '';

  const guardianName =
    normalized.guardianname ??
    normalized.parentname ??
    normalized.guardian ??
    normalized.parent ??
    '';

  const classRef =
    normalized.classcode ??
    normalized.class ??
    normalized.classname ??
    normalized.classid ??
    '';

  const studentEmail =
    normalized.email ??
    normalized.studentemail ??
    '';

  return {
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    guardianPhone: String(guardianPhone).trim(),
    guardianName: String(guardianName).trim(),
    classRef: String(classRef).trim(),
    studentEmail: String(studentEmail).trim(),
  };
}

class StudentBulkUploadController {
  /**
   * POST /api/students/bulk-upload
   * Handles multipart/form-data Excel or CSV upload held in memory buffer.
   */
  async bulkUpload(req, res) {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach an Excel (.xlsx, .xls) or CSV file.',
      });
    }

    const organization_id = req.user.organization_id;
    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: 'User does not belong to an active organization.',
      });
    }

    try {
      // 1. Parse Excel/CSV from buffer
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          message: 'The uploaded workbook does not contain any sheets.',
        });
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'The uploaded file is empty. Please ensure rows are present.',
        });
      }

      // 2. Pre-fetch classes for this organization
      const orgClasses = await Class.findAll({
        where: { organization_id },
        attributes: ['id', 'name', 'code', 'current_students', 'max_students'],
      });

      const classMap = new Map();
      orgClasses.forEach((c) => {
        if (c.id) classMap.set(String(c.id).toLowerCase(), c);
        if (c.code) classMap.set(String(c.code).toLowerCase(), c);
        if (c.name) classMap.set(String(c.name).toLowerCase(), c);
      });

      // Default class if passed in request body
      const defaultClassId = req.body.class_id ? Number(req.body.class_id) : null;
      let defaultClass = null;
      if (defaultClassId) {
        defaultClass = orgClasses.find((c) => c.id === defaultClassId) || null;
      }

      // 3. Row-by-row validation
      const validationErrors = [];
      const parsedRows = [];
      const phoneRegex = /^[+]?[0-9\s\-()]{7,25}$/;

      rawRows.forEach((raw, idx) => {
        const rowNum = idx + 2; // Row 1 is header, 2 is first data row
        const row = normalizeRowKeys(raw);

        // Skip completely blank rows
        if (!row.firstName && !row.lastName && !row.guardianPhone) {
          return;
        }

        const errors = [];
        if (!row.firstName) errors.push(`Row ${rowNum}: Missing required "First Name"`);
        if (!row.lastName) errors.push(`Row ${rowNum}: Missing required "Last Name"`);
        if (!row.guardianPhone) {
          errors.push(`Row ${rowNum}: Missing required "Guardian Phone"`);
        } else if (!phoneRegex.test(row.guardianPhone)) {
          errors.push(`Row ${rowNum}: Invalid Guardian Phone "${row.guardianPhone}" (must contain 7-25 digits/symbols)`);
        }

        // Validate class reference if specified
        let resolvedClass = defaultClass;
        if (row.classRef) {
          const match = classMap.get(row.classRef.toLowerCase());
          if (match) {
            resolvedClass = match;
          } else {
            errors.push(`Row ${rowNum}: Class "${row.classRef}" not found in this organization`);
          }
        }

        if (errors.length > 0) {
          validationErrors.push(...errors);
        } else {
          parsedRows.push({
            rowNum,
            ...row,
            resolvedClassId: resolvedClass?.id || null,
          });
        }
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Spreadsheet validation failed with ${validationErrors.length} error(s).`,
          errors: validationErrors,
        });
      }

      if (parsedRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid student data found in the spreadsheet.',
        });
      }

      // 4. Determine starting sequential student ID (ST-XXXX)
      const existingProfiles = await StudentProfile.findAll({
        attributes: ['student_id'],
        where: { student_id: { [Op.like]: 'ST-%' } },
        paranoid: false,
      });

      let maxSeq = 0;
      existingProfiles.forEach((p) => {
        const match = p.student_id?.match(/^ST-(\d{4,})$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      });

      // 5. Query existing emails in organization to avoid duplicates
      const existingUsers = await User.findAll({
        where: { organization_id },
        attributes: ['email'],
        paranoid: false,
      });
      const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

      // 6. Pre-generate default password hash
      const defaultPasswordHash = await bcrypt.hash('Student@1234', 10);

      // 7. Prepare User and StudentProfile payloads
      const usersToInsert = [];
      const studentProfilesToInsert = [];
      const generatedEmailsSet = new Set();
      const classIncrementMap = new Map();

      for (let i = 0; i < parsedRows.length; i++) {
        const r = parsedRows[i];
        const studentSeq = maxSeq + 1 + i;
        const studentId = `ST-${String(studentSeq).padStart(4, '0')}`;

        // Generate standard @gmail.com email
        const cleanFirst = r.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanLast = r.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
        let emailCandidate = `${cleanFirst}.${cleanLast}@gmail.com`;

        // If duplicate in DB or in this batch, make unique by appending student sequence
        if (existingEmailSet.has(emailCandidate) || generatedEmailsSet.has(emailCandidate)) {
          emailCandidate = `${cleanFirst}.${cleanLast}.${String(studentSeq).padStart(4, '0')}@gmail.com`;
        }
        generatedEmailsSet.add(emailCandidate);

        const fullName = `${r.firstName} ${r.lastName}`.trim();

        usersToInsert.push({
          name: fullName,
          email: emailCandidate,
          password: defaultPasswordHash,
          phone: null,
          role: 'student',
          organization_id,
          status: 'active',
          created_by: req.user.id,
        });

        studentProfilesToInsert.push({
          student_id: studentId,
          class_id: r.resolvedClassId,
          guardian_name: r.guardianName || null,
          guardian_phone: r.guardianPhone || null,
          status: 'active',
        });

        if (r.resolvedClassId) {
          classIncrementMap.set(
            r.resolvedClassId,
            (classIncrementMap.get(r.resolvedClassId) || 0) + 1
          );
        }
      }

      // 8. Execute transactional bulk creation
      const transaction = await sequelize.transaction();
      try {
        // Bulk create users
        const createdUsers = await User.bulkCreate(usersToInsert, {
          transaction,
          returning: true,
        });

        // Attach created user IDs to student profiles
        for (let i = 0; i < createdUsers.length; i++) {
          studentProfilesToInsert[i].user_id = createdUsers[i].id;
        }

        // Bulk create student profiles
        const createdProfiles = await StudentProfile.bulkCreate(studentProfilesToInsert, {
          transaction,
          returning: true,
        });

        // Update class student counts
        for (const [clsId, count] of classIncrementMap.entries()) {
          await Class.increment('current_students', {
            by: count,
            where: { id: clsId },
            transaction,
          });
        }

        // Increment total users count on organization
        await Organization.increment('current_users', {
          by: createdUsers.length,
          where: { id: organization_id },
          transaction,
        });

        await transaction.commit();

        const responseList = createdUsers.map((u, idx) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          student_id: createdProfiles[idx].student_id,
          class_id: createdProfiles[idx].class_id,
          guardian_name: createdProfiles[idx].guardian_name,
          guardian_phone: createdProfiles[idx].guardian_phone,
        }));

        return res.status(201).json({
          success: true,
          message: `Successfully uploaded and created ${createdUsers.length} student(s).`,
          count: createdUsers.length,
          default_password: 'Student@1234',
          students: responseList,
        });
      } catch (insertError) {
        await transaction.rollback();
        throw insertError;
      }
    } catch (err) {
      console.error('Bulk upload student error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to process bulk upload.',
      });
    }
  }

  /**
   * GET /api/students/template
   * Downloads a ready-to-use sample Excel template for bulk student upload.
   */
  async downloadTemplate(req, res) {
    try {
      const templateData = [
        {
          FirstName: 'John',
          LastName: 'Mugisha',
          GuardianPhone: '+250788111222',
          GuardianName: 'Paul Mugisha',
          ClassCode: 'L3SOD2024',
        },
        {
          FirstName: 'Grace',
          LastName: 'Keza',
          GuardianPhone: '+250788333444',
          GuardianName: 'Marie Keza',
          ClassCode: 'L3SOD2024',
        },
        {
          FirstName: 'Emmanuel',
          LastName: 'Kwizera',
          GuardianPhone: '+250788555666',
          GuardianName: 'Joseph Kwizera',
          ClassCode: 'L3SOD2024',
        },
      ];

      const worksheet = xlsx.utils.json_to_sheet(templateData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');

      // Generate buffer
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename="RTMS_Students_Template.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to generate template' });
    }
  }
}

export default new StudentBulkUploadController();
