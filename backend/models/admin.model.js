const mongoose = require("mongoose");
const validator = require("validator");

const AdminSchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, "Name is required"]
    },
    email:{
        type: String,
        required: [true, "Email address is required"],
        unique: true,
        lowercase: true,       // auto convert email to lowercase
        validate: [validator.isEmail, "plese provide valid email"] 
    },
    password:{
        type: String,
        minlength: 8,
        required: [true, "Password is required"]
    },
    passwordConfirm:{
        type: String,
        minlength: 8,
        required: [true, "PasswordConfirm is required"]
    }
})

const Admin = mongoose.model("Admin", AdminSchema);

module.exports = Admin;