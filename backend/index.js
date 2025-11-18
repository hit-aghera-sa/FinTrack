const app = require("./server.js");
const userRoute = require("./routers/users.route.js");
const AppError = require("./utils/appError.js");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSenitize = require("express-mongo-sanitize");
const xss = require("xss-clean")

// add http security headers
app.use(helmet());

// limit requests from same api
const limiter = rateLimit({
  // 30 api call allowed withing one hour
  limit: 30,
  windowMs: 60*60*1000,
  message: "too many requests from this IP, please try again after 1 hours"
})

// data sanitization against NoSql query injection
app.use(mongoSenitize());

// data sanitization against xss 
app.use(xss())

app.get("/testapi", limiter, (req, res) => {
  res.status(200).json({status: "success", message: "api working"})
})

app.use("/api/user", userRoute)

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
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message
  });
  
});

// server listening
const port = process.env.PORT || 5001;
app.listen(port, () => {
    console.log(`server running sucessfully on ${port}`);
})
