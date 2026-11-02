const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

// Centralized error handler
const errorHandler = (err, req, res, next) => {
    console.error(err);

    let statusCode = err.statusCode || err.http_code || 500;
    let message = err.message || "Internal Server Error";
    let errors;

    // Multer error handling (e.g. file size limit)
    if (err.name === "MulterError") {
        statusCode = 400;
        if (err.code === "LIMIT_FILE_SIZE") {
            message = "File size exceeds the 10MB limit";
        } else {
            message = err.message;
        }
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = "Validation failed";

        errors = {};

        for (const field in err.errors) {
            errors[field] = err.errors[field].message;
        }
    }

    // Mongoose invalid ObjectId
    if (err.name === "CastError") {
        statusCode = 400;
        message = "Invalid ID format";
    }

    // MongoDB duplicate key
    if (err.code === 11000) {
        statusCode = 409;
        message = "Duplicate value. This record already exists.";
    }

    const response = { success: false, message };

    if (errors) {
        response.errors = errors;
    }

    res.status(statusCode).json(response);
};

// Reusable MongoDB ObjectId validation middleware
const validateObjectId = (paramName) => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (!mongoose.isObjectIdOrHexString(id)) {
            return next(
                new AppError(`Invalid ${paramName}`, 400)
            );
        }

        next();
    };
};

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.validateObjectId = validateObjectId;
