import { DataTypes } from 'sequelize';
import sequelize from '../database.js';

const District = sequelize.define('District', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      isUppercase: true
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  paranoid: true,
  timestamps: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['code'] },
    { fields: ['status'] }
  ]
});

export default District;
