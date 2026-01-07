import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from project root
// This ensures .env is found whether running from src/ or dist/
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Also try loading from current directory as fallback (for development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // This will override with .env in current directory if it exists
}

export const config = {
  HOST: process.env.DB_HOST || 'localhost',
  USER: process.env.DB_USER || 'root',
  PASSWORD: process.env.DB_PASSWORD || '',
  DB: process.env.DB_NAME || 'testdb',
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '5', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
  },
};

export const dialect = (process.env.DB_DIALECT || 'mysql') as 'mysql';
