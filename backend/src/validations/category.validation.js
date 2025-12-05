const Joi = require('joi');

const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  icon: Joi.string().optional(),
  color: Joi.string().optional()
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  icon: Joi.string().optional(),
  color: Joi.string().optional()
}).min(1);

const categoryIdSchema = Joi.object({
  id: Joi.string().required().hex().length(24)
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema
};
