const crypto = require("crypto");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");


module.exports.coursePost = asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const { email } = req.body;
        
        if (typeof email !== "string" || !email.trim()) {
            throw new AppError("Teacher email is required", 400);
        }

        const course = await Course.findById(courseId);

        if (!course || course.isArchived) {
            throw new AppError("Course not found", 404);
        }

        // Only the primary owner may add co-teachers.
        if (course.owner.toString() !== req.user.id.toString()) {
            throw new AppError("Only the course owner can add co-teachers", 403);
        }

        const normalizedEmail = email.trim().toLowerCase();

        const userToAdd = await User.findOne({ email: normalizedEmail });

        if (!userToAdd) {
            throw new AppError("User with this email was not found", 404 );
        }

        const teacherId = userToAdd._id.toString();

        if (teacherId === course.owner.toString()) {
            throw new AppError("The course owner cannot be added as a co-teacher", 400);
        }

        if ( course.coTeachers.some( id => id.toString() === teacherId ))
             {
            throw new AppError("This user is already a co-teacher", 409);
        }

        // A user cannot simultaneously have student and teacher
        // membership in the same course under our unique index.
        const existingEnrollment = await Enrollment.findOne({
            user: userToAdd._id,
            course: course._id
        });

        if ( existingEnrollment && existingEnrollment.role === "student") {
            throw new AppError("This user is already enrolled as a student. Resolve that membership before adding them as a co-teacher.", 409);
        }

        // Add the teacher membership first.
        // If this fails, the Course document remains unchanged.
        if (!existingEnrollment) {
            await Enrollment.create({
                user: userToAdd._id,
                course: course._id,
                role: "teacher",
                status: "approved"
            });
        } else if ( existingEnrollment.role !== "teacher" || existingEnrollment.status !== "approved") {
            throw new AppError("An existing teacher membership needs to be resolved first", 409);
        }

        // Add the user to the course's co-teacher list.
        const updatedCourse = await Course.findOneAndUpdate(
            {  _id: courseId, owner: req.user.id, coTeachers: { $ne: userToAdd._id }},
            { $addToSet: { coTeachers: userToAdd._id }
            },
            { new: true, runValidators: true }
        )
            .populate("owner", "name email")
            .populate("coTeachers", "name email");

        if (!updatedCourse) {
            throw new AppError("The course changed while adding the co-teacher. Check the course and membership before retrying.", 409);
        }

        res.status(200).json({
            success: true,
            message: "Co-teacher added successfully",
            course: updatedCourse
        });
    })

module.exports.courseGet = asyncHandler(async (req, res) => {

         const userId = req.user.id;
        // Courses owned by the user or taught collaboratively.
        const teachingCourses = await Course.find({ $or: [ { owner: userId }, { coTeachers: userId } ], isArchived: false })
            .populate("owner", "name email")
            .populate("coTeachers", "name email")
            .sort({ createdAt: -1 });

        // Approved student memberships.
        const studentEnrollments = await Enrollment.find({ user: userId, role: "student", status: "approved"}) 
        .populate({path: "course",
            populate: { path: "owner", select: "name email"  }
        });

        res.status(200).json({
            success: true,
            teachingCourses,
            studentEnrollments
        });
    })
module.exports.courseGetById = asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const userId = req.user.id;
        // Find the course
        const course = await Course.findById(courseId)
            .populate("owner", "name email")
            .populate("coTeachers", "name email");

        if (!course || course.isArchived) {
            throw new AppError("Course not found", 404);
        }

        // 1. Check whether the user owns this course
        const isOwner =  course.owner._id.toString() === userId.toString();

        // 2. Check whether the user is a co-teacher
        const isCoTeacher = course.coTeachers.some( (teacher) =>
                teacher._id.toString() === userId.toString()
        );

        // 3. Check whether the user is an approved student
        const enrollment = await Enrollment.findOne({
            user: userId,
            course: courseId,
            role: "student",
            status: "approved"
        });

        const isApprovedStudent = Boolean(enrollment);

        // 4. Deny access if the user has no permission
        if (!isOwner && !isCoTeacher && !isApprovedStudent) {
            throw new AppError(
                "You are not authorized to access this course",
                403
            );
        }

        // 5. Return the course
        res.status(200).json({
            success: true,
            course
        });
    })

