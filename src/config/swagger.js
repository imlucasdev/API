"use strict";

const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "LUXJSON API",
      version: "1.1.0",
      description: "API for the LUXJSON portfolio, blog and community.",
    },
    servers: [
      {
        url: "https://api.luxjson.is-a.dev",
        description: "Production API",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Administrator or community access token.",
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./server.js"],
};

module.exports = swaggerJSDoc(options);
