const express = require("express");
const {signUp, login} = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const { getAllUsers } = require("../controllers/user.controller");


const Router = express.Router();

Router
    .post("/signUp", signUp)
    .post("/login", login)
    .get("/getAllUsers", protect, getAllUsers)

module.exports = Router;