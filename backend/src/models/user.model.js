const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, "name is required"],
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
        enum: {
            values: ["admin", "user"],
            message: "user role must be user or admin"
        },
        default: "user"
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetTokenExpire: Date,
    active:{
        type: Boolean,
        default: true,
        select: false
    }
},
{
    timestamps: true
}
);

// password hashing
UserSchema.pre('save', async function(next){
    // if password not changed then don't ecrypt again (isMofified trigger by create and update)
    if(!this.isModified("password")) return next();

    // this encrypt only new and changed password
    this.password = await bcrypt.hash(this.password, 12);

    this.passwordConfirm = undefined;
    next()                  //never forget next() while using pre - post middleware
});

UserSchema.pre('save', async function(next){
    // if password not modified or new document not created
    if(!this.isModified("password") || this.isNew) return next()

    this.passwordChangedAt = Date.now() - 1000;
    next()
})

UserSchema.pre(/^find/, async function(next){
    this.find({active: {$ne: false}});
    next();
})

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

UserSchema.methods.createResetToken = async function(){
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // valid for 10 minutes after created
    this.passwordResetTokenExpire = Date.now() + 10 * 60 * 1000;

    return resetToken;
}


const User = mongoose.model("User", UserSchema);

module.exports = User;