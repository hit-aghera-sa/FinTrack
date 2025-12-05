const express = require('express');
const validate = require('../middlewares/validate.middleware');

const {
  getAllCategories,
  getCategory,
  getMyCategory,
  createCategory,
  updateCategory,
  deactiveCategory
} = require('../controllers/category.controller');

const {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema
} = require('../validations/category.validation');

const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router
  .get('/', getMyCategory)
  .post('/', validate(createCategorySchema), createCategory)
  .patch('/:id', validate(categoryIdSchema, 'params'), validate(updateCategorySchema), updateCategory)
  .delete('/:id', validate(categoryIdSchema, 'params'), deactiveCategory);

router.use(restrictTo('admin'));

router
  .get('/all', getAllCategories).get('/admin/:id', getCategory)
  .get('/:id', validate(categoryIdSchema, 'params'), getCategory)

module.exports = router;
