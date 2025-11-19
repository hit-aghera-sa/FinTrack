const Category = require("../models/category.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");
const filterFields = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if(allowedFields.includes(el)){
            newObj[el] = obj[el];
        }
    })
    return newObj;
}

const createCategory = catchAsync( async (req, res, next) => {
    const {name, type} = req.body;
    const userId = req.user.id

    if(!name || !type){ 
        return next(new AppError("name and type both are required", 400))
    };

    if (typeof name !== "string") {
        return next(new AppError("category name must be a string", 400));
    }

    if (typeof type !== "string") {
        return next(new AppError("category type must be a string", 400));
    }

    const trimmedName = name.trim();
    const trimmedType = type.trim();

    const isCategoryExist = await Category.findOne({name: trimmedName, userId});

    if(isCategoryExist) return next(new AppError("category allready exists", 400))

    const newCategory = await Category.create({name: trimmedName, type: trimmedType, userId});

    res.status(201).json({status: "success", data: newCategory});
})

const getAllCategories = catchAsync( async (req, res, next) => {
    const allCategory = await Category.find();
    
    if(allCategory.length === 0) return next( new AppError("category not found", 404));

    res.status(200).json({status: "success", data: allCategory});
})

const getMyCategory = catchAsync( async (req, res, next) => {
    const category = await Category.find({userId: req.user.id});
    if(category.length === 0) return next( new AppError("category not found", 404));

    res.status(200).json({status: "success", data: category});
})

const getCategory = catchAsync( async (req, res, next) => {
    const categoryId = req.params.id;
    if(!categoryId) return next(new AppError("categoryId not provided", 404));

    // user can access user's own category only
    const category = await Category.findOne({_id: categoryId, userId: req.user.id})
    if(!category) return next(new AppError("category not found", 404))

    res.status(200).json({status: "success", data: category});
})

const updateCategory = catchAsync( async(req, res, next) => {
    const categoryId = req.params.id;

    if(!categoryId){ 
        return next(new AppError("categoryId not provided", 404));
    }
    
    const filteredBody = filterFields(req.body, "name", "type");

    const category = await Category.findOneAndUpdate(
        {_id: categoryId, userId: req.user.id},
        filteredBody,
        {new: true, runValidators: true}
    )

    if (!category) {
        return next(new AppError("Category not found or not allowed", 404));
    }

    res.status(200).json({status: "success", data: category});
})

const deleteCategory = catchAsync( async (req, res, next) => {
    const categoryId = req.params.id;
    
    if(!categoryId){ 
        return next(new AppError("categoryId not provided", 404));
    }

    const category = await Category.findOneAndUpdate(
        {_id: categoryId, userId: req.user.id},
        {active: false},
        {new: true}
    )    
    console.log(`categoryId: ${categoryId} and userId: ${req.user.id} category: ${category}`);
    if(!category) return next(new AppError("category not found", 404))

    res.status(200).json({status: "success", data: category});
})

module.exports = {getAllCategories, getCategory, getMyCategory, createCategory, updateCategory, deleteCategory};