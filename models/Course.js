const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        section: {
            type: String,
            trim: true
        },

        subject: {
            type: String,
            trim: true
        },

        room: {
            type: String,
            trim: true
        },

        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        coTeachers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],

        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: ""
        },

        isArchived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

courseSchema.index({ owner: 1 });

module.exports = mongoose.model("Course", courseSchema);
