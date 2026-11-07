import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  district_admin_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'district_admins',
      key: 'id'
    }
  },
  organization_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  resource_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  resource_id: {
    type: DataTypes.INTEGER
  },
  old_values: {
    type: DataTypes.JSON
  },
  new_values: {
    type: DataTypes.JSON
  },
  ip_address: {
    type: DataTypes.STRING(45),
    validate: {
      isIP: true
    }
  },
  user_agent: {
    type: DataTypes.TEXT
  },
  session_id: {
    type: DataTypes.STRING(255)
  },
  request_id: {
    type: DataTypes.STRING(100)
  },
  severity: {
    type: DataTypes.ENUM('info', 'warning', 'error', 'critical'),
    defaultValue: 'info'
  },
  category: {
    type: DataTypes.ENUM('authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSON
  },
  success: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  error_message: {
    type: DataTypes.TEXT
  },
  duration_ms: {
    type: DataTypes.INTEGER
  },
  compliance_relevant: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  retention_date: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true,
  updatedAt: false, // Audit logs should not be updated
  paranoid: false, // Audit logs should not be soft deleted
  indexes: [
    { fields: ['user_id'] },
    { fields: ['district_admin_id'] },
    { fields: ['organization_id'] },
    { fields: ['action'] },
    { fields: ['resource_type'] },
    { fields: ['category'] },
    { fields: ['severity'] },
    { fields: ['created_at'] },
    { fields: ['compliance_relevant'] },
    { fields: ['success'] }
  ]
});

export default AuditLog;
