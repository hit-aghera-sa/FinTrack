const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/asyncErrorHandler");
const AppError = require("../utils/appError");
const sendEmail = require("../utils/email");
const crypto = require("crypto");

const createToken = async(payload) => {
    return await jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: "30d"})
}

const sendToken = async (user, statusCode, res) => {
    const token = await createToken({id: user._id});

    res.cookie("jwt_cookie",
        token,
        {
            expiresIn: new Date(Date.now + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
            // secure: true,
            httpOnly: true
        }
    )
    res.status(statusCode).json({
        status: "success",
        token: token,
        data: user
    });
}

const signUp = catchAsync(async(req, res, next) => {

    const {name, email, password, passwordConfirm, passwordChangedAt, role} = req.body;
    
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
    const findUser = await User.findOne({email}).select("+password");
    if(!findUser || !(await findUser.comparePassword(password, findUser.password))){
        return next( new AppError("Incorrect email or password", 401))
    }

    sendToken(findUser, 201, res);
})


const forgotPassword = catchAsync( async (req, res, next) => {
    const email = req.body?.email;
    if(!email) return next(new AppError("email is required", 400));

    const findUser = await User.findOne({email});
    if(!findUser) return next(new AppError(`User not found for email: ${email}`, 404));

    const resetToken = await findUser.createResetToken();
    await findUser.save({ validateBeforeSave: false });

    const resetPasswordUrl = `${req.protocol}://${req.get("host")}/api/user/resetPassword/${resetToken}`;
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

module.exports = {signUp, login, forgotPassword, resetPassword, updatePassword};