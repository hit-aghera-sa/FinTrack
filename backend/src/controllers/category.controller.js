const Category = require("../models/category.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");
const filterFields = (obj, ...allfields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if(allfields.includes(el)){
            newObj[el] = [el];
        }
        return newObj;
    })
}

const createCategory = catchAsync( async (req, res, next) => {
    const {name, type} = req.body;
    const userId = req.user.id

    if (typeof name !== "string") {
        return next(new AppError("name must be a string", 400));
    }

    if(!name|| !type) next(new AppError("name and type both are required", 400));

    const newCategory = await Category.create({name, type, userId});
    res.status(201).json({status: "success", data: newCategory});
})

const getAllCategories = catchAsync( async (req, res, next) => {
    const allCategory = await Category.find();
    
    if(allCategory.length === 0) return next( new AppError("category not found", 404));

    res.status(200).json({status: "success", data: allCategory});
})

const getCategory = catchAsync( async (req, res, next) => {
    const categoryId = req.params.id;
    if(!categoryId) return next(new AppError("categoryId not found", 404));
    
    const category = await Category.findById(categoryId);
    if(!category) return next(new AppError("category not found", 404));

    res.status(200).json({status: "success", data: category});
})

const updateCategory =  catchAsync( async (req, res, next) => {
    const categoryId = req.params.id;
    if(!categoryId) return next(new AppError("categoryId not found", 404));
    
    const category = await Category.findById(categoryId);
    console.log(category);
    if(category.userId.toString() !== req.user.id){
        return next (new AppError("only owner of this category can update this category", 401)) 
    }
        
    const filteredBody = filterFields(req.body, "name", "type");
    const updatedCategory = await Category.findByIdAndUpdate(
        categoryId,
        filteredBody,
        {new: true, runValidators: true}
    );
    if(!updatedCategory) return next(new AppError("category not found", 404));

    res.status(200).json({status: "success", data: category});
})

module.exports = {getAllCategories, getCategory, createCategory, updateCategory};