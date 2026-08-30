const ApiError = require('../utils/ApiError');

// Validates req[property] against a Joi schema. Usage: validate(schema, 'body')
module.exports = function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d) => d.message);
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[property] = value;
    next();
  };
};
