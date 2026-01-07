import { Request, Response, Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import swaggerDocument from '../swagger/documentation.swagger.json';

// Note: Removed global 'count' variable to prevent race conditions between concurrent requests
// Each request handler uses local state to avoid data leakage
const defaultRoutes = Router();
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
