import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../database.js';

const DistrictAdmin = sequelize.define('DistrictAdmin', {
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
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [6, 255]
    }
  },
  phone: {
    type: DataTypes.STRING(15),
    validate: {
      is: /^[+]?[0-9\s\-()]+$/
    }
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
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active'
  },
  last_login: {
    type: DataTypes.DATE
  },
  login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  locked_until: {
    type: DataTypes.DATE
  }
}, {
  paranoid: true,
  timestamps: true,
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        admin.password = await bcrypt.hash(admin.password, 12);
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password')) {
        admin.password = await bcrypt.hash(admin.password, 12);
      }
    }
  },
  indexes: [
    { fields: ['email'] },
    { fields: ['district_id'] },
    { fields: ['status'] }
  ]
});

DistrictAdmin.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

DistrictAdmin.prototype.incrementLoginAttempts = async function() {
  if (this.locked_until && this.locked_until > Date.now()) {
    return;
  }
  
  const updates = { login_attempts: this.login_attempts + 1 };
  
  if (this.login_attempts + 1 >= 5 && !this.locked_until) {
    updates.locked_until = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  }
  
  return this.update(updates);
};

export default DistrictAdmin;