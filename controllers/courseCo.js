const cloudinary = require("../config/cloudinary");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Announcement = require("../models/Announcement");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");


module.exports.coursePost = asyncHandler(async (req, res) => {
    const { name, section, subject, room, description } = req.body;
    const userId = req.user.id;

    const session = await mongoose.startSession();

    let course;

    try {
        await session.withTransaction(async () => {
            const joinCode = crypto.randomBytes(4)
                .toString("hex")
                .toUpperCase();

            [course] = await Course.create(
                [{
                    name,
                    section,
                    subject,
                    room,
                    description,
                    code: joinCode,
                    owner: userId,
                    coTeachers: []
                }],
                { session }
            );

            await Enrollment.create(
                [{
                    user: userId,
                    course: course._id,
                    role: "teacher",
                    status: "approved"
                }],
                { session }
            );
        });
    } finally {
        await session.endSession();
    }

    res.status(201).json({
        success: true,
        message: "Course created successfully",
        course
    });
});



module.exports.courseGet = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Courses owned by the user or taught collaboratively.
    const teachingCourses = await Course.find({
        $or: [
            { owner: userId },
            { coTeachers: userId }
        ],
        isArchived: false
    })
        .populate("owner", "name email")
        .populate("coTeachers", "name email")
        .sort({ createdAt: -1 });

    // Approved student memberships.
    const studentEnrollments = await Enrollment.find({
        user: userId,
        role: "student",
        status: "approved"
    })
        .populate({
            path: "course",
            match: { isArchived: false },
            populate: [
                { path: "owner", select: "name email" },
                { path: "coTeachers", select: "name email" }
            ]
        })
        .sort({ createdAt: -1 });

    // Remove enrollments whose courses are archived or unavailable.
    const activeStudentEnrollments = studentEnrollments.filter(
        enrollment => enrollment.course !== null
    );

    res.status(200).json({
        success: true,
        teachingCourses,
        studentEnrollments: activeStudentEnrollments
    });
});
    
module.exports.courseGetById = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user.id;

    const course = await Course.findOne({
        _id: courseId,
        isArchived: false
    })
        .populate("owner", "name email")
        .populate("coTeachers", "name email");

    if (!course) {
        throw new AppError("Course not found", 404);
    }

    // Check course ownership.
    const isOwner =
        course.owner._id.toString() === userId.toString();

    // Check co-teacher membership.
    const isCoTeacher = course.coTeachers.some(
        teacher => teacher._id.toString() === userId.toString()
    );

    // Check approved student membership only when necessary.
    let isApprovedStudent = false;

    if (!isOwner && !isCoTeacher) {
        isApprovedStudent = await Enrollment.exists({
            user: userId,
            course: courseId,
            role: "student",
            status: "approved"
        });
    }

    if (!isOwner && !isCoTeacher && !isApprovedStudent) {
        throw new AppError(
            "You are not authorized to access this course",
            403
        );
    }

    res.status(200).json({
        success: true,
        course
    });
});
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

module.exports.addCoTeacher = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
        throw new AppError("Teacher email is required", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userId = req.user.id;

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {

            // Find active course.
            const course = await Course.findOne({
                _id: courseId,
                isArchived: false
            }).session(session);

            if (!course) {
                throw new AppError("Course not found", 404);
            }

            // Only course owner can add co-teachers.
            if (course.owner.toString() !== userId.toString()) {
                throw new AppError(
                    "Only the course owner can add co-teachers",
                    403
                );
            }

            // Find teacher account.
            const userToAdd = await User.findOne({
                email: normalizedEmail
            }).session(session);

            if (!userToAdd) {
                throw new AppError(
                    "User with this email was not found",
                    404
                );
            }

            const teacherId = userToAdd._id;

            // Owner cannot be added as co-teacher.
            if (teacherId.toString() === userId.toString()) {
                throw new AppError(
                    "The course owner cannot be added as a co-teacher",
                    400
                );
            }

            // Check existing co-teacher membership.
            const isAlreadyTeacher = course.coTeachers.some(
                id => id.toString() === teacherId.toString()
            );

            if (isAlreadyTeacher) {
                throw new AppError(
                    "This user is already a co-teacher",
                    409
                );
            }

            // Check existing enrollment.
            const existingEnrollment = await Enrollment.findOne({
                user: teacherId,
                course: course._id
            }).session(session);

            if (existingEnrollment && existingEnrollment.role === "student") {
                throw new AppError(
                    "This user is already enrolled as a student. Resolve that membership before adding them as a co-teacher.",
                    409
                );
            }

            if (
                existingEnrollment &&
                (
                    existingEnrollment.role !== "teacher" ||
                    existingEnrollment.status !== "approved"
                )
            ) {
                throw new AppError(
                    "An existing teacher membership needs to be resolved first",
                    409
                );
            }

            // Create approved teacher enrollment if necessary.
            if (!existingEnrollment) {
                await Enrollment.create(
                    [{
                        user: teacherId,
                        course: course._id,
                        role: "teacher",
                        status: "approved"
                    }],
                    { session }
                );
            }

            // Add teacher to course.
            const updatedCourse = await Course.findOneAndUpdate(
                {
                    _id: courseId,
                    owner: userId,
                    isArchived: false,
                    coTeachers: { $ne: teacherId }
                },
                {
                    $addToSet: {
                        coTeachers: teacherId
                    }
                },
                {
                    new: true,
                    runValidators: true,
                    session
                }
            );

            if (!updatedCourse) {
                throw new AppError(
                    "Course changed while adding the co-teacher",
                    409
                );
            }
        });

    } finally {
        await session.endSession();
    }

    // Fetch updated course after transaction commits.
    const updatedCourse = await Course.findById(courseId)
        .populate("owner", "name email")
        .populate("coTeachers", "name email");

    res.status(200).json({
        success: true,
        message: "Co-teacher added successfully",
        course: updatedCourse
    });
});

