import { cpus } from 'os';
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

const getNoOfWorkers = (workers: string | undefined, isNoOfCpus: string | undefined): number => {
  // NO_OF_CPUS_AS_WORKERS is true
  if (typeof isNoOfCpus === 'string' && isNoOfCpus === 'true') return cpus().length;
  //
  if (typeof workers === 'string') return parseInt(workers);
  // default
  return 1;
};

// Render provides PORT, but we can override with APP_PORT if needed
const getPort = (): number => {
  if (process.env.PORT) return parseInt(process.env.PORT, 10);
  if (process.env.APP_PORT) return parseInt(process.env.APP_PORT, 10);
  return 8000;
};

// Get base URL for Swagger/API documentation
const getBaseUrl = (): string => {
  // Render provides RENDER_EXTERNAL_URL in production
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  // Vercel provides VERCEL_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback to localhost for development
  const port = getPort();
  return `http://localhost:${port}`;
};

export default {
  APP_PORT: getPort(),
  BASE_URL: getBaseUrl(),
  NODE_ENV: process.env.NODE_ENV || 'development',
  NUMBER_OF_WORKERS: getNoOfWorkers(process.env.NO_OF_WORKERS, process.env.NO_OF_CPUS_AS_WORKERS),
};
