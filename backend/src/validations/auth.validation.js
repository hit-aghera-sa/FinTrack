const Joi = require('joi');

exports.signupSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  passwordConfirm: Joi.valid(Joi.ref('password')).required().messages({
    'any.only': 'passwordConfirm must match password'
  }),
  role: Joi.string().valid('user', 'admin').optional()
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

exports.forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

exports.resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).required(),
  passwordConfirm: Joi.valid(Joi.ref('password')).required().messages({
    'any.only': 'passwordConfirm must match password'
  })
});

exports.updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  newPasswordConfirm: Joi.valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'newPasswordConfirm must match newPassword'
  })
});
