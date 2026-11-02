const { rateLimit } = require("express-rate-limit");

// Login: maximum 10 attempts per 15 minutes
const loginLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
limit: 10,
standardHeaders: true,
legacyHeaders: false,
message: {
status: "fail",
message: "Too many login attempts. Please try again after 15 minutes."
}
});

// Registration: maximum 5 attempts per hour
const registerLimiter = rateLimit({
windowMs: 60 * 60 * 1000,
limit: 5,
standardHeaders: true,
legacyHeaders: false,
message: {
status: "fail",
message: "Too many registration attempts. Please try again after one hour."
}
});

module.exports = {
loginLimiter,
registerLimiter
};
