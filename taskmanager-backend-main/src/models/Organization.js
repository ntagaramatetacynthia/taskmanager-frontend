import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 200]
    }
  },
  type: {
    type: DataTypes.ENUM('school', 'company'),
    allowNull: false
  },
  district_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'districts',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'suspended'),
    defaultValue: 'pending'
  },
  code: {
    type: DataTypes.STRING(12),
    validate: {
      len: [6, 12]
    }
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'overdue', 'cancelled'),
    defaultValue: 'pending'
  },
  subscription_type: {
    type: DataTypes.ENUM('monthly', 'quarterly', 'yearly'),
    defaultValue: 'monthly'
  },
  subscription_expires: {
    type: DataTypes.DATE
  },
  contact_email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  contact_phone: {
    type: DataTypes.STRING(15),
    validate: {
      is: /^[+]?[0-9\s\-()]+$/
    }
  },
  address: {
    type: DataTypes.TEXT
  },
  max_users: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  current_users: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  approved_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'district_admins',
      key: 'id'
    }
  },
  approved_at: {
    type: DataTypes.DATE
  },
  rejection_reason: {
    type: DataTypes.TEXT
  }
}, {
  paranoid: true,
  timestamps: true,
  hooks: {
    beforeCreate: (organization) => {
      if (organization.status === 'approved' && !organization.code) {
        organization.code = generateOrganizationCode();
      }
    }
  },
  indexes: [
    { fields: ['district_id'] },
    { fields: ['status'] },
    { fields: ['code'] },
    { fields: ['type'] },
    { fields: ['payment_status'] }
  ]
});

function generateOrganizationCode() {
  const prefix = process.env.ORG_CODE_PREFIX || 'RW';
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${randomPart}`;
}

Organization.prototype.isSubscriptionActive = function() {
  return this.payment_status === 'paid' && 
         this.subscription_expires && 
         new Date(this.subscription_expires) > new Date();
};

Organization.prototype.canAddUsers = function() {
  return this.current_users < this.max_users;
};

export default Organization;