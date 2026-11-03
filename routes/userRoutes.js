const express = require("express");
const router = express.Router();

const userController = require("../controllers/usersCo");

const { authMiddleware } = require("../middleware/authMiddleware");
const { loginLimiter, registerLimiter } = require("../middleware/ratelimiters");
const validate = require("../middleware/validate");

const {registerSchema, loginSchema, updateUserSchema } = require("../validation/userValidation");


// CSRF PROTECTION
router.use(userController.csrfProtection);
// GET /api/users/csrf-token

router.get("/csrf-token", userController.getCsrfToken);

// AUTHENTICATION ROUTES

// POST /api/users/register
router.post("/register", registerLimiter, validate(registerSchema, "body"), userController.register);

// POST /api/users/login
router.post("/login", loginLimiter, validate(loginSchema, "body"), userController.login);

// POST /api/users/refresh
router.post("/refresh",userController.refreshToken);

// POST /api/users/logout
 router.post("/logout", userController.deleteUser);

// POST /api/users/logout-all
router.post("/logout-all", authMiddleware, userController.deleteAll);

// PROFILE ROUTES
// GET /api/users/me
router.get("/me", authMiddleware, userController.getCurrentUser);

// PATCH /api/users/me
router.patch("/me", authMiddleware, validate(updateUserSchema, "body"), userController.updateUser);

module.exports = router;
