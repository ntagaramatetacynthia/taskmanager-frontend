export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('organizations', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: Sequelize.STRING(200),
      allowNull: false
    },
    type: {
      type: Sequelize.ENUM('school', 'company'),
      allowNull: false
    },
    district_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'districts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    status: {
      type: Sequelize.ENUM('pending', 'approved', 'rejected', 'suspended'),
      defaultValue: 'pending'
    },
    code: {
      type: Sequelize.STRING(12),
      allowNull: true,
      unique: true
    },
    payment_status: {
      type: Sequelize.ENUM('pending', 'paid', 'overdue', 'cancelled'),
      defaultValue: 'pending'
    },
    subscription_type: {
      type: Sequelize.ENUM('monthly', 'quarterly', 'yearly'),
      defaultValue: 'monthly'
    },
    subscription_expires: {
      type: Sequelize.DATE,
      allowNull: true
    },
    contact_email: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    contact_phone: {
      type: Sequelize.STRING(15),
      allowNull: true
    },
    address: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    max_users: {
      type: Sequelize.INTEGER,
      defaultValue: 100
    },
    current_users: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    approved_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'district_admins',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    approved_at: {
      type: Sequelize.DATE,
      allowNull: true
    },
    rejection_reason: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    },
    deleted_at: {
      type: Sequelize.DATE,
      allowNull: true
    }
  });

  // Add indexes
  await queryInterface.addIndex('organizations', ['district_id']);
  await queryInterface.addIndex('organizations', ['status']);
  await queryInterface.addIndex('organizations', ['code']);
  await queryInterface.addIndex('organizations', ['type']);
  await queryInterface.addIndex('organizations', ['payment_status']);
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.dropTable('organizations');
};