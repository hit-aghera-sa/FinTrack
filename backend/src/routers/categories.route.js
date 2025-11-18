const express = require("express");
const {getAllCategories, getCategory, createCategory, updateCategory} = require("../controllers/category.controller");
const { protect, restrictTo} = require("../middlewares/auth.middleware");
const Router = express.Router();

Router
    .get("/getAllCategories", protect, restrictTo("admin"), getAllCategories)
    .get("/getCategory", protect, getCategory)
    .post("/createCategory", protect, createCategory)
    .patch("/updateCategory", updateCategory)

module.exports = Router;