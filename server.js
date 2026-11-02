require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");


const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/database");

// Routes
const initializeAnnouncementSocket = require("./sockets/announcementsSocket");
const userRoutes = require("./routes/userRoutes");
const courseRoutes = require("./routes/courseRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const announcementRoutes = require("./routes/announmentRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");


// Middleware
const { errorHandler } = require("./middleware/errorMiddleware");


const app = express();

// Security headers
app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

// CORS configuration
const corsOptions = {
    origin: (
        process.env.FRONTEND_ORIGINS ||
        process.env.FRONTEND_ORIGIN ||
        "http://localhost:5173,http://127.0.0.1:5173"
    )
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    credentials: true,
};

app.use(cors(corsOptions));

// Body and cookie parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Student Management API is running",
    });
});

// Existing routes
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/assignments", assignmentRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot find ${req.method} ${req.originalUrl}`,
    });
});

// Error handler
app.use(errorHandler);

// Create the HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
    cors: corsOptions,
});

// Make Socket.IO accessible to Express routes
 app.set("io", io);
initializeAnnouncementSocket(io);
// Socket connection lifecycle
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", socket.id, reason);
    });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectDB();

    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log("Socket.IO is ready");
    });
};

startServer().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
});

module.exports = { app, httpServer, io };