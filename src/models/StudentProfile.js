import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const StudentProfile = sequelize.define('StudentProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  student_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 50]
    }
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  admission_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  graduation_date: {
    type: DataTypes.DATE
  },
  academic_year: {
    type: DataTypes.STRING(10),
    validate: {
      is: /^\d{4}-\d{4}$/
    }
  },
  semester: {
    type: DataTypes.ENUM('1', '2', '3'),
    defaultValue: '1'
  },
  gpa: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0.00,
      max: 4.00
    }
  },
  attendance_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 100.00,
    validate: {
      min: 0.00,
      max: 100.00
    }
  },
  guardian_name: {
    type: DataTypes.STRING(100)
  },
  guardian_phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
    validate: {
      isPhoneOrEmpty(value) {
        if (!value) return;
        if (!/^[+]?[0-9\s\-()]+$/.test(value)) {
          throw new Error('Guardian phone number format is invalid');
        }
      }
    }
  },
  guardian_email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  emergency_contact: {
    type: DataTypes.STRING(30),
    allowNull: true,
    validate: {
      isEmergencyOrEmpty(value) {
        if (!value) return;
        if (!/^[+]?[0-9\s\-()]+$/.test(value)) {
          throw new Error('Emergency contact format is invalid');
        }
      }
    }
  },
  medical_info: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('active', 'graduated', 'transferred', 'suspended', 'dropped'),
    defaultValue: 'active'
  }
}, {
  paranoid: true,
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['student_id', 'class_id'], unique: true },
    { fields: ['class_id'] },
    { fields: ['status'] },
    { fields: ['academic_year'] }
  ]
});

export default StudentProfile;
