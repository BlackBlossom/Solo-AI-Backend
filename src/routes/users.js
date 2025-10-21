const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadMedia, handleMulterError } = require('../middleware/upload');
const { validate, validateImageUpload } = require('../middleware/validation');
const { updateProfileSchema, deleteAccountSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile and account management
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
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
 *   put:
 *     summary: Update user profile
 *     description: Update user profile information. All fields are optional.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdateRequest'
 *           examples:
 *             update_profile:
 *               summary: Update Profile
 *               description: Update user profile with personal information
 *               value:
 *                 name: "John Smith"
 *                 dateOfBirth: "1990-05-15"
 *                 gender: "male"
 *                 phoneNumber: "+1234567890"
 *                 preferences:
 *                   defaultPlatforms: ["instagram", "tiktok"]
 *                   autoGenerateCaption: true
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router
  .route('/profile')
  .get(userController.getProfile)
  .put(validate(updateProfileSchema), userController.updateProfile);

/**
 * @swagger
 * /api/v1/users/preferences:
 *   patch:
 *     summary: Update user preferences
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *               privacy:
 *                 type: object
 *                 properties:
 *                   profileVisible:
 *                     type: boolean
 *               language:
 *                 type: string
 *                 example: en
 *               timezone:
 *                 type: string
 *                 example: America/New_York
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.patch('/preferences', userController.updatePreferences);

/**
 * @swagger
 * /api/v1/users/profile-picture:
 *   post:
 *     summary: Upload profile picture to Cloudinary
 *     description: |
 *       Upload a profile picture directly to Cloudinary cloud storage.
 *       - Supports JPEG, PNG, GIF, WebP, and SVG formats
 *       - Maximum file size: 50MB
 *       - Automatically deletes old profile picture from Cloudinary if it exists
 *       - Returns Cloudinary URL and metadata
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture image file (JPEG, PNG, GIF, WebP, SVG, max 50MB)
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully to Cloudinary
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
 *                   example: Profile picture uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     profilePicture:
 *                       type: string
 *                       description: Cloudinary URL of uploaded profile picture
 *                       example: https://res.cloudinary.com/your-cloud/image/upload/v1234567890/solo-ai/profiles/profile-123_456789.jpg
 *                     cloudinary:
 *                       type: object
 *                       description: Additional Cloudinary metadata
 *                       properties:
 *                         publicId:
 *                           type: string
 *                           description: Cloudinary public ID for the image
 *                           example: solo-ai/profiles/profile-123_456789
 *                         format:
 *                           type: string
 *                           description: Image format
 *                           example: jpg
 *                         width:
 *                           type: number
 *                           description: Image width in pixels
 *                           example: 1024
 *                         height:
 *                           type: number
 *                           description: Image height in pixels
 *                           example: 1024
 *       400:
 *         description: Invalid file, file too large, or upload failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               no_file:
 *                 summary: No file provided
 *                 value:
 *                   success: false
 *                   message: Please upload a profile picture
 *               file_too_large:
 *                 summary: File size exceeds limit
 *                 value:
 *                   success: false
 *                   message: File too large. Maximum size is 50MB for media uploads
 *               invalid_type:
 *                 summary: Invalid file type
 *                 value:
 *                   success: false
 *                   message: Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/profile-picture',
  uploadMedia.single('image'),
  handleMulterError,
  validateImageUpload,
  userController.uploadProfilePicture
);

/**
 * @swagger
 * /api/v1/users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
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
 *                     videosCount:
 *                       type: number
 *                       example: 25
 *                     postsCount:
 *                       type: number
 *                       example: 47
 *                     totalViews:
 *                       type: number
 *                       example: 12543
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         likes:
 *                           type: number
 *                         comments:
 *                           type: number
 *                         shares:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/stats', userController.getUserStats);

/**
 * @swagger
 * /api/v1/users/account:
 *   delete:
 *     summary: Delete user account and all related data
 *     description: |
 *       Permanently deletes the user account and all associated data including:
 *       - User profile and authentication data
 *       - All uploaded videos and posts (database records)
 *       - Connected social media accounts (database records)
 *       - Bundle.social team (automatically deletes all uploads, posts, and social connections)
 *       - User preferences and settings
 *       
 *       **Efficient Cleanup**: Deleting the Bundle.social team automatically removes all related data 
 *       (uploads, posts, social accounts) from the Bundle.social platform in a single operation.
 *       
 *       **Warning**: This action is irreversible!
 *       
 *       **For email users**: Password verification is required
 *       **For social users** (Google/Apple): No password required
 *     tags: [Users]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: User password (required only for email login type)
 *                 example: "SecurePass123!"
 *           examples:
 *             email_user_deletion:
 *               summary: Delete Email User Account
 *               description: For users with email login type (password required)
 *               value:
 *                 password: "SecurePass123!"
 *             social_user_deletion:
 *               summary: Delete Social User Account
 *               description: For users with Google/Apple login (no password required)
 *               value: {}
 *     responses:
 *       200:
 *         description: Account and all related data deleted successfully
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
 *                   example: Account and all related data deleted successfully
 *       400:
 *         description: Password required or incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/account', validate(deleteAccountSchema), userController.deleteAccount);

/**
 * @swagger
 * /api/v1/users/all:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         total:
 *                           type: number
 *                         pages:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/all', userController.getAllUsers);

module.exports = router;