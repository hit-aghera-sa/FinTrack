const Transaction = require("../models/transaction.model");
const Category = require("../models/category.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");

const createTransaction = catchAsync( async (req, res, next) => {

    const {type, amount, categoryId, userId, description, date, isRecuring, isSubscription} = req.body;

    if(!type || !amount || !categoryId || !userId ){
        return next( new AppError("type, amount,  categoryId and userId are required"), 400);
    }

    const category = await Category.findOne({_id: categoryId, userId});
    if(!category) return next(new AppError("category not found for this user", 404))

    if(category.type !== type) return next(new AppError("Transaction type does not match category type", 400))

    const transaction = await Transaction.create({
      type,
      amount,
      categoryId,
      userId,
      description,
      date,
      isRecuring,
      isSubscription,
    });

    res.status(201).json({status: "success", data: transaction});
})

module.exports = {createTransaction};