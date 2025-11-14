const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");
const User = require("../models/user.model");


const protect = catchAsync( async(req, res, next) => {

    let token;

    // 1) check user have token
    if( req.headers.authorization || req.headers.authorization.startsWith("Bearer")){
        token = req.headers.authorization.split(' ')[1];
    }
    
    if(!token) return next(new AppError("user need to Login for access", 401));

    // 2) verify token
    // if jwt verified then return decode other wise throw error by itself which handled by global error handler
    const decode = jwt.verify(token , process.env.JWT_SECRET);

    // 3) check user of this token still exist
    const findUser = await User.findById(decode.id);
    if(!findUser) return next(new AppError("user of this token no longer exist", 401));

    // 4) check if password changed after user login 
    // if user change password after login then user have to login again 

    if(await findUser.isPasswordChange(decode.iat)){
        return next(new AppError("password changed, plaese login again", 401));
    }

    // grand access to protected route
    req.user = findUser;
    next()
})

// route wants midlleware(function with (req, res))
// here it also expect protect and restrictTo be a middleware .delete("/deleteUser/:id", protect, restrictTo("admin"),deleteUser)
// protect is already a middleware
// in restrictTo we want to take "roles" in parameter so we can't write (req, res) with (...roles) so instead of being middleware we return a anonymous middleware
// thats why we don't wrape restrictTo with catchAsync or async other wise it will return promise not middleware
const restrictTo = (...roles) => {

    return(req, res, next) => {
        if(!roles.includes(req.user.role)){
            return next( AppError("Unauthorize to perform this operation", 403));
        }
        next()
    }
}

module.exports = {protect, restrictTo}