import { Sequelize } from 'sequelize-typescript';
import { config, dialect } from '../config/db.config';
import WalletAccount from '../models/wallet-account.model';

class Database {
  public sequelize: Sequelize | undefined;

  constructor() {
    this.connectToDatabase();
  }

  private async connectToDatabase() {
    this.sequelize = new Sequelize({
      database: config.DB,
      username: config.USER,
      password: config.PASSWORD,
      host: config.HOST,
      dialect: dialect,
      pool: {
        max: config.pool.max,
        min: config.pool.min,
        acquire: config.pool.acquire,
        idle: config.pool.idle,
      },
      models: [WalletAccount],
    });

    try {
      await this.sequelize.authenticate();
      console.log('Connection has been established successfully.');
    } catch (err) {
      console.error('Unable to connect to the Database:', err);
      // Re-throw to allow caller to handle the error
      throw err;
    }
  }
}

export default Database;
