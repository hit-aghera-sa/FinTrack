require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./config/db");

connectDB();

const port = process.env.PORT || 5001;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// HANDLE UNCAUGHT EXCEPTIONS
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err);
  process.exit(1);
});

// HANDLE UNHANDLED PROMISE REJECTIONS
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! Shutting down server...");
  console.error(err);
  server.close(() => process.exit(1));
});
