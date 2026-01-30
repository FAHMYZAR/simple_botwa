class AppError extends Error {
  constructor(message, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
