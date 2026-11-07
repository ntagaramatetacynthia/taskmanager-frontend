import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const EmployeeProfile = sequelize.define('EmployeeProfile', {
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
  employee_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 50]
    }
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  position: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  hire_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  contract_end_date: {
    type: DataTypes.DATE
  },
  employment_type: {
    type: DataTypes.ENUM('full_time', 'part_time', 'contract', 'intern'),
    allowNull: false
  },
  salary: {
    type: DataTypes.DECIMAL(10, 2),
    validate: {
      min: 0
    }
  },
  supervisor_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  skills: {
    type: DataTypes.JSON
  },
  certifications: {
    type: DataTypes.JSON
  },
  performance_rating: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 1.00,
      max: 5.00
    }
  },
  emergency_contact_name: {
    type: DataTypes.STRING(100)
  },
  emergency_contact_phone: {
    type: DataTypes.STRING(15),
    validate: {
      is: /^[+]?[0-9\s\-()]+$/
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'terminated', 'resigned', 'on_leave', 'suspended'),
    defaultValue: 'active'
  }
}, {
  paranoid: true,
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['employee_id'], unique: true },
    { fields: ['department'] },
    { fields: ['supervisor_id'] },
    { fields: ['employment_type'] },
    { fields: ['status'] }
  ]
});

export default EmployeeProfile;
