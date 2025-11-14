const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/asyncErrorHandler");
const AppError = require("../utils/appError");

const createToken = async(payload) => {
    return await jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: "30d"})
}

const signUp = catchAsync(async(req, res, next) => {

    const {name, email, password, passwordConfirm, passwordChangedAt, role} = req.body;
    
    if(!name || !email || !password || !passwordConfirm || !role){
        return next(new AppError("All fields are required", 400))
    }
    
    const newUser = await User.create({name, email, password, passwordConfirm, passwordChangedAt, role});
    const token = await createToken({id: newUser._id});
    
    res.status(201).json({status: "success", token: token,data: newUser});
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

    const token = await createToken({id: findUser._id});
    res.status(201).json({status: "success", jwt_token: token,data: findUser});
    
})

module.exports = {signUp, login};