const User = require("../models/user.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");

const getAllUsers = catchAsync(async(req, res, next) => {
    const allUsers = await User.find();

    if(!allUsers) return next( new AppError("user not found", 404));

    res.status(200).json({status: "success", data: allUsers});
})

const deleteUser = catchAsync(async (req, res, next) => {
    const id = req.params.id;

    const deletedUser = await User.findByIdAndDelete(id);
    if(!deletedUser) return next( new AppError("user not found", 404));

    res.status(200).json({status: "success", deletedUser: deletedUser});
})

module.exports = {getAllUsers, deleteUser}