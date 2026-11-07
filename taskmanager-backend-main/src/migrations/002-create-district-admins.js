export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('district_admins', {
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
      allowNull: false,
      unique: true
    },
    password: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    phone: {
      type: Sequelize.STRING(15),
      allowNull: true
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
      type: Sequelize.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active'
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
  await queryInterface.addIndex('district_admins', ['email']);
  await queryInterface.addIndex('district_admins', ['district_id']);
  await queryInterface.addIndex('district_admins', ['status']);
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.dropTable('district_admins');
};