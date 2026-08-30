const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const notFound = require('./middlewares/notFound.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(compression());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    credentials: true,
  })
);

// Helmet's default Cross-Origin-Resource-Policy (same-origin) would block
// admin.makedown.online / www.makedown.online from loading images served
// here on back.makedown.online — relax it for just the uploads path.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../uploads'))
);

app.get('/health', (req, res) => res.json({ status: 'ok', env: env.nodeEnv }));

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Make Down API Docs' }));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
