import { NextFunction, Request, Response } from 'express';

import CustomError from '../utils/customError.utils';
import { HttpException } from '../exceptions/http.exception';
import logger from '../utils/logger.utils';
import appConfig from '../config/app.config';

const globalErrorHandler = (
  err: Error | CustomError | HttpException,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Default error response
  let statusCode = 500;
  let message = 'An unexpected error occurred';
  let userFriendlyMessage = 'Something went wrong. Please try again later.';
  let errorCode: string | undefined;
  let retryable = false;
  let retryAfter: number | undefined;
  let details: string | undefined;
  const isProduction = appConfig.NODE_ENV === 'production';

  // HttpException handling (from services)
  if (err instanceof HttpException) {
    statusCode = err.status;
    message = err.response.message;
    userFriendlyMessage = err.response.message;
    errorCode = err.response.errorCode;
    retryable = err.response.retryable ?? false;
    retryAfter = err.response.retryAfter;
    details = err.response.details;

    logger.error(
      `HttpException: ${message} | Code: ${errorCode || 'N/A'} | Retryable: ${retryable} | Path: ${req.path} | Method: ${req.method}`
    );
  } else if (err instanceof CustomError) {
    // Operational error (e.g., missing parameters)
    statusCode = err.statusCode || 400;
    message = err.message || 'An operational error occurred';
    userFriendlyMessage = message;

    logger.error(`${message} | Path: ${req.path} | Method: ${req.method}`);
  } else if (err.name === 'ValidationError') {
    // JSON or request validation error
    statusCode = 400;
    message = 'Invalid data provided';
    userFriendlyMessage = 'Please check the input data and try again.';

    logger.error(`${userFriendlyMessage} | Path: ${req.path}`);
  } else if (err.name === 'SyntaxError') {
    // JSON parsing error
    statusCode = 400;
    message = 'Bad Request: Invalid JSON';
    userFriendlyMessage = 'The request body contains invalid JSON. Please check and try again.';

    logger.error(`${userFriendlyMessage} | Path: ${req.path}`);
  } else if (err.name === 'TypeError') {
    // Programmer error (e.g., undefined variable)
    // Do not expose details to the user
    message = 'A programmer error occurred';
    userFriendlyMessage = 'Something went wrong on our end. Please try again later.';

    logger.error(`${message}: ${err.message} | Stack: ${err.stack}`);
  } else if (err.name === 'ReferenceError' || err.name === 'RangeError') {
    // Other common programmer errors
    message = 'A system error occurred';
    userFriendlyMessage = 'We encountered a problem. Please try again later.';

    logger.error(`${message}: ${err.message} | Stack: ${err.stack}`);
  } else {
    // Unknown error
    logger.error(`Unhandled error: ${err.message} | Stack: ${err.stack}`);
  }

  // Response object structure
  const errorResponse: {
    success: boolean;
    status: number;
    message: string;
    errorCode?: string;
    retryable?: boolean;
    retryAfter?: number;
    details?: string;
    stack?: string;
    path?: string;
    timestamp?: string;
  } = {
    success: false,
    status: statusCode,
    message: isProduction ? userFriendlyMessage : message,
  };

  // Add retry information if available
  if (errorCode) {
    errorResponse.errorCode = errorCode;
  }
  if (retryable !== undefined) {
    errorResponse.retryable = retryable;
  }
  if (retryAfter !== undefined) {
    errorResponse.retryAfter = retryAfter;
    // Also set Retry-After header for HTTP compliance
    res.setHeader('Retry-After', retryAfter.toString());
  }
  if (details) {
    errorResponse.details = details;
  }

  // Only include stack trace in development mode
  if (!isProduction) {
    errorResponse.stack = err.stack;
    errorResponse.path = req.path;
    errorResponse.timestamp = new Date().toISOString();
  }

  // Send a structured response to the user
  res.status(statusCode).json(errorResponse);
};

export default globalErrorHandler;
