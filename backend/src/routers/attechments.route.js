const express = require("express");
const {uploadAttachment, updateAttachment, deleteAttachment} = require("../controllers/attachment.controller");
const {protect} = require("../middlewares/auth.middleware")
const upload = require("../middlewares/upload.middleware")
const router = express.Router();

router.use(protect);

router
    .post("/transaction/:transactionId", upload.array("files", 5), uploadAttachment)
    .delete("/transaction/:transactionId/:index", deleteAttachment)
    .patch("/transaction/:transactionId/:index", upload.single("file"), updateAttachment);
    
module.exports = router;
