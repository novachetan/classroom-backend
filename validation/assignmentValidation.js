const Joi = require("joi");

// MongoDB ObjectId validation
const objectId = Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("{{#label}} must be a valid MongoDB ObjectId");

// Create assignment validation
const createAssignmentSchema = Joi.object({
    title: Joi.string()
        .trim()
        .min(1)
        .max(200)
        .required()
        .messages({
            "any.required": "Assignment title is required",
            "string.empty": "Assignment title cannot be empty",
            "string.min": "Assignment title must contain at least 1 character",
            "string.max": "Assignment title cannot exceed 200 characters",
        }),

    instructions: Joi.string()
        .trim()
        .max(10000)
        .allow("")
        .default(""),

    dueDate: Joi.date()
        .iso()
        .allow(null, "")
        .default(null),

    totalMarks: Joi.number()
        .min(0)
        .max(100000)
        .default(100)
        .messages({
            "number.base": "Total marks must be a number",
            "number.min": "Total marks cannot be negative",
            "number.max": "Total marks cannot exceed 100000",
        }),
}).unknown(false);

// Update assignment validation
const updateAssignmentSchema = Joi.object({
    title: Joi.string()
        .trim()
        .min(1)
        .max(200)
        .messages({
            "string.empty": "Assignment title cannot be empty",
            "string.min": "Assignment title must contain at least 1 character",
            "string.max": "Assignment title cannot exceed 200 characters",
        }),

    instructions: Joi.string()
        .trim()
        .max(10000)
        .allow(""),

    dueDate: Joi.date()
        .iso()
        .allow(null, ""),

    totalMarks: Joi.number()
        .min(0)
        .max(100000)
        .messages({
            "number.base": "Total marks must be a number",
            "number.min": "Total marks cannot be negative",
            "number.max": "Total marks cannot exceed 100000",
        }),
})
    .min(1)
    .unknown(false);

// Validate course ID in route parameters
const courseParamsSchema = Joi.object({
    courseId: objectId.required()
});

// Validate course ID and assignment ID
const assignmentParamsSchema = Joi.object({
    courseId: objectId.required(),
    assignmentId: objectId.required()
});


module.exports = {
    objectId,
    createAssignmentSchema,
    updateAssignmentSchema,
    courseParamsSchema,
    assignmentParamsSchema
};