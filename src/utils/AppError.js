"use strict";

class AppError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

module.exports = { AppError };
