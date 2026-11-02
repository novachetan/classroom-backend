const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
    {
        // Classroom to which this assignment belongs
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: [true, "Course ID is required"],
            index: true,
        },

        // Teacher who created the assignment
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Assignment creator is required"],
        },

        // Assignment title
        title: {
            type: String,
            required: [true, "Assignment title is required"],
            trim: true,
            minlength: 1,
            maxlength: 200,
        },

        // Assignment instructions
        instructions: {
            type: String,
            trim: true,
            maxlength: 10000,
            default: "",
        },

        // Submission deadline
        dueDate: {
            type: Date,
            default: null,
        },

        // Maximum marks available
        totalMarks: {
            type: Number,
            required: true,
            min: 0,
            default: 100,
        },

        // Optional attachment stored in Cloudinary
        attachment: {
            publicId: {
                type: String,
                default: null,
            },

            url: {
                type: String,
                default: null,
            },

            originalName: {
                type: String,
                default: null,
            },

            mimeType: {
                type: String,
                enum: [
                    "application/pdf",
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/gif",
                    "text/plain",
                    "text/csv",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    null,
                ],
                default: null,
            },

            size: {
                type: Number,
                min: 0,
                default: null,
            },
        },
    },
    {
        timestamps: true,
    }
);

// Retrieve assignments for a classroom, newest first
assignmentSchema.index({
    course: 1,
    createdAt: -1,
});

module.exports = mongoose.model("Assignment", assignmentSchema);
