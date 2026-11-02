
const Joi = require("joi");
const mongoose = require("mongoose");

// Reusable MongoDB ObjectId validation
const objectIdSchema = Joi.string()
    .custom((value, helpers) => {
        if (!mongoose.isValidObjectId(value)) {
            return helpers.error("any.invalid");
        }
        return value;
    })
    .messages({
        "any.invalid": "Invalid MongoDB ObjectId",
        "string.empty": "ID cannot be empty",
        "any.required": "ID is required"
    });

// Create course validation
const createCourseSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(1)
        .max(100)
        .required()
        .messages({
            "string.empty": "Course name is required",
            "string.max": "Course name cannot exceed 100 characters",
            "any.required": "Course name is required"
        }),

    section: Joi.string()
        .trim()
        .allow("")
        .optional(),

    subject: Joi.string()
        .trim()
        .allow("")
        .optional(),

    room: Joi.string()
        .trim()
        .allow("")
        .optional(),

    description: Joi.string()
        .trim()
        .max(2000)
        .allow("")
        .optional(),

    code: Joi.forbidden(),
    owner: Joi.forbidden(),
    coTeachers: Joi.forbidden(),
    isArchived: Joi.forbidden()
}).unknown(false);

// Update course validation
const updateCourseSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(1)
        .max(100),

    section: Joi.string()
        .trim()
        .allow(""),

    subject: Joi.string()
        .trim()
        .allow(""),

    room: Joi.string()
        .trim()
        .allow(""),

    description: Joi.string()
        .trim()
        .max(2000)
        .allow("")
})
    .min(1)
    .unknown(false);

// Validate course ID in route parameters
const courseIdParamsSchema = Joi.object({
    courseId: objectIdSchema.required()
});

// Validate teacher ID in route parameters
const teacherIdParamsSchema = Joi.object({
    teacherId: objectIdSchema.required()
});

// Validate course and teacher IDs together
const courseAndTeacherParamsSchema = Joi.object({
    courseId: objectIdSchema.required(),
    teacherId: objectIdSchema.required()
});

module.exports = {
    objectIdSchema,
    createCourseSchema,
    updateCourseSchema,
    courseIdParamsSchema,
    teacherIdParamsSchema,
    courseAndTeacherParamsSchema
};

