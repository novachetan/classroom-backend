
const express = require("express");
const {
    createCourseSchema,
    updateCourseSchema,
    courseIdParamsSchema,
    courseAndTeacherParamsSchema
} = require("../validation/courseValidation");
const { authMiddleware } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const Course =  require("../controllers/courseCo")
const router = express.Router();



router.post("/", authMiddleware, validate(createCourseSchema, "body"), 
Course.coursePost
);


// ======================================================
// 2. GET COURSES FOR THE LOGGED-IN USER
// GET /api/courses
// ======================================================


router.get("/", authMiddleware, 
    Course.courseGet
);


// GET ONE COURSE
// GET /api/courses/:courseId

router.get( "/:courseId", authMiddleware, validate(courseIdParamsSchema, "params"), Course.courseGetById
);


// UPDATE COURSE
// PATCH /api/courses/:courseId

router.patch(
    "/:courseId",
    authMiddleware,
    validate(courseIdParamsSchema, "params"),
    validate(updateCourseSchema, "body"),
    Course.coursePatch
);


// ======================================================
// 4. ADD A CO-TEACHER
// POST /api/courses/:courseId/teachers
// ======================================================

router.post( "/:courseId/teachers", authMiddleware, validate(courseIdParamsSchema, "params"), 
Course.addCoTeacher 
);


// ======================================================
// 5. REMOVE A CO-TEACHER
// DELETE /api/courses/:courseId/teachers/:teacherId
// ======================================================

router.delete( "/:courseId/teachers/:teacherId",  authMiddleware, validate(courseAndTeacherParamsSchema, "params"), 
 Course.deleteCoTeacher 
);



// 6. DELETE A COURSE
// DELETE /api/courses/:courseId

router.delete("/:courseId",  authMiddleware, validate(courseIdParamsSchema, "params"), Course.courseDelete);

module.exports = router;


