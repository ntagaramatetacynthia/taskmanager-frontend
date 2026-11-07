import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const ApprovalRequest = sequelize.define('ApprovalRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  organization_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  request_type: {
    type: DataTypes.ENUM('registration', 'subscription_change', 'reactivation', 'data_modification'),
    defaultValue: 'registration'
  },
  status: {
    type: DataTypes.ENUM('pending', 'under_review', 'approved', 'rejected', 'cancelled'),
    defaultValue: 'pending'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  submitted_documents: {
    type: DataTypes.JSON
  },
  requested_changes: {
    type: DataTypes.JSON
  },
  current_data: {
    type: DataTypes.JSON
  },
  requested_data: {
    type: DataTypes.JSON
  },
  business_justification: {
    type: DataTypes.TEXT
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'district_admins',
      key: 'id'
    }
  },
  reviewed_at: {
    type: DataTypes.DATE
  },
  approval_notes: {
    type: DataTypes.TEXT
  },
  rejection_reason: {
    type: DataTypes.TEXT
  },
  conditions: {
    type: DataTypes.TEXT
  },
  follow_up_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  follow_up_date: {
    type: DataTypes.DATE
  },
  escalated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  escalated_to: {
    type: DataTypes.INTEGER,
    references: {
      model: 'district_admins',
      key: 'id'
    }
  },
  escalated_at: {
    type: DataTypes.DATE
  },
  sla_due_date: {
    type: DataTypes.DATE
  },
  processing_time_hours: {
    type: DataTypes.INTEGER
  },
  compliance_checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  compliance_notes: {
    type: DataTypes.TEXT
  }
}, {
  paranoid: true,
  timestamps: true,
  hooks: {
    beforeCreate: (request) => {
      // Set SLA due date (72 hours for registration requests)
      if (request.request_type === 'registration') {
        request.sla_due_date = new Date(Date.now() + 72 * 60 * 60 * 1000);
      }
    },
    beforeUpdate: (request) => {
      if (request.changed('status') && ['approved', 'rejected'].includes(request.status)) {
        request.reviewed_at = new Date();
        if (request.createdAt) {
          const processingTime = (new Date() - new Date(request.createdAt)) / (1000 * 60 * 60);
          request.processing_time_hours = Math.round(processingTime);
        }
      }
    }
  },
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['status'] },
    { fields: ['request_type'] },
    { fields: ['reviewed_by'] },
    { fields: ['priority'] },
    { fields: ['sla_due_date'] },
    { fields: ['escalated'] },
    { fields: ['follow_up_required'] }
  ]
});

ApprovalRequest.prototype.isOverdue = function() {
  return this.sla_due_date && new Date() > new Date(this.sla_due_date) && this.status === 'pending';
};

ApprovalRequest.prototype.shouldEscalate = function() {
  return this.isOverdue() && !this.escalated;
};

export default ApprovalRequest;
