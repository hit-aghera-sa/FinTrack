require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./config/db');
const logger = require('./src/utils/logger');

// Connect to database
connectDB();

const port = process.env.PORT || 5001;

const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down server...');
  logger.error(err.stack || err);
  server.close(() => process.exit(1));
});
