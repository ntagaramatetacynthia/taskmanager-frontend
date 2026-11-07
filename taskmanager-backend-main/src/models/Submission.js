import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const Submission = sequelize.define('Submission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tasks',
      key: 'id'
    }
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT
  },
  file_url: {
    type: DataTypes.STRING(500)
  },
  file_name: {
    type: DataTypes.STRING(255)
  },
  file_size: {
    type: DataTypes.INTEGER
  },
  file_type: {
    type: DataTypes.STRING(50)
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'graded', 'returned', 'resubmitted'),
    defaultValue: 'draft'
  },
  submitted_at: {
    type: DataTypes.DATE
  },
  is_late: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  late_hours: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  score: {
    type: DataTypes.DECIMAL(5, 2),
    validate: {
      min: 0
    }
  },
  max_score: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  percentage: {
    type: DataTypes.DECIMAL(5, 2),
    validate: {
      min: 0,
      max: 100
    }
  },
  grade: {
    type: DataTypes.STRING(5)
  },
  feedback: {
    type: DataTypes.TEXT
  },
  graded_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  graded_at: {
    type: DataTypes.DATE
  },
  attempt_number: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  plagiarism_score: {
    type: DataTypes.DECIMAL(5, 2),
    validate: {
      min: 0,
      max: 100
    }
  },
  group_id: {
    type: DataTypes.INTEGER
  },
  rubric_scores: {
    type: DataTypes.JSON
  }
}, {
  paranoid: true,
  timestamps: true,
  hooks: {
    beforeUpdate: (submission) => {
      if (submission.score && submission.max_score) {
        submission.percentage = (submission.score / submission.max_score) * 100;
      }
    }
  },
  indexes: [
    { fields: ['task_id'] },
    { fields: ['student_id'] },
    { fields: ['task_id', 'student_id'], unique: true },
    { fields: ['status'] },
    { fields: ['submitted_at'] },
    { fields: ['graded_by'] },
    { fields: ['is_late'] },
    { fields: ['group_id'] }
  ]
});

Submission.prototype.calculateGrade = function() {
  if (!this.percentage) return null;
  
  if (this.percentage >= 90) return 'A';
  if (this.percentage >= 80) return 'B';
  if (this.percentage >= 70) return 'C';
  if (this.percentage >= 60) return 'D';
  return 'F';
};

export default Submission;
