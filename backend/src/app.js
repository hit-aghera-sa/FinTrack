const express = require("express");
const userRoute = require("./routers/users.route.js");
const categoryRoute = require("./routers/categories.route.js");
const transactionRoute = require("./routers/transactions.route.js");
const attachmentRoute = require("./routers/attechments.route.js");
const AppError = require("./utils/appError.js");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// Parse cookies FIRST
app.use(cookieParser());

// CORS (Express 5-friendly)
app.use(cors({
  origin: "http://localhost:4200",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body parser
app.use(express.json());

// Helmet (must disable CORP for local dev)
app.use(helmet({
  crossOriginResourcePolicy: false
}));

// Routes
app.use("/api/user", userRoute);
app.use("/api/category", categoryRoute);
app.use("/api/transaction", transactionRoute);
app.use("/api/attachment", attachmentRoute);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);

  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message || "something went wrong"
  });
});

module.exports = app;
