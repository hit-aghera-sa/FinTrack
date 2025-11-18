const User = require("../models/user.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");
const filterFields = (obj, ...allfields) => {
    let newObj = {};
    Object.keys(obj).forEach( el => {
        if(allfields.includes(el)){
            newObj[el] = obj[el];
        }
    })  
    return newObj
}

const getAllUsers = catchAsync(async(req, res, next) => {
    const allUsers = await User.find();

    if(!allUsers) return next( new AppError("user not found", 404));

    res.status(200).json({status: "success", data: allUsers});
})

const updateMe = catchAsync( async(req, res, next) => {
    
    // user not allowed to change password here
    if(req.body.password || req.body.passwordConfirm){
        return next (new AppError("password can change only throgh /api/user/updatePassword", 401));
    }

    const filteredBody = filterFields(req.body, "name", "email");
    
    // user allowed to change only name & email
    const updatedUser = await User.findByIdAndUpdate(
        req.user.id, 
        filteredBody, 
        {new: true, runValidators: true}
    )
    res.status(200).json({status: "success", updatedUser: updatedUser})
})

const deleteMe = catchAsync(async (req, res, next) => {

    await User.findByIdAndUpdate(req.user.id, {active: false})
    res.status(204).json({status: "success", data: null});
})

const deleteUser = catchAsync(async (req, res, next) => {
    const id = req.params.id;

    const deletedUser = await User.findByIdAndDelete(id);
    if(!deletedUser) return next( new AppError("user not found", 404));

    res.status(200).json({status: "success", deletedUser: deletedUser});
})

module.exports = {getAllUsers, updateMe, deleteMe, deleteUser}