const Category = require('../models/category.model');
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/asyncErrorHandler');

const filterFields = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

const createCategory = catchAsync(async (req, res, next) => {
  const { name, type } = req.body;
  const userId = req.user.id;

  if (!name || !type) {
    return next(new AppError('name and type both are required', 400));
  }

  if (typeof name !== 'string') {
    return next(new AppError('category name must be a string', 400));
  }

  if (typeof type !== 'string') {
    return next(new AppError('category type must be a string', 400));
  }

  const trimmedName = name.trim();
  const trimmedType = type.trim();

  const user = await User.findById(userId);
  if (!user) return next(new AppError('user not found for this user', 404));
  if (user.active)
    return next(new AppError('Cannot add category under a deleted user', 400));

  const isCategoryExist = await Category.findOne({ name: trimmedName, userId });
  if (isCategoryExist)
    return next(new AppError('category allready exists', 400));

  const newCategory = await Category.create({
    name: trimmedName,
    type: trimmedType,
    userId
  });

  res.status(201).json({ status: 'success', data: newCategory });
});

const getAllCategories = catchAsync(async (req, res, next) => {
  const allCategory = await Category.find();

  if (allCategory.length === 0)
    return next(new AppError('category not found', 404));

  res.status(200).json({ status: 'success', data: allCategory });
});

const getMyCategory = catchAsync(async (req, res) => {
  const categories = await Category.find({ userId: req.user.id });

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: categories
  });
});

const getCategory = catchAsync(async (req, res, next) => {
  const categoryId = req.params.id;
  if (!categoryId) return next(new AppError('categoryId not provided', 400));

  // user can access user's own category only and admin can accesss any

  const query =
    req.user.role === 'admin'
      ? { _id: categoryId }
      : { _id: categoryId, userId: req.user.id };

  const category = await Category.findOne(query);
  if (!category) return next(new AppError('category not found', 404));

  res.status(200).json({ status: 'success', data: category });
});

const updateCategory = catchAsync(async (req, res, next) => {
  const categoryId = req.params.id;

  if (!categoryId) {
    return next(new AppError('categoryId not provided', 400));
  }

  const filteredBody = filterFields(req.body, 'name');

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, userId: req.user.id },
    filteredBody,
    { new: true, runValidators: true }
  );

  if (!category) {
    return next(new AppError('Category not found or not allowed', 404));
  }

  res.status(200).json({ status: 'success', data: category });
});

const deactiveCategory = catchAsync(async (req, res, next) => {
  const categoryId = req.params.id;

  if (!categoryId) {
    return next(new AppError('categoryId not provided or not allowed', 400));
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, userId: req.user.id },
    { active: false },
    { new: true }
  );
  if (!category) return next(new AppError('category not found', 404));

  await Transaction.updateMany(
    { categoryId, userId: req.user.id },
    { active: false }
  );
  res.status(204).json({ status: 'success', data: null });
});

module.exports = {
  getAllCategories,
  getCategory,
  getMyCategory,
  createCategory,
  updateCategory,
  deactiveCategory
};
