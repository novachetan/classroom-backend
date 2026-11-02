const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const RefreshToken = require("../models/refreshToken");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
require("dotenv").config()

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const ACCESS_TOKEN_DURATION = 15* 60 * 1000;
const REFRESH_TOKEN_DURATION = 7 * 24 * 60 * 60 * 1000;
const CSRF_TOKEN_DURATION = 60 * 60 * 1000;

const ACCESS_COOKIE_NAME = "accessToken";
const REFRESH_COOKIE_NAME = "refreshToken";
const CSRF_COOKIE_NAME = "csrfToken";

const isProduction = process.env.NODE_ENV === "production";

const FRONTEND_ORIGINS = (
    process.env.FRONTEND_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

// Access token: available to all API routes.
const accessCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/"
};

// Refresh token: restricted to authentication routes.
const refreshCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/users"
};

// CSRF cookie: available to the frontend API requests.
// The token is also returned by the CSRF endpoint.
const csrfCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api"
};

// CONFIGURATION HELPERS

const checkSecurityConfiguration = () => {
    if (
        !process.env.JWT_SECRET ||
        !process.env.JWT_REFRESH_SECRET ||
        !process.env.CSRF_SECRET
    ) {
        throw new AppError(
            "JWT_SECRET, JWT_REFRESH_SECRET, and CSRF_SECRET must be configured",
            500
        );
    }
};


// REFRESH TOKEN HELPERS

const hashRefreshToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user._id.toString()
        },
        process.env.JWT_SECRET,
        {
            expiresIn: ACCESS_TOKEN_EXPIRY
        }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user._id.toString(),
            jti: crypto.randomUUID()
        },
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: REFRESH_TOKEN_EXPIRY
        }
    );
};

const saveRefreshToken = async (token, userId) => {
    await RefreshToken.create({
        token: hashRefreshToken(token),
        user: userId,
        expiresAt: new Date(
            Date.now() + REFRESH_TOKEN_DURATION
        )
    });
};

// CSRF TOKEN HELPERS

const createCsrfToken = () => {
    const randomValue = crypto.randomBytes(32).toString("hex");

    const signature = crypto
        .createHmac("sha256", process.env.CSRF_SECRET)
        .update(randomValue)
        .digest("hex");

    return `${randomValue}.${signature}`;
};

const safeStringEqual = (left, right) => {
    if (
        typeof left !== "string" ||
        typeof right !== "string"
    ) {
        return false;
    }

    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
        leftBuffer.length === rightBuffer.length &&
        crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
};

const isValidCsrfToken = (token) => {
    if (typeof token !== "string") {
        return false;
    }

    const parts = token.split(".");

    if (parts.length !== 2) {
        return false;
    }

    const [randomValue, providedSignature] = parts;

    if (!randomValue || !providedSignature) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.CSRF_SECRET)
        .update(randomValue)
        .digest("hex");

    return safeStringEqual(
        providedSignature,
        expectedSignature
    );
};

module.exports.getCsrfToken =  (req, res, next) => {
        try {
            checkSecurityConfiguration();

            const csrfToken = createCsrfToken();

            res.cookie(
                CSRF_COOKIE_NAME,
                csrfToken,
                {
                    ...csrfCookieOptions,
                    maxAge: CSRF_TOKEN_DURATION
                }
            );

            res.status(200).json({
                success: true,
                csrfToken
            });
        } catch (error) {
            next(error);
        }
    }

// CSRF PROTECTION MIDDLEWAR

module.exports.csrfProtection = (req, res, next) => {
    // Safe methods must not change application state.
    if ( ["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path === "/refresh" ) {
        return next();
    }

    try {
        checkSecurityConfiguration();

        // Validate the request's browser origin.
        const origin = req.get("origin");

if (origin && !FRONTEND_ORIGINS.includes(origin)) {
    return next(new AppError("Untrusted request origin", 403));
}

        // Require both the CSRF cookie and custom header.
        const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
        const headerToken = req.get("x-csrf-token");

        if ( !cookieToken || !headerToken || !safeStringEqual(cookieToken, headerToken) || !isValidCsrfToken(cookieToken)
        ) {
            return next( new AppError("CSRF validation failed", 403));
        }

        next();
    } catch (error) {
        next(error);
    }
};


module.exports.register = asyncHandler(async (req, res) => {
        const { name, email, password } = req.body;

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            throw new AppError( "An account with this email already exists", 409);
        }

        const hashedPassword = await bcrypt.hash(
            password,
            12
        );

        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
        });

        res.status(201).json({
            success: true,
            message: "Registration successful",
            user: {
                _id: user._id,
                id: user._id,
                name: user.name,
                email: user.email,
                systemRole: user.systemRole
            }
        });
    })




module.exports.login = asyncHandler(async (req, res) => {
        checkSecurityConfiguration();

        const { email, password } = req.body;

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        }).select("+password");

        if (!user) {
            throw new AppError( "Invalid email or password", 401);
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            throw new AppError( "Invalid email or password", 401);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await saveRefreshToken(
            refreshToken,
            user._id
        );

        // Store both authentication tokens in HTTP-only cookies.
        res.cookie(
            ACCESS_COOKIE_NAME,
            accessToken,
            {
                ...accessCookieOptions,
                maxAge: ACCESS_TOKEN_DURATION
            }
        );

        res.cookie(
            REFRESH_COOKIE_NAME,
            refreshToken,
            {
                ...refreshCookieOptions,
                maxAge: REFRESH_TOKEN_DURATION
            }
        );

        // Never return authentication tokens in JSON.
        res.status(200).json({
            success: true,
            message: "Login successful",
            expiresIn: 900,
            user: {
                _id: user._id,
                id: user._id,
                name: user.name,
                email: user.email,
                systemRole: user.systemRole
            }
        });
    })

