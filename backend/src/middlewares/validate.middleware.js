const AppError = require('../utils/appError');

module.exports = (schema, type = 'body') => (req, res, next) => {
  const toValidate = type === 'params' ? req.params : req.body;

  const { error } = schema.validate(toValidate, { abortEarly: false });

  if (error) {
    return next(new AppError(error.details.map(d => d.message).join(', '), 400));
  }

  next();
};
