const express = require("express");
const userRoute = require("./routers/users.route.js");
const categoryRoute = require("./routers/categories.route.js");
const transactionRoute = require("./routers/transactions.route.js");
const attachmentRoute = require("./routers/attechments.route.js");
const AppError = require("./utils/appError.js");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

/* -------------------- COOKIE PARSER -------------------- */
app.use(cookieParser());

/* -------------------- EXPRESS 5 SAFE CORS -------------------- */
app.use(
  cors({
    origin: "http://localhost:4200",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* -------------------- JSON PARSER -------------------- */
app.use(express.json());

/* -------------------- HELMET -------------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

/* -------------------- STATIC UPLOADS -------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------- API ROUTES -------------------- */
app.use("/api/user", userRoute);
app.use("/api/category", categoryRoute);
app.use("/api/transaction", transactionRoute);
app.use("/api/attachment", attachmentRoute);

/* -------------------- 404 -------------------- */
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});

/* -------------------- GLOBAL ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
  console.error("Error:", err);

  return res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message || "something went wrong"
  });
});

module.exports = app;
