export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyPattern || {}).join(", ");
    message = `Duplicate value for: ${fields || "unique field"}`;
  }

  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "Uploaded file is too large. Max allowed size is 5MB.";
    }
  }

  if (res.headersSent) {
    return next(err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
};
