import cluster from 'cluster';
import fs from 'fs';
import path from 'path';

import env from './config/app.config';
import app from './app';
import logger from './utils/logger.utils';

/**
 * Validate critical environment variables are loaded
 * This helps catch configuration issues early
 */
function validateEnvironmentVariables(): void {
  const requiredVars = ['STELLAR_HORIZON_URL', 'SYTE_DISTRIBUTOR_ADDRESS', 'SPONSOR_PUBLIC_KEY', 'SPONSOR_PRIVATE_KEY'];

  const missing: string[] = [];
  const present: string[] = [];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      present.push(varName);
    }
  });

  if (missing.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    logger.error(`✅ Present environment variables: ${present.join(', ')}`);
    logger.error(
      'Please ensure all required environment variables are set in your .env file or deployment environment.'
    );
  } else {
    logger.info(`✅ All critical environment variables are loaded`);
    logger.debug(`Environment check - STELLAR_HORIZON_URL: ${process.env.STELLAR_HORIZON_URL}`);
    logger.debug(
      `Environment check - SYTE_DISTRIBUTOR_ADDRESS: ${process.env.SYTE_DISTRIBUTOR_ADDRESS ? 'SET' : 'NOT SET'}`
    );
  }
}

if (cluster.isPrimary) {
  // Validate environment variables are loaded before starting workers
  validateEnvironmentVariables();

  // Swagger documentation should be generated at build time (see package.json build script)
  // At runtime, we just verify the swagger file exists and use it
  // This avoids runtime generation issues with compiled JS files
  const swaggerPath = path.join(__dirname, 'swagger', 'documentation.swagger.json');
  if (!fs.existsSync(swaggerPath)) {
    logger.warn(`Swagger file not found at ${swaggerPath}. Generating at runtime...`);
    // Fallback: generate at runtime if not found
    (async function () {
      try {
        const swaggerPromise = await import('./swagger/swagger');
        await swaggerPromise.default;
        logger.info('Runtime swagger generation completed');
      } catch (error) {
        logger.error(`Failed to generate swagger documentation: ${error}`);
      }
    })();
  } else {
    logger.info(`Swagger documentation found at: ${swaggerPath}`);
  }

  // TODO: style recommendation: set below statement background color green and foreground color black
  // TODO: add teminal bell when server starts
  logger.info(`Primary Process Starting ${env.NUMBER_OF_WORKERS} Workers!`);

  for (let worker = 1; worker <= env.NUMBER_OF_WORKERS; worker++) cluster.fork();

  // when a worker starts
  cluster.on('online', (workerInfo) => logger.info(`Worker with Process ${workerInfo.process.pid} Started!`));

  // start a new worker whenever a worker dies of some error
  cluster.on('exit', (worker, code, signal) => {
    logger.error('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
    logger.info('Starting a new worker');
    cluster.fork();
  });
} else {
  // create express app
  const expressApp = app();
  // start listening to requests
  // Bind to 0.0.0.0 to accept connections from all interfaces (required for Render/Docker)
  // Check if PORT env var is set (Render/Heroku/Docker) or NODE_ENV is production
  // Always use 0.0.0.0 if PORT is set, as it's a reliable indicator of cloud deployment
  // Render always provides PORT, so this ensures binding to 0.0.0.0 on Render
  const hasPort = !!process.env.PORT;
  const isProduction = process.env.NODE_ENV === 'production';
  const host = hasPort || isProduction ? '0.0.0.0' : 'localhost';
  expressApp.listen(env.APP_PORT, host, () => {
    logger.info('=== SERVER STARTED ===');
    logger.info(`Server is up & running on http://${host}:${env.APP_PORT}`);
    if (env.BASE_URL && env.BASE_URL !== `http://${host}:${env.APP_PORT}`) {
      logger.info(`Public URL: ${env.BASE_URL}`);
    }
  });
}

// catch termination signals from system (system level interruptions)
process.on('SIGTERM', () => {
  logger.error('SIGTERM SIGNAL! Shutting down...');
  process.exit(1);
});

// catch termination signals from user (user level interruptions like Ctrl + C)
process.on('SIGINT', () => {
  logger.error('SIGINT SIGNAL! Shutting down...');
  process.exit(1);
});

// catch any error that is not catched properly
process.on('uncaughtException', (error) => {
  logger.error(`UNCAUGHT EXCEPTION! Shutting down... \n ${error}`);
  process.exit(1);
});
// catch any error that is not handled properly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('unhandledRejection', (error: any) => {
  logger.error(`UNHANDLED REJECTION! Shutting down... \n ${error}`);
  process.exit(1);
});
