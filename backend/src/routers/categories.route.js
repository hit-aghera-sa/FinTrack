const express = require("express");
const {getAllCategories, getCategory, getMyCategory, createCategory, updateCategory, deactiveCategory} = require("../controllers/category.controller");
const { protect, restrictTo} = require("../middlewares/auth.middleware");
const router = express.Router();

router.use(protect);

router
    .get("/", getMyCategory)
    .post("/", createCategory)
    .patch("/:id", updateCategory)
    .delete("/:id", deactiveCategory)

router.use(restrictTo("admin"));

router
    .get("/all", getAllCategories)
    .get("/admin/:id", getCategory)

module.exports = router;