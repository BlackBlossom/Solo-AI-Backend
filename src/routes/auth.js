const express = require('express');
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validation');
// const { authLimiter } = require('../middleware/rateLimiting'); // DISABLED FOR TESTING
const { registerSchema, loginSchema, refreshTokenSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and account management
 */

// Apply auth rate limiting to all routes - DISABLED FOR TESTING
// router.use(authLimiter);

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: |
 *       Register a new user with different authentication types:
 *       - **Email**: Requires password and confirmPassword
 *       - **Google**: Only requires email and name (no password)
 *       - **Apple**: Only requires email and name (no password)
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             email_registration:
 *               summary: Email Registration
 *               description: Register with email and password
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 password: "SecurePass123!"
 *                 confirmPassword: "SecurePass123!"
 *                 loginType: "email"
 *                 dateOfBirth: "1990-05-15"
 *                 gender: "male"
 *                 phoneNumber: "+1234567890"
 *             google_registration:
 *               summary: Google Registration
 *               description: Register with Google OAuth (no password required)
 *               value:
 *                 name: "John Doe"
 *                 email: "john@gmail.com"
 *                 loginType: "google"
 *                 dateOfBirth: "1990-05-15"
 *                 gender: "male"
 *                 phoneNumber: "+1234567890"
 *             apple_registration:
 *               summary: Apple Registration
 *               description: Register with Apple Sign-In (no password required)
 *               value:
 *                 name: "John Doe"
 *                 email: "john@icloud.com"
 *                 loginType: "apple"
 *                 dateOfBirth: "1990-05-15"
 *                 gender: "male"
 *                 phoneNumber: "+1234567890"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     description: |
 *       Login with different authentication types:
 *       - **Email**: Requires password
 *       - **Google**: Only requires email (OAuth handled externally)
 *       - **Apple**: Only requires email (OAuth handled externally)
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             email_login:
 *               summary: Email Login
 *               description: Login with email and password
 *               value:
 *                 email: "john@example.com"
 *                 password: "SecurePass123!"
 *                 loginType: "email"
 *             google_login:
 *               summary: Google Login
 *               description: Login with Google OAuth (no password required)
 *               value:
 *                 email: "john@gmail.com"
 *                 loginType: "google"
 *             apple_login:
 *               summary: Apple Login
 *               description: Login with Apple Sign-In (no password required)
 *               value:
 *                 email: "john@icloud.com"
 *                 loginType: "apple"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Use a valid refresh token to get a new access token. The refresh token will be rotated (invalidated and replaced with a new one).
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           examples:
 *             refresh_token:
 *               summary: Refresh Token
 *               description: Provide a valid refresh token to get new access and refresh tokens
 *               value:
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MDFhMmY5ZGJkOTQwMDEyNzg5YWJjZCIsImlhdCI6MTcyODA1MzI0MSwiZXhwIjoxNzI4NjU4MDQxfQ.example_refresh_token_signature"
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Tokens refreshed successfully
 *                 data:
 *                   $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Password reset email sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *               password:
 *                 type: string
 *                 description: New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character
 *                 minLength: 8
 *                 example: NewPassword123!
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/reset-password', authController.resetPassword);

// Protected routes (require authentication)
const { protect } = require('../middleware/auth');

router.use(protect); // All routes after this middleware require authentication

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/v1/auth/update-password:
 *   patch:
 *     summary: Update user password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.patch('/update-password', authController.updatePassword);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/me', authController.getMe);

module.exports = router;