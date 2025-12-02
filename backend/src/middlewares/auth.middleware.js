const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");
const User = require("../models/user.model");

const protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Check cookie first
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // 2) Fallback: Authorization header
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 3) If no token found
  if (!token) {
    return next(new AppError("User needs to login for access", 401));
  }

  // 4) Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 5) Check user existence
  const findUser = await User.findById(decoded.id);
  if (!findUser) {
    return next(
      new AppError("User belonging to this token no longer exists", 401)
    );
  }

  // 6) Check password change
  if (await findUser.isPasswordChange(decoded.iat)) {
    return next(new AppError("Password changed, please login again", 401));
  }

  req.user = findUser;
  next();
});


const restrictTo = (...roles) => {

    return(req, res, next) => {
        if(!roles.includes(req.user.role)){
            return next( new AppError("Unauthorize to perform this operation", 403));
        }
        next()
    }
}

module.exports = {protect, restrictTo}