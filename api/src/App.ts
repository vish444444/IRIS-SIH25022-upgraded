import express, { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import http from "http";
import dotenv from "dotenv";

// Load environment variables immediately before other imports
dotenv.config();

import globalErrorHandler from "./controller/utils/globalErrorController";
import { routes } from "./routes/index.route";
import { SocketService } from "./services/websocket/socketService";
import { initializeDatabase } from "./db/database";

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;
const reactAppBaseUrl = process.env.REACT_APP_BASE_URL;

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

// Middleware setup
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: reactAppBaseUrl ? [reactAppBaseUrl] : true,
  })
);
app.use(cookieParser());
app.use(compression());

// Initialize socket service (for future use with receiver data)
const socketService = new SocketService(server);

// Routes (must be after simulation controller initialization)
routes(app);

// Global error handler
app.use(
  globalErrorHandler as unknown as (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => void
);

// Initialize SQLite database and start server
try {
  initializeDatabase();
  console.log("SQLite database ready");
} catch (err) {
  console.error("Failed to initialize database:", err);
}

// Start the server
server.listen(port, () => {
  console.log(`API is running on port ${port} - ${process.env.NODE_ENV}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  console.error("Unhandled Rejection! 💥 Shutting down...");
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
