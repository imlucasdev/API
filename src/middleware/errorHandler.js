"use strict";

const { AppError } = require("../utils/AppError");

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error?.code === "CORS_ORIGIN_DENIED") {
    return res.status(403).json({
      success: false,
      code: "CORS_ORIGIN_DENIED",
      message: "Origin not allowed.",
    });
  }

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large.",
    });
  }

  if (
    error?.type === "entity.parse.failed" ||
    (error instanceof SyntaxError && error.status === 400)
  ) {
    return res.status(400).json({
      success: false,
      code: "INVALID_JSON",
      message: "Invalid JSON request body.",
    });
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      success: false,
      code: "CONFLICT",
      message: "A record with those details already exists.",
    });
  }

  if (["23503", "23514", "22P02"].includes(error?.code)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "The request contains invalid data.",
    });
  }

  const transientDatabaseCodes = new Set([
    "57014", "57P01", "57P02", "57P03", "57P04", "53300",
    "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
    "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH",
    "ENETUNREACH", "EPIPE", "ENOTFOUND", "EAI_AGAIN",
  ]);
  if (transientDatabaseCodes.has(error?.code) || String(error?.code || "").startsWith("08")) {
    return res.status(503).json({
      success: false,
      code: "SERVICE_UNAVAILABLE",
      message: "The service is temporarily unavailable.",
    });
  }

  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR";

  if (status >= 500) {
    console.error("[api-error]", {
      name: error?.name || "Error",
      code: error?.code || null,
      path: req.path,
      method: req.method,
    });
  } else if (process.env.NODE_ENV !== "production" && !(error instanceof AppError)) {
    console.error("[request-error]", error);
  }

  return res.status(status).json({
    success: false,
    code,
    message:
      error instanceof AppError && status < 500
        ? error.message
        : status >= 500
          ? "Internal server error."
          : "Request failed.",
  });
}

function notFoundHandler(_req, res) {
  return res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "Route not found.",
  });
}

module.exports = { errorHandler, notFoundHandler };
