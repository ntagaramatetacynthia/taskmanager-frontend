import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const Subject = sequelize.define('Subject', {
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
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  teacher_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  credits: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  hours_per_week: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 40
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'completed'),
    defaultValue: 'active'
  },
  syllabus: {
    type: DataTypes.TEXT
  },
  resources: {
    type: DataTypes.JSON
  }
}, {
  paranoid: true,
  timestamps: true,
  indexes: [
    { fields: ['class_id'] },
    { fields: ['teacher_id'] },
    { fields: ['code', 'class_id'], unique: true },
    { fields: ['status'] }
  ]
});

export default Subject;