module.exports.coursePatch = asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const userId = req.user.id;

        // Find the course
        const course = await Course.findById(courseId);

        if (!course || course.isArchived) {
            throw new AppError("Course not found", 404);
        }

        // Only the course owner can update course details
        if (course.owner.toString() !== userId.toString()) {
            throw new AppError("Only the course owner can update this course", 403);
        }

        // Update only the validated fields
        const updatedCourse = await Course.findOneAndUpdate( { _id: courseId, owner: userId, isArchived: false },
            {  $set: req.body }, { new: true, runValidators: true }
        )
            .populate("owner", "name email")
            .populate("coTeachers", "name email");


        if (!updatedCourse) {
            throw new AppError("Course not found or no longer editable", 404);
        }

        res.status(200).json({
            success: true,
            message: "Course updated successfully",
            course: updatedCourse
        });
    })

module.exports.courseGetCoTeachers = asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const { email } = req.body;
        
        if (typeof email !== "string" || !email.trim()) {
            throw new AppError("Teacher email is required", 400);
        }

        const course = await Course.findById(courseId);

        if (!course || course.isArchived) {
            throw new AppError("Course not found", 404);
        }

        // Only the primary owner may add co-teachers.
        if (course.owner.toString() !== req.user.id.toString()) {
            throw new AppError("Only the course owner can add co-teachers", 403);
        }

        const normalizedEmail = email.trim().toLowerCase();

        const userToAdd = await User.findOne({ email: normalizedEmail });

        if (!userToAdd) {
            throw new AppError("User with this email was not found", 404 );
        }

        const teacherId = userToAdd._id.toString();

        if (teacherId === course.owner.toString()) {
            throw new AppError("The course owner cannot be added as a co-teacher", 400);
        }

        if ( course.coTeachers.some( id => id.toString() === teacherId ))
             {
            throw new AppError("This user is already a co-teacher", 409);
        }

        // A user cannot simultaneously have student and teacher
        // membership in the same course under our unique index.
        const existingEnrollment = await Enrollment.findOne({
            user: userToAdd._id,
            course: course._id
        });

        if ( existingEnrollment && existingEnrollment.role === "student") {
            throw new AppError("This user is already enrolled as a student. Resolve that membership before adding them as a co-teacher.", 409);
        }

        // Add the teacher membership first.
        // If this fails, the Course document remains unchanged.
        if (!existingEnrollment) {
            await Enrollment.create({
                user: userToAdd._id,
                course: course._id,
                role: "teacher",
                status: "approved"
            });
        } else if ( existingEnrollment.role !== "teacher" || existingEnrollment.status !== "approved") {
            throw new AppError("An existing teacher membership needs to be resolved first", 409);
        }

        // Add the user to the course's co-teacher list.
        const updatedCourse = await Course.findOneAndUpdate(
            {  _id: courseId, owner: req.user.id, coTeachers: { $ne: userToAdd._id }},
            { $addToSet: { coTeachers: userToAdd._id }
            },
            { new: true, runValidators: true }
        )
            .populate("owner", "name email")
            .populate("coTeachers", "name email");

        if (!updatedCourse) {
            throw new AppError("The course changed while adding the co-teacher. Check the course and membership before retrying.", 409);
        }

        res.status(200).json({
            success: true,
            message: "Co-teacher added successfully",
            course: updatedCourse
        });
    })

module.exports.deleteCoTeacher = asyncHandler(async (req, res) => {
        const { courseId, teacherId } = req.params;
        const course = await Course.findById(courseId);

        if (!course) {
            throw new AppError("Course not found", 404);
        }

        if (course.owner.toString() !== req.user.id.toString()) {
            throw new AppError("Only the course owner can remove co-teachers", 403);
        }

        const isCoTeacher = course.coTeachers.some( id => id.toString() === teacherId );

        if (!isCoTeacher) {
            throw new AppError("This user is not a co-teacher",404);
        }

        // Remove from the course's co-teacher list.
        await Course.updateOne(
            { _id: courseId, owner: req.user.id },
            { $pull: { coTeachers: teacherId } }
        );

        // Remove only the teacher membership.
        await Enrollment.deleteOne({
            user: teacherId,
            course: courseId,
            role: "teacher"
        });

        res.status(200).json({
            success: true,
            message: "Co-teacher removed successfully"
        });
    })

module.exports.courseDelete =  asyncHandler(async (req, res) => {
        const { courseId } = req.params;

        const course = await Course.findById(courseId);

        if (!course) {
            throw new AppError("Course not found", 404);
        }

        if (course.owner.toString() !== req.user.id.toString()) {
            throw new AppError("Only the course owner can delete this course", 403);
        }

        // Delete related enrollment records before removing the course.
        // A MongoDB transaction is preferable for production deletion.
        await Enrollment.deleteMany({ course: courseId });

        await Course.deleteOne({ _id: courseId, owner: req.user.id });
        res.status(200).json({
            success: true,
            message: "Course deleted successfully"
        });
    })
