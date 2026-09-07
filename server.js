require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const authRoutes = require('./src/routes/authRoutes');
const blogRoutes = require('./src/routes/blogRoutes');
const communityRoutes = require('./src/routes/communityRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');
const setupSwagger = require('./src/config/swagger');
const redoc = require('redoc-express');
const swaggerSpec = require('./src/config/swagger');
const { apiReference } = require('@scalar/express-api-reference');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function (body) {
    if (
      typeof body === 'string' &&
      (body.includes('<!DOCTYPE html>') || body.includes('<html'))
    ) {
      const globalHeadTags = `
        <title>API Documentation</title>
        <link rel="icon" href="https://luxjson.is-a.dev/favicon.ico" />
      `;
      
      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>\n${globalHeadTags}`);
      }
    }
    return originalSend.call(this, body);
  };
  
  next();
});

const allowedOrigins = [
  'https://luxjson.is-a.dev',
  'https://api.luxjson.is-a.dev',
  'https://luxjson.github.io',
  'https://luxjson.vercel.app',

  // React + Vite
  'http://localhost:5173',
  'http://127.0.0.1:5173',

  // Expo Web
  'http://localhost:8081',
  'http://127.0.0.1:8081',

  // Backend local
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked: ${origin}`);
      return callback(new Error(`Origin não permitida pelo CORS: ${origin}`));
    },

    credentials: false,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
    ],

    optionsSuccessStatus: 204,
  })
);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
  permissionsPolicy: {
    features: {
      geolocation: ["'none'"],
      microphone: ["'none'"],
      camera: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
    },
  },
contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://unpkg.com", 
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.luxjson.is-a.dev", "http://localhost:5000"],
      fontSrc: ["'self'", "https:", "data:", "https://fonts.gstatic.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
    
  },
}));



app.use(hpp());
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

delete swaggerSpec.openapi;
delete swaggerSpec.swagger;

app.use(
  '/docs',
  apiReference({
    spec: {
      content: swaggerSpec,
    },
    theme: 'purple',
    pageTitle: 'API Documentation | LUXJSON',
    favicon: 'https://luxjson.is-a.dev/favicon.ico',
    showDeveloperTools: "never",
    hideVersion: true,
    hideDownloadButton: true,
    hiddenClients: true,
  })
);

if (!isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/community', communityRoutes);

app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});


app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>API Documentation</title>
        <link rel="icon" href="https://luxjson.is-a.dev/favicon.ico" />
        <link href="https://fonts.googleapis.com/css?family=Inter:300,400,500,600,700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <div class="container">
          <div class="card">
            <img src="https://luxjson.is-a.dev/favicon.png" style="width: 100px; height: 100px; border-radius: 50%"; class="avatar" />
            <p>API running on <strong>${isProduction ? 'production' : 'development'} mode</strong>.</p>
            <a class="btn" href="/docs">View Documentation</a>
          </div>

          <div class="endpoints-list">
            <h3>Endpoints</h3>
            <ul id="routes">
              <p style="color: var(--scalar-color-2); font-size: 13px;">Loading...</p>
            </ul>
          </div>
        </div>

        <script>
          fetch('/swagger.json')
            .then(res => res.json())
            .then(data => {
              const list = document.getElementById('routes');
              list.innerHTML = '';
              
              for (const [path, methods] of Object.entries(data.paths)) {
                for (const method of Object.keys(methods)) {
                  const li = document.createElement('li');
                  
                  const spanMethod = document.createElement('span');
                  spanMethod.className = 'method ' + method.toLowerCase();
                  spanMethod.innerText = method;
                  
                  const a = document.createElement('a');
                  a.className = 'endpoint-link';
                  a.href = path;
                  a.target = '_blank';
                  a.innerText = path;
                  
                  li.appendChild(spanMethod);
                  li.appendChild(a);
                  list.appendChild(li);
                }
              }
            })
            .catch(() => {
              document.getElementById('routes').innerHTML = '<p style="color: #f87171; font-size: 13px;"> Failed to fetch routes.</p>';
            });
        </script>
      </body>
    </html>
  `);
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

app.use(errorHandler);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  if (isProduction) process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  if (isProduction) process.exit(1);
});

app.listen(PORT, () => {
  console.log(`API running on PORT: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS: ${isProduction ? 'Restrict' : 'All origins (DEV)'}`);
});