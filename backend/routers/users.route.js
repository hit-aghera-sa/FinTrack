const express = require("express");
const {signUp, login} = require("../controllers/auth.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const { getAllUsers, deleteUser } = require("../controllers/user.controller");

const Router = express.Router();

Router
    .post("/signUp", signUp)
    .post("/login", login)
    .get("/getAllUsers", protect, getAllUsers)
    .delete("/deleteUser/:id", protect, restrictTo("admin"),deleteUser)

module.exports = Router;