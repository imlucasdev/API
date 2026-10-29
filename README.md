# LUXJSON API

Express API for the LUXJSON portfolio, blog and community. Production URL: https://api.luxjson.is-a.dev. The public portfolio uses https://luxjson.is-a.dev.

## Runtime

- Node.js 24+
- PostgreSQL
- Render web service

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` and a randomly generated `JWT_SECRET` containing at least 32 bytes.
3. Apply the existing database schema and community tables to the intended database. Do not point local tests or development at production.
4. Run `npm install`, `npm test`, `npm run check`, then `npm start`.

## Configuration

- `DATABASE_URL`: PostgreSQL connection URL.
- `DATABASE_POOL_SIZE`: pool size from 1 to 15; default 5.
- `DATABASE_SSL_REJECT_UNAUTHORIZED`: certificate verification is enabled by default. Use a trusted CA with `DATABASE_SSL_CA` if the hosting provider requires it; do not disable TLS verification in production.
- `JWT_SECRET`: required, at least 32 bytes; tokens are explicitly restricted to HS256.
- `FRONTEND_URL`: primary frontend origin.
- `CORS_ORIGINS`: optional comma-separated list of additional HTTPS production origins. Local HTTP origins are accepted only outside production.
- `TRUST_PROXY_HOPS`: trusted proxy count; default 1 in production and 0 in development.

## Architecture

Routes bind URL paths, request validation and middleware. Controllers translate HTTP requests into service calls. Services enforce application rules. Repositories own SQL queries. Shared middleware handles authentication, validation, error responses, rate limits and HTTP security headers.

The current API contracts remain under `/api/auth`, `/api/blog` and `/api/community`. Blog HTML is sanitized on writes and public rendering should sanitize again to protect against old database content.

## Deployment

Render reads `render.yaml`, builds the Node service, and checks `/api/health`. Configure `DATABASE_URL`, `JWT_SECRET`, and any origin override in the Render dashboard. The blueprint does not change custom DNS for `api.luxjson.is-a.dev`; configure that hostname in Render and your DNS provider separately.

The API health endpoint checks database connectivity. API responses are not cacheable. The documentation is served from `/docs` and its OpenAPI document from `/swagger.json`.

## Verification scope

CI runs input/sanitization regression tests and JavaScript syntax checks. Real database authorization, deployed CORS, Render environment, custom DNS, email provider, and live penetration tests require a configured staging environment; this repository's automated tests do not claim those external checks.
