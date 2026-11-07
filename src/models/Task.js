import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  instructions: {
    type: DataTypes.TEXT
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
      isAfter: new Date().toISOString()
    }
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  class_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'classes',
      key: 'id'
    }
  },
  subject_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'subjects',
      key: 'id'
    }
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  type: {
    type: DataTypes.ENUM('assignment', 'project', 'quiz', 'exam', 'homework', 'task'),
    defaultValue: 'assignment'
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'closed', 'cancelled'),
    defaultValue: 'draft'
  },
  max_score: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    validate: {
      min: 1,
      max: 1000
    }
  },
  submission_type: {
    type: DataTypes.ENUM('file', 'text', 'both'),
    defaultValue: 'both'
  },
  allowed_file_types: {
    type: DataTypes.JSON,
    defaultValue: ['pdf', 'doc', 'docx', 'txt']
  },
  max_file_size: {
    type: DataTypes.INTEGER,
    defaultValue: 10485760 // 10MB
  },
  late_submission_allowed: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  late_penalty_percentage: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    validate: {
      min: 0,
      max: 100
    }
  },
  group_task: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  max_group_size: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  auto_grade: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rubric: {
    type: DataTypes.JSON
  },
  resources: {
    type: DataTypes.JSON
  },
  published_at: {
    type: DataTypes.DATE
  },
  total_submissions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  graded_submissions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  paranoid: true,
  timestamps: true,
  indexes: [
    { fields: ['created_by'] },
    { fields: ['class_id'] },
    { fields: ['subject_id'] },
    { fields: ['due_date'] },
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['type'] },
    { fields: ['published_at'] }
  ]
});

Task.prototype.isOverdue = function() {
  return new Date() > new Date(this.due_date);
};

Task.prototype.canSubmit = function() {
  if (this.status !== 'published') return false;
  if (!this.late_submission_allowed && this.isOverdue()) return false;
  return true;
};

export default Task;
