import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import connectDB from "./database/connection.js"
import shareRoutes from "./routes/shares.js"
import fileRoutes from "./routes/files.js"
import { setupSocketHandlers } from "./socket/handlers.js"
import { startCleanupJob } from "./utils/cleanup.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)

// Configure Socket.IO with proper CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://qrlwr7st-5173.inc1.devtunnels.ms"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: false,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
})

// Add middleware to better capture client IP
io.use((socket, next) => {
  // Try to get the real client IP from various sources
  const forwarded = socket.handshake.headers["x-forwarded-for"]
  const realIP = socket.handshake.headers["x-real-ip"]
  const remoteAddress = socket.conn.remoteAddress
  const socketAddress = socket.handshake.address

  // Priority order: x-real-ip, first x-forwarded-for, remoteAddress, handshake.address
  const clientIP = realIP || (forwarded ? forwarded.split(",")[0].trim() : null) || remoteAddress || socketAddress

  // Store the detected IP on the socket for later use
  socket.clientIP = clientIP
  next()
})

// Configure Express CORS
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://qrlwr7st-5173.inc1.devtunnels.ms"],
    credentials: false,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Body parsing middleware
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Handle preflight requests
app.options("*", cors())

// Create uploads directory
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use("/uploads", express.static(uploadsDir))

// Connect to database
await connectDB()

// Setup socket handlers
setupSocketHandlers(io)

// Start cleanup job
startCleanupJob()

// API routes
app.use("/api/shares", shareRoutes)
app.use("/api/files", fileRoutes)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
})

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "ShareFlow API Server",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      shares: "/api/shares",
      files: "/api/files",
    },
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err)
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  })
})

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
  })
})

export { io }
