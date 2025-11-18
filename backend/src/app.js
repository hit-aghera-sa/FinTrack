const express = require("express");
const userRoute = require("./routers/users.route.js");
const AppError = require("./utils/appError.js");
const helmet = require("helmet");
const app = express();

app.use(express.json());
// add http security headers
app.use(helmet());

app.use("/api/user", userRoute);

// handle unhandled api call
app.use((req, res, next) => {
  next( new AppError(`can't find ${req.originalUrl}`, 404))
})

// global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  
  // jwt invalid token
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      status: "fail", 
      message: "Invalid token. Please login again"
    })
  }

  // jwt expired token
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "fail",
      message: "Token expired. Login Again"
    })
  }

  // duplicate field in mongodb
  if (err.code === 11000) {
    return res.status(400).json({
      status: "fail",
      message: "Email already exist"
    });
  }

  // programming errors
  if(!err.isOperational){
    console.log("UNEXPECTED ERROR: ", err);
    return res.status(500).json({
      status: "error",
      message: "something went wrong"
    })
  }
  
  // uncaught errors
  res.status(err.statusCode || 500).json({
    status: err.status,
    message: err.message
  });
  
});

module.exports = app;