module.exports.refreshToken =  asyncHandler(async (req, res) => {
  checkSecurityConfiguration();

        const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

        if (!refreshToken) {
            throw new AppError( "Refresh token is missing. Please log in.", 401);
        }

        let decoded;

        try {
            decoded = jwt.verify(   refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
            res.clearCookie(  ACCESS_COOKIE_NAME, accessCookieOptions);

            res.clearCookie( REFRESH_COOKIE_NAME, refreshCookieOptions );

            throw new AppError("Invalid or expired refresh token. Please log in again.", 401);
        }

        if (typeof decoded.id !== "string" || typeof decoded.jti !== "string") {
            throw new AppError("Invalid refresh token payload", 401);
        }

        const tokenHash = hashRefreshToken(refreshToken);

        const tokenRecord = await RefreshToken.findOne({
            token: tokenHash,
            user: decoded.id,
            expiresAt: {
                $gt: new Date()
            }
        });

        if (!tokenRecord) {
            res.clearCookie( ACCESS_COOKIE_NAME,  accessCookieOptions);
            res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
            throw new AppError("Refresh token is invalid or has already been used", 401);
        }

        // Consume the old token so it cannot be reused.
        const consumedToken =
            await RefreshToken.findOneAndDelete({
                _id: tokenRecord._id,
                token: tokenHash
            });

        if (!consumedToken) {
            res.clearCookie(
                ACCESS_COOKIE_NAME,
                accessCookieOptions
            );

            res.clearCookie(
                REFRESH_COOKIE_NAME,
                refreshCookieOptions
            );

            throw new AppError( "Refresh token has already been used", 401 );
        }

        const user = await User.findById(decoded.id);

        if (!user) {
            res.clearCookie( ACCESS_COOKIE_NAME,  accessCookieOptions);

            res.clearCookie( REFRESH_COOKIE_NAME, refreshCookieOptions);
        res.clearCookie( REFRESH_COOKIE_NAME, { ...refreshCookieOptions, path: "/" });

            throw new AppError( "User account not found", 401);
        }

        // Generate a new access and refresh token pair.
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await saveRefreshToken( newRefreshToken, user._id);

        res.cookie( ACCESS_COOKIE_NAME,  newAccessToken,
            {
                  ...accessCookieOptions,
                maxAge: ACCESS_TOKEN_DURATION
            }
        );

        res.cookie(
            REFRESH_COOKIE_NAME,
            newRefreshToken,
            {
                ...refreshCookieOptions,
                maxAge: REFRESH_TOKEN_DURATION
            }
        );

        // Never expose tokens in the response body.
        res.status(200).json({
            success: true,
            message: "Tokens refreshed successfully",
            expiresIn: 900
        });
    })

module.exports.getCurrentUser =   asyncHandler(async (req, res) => {
        const user = await User.findById(
            req.user.id
        ).select("-password");

        if (!user) {
            throw new AppError("User not found",  404);
        }

        res.status(200).json({
            success: true,
            user
        });
    })

module.exports.updateUser = asyncHandler(async (req, res) => {
        const { name, email } = req.body;

        const updates = {};

        if (name !== undefined) {
            updates.name = name;
        }

        if (email !== undefined) {
            updates.email = email.trim().toLowerCase();
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("Provide at least one field to update", 400);
        }

        if (updates.email) {
            const existingUser = await User.findOne({  email: updates.email, _id: { $ne: req.user.id } });

            if (existingUser) {
                throw new AppError("This email is already in use", 409);
            }
        }

        const user = await User.findByIdAndUpdate( req.user.id, { $set: updates}, {  new: true,  runValidators: true }
        ).select("-password");

        if (!user) {
            throw new AppError("User not found", 404);
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user
        });
    })

module.exports.deleteUser = asyncHandler(async (req, res) => {
        const refreshToken =  req.cookies?.[REFRESH_COOKIE_NAME];

        if (refreshToken) {
             await RefreshToken.deleteOne({  token: hashRefreshToken(refreshToken)});
        }
        res.clearCookie( ACCESS_COOKIE_NAME, accessCookieOptions);
        res.clearCookie( REFRESH_COOKIE_NAME, refreshCookieOptions);
        res.clearCookie( REFRESH_COOKIE_NAME, { ...refreshCookieOptions, path: "/" });
        res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions);
        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    })

module.exports.deleteAll =  asyncHandler(async (req, res) => {  await RefreshToken.deleteMany({  user: req.user.id });
        res.clearCookie( ACCESS_COOKIE_NAME, accessCookieOptions);
        res.clearCookie( REFRESH_COOKIE_NAME, refreshCookieOptions);
        res.clearCookie( REFRESH_COOKIE_NAME, { ...refreshCookieOptions, path: "/" });
        res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions);
        res.status(200).json({
            success: true,
            message: "All refresh-token sessions have been revoked"
        });
    })
