const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, "name is required"]
    },
    email:{
        type: String,
        required: [true, "email address is required"],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, "plese provide valid email"]
    },
    password:{
        type: String,
        minlength: 8,
        required: [true, "password is required"],
        select: false             //means: dont return password in respose of find query like find(), findById(), findOne(), etc
    },
    passwordConfirm:{
        type: String,
        minlength: 8,
        required: [true, "passwordConfirm is required"],
        validate: {
            validator: function(el){
                return el === this.password;          //el refer to passwordConfirm
            },
            message: "password do not match"
        }
    },
    role:{
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    passwordChangedAt: Date,
});

// password hashing
UserSchema.pre('save', async function(next){
    // if password not changed then don't ecrypt again (isMofified trigger by create and update)
    if(!this.isModified("password")) return next();

    // this encrypt only new and changed password
    this.password = await bcrypt.hash(this.password, 12);

    this.passwordConfirm = undefined;
    next()                  //never forget next() while using pre - post middleware
});

// password veridication
UserSchema.methods.comparePassword = async function(clientPassword, hashedPassword){
    return await bcrypt.compare(clientPassword, hashedPassword);
}

// check password changed after login
UserSchema.methods.isPasswordChange = async function(loginTime){
    
    if (this.passwordChangedAt){
        const convertedDate = parseInt(
            this.passwordChangedAt.getTime() / 1000
        , 10)
        return loginTime < convertedDate;
    }   
    return false;
}

const User = mongoose.model("User", UserSchema);

module.exports = User;