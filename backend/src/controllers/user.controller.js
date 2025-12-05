const User = require('../models/user.model');
const Category = require('../models/category.model');
const Transaction = require('../models/transaction.model');
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

const getAllUsers = catchAsync(async (req, res, next) => {
  const allUsers = await User.find();

  if (allUsers.length === 0) return next(new AppError('user not found', 404));

  res.status(200).json({ status: 'success', data: allUsers });
});

const getUser = catchAsync(async (req, res, next) => {
  const userId = req.params.id;
  if (!userId) return next(new AppError('userId not proovided', 400));

  const user = await User.findById(userId);
  if (!user) return next(new AppError('user not found', 404));

  res.status(200).json({ status: 'success', data: user });
});

const updateMe = catchAsync(async (req, res, next) => {
  // user not allowed to change password here
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'password can change only throgh /api/user/update-password',
        401
      )
    );
  }

  const filteredBody = filterFields(req.body, 'name', 'email');

  // user allowed to change only name & email
  const user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });
  res.status(200).json({ status: 'success', updatedUser: user });
});

const deactiveMe = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    { _id: req.user.id },
    { active: true },
    { new: true }
  );
  if (!user) return next(new AppError('User not found', 404));

  await Category.updateMany({ userId: req.user.id }, { active: true });
  await Transaction.updateMany({ userId: req.user.id }, { active: true });
  res.status(204).json({ status: 'success', data: null });
});

const deactiveUser = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  if (!id) return next('id not provided', 400);

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { active: false },
    { new: true }
  );
  if (!user) return next(new AppError('User not found', 404));

  await Category.updateMany({ userId: req.user.id }, { active: false });
  await Transaction.updateMany({ userId: req.user.id }, { active: false });
  if (!user) return next(new AppError('user not found', 404));

  res.status(204).json({ status: 'success', data: null });
});

module.exports = { getAllUsers, getUser, updateMe, deactiveMe, deactiveUser };