module.exports.deleteCoTeacher = asyncHandler(async (req, res) => {
    const { courseId, teacherId } = req.params;
    const userId = req.user.id;

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {

            // Find the course.
            const course = await Course.findById(courseId).session(session);

            if (!course) {
                throw new AppError("Course not found", 404);
            }

            // Only the primary owner can remove co-teachers.
            if (course.owner.toString() !== userId.toString()) {
                throw new AppError(
                    "Only the course owner can remove co-teachers",
                    403
                );
            }

            // Verify co-teacher membership.
            const isCoTeacher = course.coTeachers.some(
                id => id.toString() === teacherId
            );

            if (!isCoTeacher) {
                throw new AppError(
                    "This user is not a co-teacher",
                    404
                );
            }

            // Remove the co-teacher from the course.
            const updatedCourse = await Course.findOneAndUpdate(
                {
                    _id: courseId,
                    owner: userId,
                    coTeachers: teacherId
                },
                {
                    $pull: { coTeachers: teacherId }
                },
                {
                    new: true,
                    session
                }
            );

            if (!updatedCourse) {
                throw new AppError(
                    "Unable to remove co-teacher",
                    409
                );
            }

            // Remove only the teacher enrollment.
            await Enrollment.deleteOne({
                user: teacherId,
                course: courseId,
                role: "teacher"
            }).session(session);

        });

    } finally {
        await session.endSession();
    }

    const updatedCourse = await Course.findById(courseId)
        .populate("owner", "name email")
        .populate("coTeachers", "name email");

    res.status(200).json({
        success: true,
        message: "Co-teacher removed successfully",
        course: updatedCourse
    });
});

module.exports.courseDelete = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user.id;

    const session = await mongoose.startSession();

    let attachmentsToDelete = [];

    try {
        await session.withTransaction(async () => {

            const course = await Course.findOne({
                _id: courseId,
                owner: userId
            }).session(session);

            if (!course) {
                throw new AppError("Course not found", 404);
            }

            // Collect assignment attachment information.
            const assignments = await Assignment.find({
                course: courseId
            })
                .select("attachment.publicId attachment.mimeType")
                .session(session);

            attachmentsToDelete = assignments
                .filter(assignment => assignment.attachment?.publicId)
                .map(assignment => ({
                    publicId: assignment.attachment.publicId,
                    resourceType: assignment.attachment.mimeType.startsWith("image/")
                        ? "image"
                        : "raw"
                }));

            // Delete assignments.
            await Assignment.deleteMany({
                course: courseId
            }).session(session);

            // Delete announcements.
            await Announcement.deleteMany({
                course: courseId
            }).session(session);

            // Delete enrollments.
            await Enrollment.deleteMany({
                course: courseId
            }).session(session);

            // Delete course.
            const deletedCourse = await Course.deleteOne({
                _id: courseId,
                owner: userId
            }).session(session);

            if (deletedCourse.deletedCount !== 1) {
                throw new AppError("Unable to delete course", 409);
            }
        });

    } finally {
        await session.endSession();
    }

    // Delete Cloudinary files only after transaction commits.
    const cleanupResults = await Promise.allSettled(
        attachmentsToDelete.map(({ publicId, resourceType }) =>
            cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType
            })
        )
    );

    // Log failed Cloudinary cleanup operations.
    cleanupResults.forEach((result, index) => {
        if (result.status === "rejected") {
            console.error(
                "Cloudinary cleanup failed:",
                attachmentsToDelete[index].publicId,
                result.reason
            );
        }
    });

    res.status(200).json({
        success: true,
        message: "Course and related records deleted successfully"
    });
});