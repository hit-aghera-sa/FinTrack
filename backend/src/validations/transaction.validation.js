import Joi from 'joi';

export const createTransactionSchema = Joi.object({
  body: Joi.object({
    amount: Joi.number().required(),
    description: Joi.string().max(200).optional(),
    date: Joi.date().required(),
    categoryId: Joi.string().hex().length(24).required(),
    isRecurring: Joi.boolean().optional(),
    isSubscription: Joi.boolean().optional(),
  }),
});

export const updateTransactionSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
  body: Joi.object({
    amount: Joi.number().optional(),
    description: Joi.string().max(200).optional(),
    date: Joi.date().optional(),
    isRecurring: Joi.boolean().optional(),
    isSubscription: Joi.boolean().optional(),
  }),
});
