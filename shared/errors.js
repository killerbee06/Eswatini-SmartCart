/**
 * Custom application error class.
 * Use this for all thrown errors so statusCode is preserved.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists.') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input.') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions.') {
    super(message, 403);
  }
}
