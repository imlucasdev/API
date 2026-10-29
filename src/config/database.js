const { Pool } = require("pg");
const { env } = require("./env");

function poolConfig() {
  let url;
  try {
    url = new URL(env.databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local) {
    for (const option of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      url.searchParams.delete(option);
    }
  }

  const config = {
    connectionString: url.toString(),
    max: env.poolSize,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    idle_in_transaction_session_timeout: 15_000,
    application_name: "luxjson-api",
    keepAlive: true,
  };

  if (env.isProduction && !local) {
    config.ssl = {
      rejectUnauthorized: env.databaseSslRejectUnauthorized,
      ...(env.databaseSslCa ? { ca: env.databaseSslCa } : {}),
    };
  } else {
    config.ssl = false;
  }

  return config;
}

const pool = new Pool(poolConfig());

pool.on("error", (error) => {
  console.error("[database-pool]", {
    code: error?.code || "UNKNOWN",
    name: error?.name || "DatabaseError",
  });
});

module.exports = { pool };
