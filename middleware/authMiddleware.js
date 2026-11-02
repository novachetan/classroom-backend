const jwt = require("jsonwebtoken");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const AppError = require("../utils/AppError");

module.exports.authMiddleware = (req, res, next) => {
  try {
    // Read the access token from the HTTP-only cookie
    const token = req.cookies?.accessToken;

    if (!token) {
      return next(
        new AppError("Authentication required", 401)
      );
    }

    // Verify the access token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Attach authenticated user information to the request
    req.user = {
      id: decoded.id,
    };

    next();
  } catch (error) {
    if ( error.name === "TokenExpiredError" || error.name === "JsonWebTokenError"
    ) {
      return next(
        new AppError("Invalid or expired access token", 401)
      );
    }

    next(error);
  }
};




module.exports.authorizeCourseRole = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // Get course ID from either the URL or the loaded assignment.
            const courseId = req.params.courseId || req.assignment?.course;

            if (!courseId) {
                return next(
                    new AppError("Course ID is required", 400)
                );
            }

            const course = await Course.findById(courseId);

            if (!course || course.isArchived) {
                return next( new AppError("Course not found", 404)
                );
            }

            const userId = String(req.user.id);
            const ownerId = String(course.owner);
            const coTeacherIds = (course.coTeachers || []).map((id) => String(id?._id || id));
            let userRole = null
            // Course owner
            if (ownerId === userId) {
                userRole = "teacher";
            }

            // Co-teacher
            else if (coTeacherIds.includes(userId)) {
                userRole = "teacher";
            }

            // Approved enrollment
            else {
                const enrollment = await Enrollment.findOne({ user: userId, course: course._id,  status: "approved",});

                if (enrollment) {
                    userRole = enrollment.role;
                }
            }

            if (!userRole) {
                return next(
                    new AppError("You are not a member of this course", 403)
                );
            }

            if (!allowedRoles.includes(userRole)) {
                return next(
                    new AppError("You are not authorized to perform this action", 403)
                );
            }

            req.course = course;
            req.courseRole = userRole;

            next();
        } catch (error) {
            next(error);
        }
    };
};