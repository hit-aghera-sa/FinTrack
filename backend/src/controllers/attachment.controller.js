const Transaction = require("../models/transaction.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/asyncErrorHandler");
const path = require("path");
const fs = require("fs");

const uploadAttachment = catchAsync( async ( req, res, next) => {
  const userId = req.user.id;
  const transactionId = req.params.transactionId;

  if(!req.files || req.files.length === 0) return next( new AppError("no files uploaded", 400))

  const filePaths = req.files.map( file => {
    return  `/uploads/transactions/${userId}/${transactionId}/${file.filename}`
  })

  const transaction = await Transaction.findOne({_id: transactionId, userId});
  if(!transaction) return next( new AppError("transaction not found or not allowed", 404))

  transaction.attachments.push( ...filePaths);
  await transaction.save();

  res.status(200).json({status: "success", message: "files upload successfully", data: transaction.attachments})
})

const deleteAttachment = catchAsync( async ( req, res, next) => { 
  const userId = req.user.id;
  const transactionId = req.params.transactionId;
  const index = Number(req.params.index);

  const transaction = await Transaction.findOne({_id: transactionId, userId});
  if(!transaction) return next( new AppError("transaction not found or not allowed", 404))

  if(
    !transaction.attachments ||
    index < 0 ||
    index >= transaction.attachments.length
  ){return next( new AppError("Attachment not found", 404))}

  const filePath = path.join(__dirname, "..", transaction.attachments[index]);

  // remove from server
  await fs.promises.unlink(filePath)

  // remove from database
  transaction.attachments.splice(index, 1);
  await transaction.save();

  res.status(200).json({status: "success", message: "attachment deleted", attachments: transaction.attachments})
})

const updateAttachment = catchAsync( async ( req, res, next) => {
  const userId = req.user.id;
  const transactionId = req.params.transactionId;
  const index = Number(req.params.index);
  
  const transaction = await Transaction.findOne({_id: transactionId, userId});
  if(!transaction) return next( new AppError("transaction not found or not allowed", 404))
    
    if(
      !transaction.attachments ||
      index < 0 ||
    index >= transaction.attachments.length
  ){return next( new AppError("Attachment not found", 404))}

  const oldFilePath = path.join(__dirname, "..", transaction.attachments[index]);

  await fs.unlink(oldFilePath, (err) => {
    console.log(err);
  })

  if (!req.file) {
    return next(new AppError("No file uploaded", 400));
  }

  const newFilePath = `/uploads/transactions/${userId}/${transactionId}/${req.file.filename}`

  transaction.attachments[index] = newFilePath;
  await transaction.save();

  res.status(200).json({status: "success", message: "attachment replaced", attachments: transaction.attachments})
})

module.exports = {uploadAttachment, updateAttachment, deleteAttachment}
