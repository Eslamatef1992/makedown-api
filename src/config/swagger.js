const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Make Down API',
      version: '1.0.0',
      description:
        'REST API for the Make Down platform: auth, e-commerce, packages, schools, the live quiz game engine, social features and admin management.',
      contact: { name: 'Teknulugy' },
    },
    servers: [
      { url: `${env.apiBaseUrl}/api/v1`, description: 'Current environment' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Registration, login, OTP verification, password reset' },
    ],
  },
  apis: ['./src/modules/**/*.routes.js', './src/modules/**/*.controller.js'],
};

module.exports = swaggerJsdoc(options);
