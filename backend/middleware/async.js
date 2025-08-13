// Simple async handler utility to catch errors from async route handlers
// and pass them to Express error handling middleware.

export default function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
