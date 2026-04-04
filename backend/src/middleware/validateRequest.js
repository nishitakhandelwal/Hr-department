import { validationResult } from "express-validator";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(422).json({
    success: false,
    message: "Validation failed",
    errors: errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    })),
  });
};
