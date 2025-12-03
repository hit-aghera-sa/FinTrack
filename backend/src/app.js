const express = require('express');
const userRoute = require('./routers/users.route.js');
const categoryRoute = require('./routers/categories.route.js');
const transactionRoute = require('./routers/transactions.route.js');
const attachmentRoute = require('./routers/attechments.route.js');
const AppError = require('./utils/appError.js');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('./utils/logger');

const app = express();

/* -------------------- COOKIE PARSER -------------------- */
app.use(cookieParser());

/* -------------------- EXPRESS 5 SAFE CORS -------------------- */
app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* -------------------- API ROUTES -------------------- */
app.use('/api/user', userRoute);
app.use('/api/category', categoryRoute);
app.use('/api/transaction', transactionRoute);
app.use('/api/attachment', attachmentRoute);

/* -------------------- 404 -------------------- */
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});

/* -------------------- GLOBAL ERROR HANDLER -------------------- */
app.use((err, req, res) => {
  // Log the error with winston
  logger.error(
    `${err.statusCode || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );
  logger.error(err.stack);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      status: 'error',
      message: `Validation error: ${messages.join('. ')}`
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token. Please log in again!'
    });
  }

  // Handle token expiration
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Your token has expired! Please log in again.'
    });
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      status: 'error',
      message: `Duplicate field value: ${field}. Please use another value!`
    });
  }

  // Handle other errors
  return res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
