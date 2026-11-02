const express = require("express");

const {
    authMiddleware,
    authorizeCourseRole
} = require("../middleware/authMiddleware");

const validate = require("../middleware/validate");

const {
    createAssignmentSchema,
    updateAssignmentSchema
} = require("../validation/assignmentValidation");

const uploadAssignment = require("../middleware/upload");

const Assignment = require("../controllers/assignmentCo");

const router = express.Router();


// CREATE ASSIGNMENT
router.post("/course/:courseId/assignment", authMiddleware, authorizeCourseRole("teacher"), uploadAssignment, validate(createAssignmentSchema, "body"), Assignment.assignmentpost);

// GET ALL ASSIGNMENTS FOR A COURSE
router.get(  "/course/:courseId",  authMiddleware,  authorizeCourseRole("teacher", "student"),  Assignment.assignmentget);

// GET SINGLE ASSIGNMENT
router.get(  "/course/:courseId/assignment/:assignmentId",  authMiddleware, authorizeCourseRole("teacher", "student"), Assignment.assignmentgetbyid);

// UPDATE ASSIGNMENT
router.patch( "/course/:courseId/assignment/:assignmentId",  authMiddleware,  authorizeCourseRole("teacher"),  validate(updateAssignmentSchema, "body"), Assignment.assignmentUpdate);

// DELETE ASSIGNMENT
router.delete( "/course/:courseId/assignment/:assignmentId", authMiddleware, authorizeCourseRole("teacher"), Assignment.assignmentdelete);

module.exports = router;