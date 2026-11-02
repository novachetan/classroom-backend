const Joi = require("joi");

const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),

    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(254)
        .required(),

    password: Joi.string()
        .min(8)
        .max(128)
        .required()
});

const loginSchema = Joi.object({
    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(254)
        .required(),

    password: Joi.string()
        .min(1)
        .max(128)
        .required()
});

const updateUserSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50),

    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(254)
}).min(1);

module.exports = {
    registerSchema,
    loginSchema,
    updateUserSchema
};

