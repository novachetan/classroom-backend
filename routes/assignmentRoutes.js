const express = require("express");
const {
    authMiddleware,
    authorizeCourseRole
} = require("../middleware/authMiddleware");

const validate = require("../middleware/validate");
const {
    createAssignmentSchema,
    updateAssignmentSchema,
    courseParamsSchema,
    assignmentParamsSchema
} = require("../validation/assignmentValidation");
const {
    receiveAssignmentFile,
    uploadAssignmentToCloudinary
} = require("../middleware/upload");

const Assignment = require("../controllers/assignmentCo");
const router = express.Router();


// CREATE ASSIGNMENT
router.post(
    "/course/:courseId/assignment",
    authMiddleware,
    authorizeCourseRole("teacher"),
    receiveAssignmentFile,
    validate(createAssignmentSchema, "body"),
    uploadAssignmentToCloudinary,
    Assignment.assignmentpost
);

// CREATE ASSIGNMENT
router.post(
    "/course/:courseId/assignment",
    authMiddleware,
    validate(courseParamsSchema, "params"),
    authorizeCourseRole("teacher"),
    receiveAssignmentFile,
    validate(createAssignmentSchema, "body"),
    uploadAssignmentToCloudinary,
    Assignment.assignmentpost
);

// GET ALL ASSIGNMENTS
router.get(
    "/course/:courseId",
    authMiddleware,
    validate(courseParamsSchema, "params"),
    authorizeCourseRole("teacher", "student"),
    Assignment.assignmentget
);

// GET SINGLE ASSIGNMENT
router.get(
    "/course/:courseId/assignment/:assignmentId",
    authMiddleware,
    validate(assignmentParamsSchema, "params"),
    authorizeCourseRole("teacher", "student"),
    Assignment.assignmentgetbyid
);

// UPDATE ASSIGNMENT
router.patch(
    "/course/:courseId/assignment/:assignmentId",
    authMiddleware,
    validate(assignmentParamsSchema, "params"),
    authorizeCourseRole("teacher"),
    validate(updateAssignmentSchema, "body"),
    Assignment.assignmentUpdate
);

// DELETE ASSIGNMENT
router.delete(
    "/course/:courseId/assignment/:assignmentId",
    authMiddleware,
    validate(assignmentParamsSchema, "params"),
    authorizeCourseRole("teacher"),
    Assignment.assignmentdelete
);

module.exports = router;