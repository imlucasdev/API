"use strict";

const { AppError } = require("../utils/AppError");

function validate(schema, source = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError(400, "INVALID_REQUEST", "Request validation failed."));
    }
    req.validated ||= {};
    req.validated[source] = result.data;
    return next();
  };
}

module.exports = { validate };
