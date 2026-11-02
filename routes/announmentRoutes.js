const express = require("express");
const mongoose = require("mongoose");

const Announcement = require("../models/Announcement");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");

const { authMiddleware } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const router = express.Router();

// CREATE ANNOUNCEMENT
router.post(
    "/course/:courseId",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const { content } = req.body;

        // 1. Validate course ID
        if (!mongoose.isValidObjectId(courseId)) {
            throw new AppError("Invalid course ID", 400);
        }

        // 2. Validate announcement content
        if (
            typeof content !== "string" ||
            !content.trim() ||
            content.trim().length > 10000
        ) {
            throw new AppError(
                "Announcement content is required and must not exceed 10000 characters",
                400
            );
        }

        // 3. Find classroom
        const course = await Course.findById(courseId);

        if (!course) {
            throw new AppError("Classroom not found", 404);
        }

        if (course.isArchived) {
            throw new AppError(
                "Cannot create announcements in an archived classroom",
                403
            );
        }

        // 4. Verify owner or co-teacher permissions
        const userId = req.user.id;

        const isOwner = course.owner.toString() === userId;

        const isCoTeacher = course.coTeachers.some(
            (teacherId) => teacherId.toString() === userId
        );

        if (!isOwner && !isCoTeacher) {
            throw new AppError(
                "Only the classroom owner or an authorized co-teacher can create announcements",
                403
            );
        }

        // 5. Create announcement
        const announcement = await Announcement.create({
            course: course._id,
            author: userId,
            content: content.trim(),
        });

        // 6. Populate announcement author
        await announcement.populate("author", "name email");

        // 7. Emit announcement through Socket.IO
        const io = req.app.get("io");

        if (io) {
            io.to(`course:${courseId}:announcements`).emit(
                "announcement:created",
                { announcement }
            );
        }

        // 8. Send response
        res.status(201).json({
            success: true,
            message: "Announcement created successfully",
            announcement,
        });
    })
);


// GET ALL ANNOUNCEMENTS FOR A CLASSROOM
// GET /api/announcements/course/:courseId

router.get(
    "/course/:courseId",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { courseId } = req.params;

        if (!mongoose.isValidObjectId(courseId)) {
            throw new AppError("Invalid course ID", 400);
        }

        const course = await Course.findById(courseId);

        if (!course || course.isArchived) {
            throw new AppError("Classroom not found", 404);
        }

        const userId = req.user.id;

        const isOwner = course.owner.toString() === userId;

        const isCoTeacher = course.coTeachers.some(
            (teacherId) => teacherId.toString() === userId
        );

        // Check if student is enrolled and approved
        const enrollment = await Enrollment.findOne({
            user: userId,
            course: courseId,
            role: "student",
            status: "approved",
        });

        if (!isOwner && !isCoTeacher && !enrollment) {
            throw new AppError(
                "You do not have permission to view announcements for this classroom",
                403
            );
        }

        const announcements = await Announcement.find({
            course: courseId,
        })
            .populate("author", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: announcements.length,
            announcements,
        });
    })
);

module.exports = router;