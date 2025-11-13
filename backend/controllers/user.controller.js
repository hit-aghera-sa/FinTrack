const User = require("../models/user.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");

exports.getAllUsers = catchAsync(async(req, res, next) => {
    const allUsers = await User.find();

    if(!allUsers) return next( new AppError("user not found", 404));

    res.status(200).json({status: "success", data: allUsers});
})