import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  organization_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'RWF',
    validate: {
      len: [3, 3]
    }
  },
  payment_method: {
    type: DataTypes.ENUM('mobile_money', 'bank_transfer', 'credit_card', 'cash'),
    allowNull: false
  },
  payment_provider: {
    type: DataTypes.STRING(50)
  },
  transaction_id: {
    type: DataTypes.STRING(100),
    unique: true
  },
  reference_number: {
    type: DataTypes.STRING(100)
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'),
    defaultValue: 'pending'
  },
  payment_date: {
    type: DataTypes.DATE
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  subscription_type: {
    type: DataTypes.ENUM('monthly', 'quarterly', 'yearly'),
    allowNull: false
  },
  subscription_start: {
    type: DataTypes.DATE
  },
  subscription_end: {
    type: DataTypes.DATE
  },
  invoice_number: {
    type: DataTypes.STRING(50),
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_gateway_response: {
    type: DataTypes.JSON
  },
  failure_reason: {
    type: DataTypes.TEXT
  },
  processed_by: {
    type: DataTypes.INTEGER,
    references: {
      model: 'district_admins',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  paranoid: true,
  timestamps: true,
  hooks: {
    beforeCreate: (payment) => {
      payment.total_amount = payment.amount + payment.tax_amount - payment.discount_amount;
      if (!payment.invoice_number) {
        payment.invoice_number = generateInvoiceNumber();
      }
    }
  },
  indexes: [
    { fields: ['organization_id'] },
    { fields: ['status'] },
    { fields: ['payment_date'] },
    { fields: ['due_date'] },
    { fields: ['transaction_id'] },
    { fields: ['invoice_number'] },
    { fields: ['subscription_type'] }
  ]
});

function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

Payment.prototype.isOverdue = function() {
  return new Date() > new Date(this.due_date) && this.status === 'pending';
};

export default Payment;
