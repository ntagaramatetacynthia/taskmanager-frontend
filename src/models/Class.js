import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const Class = sequelize.define('Class', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 20]
    }
  },
  description: {
    type: DataTypes.TEXT
  },
  organization_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  manager_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('class', 'department', 'team'),
    defaultValue: 'class'
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
  max_students: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  current_students: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'archived'),
    defaultValue: 'active'
  },
  schedule: {
    type: DataTypes.JSON
  }
}, {
  paranoid: true,
  timestamps: true,
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['manager_id'] },
    { fields: ['code', 'organization_id'], unique: true },
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['academic_year'] }
  ]
});

Class.prototype.canAddStudents = function() {
  return this.current_students < this.max_students;
};

export default Class;
