export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('users', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: Sequelize.STRING(100),
      allowNull: false
    },
    email: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    password: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    phone: {
      type: Sequelize.STRING(15),
      allowNull: true
    },
    role: {
      type: Sequelize.ENUM('organization_admin', 'teacher', 'student', 'worker', 'intern'),
      allowNull: false
    },
    organization_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive', 'suspended', 'pending'),
      defaultValue: 'pending'
    },
    email_verified: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    email_verification_token: {
      type: Sequelize.STRING(255),
      allowNull: true
    },
    password_reset_token: {
      type: Sequelize.STRING(255),
      allowNull: true
    },
    password_reset_expires: {
      type: Sequelize.DATE,
      allowNull: true
    },
    last_login: {
      type: Sequelize.DATE,
      allowNull: true
    },
    login_attempts: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    locked_until: {
      type: Sequelize.DATE,
      allowNull: true
    },
    profile_picture: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    created_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
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
  await queryInterface.addIndex('users', ['email', 'organization_id'], { unique: true });
  await queryInterface.addIndex('users', ['organization_id']);
  await queryInterface.addIndex('users', ['role']);
  await queryInterface.addIndex('users', ['status']);
  await queryInterface.addIndex('users', ['created_by']);
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.dropTable('users');
};