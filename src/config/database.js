import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
dotenv.config();

const env = process.env.NODE_ENV || 'development';

// Check if DATABASE_URL is set (for cloud/production databases)
let sequelize;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL for PostgreSQL connection
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    define: {
      paranoid: true,
      timestamps: true,
      underscored: true
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      statement_timeout: 1000000,
      connect_timeout: 60000
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000,
      evict: 5000
    },
    retry: {
      max: 5,
      timeout: 10000
    }
  });
} else {
  // Use individual environment variables for local development
  const config = {
    development: {
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rwanda_task_management',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: false,
      define: {
        paranoid: true,
        timestamps: true,
        underscored: true
      }
    },
    production: {
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: false,
      define: {
        paranoid: true,
        timestamps: true,
        underscored: true
      }
    }
  };

  const dbConfig = config[env];

  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging,
      define: dbConfig.define,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

export { config };
export default sequelize;
