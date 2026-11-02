const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const mongoose = require("mongoose");

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");

const initializeAnnouncementSocket = (io) => {

    // 1. Socket authentication middleware
    io.use((socket, next) => {
        try {
            const cookieHeader = socket.handshake.headers.cookie;

            if (!cookieHeader) {
                return next(new Error("Authentication required"));
            }

            const cookies = cookie.parse(cookieHeader);
            const accessToken = cookies.accessToken;

            if (!accessToken) {
                return next(new Error("Access token missing"));
            }

            const decoded = jwt.verify(
                accessToken,
                process.env.JWT_SECRET
            );

            if (!decoded.id) {
                return next(new Error("Invalid authentication token"));
            }

            // Attach authenticated user to socket
            socket.user = {
                id: decoded.id
            };

            next();

        } catch (error) {
            next(new Error("Unauthorized socket connection"));
        }
    });


    // 2. Handle authenticated connections
    io.on("connection", (socket) => {

        console.log("Announcement socket connected:", socket.id);

        // 3. Join classroom announcement room
        socket.on("join:classroom", async (courseId, callback) => {

            try {

                // Validate course ID
                if (!mongoose.isValidObjectId(courseId)) {
                    throw new Error("Invalid classroom ID");
                }

                const userId = socket.user.id;

                // Find classroom
                const course = await Course.findById(courseId);

                if (!course || course.isArchived) {
                    throw new Error("Classroom not found");
                }

                // Check classroom owner
                const isOwner =
                    course.owner.toString() === userId;

                // Check co-teacher
                const isCoTeacher = course.coTeachers.some(
                    (teacherId) => teacherId.toString() === userId
                );

                // Check approved student enrollment
                const enrollment = await Enrollment.findOne({
                    user: userId,
                    course: courseId,
                    role: "student",
                    status: "approved"
                });

                if (!isOwner && !isCoTeacher && !enrollment) {
                    throw new Error("You cannot access this classroom");
                }

                // Join authorized announcement room
                const roomName =
                    `course:${courseId}:announcements`;

                await socket.join(roomName);

                if (typeof callback === "function") {
                    callback({
                        success: true,
                        message: "Joined classroom announcement room"
                    });
                }

            } catch (error) {

                if (typeof callback === "function") {
                    callback({
                        success: false,
                        message: error.message
                    });
                }

            }

        });


        // 4. Handle disconnection
        socket.on("disconnect", (reason) => {
            console.log(
                "Announcement socket disconnected:",
                socket.id,
                reason
            );
        });

    });

};

module.exports = initializeAnnouncementSocket;