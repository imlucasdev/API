const { validateEnv, env } = require("./src/config/env");

function start() {
  validateEnv();
  const { createApp } = require("./src/app");
  const { pool } = require("./src/config/database");
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`LUXJSON API listening on port ${env.port} (${env.nodeEnv}).`);
  });

  let shuttingDown = false;
  const shutdown = (signal, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down the API.`);
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();

    server.close(async () => {
      try {
        await pool.end();
        clearTimeout(deadline);
        process.exit(exitCode);
      } catch {
        process.exit(1);
      }
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("uncaughtException", (error) => {
    console.error("[uncaught-exception]", {
      name: error?.name || "Error",
      message: error?.message || "Unexpected error",
    });
    shutdown("uncaughtException", 1);
  });
  process.once("unhandledRejection", () => shutdown("unhandledRejection", 1));

  return server;
}

if (require.main === module) {
  try {
    start();
  } catch (error) {
    console.error("[startup-failed]", error.message);
    process.exitCode = 1;
  }
}

module.exports = { start };
