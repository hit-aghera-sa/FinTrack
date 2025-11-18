const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");
const User = require("../models/user.model");


const protect = catchAsync( async(req, res, next) => {

    let token;

    // 1) Check if authorization header exists AND starts with Bearer
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }


    if (!token) {
        return next(new AppError("User needs to login for access", 401));
    }

    // 2) verify token
    const decode = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const findUser = await User.findById(decode.id);
    if (!findUser) {
        return next(new AppError("User belonging to this token no longer exists", 401));
    }
    
    // 4) Check if user changed password after token was issued
    if (await findUser.isPasswordChange(decode.iat)) {
        return next(new AppError("Password changed, please login again", 401));
    }

    // grant access to protected route
    req.user = findUser;
    next()
})

const restrictTo = (...roles) => {

    return(req, res, next) => {
        if(!roles.includes(req.user.role)){
            return next( new AppError("Unauthorize to perform this operation", 403));
        }
        next()
    }
}

module.exports = {protect, restrictTo}