const express = require("express");
const {signUp, login, forgotPassword, resetPassword, updatePassword } = require("../controllers/auth.controller");
const { protect, restrictTo} = require("../middlewares/auth.middleware");
const { getAllUsers, getUser, updateMe, deleteMe, deleteUser} = require("../controllers/user.controller");
const {signupLimiter, loginLimiter, forgotLimiter} = require("../utils/rateLimitor")

const Router = express.Router();

Router
    .get("/getAllUsers", protect, restrictTo("admin"), getAllUsers)
    .get("/getUser/:id", protect, restrictTo("admin"),getUser)
    .post("/signUp", signupLimiter, signUp)
    .post("/login", loginLimiter, login)
    .post("/forgotPassword", forgotLimiter,forgotPassword)
    .patch("/resetPassword/:token", resetPassword)
    .patch("/updatePassword", protect, updatePassword)
    .patch("/updateMe", protect, updateMe)
    .delete("/deleteMe",protect, deleteMe)
    .delete("/deleteUser/:id", protect, restrictTo("admin"),deleteUser)
    
module.exports = Router;