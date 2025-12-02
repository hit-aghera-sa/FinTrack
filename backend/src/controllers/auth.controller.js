const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/asyncErrorHandler");
const AppError = require("../utils/appError");
const sendEmail = require("../utils/email");
const crypto = require("crypto");

const createToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const sendToken = (user, statusCode, res) => {
  const token = createToken({ id: user._id });

    res.cookie("jwt", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(Date.now() + 90*24*60*60*1000)
    });


  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    data: user
  });
};


const signUp = catchAsync(async(req, res, next) => {

    const {name, email, password, passwordConfirm, passwordChangedAt, role} = req.body;
    
    if (typeof name !== "string") {
        return next(new AppError("name must be a string", 400));
    }
    
    if(!name || !email || !password || !passwordConfirm){
        return next(new AppError("All fields are required", 400))
    }

    const newUser = await User.create({name, email, password, passwordConfirm, passwordChangedAt, role});
    sendToken(newUser, 201, res);    
})

const login = catchAsync( async (req, res, next) => {

    const {email, password} = req.body;

    if(!email || !password){
        return next(new AppError("Please provide email and password", 400))
    }

    // this will not include password, so add it
    const user = await User.findOne({email}).select("+password");
    if(!user || !(await user.comparePassword(password, user.password))){
        return next( new AppError("Incorrect email or password", 401))
    }
    sendToken(user, 200, res);
})

const forgotPassword = catchAsync( async (req, res, next) => {
    const email = req.body?.email;
    if(!email) return next(new AppError("email is required", 400));

    const findUser = await User.findOne({email});
    if(!findUser) return next(new AppError(`User not found for email: ${email}`, 404));

    const resetToken = await findUser.createResetToken();
    await findUser.save({ validateBeforeSave: false });

    // const resetPasswordUrl = `${req.protocol}://${req.get("host")}/api/user/resetPassword/${resetToken}`;
    const resetPasswordUrl = `http://localhost:4200/reset-password/${resetToken}`;
    const message = `forgot password? submit patch request with password and confirmPassword on ${resetPasswordUrl}\n if you didn't forgot password then ignore this mail`;

    try{
        await sendEmail({
            email: findUser.email,
            subject: "url to reset password (valid for 10 minutes)",
            message
        })
        return res.status(200).json({status: "success", message: `url to reset token sent to your email ${findUser.email}`})
    }
    catch(error){
        findUser.passwordResetToken = undefined;
        findUser.passwordResetTokenExpire = undefined;
        
        await findUser.save({validateBeforeSave: false});
        console.log(error);
        return next(new AppError("something went wrong while sending email", 500));
    }
    
})

const resetPassword = catchAsync( async (req, res, next) => {

    // 1) hash the raw resetToken
    const hashedResetToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    // 2) find user by hashed resetToken and resetToken has not expired
    const findUser = await User.findOne({passwordResetToken: hashedResetToken, passwordResetTokenExpire: {$gt: Date.now()}});
    if(!findUser) return next( new AppError("token is invalid or Expired", 400));

    if(!req.body) return next(new AppError("req body is undefined", 400))
    const {password, passwordConfirm} = req.body;
    if(!password || !passwordConfirm) return next( new AppError("password and passwordConfirm both are required", 400));

    findUser.password = req.body.password;
    findUser.passwordConfirm = req.body.passwordConfirm;
    findUser.passwordResetToken = undefined;
    findUser.passwordResetTokenExpire = undefined;
    await findUser.save();

    // 3) update passwordChangedAt field (in user.model.js)

    // 4) send new JWT token and send res
    sendToken(findUser, 201, res);
})

const updatePassword = catchAsync( async(req, res, next) => {    
    const findUser = await User.findById(req.user.id).select("+password");

    if(!(await findUser.comparePassword(req.body.currentPassword, findUser.password))){
        return next(new AppError("Invalid currentPassword please try again", 401));
    }
    findUser.password = req.body.newPassword;
    findUser.passwordConfirm = req.body.newPasswordConfirm;
    await findUser.save();

    sendToken(findUser, 201, res);
})

const logout = (req, res) => {
  res.cookie("jwt_cookie", "", {
    httpOnly: true,
    secure: false, 
    sameSite: "lax",
    expires: new Date(0)   // delete cookie
  });

  res.status(200).json({ status: "success", message: "Logged out" });
};

module.exports = {signUp, login, logout, forgotPassword, resetPassword, updatePassword};