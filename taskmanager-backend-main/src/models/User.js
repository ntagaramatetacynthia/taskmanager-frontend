import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../database.js';

const User = sequelize.define('User', {
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
    type: DataTypes.STRING(30),
    allowNull: true,
    validate: {
      isPhoneOrEmpty(value) {
        if (!value) return;
        if (!/^[+]?[0-9\s\-()]+$/.test(value)) {
          throw new Error('Phone number format is invalid');
        }
      }
    }
  },
  role: {
    type: DataTypes.ENUM('organization_admin', 'teacher', 'student', 'worker', 'intern'),
    allowNull: false
  },
  organization_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'organizations',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending'),
    defaultValue: 'pending'
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  email_verification_token: {
    type: DataTypes.STRING(255)
  },
  password_reset_token: {
    type: DataTypes.STRING(255)
  },
  password_reset_expires: {
    type: DataTypes.DATE
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
  },
  profile_picture: {
    type: DataTypes.STRING(500)
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
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    }
  },
  indexes: [
    { fields: ['email', 'organization_id'], unique: true },
    { fields: ['organization_id'] },
    { fields: ['role'] },
    { fields: ['status'] },
    { fields: ['created_by'] }
  ]
});

User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

User.prototype.incrementLoginAttempts = async function() {
  if (this.locked_until && this.locked_until > Date.now()) {
    return;
  }
  
  const updates = { login_attempts: this.login_attempts + 1 };
  
  if (this.login_attempts + 1 >= 5 && !this.locked_until) {
    updates.locked_until = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  }
  
  return this.update(updates);
};

User.prototype.hasRole = function(roles) {
  if (Array.isArray(roles)) {
    return roles.includes(this.role);
  }
  return this.role === roles;
};

export default User;