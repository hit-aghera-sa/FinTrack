const express = require("express");
const {getAllCategories, getCategory, getMyCategory, createCategory, updateCategory, deleteCategory} = require("../controllers/category.controller");
const { protect, restrictTo} = require("../middlewares/auth.middleware");
const router = express.Router();

router.use(protect);

router
    .get("/", getMyCategory)
    .post("/", createCategory)
    .patch("/:id", updateCategory)
    .delete("/:id", deleteCategory)

router.use(restrictTo("admin"));

router
    .get("/getAll", getAllCategories)
    .get("/:id", getCategory)

module.exports = router;