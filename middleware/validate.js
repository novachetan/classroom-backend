const AppError = require('../utils/AppError');

const validate = (schema, property) => {
    return (req, res, next) => {

        const { error, value } = schema.validate(req[property]);

        if (error) {
            return next(
                new AppError(error.details[0].message, 400)
            );
        }

        req[property] = value;
        next();
    };
};

module.exports = validate;