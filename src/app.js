const path = require("node:path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const { env } = require("./config/env");
const { pool } = require("./config/database");
const swaggerSpec = require("./config/swagger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const blogRoutes = require("./routes/blogRoutes");
const communityRoutes = require("./routes/communityRoutes");

let scalarApiReferencePromise;

function getScalarApiReferenceHandler() {
  if (!scalarApiReferencePromise) {
    scalarApiReferencePromise = import("@scalar/express-api-reference")
      .then(({ apiReference }) =>
        apiReference({
          spec: { content: swaggerSpec },
          theme: "purple",
          pageTitle: "API Documentation | LUXJSON",
          favicon: "https://luxjson.is-a.dev/favicon.ico",
          showDeveloperTools: "never",
          hideVersion: true,
          hideDownloadButton: true,
          hiddenClients: true,
        }),
      )
      .catch((error) => {
        scalarApiReferencePromise = undefined;
        throw error;
      });
  }

  return scalarApiReferencePromise;
}

morgan.token("path", (req) => req.path);

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isProduction ? 120 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Too many requests." }),
});

const rootPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://luxjson.is-a.dev data:",
  "connect-src 'self'",
  "frame-src 'none'",
  ...(env.isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const docsPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.github.com",
  "frame-src 'none'",
].join("; ");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  if (env.isProduction) app.set("trust proxy", env.trustProxyHops);

  app.use((req, res, next) => {
    res.setHeader("Cache-Control", req.path.startsWith("/api") ? "no-store" : "public, max-age=3600");
    res.setHeader(
      "Content-Security-Policy",
      req.path === "/docs" || req.path.startsWith("/docs/")
        ? docsPolicy
        : rootPolicy,
    );
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: env.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
      permittedCrossDomainPolicies: { permittedPolicies: "none" },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: "deny" },
      noSniff: true,
      originAgentCluster: true,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
        const error = new Error("Origin not allowed.");
        error.code = "CORS_ORIGIN_DENIED";
        error.status = 403;
        return callback(error);
      },
      credentials: false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"],
      exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
      maxAge: 600,
      optionsSuccessStatus: 204,
    }),
  );

  app.use(hpp());
  app.use(compression());
  app.use(morgan(":method :path :status :response-time ms", {
    skip: (req) => req.path === "/api/health",
  }));
  app.use(express.json({ limit: "256kb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "32kb", parameterLimit: 100 }));
  app.use(
    express.static(path.join(__dirname, "../public"), {
      dotfiles: "deny",
      etag: true,
      index: false,
      maxAge: env.isProduction ? "1h" : 0,
    }),
  );
  app.use("/api", apiLimiter);

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      return res.status(200).json({ status: "ok", service: "LUXJSON API" });
    } catch {
      return res.status(503).json({ status: "unavailable", service: "LUXJSON API" });
    }
  });

  app.use("/docs", async (req, res, next) => {
    try {
      const handler = await getScalarApiReferenceHandler();
      return handler(req, res, next);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/swagger.json", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json(swaggerSpec);
  });

  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    return res.type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>LUXJSON API</title>
    <link rel="icon" href="https://luxjson.is-a.dev/favicon.ico">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter:300,400,500,600,700&display=swap">
    <link rel="stylesheet" href="/style.css">
    <script src="/endpoints.js" defer></script>
  </head>
  <body>
    <main class="container">
      <section class="card">
        <img src="https://luxjson.is-a.dev/favicon.png" class="avatar" alt="LUXJSON">
        <p>API running in <strong>${env.isProduction ? "production" : "development"} mode</strong>.</p>
        <a class="btn" href="/docs">View documentation</a>
      </section>
      <section class="endpoints-list" aria-labelledby="endpoint-title">
        <h2 id="endpoint-title">Endpoints</h2>
        <ul id="routes"><li>Loading endpoints…</li></ul>
        <p id="routes-error" role="status" hidden>Unable to load the API specification.</p>
      </section>
    </main>
  </body>
</html>`);
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/blog", blogRoutes);
  app.use("/api/community", communityRoutes);
  app.use("/api", notFoundHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
