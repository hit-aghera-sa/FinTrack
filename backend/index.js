const app = require("./server.js")
const userRoute = require("./routers/users.route.js");
const AppError = require("./utils/appError.js");


app.use("/api/user", userRoute)

// global error handler

app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  
  // signup using same email
  if (err.code === 11000) {
    return res.status(400).json({status: "fail", message: "Email already exists"});
  }

  if(!err.isOperational){
    console.log("something went wrong");
    return res.status(500).json({status: "error", message: "something went wrong"})
  }

  res.status(err.statusCode).json({status: err.status, message: err.message});
});

app.use((req, res, next) => {
    next( new AppError(`can't find ${req.originalUrl}`, 404))
})

// server listening
const port = process.env.PORT || 5001;

app.listen(port, () => {
    console.log(`server running sucessfully on ${port}`);
})
