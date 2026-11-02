const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const Assignment = require("../models/Assignment");
const User = require("../models/User");
const uploadAssignment = require("../middleware/upload");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");


module.exports.assignmentpost =  asyncHandler(async (req, res) => {
        const { title, instructions, dueDate, totalMarks } = req.body;

        const assignmentData = {
            course: req.course._id,
            createdBy: req.user.id,
            title,
            instructions,
            dueDate: dueDate || null,
            totalMarks,
        };

        if (req.uploadedFile) {
            assignmentData.attachment = {
                publicId: req.uploadedFile.publicId,
                url: req.uploadedFile.url,
                originalName: req.uploadedFile.originalName,
                mimeType: req.uploadedFile.mimeType,
                size: req.uploadedFile.size,
            };
        }

        const assignment = await Assignment.create(assignmentData);
        await assignment.populate("createdBy", "name email");

        res.status(201).json({
            success: true,
            message: "Assignment created successfully",
            assignment,
        });
    })



module.exports.assignmentget = asyncHandler(async (req, res) => {    const { courseId } = req.params;

        const assignments = await Assignment.find({ course: courseId })
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: assignments.length,
            assignments,
        });
    })

module.exports.assignmentgetbyid = asyncHandler(async (req, res) => {
        const { courseId, assignmentId } = req.params;

        if (!mongoose.isValidObjectId(assignmentId)) {
            throw new AppError("Invalid assignment ID format", 400);
        }

        const assignment = await Assignment.findOne({
            _id: assignmentId,
            course: courseId,
        }).populate("createdBy", "name email");

        if (!assignment) {
            throw new AppError("Assignment not found", 404);
        }

        res.status(200).json({
            success: true,
            assignment,
        });
    })



module.exports.assignmentUpdate =  asyncHandler(async (req, res) => {
        const { courseId, assignmentId } = req.params;

        if (!mongoose.isValidObjectId(assignmentId)) {
            throw new AppError("Invalid assignment ID format", 400);
        }

        const assignment = await Assignment.findOne({   _id: assignmentId,    course: courseId,});

        if (!assignment) {
            throw new AppError("Assignment not found", 404);
        }

        const { title, instructions, dueDate, totalMarks } = req.body;

        if (title !== undefined) assignment.title = title;
        if (instructions !== undefined) assignment.instructions = instructions;
        if (dueDate !== undefined) assignment.dueDate = dueDate || null;
        if (totalMarks !== undefined) assignment.totalMarks = totalMarks;

        await assignment.save();
        await assignment.populate("createdBy", "name email");

        res.status(200).json({
            success: true,
            message: "Assignment updated successfully",
            assignment,
        });
    })

module.exports.assignmentdelete = asyncHandler(async (req, res) => {
        const { courseId, assignmentId } = req.params;

        if (!mongoose.isValidObjectId(assignmentId)) {
            throw new AppError("Invalid assignment ID format", 400);
        }

        const assignment = await Assignment.findOne({
            _id: assignmentId,
            course: courseId,
        });

        if (!assignment) {
            throw new AppError("Assignment not found", 404);
        }

        // Clean up Cloudinary file if exists
        if (assignment.attachment?.publicId) {
            try {
                const isImage = assignment.attachment.mimeType?.startsWith("image/");
                await cloudinary.uploader.destroy(assignment.attachment.publicId, {
                    resource_type: isImage ? "image" : "raw",
                });
            } catch (err) {
                console.error("Failed to delete Cloudinary asset:", err.message);
            }
        }

        await Assignment.findByIdAndDelete(assignmentId);

        res.status(200).json({
            success: true,
            message: "Assignment deleted successfully",
        });
    })


