"use strict";

const swaggerJSDoc = require("swagger-jsdoc");

const idParameter = (name = "id", description = "Positive integer identifier.") => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "integer", minimum: 1 },
});

const paginationParameters = [
  { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
  { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
];

const jsonBody = (schema) => ({
  required: true,
  content: { "application/json": { schema } },
});

const success = (description = "Request completed successfully.") => ({ description });
const errorResponse = (description) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
});

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "LUXJSON API",
      version: "1.1.0",
      description: "API for the LUXJSON portfolio, blog, and community.",
    },
    servers: [
      {
        url: "https://api.luxjson.is-a.dev",
        description: "Production API",
      },
    ],
    tags: [
      { name: "Health" },
      { name: "Admin authentication" },
      { name: "Blog" },
      { name: "Community authentication" },
      { name: "Community posts" },
      { name: "Community moderation" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Admin or community-user access token, as appropriate for the operation.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["success", "code", "message"],
          properties: {
            success: { type: "boolean", example: false },
            code: { type: "string", example: "INVALID_REQUEST" },
            message: { type: "string" },
          },
        },
        AdminCredentials: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1, maxLength: 50 },
            password: { type: "string", minLength: 1, maxLength: 1024, format: "password" },
          },
        },
        CommunityRegistration: {
          type: "object",
          required: ["name", "username", "password", "confirmPassword"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            username: { type: "string", minLength: 3, maxLength: 50, pattern: "^[A-Za-z0-9_.-]+$" },
            password: { type: "string", minLength: 8, maxLength: 72, format: "password" },
            confirmPassword: { type: "string", minLength: 8, maxLength: 72, format: "password" },
          },
        },
        CommunityLogin: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1, maxLength: 50 },
            password: { type: "string", minLength: 1, maxLength: 1024, format: "password" },
          },
        },
        BlogPostWrite: {
          type: "object",
          required: ["title", "content"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 180 },
            content: { type: "string", minLength: 1, maxLength: 80000, description: "HTML is accepted but sanitized by the API." },
            excerpt: { type: "string", maxLength: 500, nullable: true },
            cover_image: { type: "string", maxLength: 2048, nullable: true, description: "HTTPS image URL or same-origin absolute path." },
            published: { type: "boolean", default: false },
          },
        },
        BlogPostUpdate: {
          type: "object",
          minProperties: 1,
          properties: {
            title: { type: "string", minLength: 1, maxLength: 180 },
            content: { type: "string", minLength: 1, maxLength: 80000, description: "HTML is accepted but sanitized by the API." },
            excerpt: { type: "string", maxLength: 500, nullable: true },
            cover_image: { type: "string", maxLength: 2048, nullable: true },
            published: { type: "boolean" },
          },
        },
        CommunityPostCreate: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string", minLength: 1, maxLength: 500 },
          },
        },
        CommunityReport: {
          type: "object",
          properties: {
            reason: { type: "string", maxLength: 1000 },
          },
        },
        CommunityModeration: {
          type: "object",
          required: ["action"],
          properties: {
            action: { type: "string", enum: ["approve", "remove"] },
          },
        },
        CommunityProfileUpdate: {
          type: "object",
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            username: { type: "string", minLength: 3, maxLength: 50, pattern: "^[A-Za-z0-9_.-]+$" },
            avatar_url: { type: "string", maxLength: 2048, nullable: true, description: "HTTPS URL." },
          },
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Check API and database availability",
          responses: {
            "200": success("API and database are available."),
            "503": errorResponse("API or database is unavailable."),
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Admin authentication"],
          summary: "Sign in as an administrator",
          requestBody: jsonBody({ $ref: "#/components/schemas/AdminCredentials" }),
          responses: {
            "200": success("Returns a bearer token and public administrator profile."),
            "400": errorResponse("Invalid request."),
            "401": errorResponse("Credentials are invalid."),
            "429": errorResponse("Too many login attempts."),
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Admin authentication"],
          summary: "Return the current administrator",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": success("Administrator profile."),
            "401": errorResponse("Token is missing, invalid, or expired."),
            "503": errorResponse("Database unavailable."),
          },
        },
      },
      "/api/blog/posts": {
        get: {
          tags: ["Blog"],
          summary: "List blog posts",
          description: "Public requests must use publishedOnly=true. Setting publishedOnly=false requires an administrator token.",
          parameters: [
            ...paginationParameters,
            { name: "publishedOnly", in: "query", required: false, schema: { type: "boolean", default: true } },
          ],
          responses: {
            "200": success("Returns a paginated array of posts."),
            "400": errorResponse("Invalid query parameters."),
            "403": errorResponse("Drafts require administrator access."),
          },
        },
        post: {
          tags: ["Blog"],
          summary: "Create a blog post",
          security: [{ BearerAuth: [] }],
          requestBody: jsonBody({ $ref: "#/components/schemas/BlogPostWrite" }),
          responses: {
            "201": success("Post created."),
            "400": errorResponse("Invalid input."),
            "401": errorResponse("Administrator token required."),
            "409": errorResponse("A post with the same slug exists."),
          },
        },
      },
      "/api/blog/posts/{identifier}": {
        parameters: [{
          name: "identifier",
          in: "path",
          required: true,
          description: "GET uses the post slug; PUT and DELETE use the numeric post ID.",
          schema: { type: "string" },
        }],
        get: {
          tags: ["Blog"],
          summary: "Read a published post by slug",
          responses: {
            "200": success("Returns the published post. View count is incremented."),
            "404": errorResponse("Published post not found."),
          },
        },
        put: {
          tags: ["Blog"],
          summary: "Update a post by ID",
          security: [{ BearerAuth: [] }],
          requestBody: jsonBody({ $ref: "#/components/schemas/BlogPostUpdate" }),
          responses: {
            "200": success("Post updated."),
            "400": errorResponse("Invalid input."),
            "401": errorResponse("Administrator token required."),
            "404": errorResponse("Post not found."),
            "409": errorResponse("A post with the same slug exists."),
          },
        },
        delete: {
          tags: ["Blog"],
          summary: "Delete a post by ID",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": success("Post deleted."),
            "401": errorResponse("Administrator token required."),
            "404": errorResponse("Post not found."),
          },
        },
      },
      "/api/blog/posts/id/{id}": {
        get: {
          tags: ["Blog"],
          summary: "Read a post by numeric ID, including drafts",
          security: [{ BearerAuth: [] }],
          parameters: [idParameter()],
          responses: {
            "200": success("Returns the post for the admin editor."),
            "401": errorResponse("Administrator token required."),
            "404": errorResponse("Post not found."),
          },
        },
      },
      "/api/blog/stats": {
        get: {
          tags: ["Blog"],
          summary: "Get blog statistics",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": success("Counts of posts, published posts, and views."),
            "401": errorResponse("Administrator token required."),
          },
        },
      },
      "/api/community/auth/register": {
        post: {
          tags: ["Community authentication"],
          summary: "Register a community account",
          requestBody: jsonBody({ $ref: "#/components/schemas/CommunityRegistration" }),
          responses: {
            "201": success("Community account created."),
            "400": errorResponse("Invalid registration data."),
            "409": errorResponse("Username already exists."),
            "429": errorResponse("Too many attempts."),
          },
        },
      },
      "/api/community/auth/login": {
        post: {
          tags: ["Community authentication"],
          summary: "Sign in as a community user or administrator",
          requestBody: jsonBody({ $ref: "#/components/schemas/CommunityLogin" }),
          responses: {
            "200": success("Returns a bearer token and public profile."),
            "400": errorResponse("Invalid request."),
            "401": errorResponse("Credentials are invalid."),
            "429": errorResponse("Too many attempts."),
          },
        },
      },
      "/api/community/auth/me": {
        get: {
          tags: ["Community authentication"],
          summary: "Return the current community account",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": success("Current account profile."),
            "401": errorResponse("Valid login required."),
          },
        },
      },
      "/api/community/auth/profile": {
        put: {
          tags: ["Community authentication"],
          summary: "Update the current community profile",
          security: [{ BearerAuth: [] }],
          requestBody: jsonBody({ $ref: "#/components/schemas/CommunityProfileUpdate" }),
          responses: {
            "200": success("Profile updated."),
            "400": errorResponse("Invalid profile data."),
            "401": errorResponse("Valid login required."),
            "409": errorResponse("Username already exists."),
          },
        },
      },
      "/api/community/posts": {
        get: {
          tags: ["Community posts"],
          summary: "List active and approved community posts",
          parameters: [
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
            { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: {
            "200": success("Returns posts, counts, and the current user's like state when authenticated."),
            "400": errorResponse("Invalid query parameters."),
          },
        },
        post: {
          tags: ["Community posts"],
          summary: "Create a community post",
          security: [{ BearerAuth: [] }],
          requestBody: jsonBody({ $ref: "#/components/schemas/CommunityPostCreate" }),
          responses: {
            "201": success("Community post created."),
            "400": errorResponse("Invalid content."),
            "401": errorResponse("Valid login required."),
          },
        },
      },
      "/api/community/posts/{id}": {
        delete: {
          tags: ["Community posts"],
          summary: "Delete a post (owners or admins)",
          security: [{ BearerAuth: [] }],
          parameters: [idParameter()],
          responses: {
            "200": success("Post deleted."),
            "401": errorResponse("Valid login required."),
            "403": errorResponse("Users can only delete their own posts."),
            "404": errorResponse("Post not found."),
          },
        },
      },
      "/api/community/posts/{id}/like": {
        post: {
          tags: ["Community posts"],
          summary: "Toggle a like on a post",
          security: [{ BearerAuth: [] }],
          parameters: [idParameter()],
          responses: {
            "200": success("Returns the new like state and total likes."),
            "401": errorResponse("Valid login required."),
            "404": errorResponse("Post not found."),
          },
        },
      },
      "/api/community/posts/{id}/report": {
        post: {
          tags: ["Community posts"],
          summary: "Report a community post",
          security: [{ BearerAuth: [] }],
          parameters: [idParameter()],
          requestBody: jsonBody({ $ref: "#/components/schemas/CommunityReport" }),
          responses: {
            "200": success("Report submitted."),
            "401": errorResponse("Valid login required."),
            "404": errorResponse("Post not found."),
            "409": errorResponse("This account has already reported the post."),
          },
        },
      },
      "/api/community/users/{id}/posts": {
        get: {
          tags: ["Community posts"],
          summary: "List the authenticated user's posts (admins may request another user)",
          security: [{ BearerAuth: [] }],
          parameters: [idParameter()],
          responses: {
            "200": success("Returns the requested user's posts."),
            "401": errorResponse("Valid login required."),
            "403": errorResponse("Users cannot inspect other profiles through this route."),
          },
        },
      },
      "/api/community/admin/reports": {
        get: {
          tags: ["Community moderation"],
          summary: "List reported posts",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": success("Returns reported posts and report details."),
            "401": errorResponse("Valid login required."),
            "403": errorResponse("Administrator access required."),
          },
        },
      },
      "/api/community/admin/posts/{id}/moderate": {
        put: {
          tags: ["Community moderation"],
          summary: "Approve or remove a reported post",
          security: [{ BearerAuth: [] }],
          parameters: [idParameter()],
          requestBody: jsonBody({ $ref: "#/components/schemas/CommunityModeration" }),
          responses: {
            "200": success("Moderation action completed."),
            "400": errorResponse("Invalid moderation action."),
            "401": errorResponse("Valid login required."),
            "403": errorResponse("Administrator access required."),
            "404": errorResponse("Reported post not found."),
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./server.js"],
};

module.exports = swaggerJSDoc(options);
