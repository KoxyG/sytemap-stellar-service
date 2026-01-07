import { Request, Response, Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import swaggerDocument from '../swagger/documentation.swagger.json';

// Note: Removed global 'count' variable to prevent race conditions between concurrent requests
// Each request handler uses local state to avoid data leakage
const defaultRoutes = Router();

// Root endpoint - handles health checks and provides API information
defaultRoutes.get('/', (req: Request, res: Response) => {
  // #swagger.tags = ['Health']
  // #swagger.summary = "API Health Check and Information"
  /*  #swagger.responses[200] = {
              description: 'API is running',
              schema: {
                  success: true,
                  message: "SyteMap Stellar Service API",
                  version: "1.0.0",
                  endpoints: {
                    api: "/api/v1",
                    docs: "/api/v1/api-docs",
                    welcome: "/api/v1/welcome"
                  }
              }
      } */
  return res.status(200).json({
    success: true,
    message: 'SyteMap Stellar Service API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      api: '/api/v1',
      docs: '/api/v1/api-docs',
      welcome: '/api/v1/welcome',
    },
  });
});

// Handle HEAD requests for health checks (Render, load balancers, etc.)
defaultRoutes.head('/', (req: Request, res: Response) => {
  res.status(200).end();
});

// simple endpoint
defaultRoutes.get('/welcome', (req: Request, res: Response) => {
  // #swagger.tags = ['Welcome']
  // #swagger.summary = "Welcome API Endpoint to start"
  /*  #swagger.responses[200] = {
              description: 'Some description...',
              schema: {
                  sucess: true,
                  message: "Welcome to Sytemap Blockchain Backend Service"
              }
      } */
  // Using local state per request - no shared global state
  return res.status(200).json({ success: true, message: 'Welcome to Sytemap Blockchain Backend Service' });
});

defaultRoutes.get('/benchmark', (req, res) => {
  const _requests = req.query.requests;
  let requests = 100;
  if (typeof _requests === 'string')
    // Simulate a high-load response
    requests = parseInt(_requests, 10);
  // Using local state per request - no shared global state
  let completed = 0;

  // Function to simulate high-load
  const simulateLoad = () => {
    if (completed >= requests) {
      res.send('Benchmark test complete!');
      return;
    }
    completed += 1;
    setImmediate(simulateLoad);
  };

  simulateLoad();
});

// swagger document route
// when you hit this route you shall auto generated swagger documentation
defaultRoutes.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default defaultRoutes;
