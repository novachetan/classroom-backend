const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true
        },

        role: {
            type: String,
            enum: ["teacher", "student"],
            required: true
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// One membership per user per course.
enrollmentSchema.index(
    { user: 1, course: 1 },
    { unique: true }
);

module.exports = mongoose.model("Enrollment", enrollmentSchema);