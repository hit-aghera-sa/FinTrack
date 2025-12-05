const Joi = require('joi');

const updateMeSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),

  password: Joi.forbidden(),
  passwordConfirm: Joi.forbidden()
}).min(1);

module.exports = { updateMeSchema };
