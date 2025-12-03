const Transaction = require('../models/transaction.model');
const Category = require('../models/category.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/asyncErrorHandler');
const logger = require('../utils/logger');

const filterFields = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

const createTransaction = catchAsync(async (req, res, next) => {
  const { amount, categoryId, description, date, isRecurring, isSubscription } =
    req.body;

  if (!amount || !categoryId) {
    return next(new AppError('amount and categoryId are required', 400));
  }

  const userId = req.user.id;

  const category = await Category.findOne({ _id: categoryId, userId });
  if (!category)
    return next(new AppError('category not found for this user', 404));
  if (category.active)
    return next(
      new AppError('Cannot add transaction under a deleted category', 400)
    );

  const transaction = await Transaction.create({
    type: category.type,
    amount,
    categoryId,
    userId,
    description,
    date,
    isRecurring,
    isSubscription
  });

  res.status(201).json({ status: 'success', data: transaction });
});

const getAllTransction = catchAsync(async (req, res, next) => {
  const transaction = await Transaction.find();
  if (transaction.length === 0)
    return next(new AppError('transaction not found', 404));

  res.status(200).json({ status: 'success', data: transaction });
});

const getMyTransaction = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const transaction = await Transaction.find({ userId }).populate(
    'categoryId',
    'name type'
  );

  res.status(200).json({
    status: 'success',
    results: transaction.length,
    data: transaction
  });
});

const getTransaction = catchAsync(async (req, res, next) => {
  const transactionId = req.params.id;
  if (!transactionId)
    return next(new AppError('transaction id not provided', 404));

  const query =
    req.user.role === 'admin'
      ? { _id: transactionId }
      : { _id: transactionId, userId: req.user.id };

  const transaction = await Transaction.findOne(query);
  if (!transaction) return next(new AppError('transaction not found', 404));

  res.status(200).json({ status: 'success', data: transaction });
});

const updateTransaction = catchAsync(async (req, res, next) => {
  const transactionId = req.params.id;
  if (!transactionId)
    return next(new AppError('transaction id not provided', 404));
  // remove from server
  logger.info('Update transaction called', {
    userId: req.user?.id,
    transactionId: req.params.id
  });

  const filteredBody = filterFields(
    req.body,
    'amount',
    'description',
    'date',
    'isRecurring',
    'isSubscription'
  );

  logger.debug('Filtered transaction body', {
    filteredBody
  });

  const transaction = await Transaction.findOneAndUpdate(
    { _id: transactionId, userId: req.user.id },
    filteredBody,
    { new: true }
  );

  if (!transaction) return next(new AppError('transaction not found', 404));
  res.status(200).json({ status: 'success', data: transaction });
});

const deactiveTransaction = catchAsync(async (req, res, next) => {
  const transactionId = req.params.id;
  if (!transactionId)
    return next(new AppError('transaction id not provided', 404));

  const transaction = await Transaction.findOneAndUpdate(
    { _id: transactionId, userId: req.user.id },
    { active: false },
    { new: true }
  );
  if (!transaction) return next(new AppError('transaction not found', 404));

  res.status(204).json({ status: 'success', data: null });
});

module.exports = {
  createTransaction,
  getAllTransction,
  getMyTransaction,
  getTransaction,
  updateTransaction,
  deactiveTransaction
};
