import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const Reminder = sequelize.define('Reminder', {
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
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reminder_time: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true
    }
  },
  type: {
    type: DataTypes.ENUM('email', 'sms', 'push', 'in_app'),
    defaultValue: 'email'
  },
  message: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  sent_at: {
    type: DataTypes.DATE
  },
  error_message: {
    type: DataTypes.TEXT
  },
  retry_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  max_retries: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurring_pattern: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
    allowNull: true
  },
  next_reminder: {
    type: DataTypes.DATE
  },
  created_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  paranoid: true,
  timestamps: true,
  indexes: [
    { fields: ['task_id'] },
    { fields: ['user_id'] },
    { fields: ['reminder_time'] },
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['priority'] },
    { fields: ['next_reminder'] }
  ]
});

Reminder.prototype.canRetry = function() {
  return this.retry_count < this.max_retries && this.status === 'failed';
};

export default Reminder;
