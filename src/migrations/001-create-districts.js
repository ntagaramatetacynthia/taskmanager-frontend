export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('districts', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true
    },
    code: {
      type: Sequelize.STRING(10),
      allowNull: false,
      unique: true
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive'),
      defaultValue: 'active'
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
  await queryInterface.addIndex('districts', ['name']);
  await queryInterface.addIndex('districts', ['code']);
  await queryInterface.addIndex('districts', ['status']);
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.dropTable('districts');
};