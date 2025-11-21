const multer = require("multer")
const path = require("path")
const fs = require("fs")
const AppError = require("../utils/appError")

const allowedFileTypes = ["image/jpg", "image/jpeg", "image/png", "image/webp", "application/pdf"]

const fileFilter = (req, file, cb) => {
    if( allowedFileTypes.includes(file.mimetype)) cb(null, true);
    else cb(new AppError("file type must be JPG, JPEG, PNG, WEBP, PDF", 400), false);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user.id
        const transactionId = req.params.transactionId
        const uploadPath = path.join(
            __dirname, "..","uploads", "transactions", userId, transactionId
        )

        fs.mkdirSync(uploadPath, {recursive: true})
        cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
        const userId = req.user.id
        const transactionId = req.params.transactionId
        const ext = path.extname(file.originalname)
        
        const filename = `${userId}-${transactionId}-${Date.now()}${ext}`;
        
        cb(null, filename);
    }
})

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    }
})

module.exports = upload 