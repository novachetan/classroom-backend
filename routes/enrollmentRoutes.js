const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const router = express.Router();


router.post(  "/join",  authMiddleware,  asyncHandler(async (req, res) => {
        const { code } = req.body;
        const userId = req.user.id;

        if (typeof code !== "string" || !code.trim()) {
            throw new AppError("Course join code is required", 400);
        }

        const course = await Course.findOne({
            code: code.trim().toUpperCase(),
            isArchived: false
        });

        if (!course) {
            throw new AppError("Invalid course join code", 404);
        }

        if (course.owner.toString() === userId.toString()) {
            throw new AppError(
                "Course owner cannot join their own course as a student",
                400
            );
        }

        // Prevent duplicate enrollment requests
        const existingEnrollment = await Enrollment.findOne({
            user: userId,
            course: course._id
        });

        if (existingEnrollment) {
            throw new AppError("You have already joined or requested to join this course", 409); 
        }

        const enrollment = await Enrollment.create({
            user: userId,
            course: course._id,
            role: "student",
            status: "pending"
        });

        res.status(201).json({
            success: true,
            message: "Enrollment request submitted successfully",
            enrollment
        });
    })
);
    
// APPROVE OR REJECT STUDENT ENROLLMENT
// PATCH /api/enrollments/:courseId/requests/:enrollmentId

router.patch(
    "/:courseId/requests/:enrollmentId",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { courseId, enrollmentId } = req.params;
        const userId = req.user.id;
        const { status } = req.body;

        // Validate MongoDB IDs
        if ( !mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(enrollmentId) ) 
            {
            throw new AppError("Invalid course or enrollment ID", 400);
        }

        // Validate requested status
        if (!["approved", "rejected"].includes(status)) {
            throw new AppError("Status must be approved or rejected", 400);
        }

        // Find the course
        const course = await Course.findById(courseId);

        if (!course || course.isArchived) {
            throw new AppError("Course not found", 404);
        }

        // Only the course owner can approve or reject requests
        if (course.owner.toString() !== userId.toString()) {
            throw new AppError( "Only the course owner can manage enrollment requests", 403);
        }

        // Find a pending student enrollment for this course
        const enrollment = await Enrollment.findOne({
            _id: enrollmentId,
            course: courseId,
            role: "student",
            status: "pending"
        });

        if (!enrollment) {
            throw new AppError("Pending student enrollment not found", 404);
        }

        // Update the enrollment status
        enrollment.status = status;
        await enrollment.save();

        res.status(200).json({
            success: true,
            message: `Enrollment ${status} successfully`,
            enrollment
        });
    })
);


// GET PENDING ENROLLMENT REQUESTS FOR A COURSE (OWNER ONLY)
// GET /api/enrollments/:courseId/requests
router.get(
    "/:courseId/requests",
    authMiddleware,
    asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const userId = req.user.id;

        if (!mongoose.isValidObjectId(courseId)) {
            throw new AppError("Invalid course ID", 400);
        }

        const course = await Course.findById(courseId);
        if (!course || course.isArchived) {
            throw new AppError("Course not found", 404);
        }

        // Only the course owner can view enrollment requests
        if (course.owner.toString() !== userId.toString()) {
            throw new AppError("Only the course owner can manage enrollment requests", 403);
        }

        const requests = await Enrollment.find({
            course: courseId,
            role: "student",
            status: "pending"
        })
            .populate("user", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: requests.length,
            requests
        });
    })
);

router.get(
    "/my",
    authMiddleware,
    asyncHandler(async (req, res) => {

        const enrollments = await Enrollment.find({
            user: req.user.id,
            role: "student"
        })
        .populate({
            path: "course",
            select: "name section subject room code description owner isArchived",
            populate: {
                path: "owner",
                select: "name email"
            }
        })
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: enrollments.length,
            enrollments
        });
    })
);

module.exports = router;





