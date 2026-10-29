require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5000);
const poolSize = Number(process.env.DATABASE_POOL_SIZE || 5);
const trustProxyHops = Number(
  process.env.TRUST_PROXY_HOPS ?? (isProduction ? 1 : 0),
);
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const jwtSecret = String(process.env.JWT_SECRET || "");
const frontendUrl = String(
  process.env.FRONTEND_URL || "https://luxjson.is-a.dev",
).trim();

function parseOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  const localHttp =
    !isProduction &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!localHttp && url.protocol !== "https:") || url.username || url.password) {
    throw new Error(`${label} must use HTTPS, except localhost in development.`);
  }
  return url.origin;
}

const frontendOrigin = parseOrigin(frontendUrl, "FRONTEND_URL");
const configuredOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => parseOrigin(value, "CORS_ORIGINS entry"));

const productionOrigins = [
  frontendOrigin,
  "https://luxjson.is-a.dev",
  "https://luxjson.github.io",
  "https://luxjson.vercel.app",
];
const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port,
  poolSize,
  trustProxyHops,
  databaseUrl,
  databaseSslCa: process.env.DATABASE_SSL_CA || "",
  databaseSslRejectUnauthorized:
    String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
  jwtSecret,
  frontendOrigin,
  allowedOrigins: [
    ...new Set([
      ...productionOrigins,
      ...(!isProduction ? developmentOrigins : []),
      ...configuredOrigins,
    ]),
  ],
});

function validateEnv() {
  const errors = [];
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("PORT must be an integer between 1 and 65535.");
  }
  if (!databaseUrl) {
    errors.push("DATABASE_URL is required.");
  } else {
    try {
      const url = new URL(databaseUrl);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
        errors.push("DATABASE_URL must be a PostgreSQL connection URL.");
      }
    } catch {
      errors.push("DATABASE_URL must be a valid PostgreSQL connection URL.");
    }
  }
  if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
    errors.push("JWT_SECRET must contain at least 32 bytes of random secret material.");
  }
  if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 15) {
    errors.push("DATABASE_POOL_SIZE must be an integer between 1 and 15.");
  }
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 4) {
    errors.push("TRUST_PROXY_HOPS must be an integer between 0 and 4.");
  }
  if (errors.length) {
    throw new Error(`Invalid API configuration:\n- ${errors.join("\n- ")}`);
  }
}

module.exports = { env, validateEnv };
