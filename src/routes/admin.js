const express = require('express');
const adminController = require('../controllers/adminController');
const { protectAdmin, restrictTo, checkPermission, logActivity } = require('../middleware/adminAuth');
const { uploadMedia, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

/**
 * @swagger
 * tags:
 *   - name: Admin Authentication
 *     description: Admin login and token management
 *   - name: Admin Dashboard
 *     description: Dashboard statistics and overview
 *   - name: Admin Media
 *     description: Media management (images, stickers, GIFs, audio, fonts)
 *   - name: Admin Users
 *     description: User management and moderation
 *   - name: Admin Videos
 *     description: Video content management
 *   - name: Admin Posts
 *     description: Social media post management
 *   - name: Admin Analytics
 *     description: Analytics and reporting
 *   - name: Admin Settings
 *     description: System settings and configuration
 *   - name: Admin Activity
 *     description: Activity logs and audit trails
 */

/**
 * @swagger
 * /api/v1/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@soloai.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Admin@123456
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                           enum: [superadmin, admin, moderator]
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', adminController.login);

/**
 * @swagger
 * /api/v1/admin/refresh-token:
 *   post:
 *     summary: Refresh admin access token
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh-token', adminController.refreshToken);

// ==================== PROTECTED ROUTES ====================

// All routes below require authentication
router.use(protectAdmin);

// ==================== DASHBOARD ====================

/**
 * @swagger
 * /api/v1/admin/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

// ==================== MEDIA MANAGEMENT ====================

/**
 * @swagger
 * /api/v1/admin/media:
 *   get:
 *     summary: Get all media with pagination and filters
 *     description: Retrieve media files with support for filtering by type, category, folder, and search. Returns counts by folder type.
 *     tags: [Admin Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by media type (comma-separated for multiple). Examples - image, sticker, gif, audio, font, or "image,sticker,gif"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (comma-separated for multiple). Examples - overlay, effect, transition, music, typography, or "overlay,effect"
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *         description: Filter by Cloudinary folder (comma-separated for multiple). Options - images, stickers, gifs, audio, fonts, or "images,gifs"
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status (true/false)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title, description, and tags
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by (e.g., createdAt, title, fileSize, usageCount)
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: Media retrieved successfully with counts by folder type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Media retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     media:
 *                       type: array
 *                       items:
 *                         type: object
 *                     counts:
 *                       type: object
 *                       properties:
 *                         images:
 *                           type: integer
 *                         stickers:
 *                           type: integer
 *                         gifs:
 *                           type: integer
 *                         audio:
 *                           type: integer
 *                         fonts:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get(
  '/media',
  checkPermission('media'),
  adminController.getAllMedia
);

/**
 * @swagger
 * /api/v1/admin/media:
 *   post:
 *     summary: Upload new media to Cloudinary (images, stickers, GIFs, audio, fonts)
 *     description: |
 *       Upload media files to organized Cloudinary folders:
 *       - **Images** → solo-ai/images (JPEG, PNG, WebP, SVG)
 *       - **Stickers** → solo-ai/stickers (PNG, WebP, SVG with transparency)
 *       - **GIFs** → solo-ai/gifs (GIF images or videos converted to GIF)
 *       - **Audio** → solo-ai/audio (MP3, WAV, OGG, M4A)
 *       - **Fonts** → solo-ai/fonts (TTF, OTF, WOFF, WOFF2)
 *       
 *       Videos (MP4, MOV, AVI, WebM, MKV) are automatically converted to GIFs (max 800px, 15 FPS).
 *     tags: [Admin Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - title
 *               - type
 *               - category
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: |
 *                   Media file to upload (max 50MB):
 *                   - Images: JPEG, PNG, GIF, WebP, SVG
 *                   - Audio: MP3, WAV, OGG, M4A
 *                   - Video: MP4, MOV, AVI, WebM, MKV (converted to GIF)
 *                   - Fonts: TTF, OTF, WOFF, WOFF2
 *               title:
 *                 type: string
 *                 example: Cool Overlay Effect
 *                 description: Name of the media file
 *               description:
 *                 type: string
 *                 example: A cool animated overlay for videos
 *                 description: Optional description
 *               type:
 *                 type: string
 *                 enum: [image, sticker, gif, audio, font]
 *                 description: |
 *                   Media type (determines Cloudinary folder):
 *                   - image: Regular images
 *                   - sticker: Images with transparency
 *                   - gif: GIF animations or videos
 *                   - audio: Audio files
 *                   - font: Font files
 *               category:
 *                 type: string
 *                 enum: [overlay, effect, transition, music, soundfx, filter, background, template, typography, other]
 *                 description: Category for organization and filtering
 *               tags:
 *                 type: string
 *                 description: JSON array or comma-separated string for search and filtering
 *                 example: '["animated", "cool", "effect"]'
 *     responses:
 *       201:
 *         description: Media uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Media uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     media:
 *                       type: object
 *                       properties:
 *                         cloudinaryUrl:
 *                           type: string
 *                         type:
 *                           type: string
 *                         cloudinaryFolder:
 *                           type: string
 *       400:
 *         description: Bad request - Invalid file type, missing fields, or validation error
 *       413:
 *         description: File too large (max 50MB)
 */
router.post(
  '/media',
  checkPermission('media'),
  logActivity('upload', 'media'),
  uploadMedia.single('file'),
  handleMulterError,
  adminController.createMedia
);

/**
 * @swagger
 * /api/v1/admin/media/{id}:
 *   get:
 *     summary: Get single media by ID
 *     tags: [Admin Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Media retrieved successfully
 *       404:
 *         description: Media not found
 */
router.get(
  '/media/:id',
  checkPermission('media'),
  adminController.getMedia
);

/**
 * @swagger
 * /api/v1/admin/media/{id}:
 *   patch:
 *     summary: Update media metadata
 *     tags: [Admin Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Media updated successfully
 *       404:
 *         description: Media not found
 */
router.patch(
  '/media/:id',
  checkPermission('media'),
  logActivity('update', 'media'),
  adminController.updateMedia
);

/**
 * @swagger
 * /api/v1/admin/media/{id}/toggle-status:
 *   patch:
 *     summary: Toggle media active status
 *     tags: [Admin Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status toggled successfully
 *       404:
 *         description: Media not found
 */
router.patch(
  '/media/:id/toggle-status',
  checkPermission('media'),
  logActivity('status_change', 'media'),
  adminController.toggleMediaStatus
);

/**
 * @swagger
 * /api/v1/admin/media/{id}:
 *   delete:
 *     summary: Delete single media
 *     tags: [Admin Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Media deleted successfully
 *       404:
 *         description: Media not found
 */
router.delete(
  '/media/:id',
  checkPermission('media'),
  logActivity('delete', 'media'),
  adminController.deleteMedia
);

/**
 * @swagger
 * /api/v1/admin/media/bulk-delete:
 *   post:
 *     summary: Bulk delete media
 *     tags: [Admin Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["507f1f77bcf86cd799439011", "507f191e810c19729de860ea"]
 *     responses:
 *       200:
 *         description: Media deleted successfully
 *       400:
 *         description: No IDs provided
 */
router.post(
  '/media/bulk-delete',
  restrictTo('superadmin', 'admin'),
  checkPermission('media'),
  logActivity('bulk_delete', 'media'),
  adminController.bulkDeleteMedia
);

// ==================== USER MANAGEMENT ====================

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users with pagination and filters
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: loginType
 *         schema:
 *           type: string
 *           enum: [email, google, apple]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get(
  '/users',
  checkPermission('users'),
  adminController.getAllUsers
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get user details with stats
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       404:
 *         description: User not found
 */
router.get(
  '/users/:id',
  checkPermission('users'),
  adminController.getUserDetails
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/ban:
 *   patch:
 *     summary: Ban, suspend, or reactivate user account
 *     description: |
 *       Update user account status to control access to the platform. This endpoint provides comprehensive account management capabilities.
 *       
 *       ## Account Status Types
 *       
 *       - **active**: Normal account with full access (default)
 *       - **banned**: Account prohibited from logging in and accessing API endpoints
 *       - **suspended**: Account temporarily restricted (similar to banned but semantically different)
 *       
 *       ## Ban Duration Options
 *       
 *       - **Temporary Ban/Suspension**: Provide `duration` in days (e.g., 7, 30, 90)
 *         - Automatically expires after the specified period
 *         - System auto-reactivates account when ban expires
 *         - User sees expiry date in error messages
 *       
 *       - **Permanent Ban/Suspension**: Omit the `duration` parameter
 *         - No automatic expiry
 *         - Requires manual admin reactivation
 *         - User sees "permanent ban" message
 *       
 *       ## How It Works
 *       
 *       ### When User is Banned/Suspended:
 *       1. **Login Attempt**: User receives detailed error with reason and expiry (if applicable)
 *       2. **API Requests**: All authenticated requests rejected with same error message
 *       3. **Token Validity**: Even valid JWT tokens cannot bypass ban status
 *       4. **Middleware Check**: Status validated on every protected route
 *       
 *       ### Automatic Expiry Process:
 *       1. System checks ban expiry on every login attempt and API request
 *       2. If ban has expired, status automatically changes to 'active'
 *       3. Ban reason and expiry fields are cleared
 *       4. User can login immediately without admin intervention
 *       
 *       ### Reactivation:
 *       - Set `status: "active"` to manually reactivate account
 *       - Clears all ban-related fields (reason, expiry)
 *       - User can login immediately
 *       
 *       ## Use Cases
 *       
 *       - **Temporary Ban (7 days)**: Minor policy violation, spam posting
 *       - **Temporary Ban (30 days)**: Moderate violation, repeated offenses
 *       - **Temporary Ban (90+ days)**: Serious violation, cooling-off period
 *       - **Permanent Ban**: Severe terms violation, illegal activity
 *       - **Suspension**: Account under review, pending investigation
 *       - **Reactivation**: Appeal accepted, ban expired manually
 *       
 *       ## Security & Audit
 *       
 *       - All ban actions logged with admin ID, timestamp, and reason
 *       - User login attempts while banned are logged
 *       - Ban history available in application logs
 *       
 *       ## User Experience
 *       
 *       Users receive clear, specific error messages:
 *       - Shows exact reason for ban/suspension
 *       - Shows expiry date for temporary bans
 *       - Indicates permanent vs temporary status
 *       - No ambiguity about account status
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (MongoDB ObjectId)
 *         example: "64a1b2c3d4e5f6789012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, banned, suspended]
 *                 example: banned
 *                 description: |
 *                   New account status:
 *                   - `active`: Normal account (reactivate banned/suspended user)
 *                   - `banned`: Prohibit account access
 *                   - `suspended`: Temporarily restrict account
 *               reason:
 *                 type: string
 *                 example: Violation of terms of service
 *                 description: |
 *                   Reason for ban/suspension (optional but recommended).
 *                   This message is shown to the user when they try to login.
 *                   Not required when reactivating (status: active).
 *                   Default: "No reason provided" if omitted.
 *               duration:
 *                 type: number
 *                 example: 30
 *                 minimum: 1
 *                 description: |
 *                   Ban duration in days (optional).
 *                   - If provided: Temporary ban with automatic expiry
 *                   - If omitted: Permanent ban requiring manual reactivation
 *                   - Only applicable when status is 'banned' or 'suspended'
 *                   - Examples: 7 (one week), 30 (one month), 90 (three months)
 *           examples:
 *             temp_ban_7_days:
 *               summary: Temporary Ban - 7 Days
 *               description: Ban user for one week (minor violation)
 *               value:
 *                 status: banned
 *                 reason: Spamming comments in multiple posts
 *                 duration: 7
 *             temp_ban_30_days:
 *               summary: Temporary Ban - 30 Days
 *               description: Ban user for one month (moderate violation)
 *               value:
 *                 status: banned
 *                 reason: Repeated policy violations despite warnings
 *                 duration: 30
 *             temp_ban_90_days:
 *               summary: Temporary Ban - 90 Days
 *               description: Ban user for three months (serious violation)
 *               value:
 *                 status: banned
 *                 reason: Harassment and abusive behavior toward other users
 *                 duration: 90
 *             permanent_ban:
 *               summary: Permanent Ban
 *               description: Ban user indefinitely (no expiry)
 *               value:
 *                 status: banned
 *                 reason: Serious terms of service violation - posting illegal content
 *             suspend_investigation:
 *               summary: Suspend Account - Investigation
 *               description: Temporarily suspend while investigating
 *               value:
 *                 status: suspended
 *                 reason: Account under security review for suspicious activity
 *                 duration: 7
 *             suspend_payment:
 *               summary: Suspend Account - Payment Issue
 *               description: Suspend due to payment problems
 *               value:
 *                 status: suspended
 *                 reason: Payment dispute - account suspended pending resolution
 *             reactivate_appeal:
 *               summary: Reactivate Account - Appeal Accepted
 *               description: Manually reactivate banned account after appeal
 *               value:
 *                 status: active
 *             reactivate_expired:
 *               summary: Reactivate Account - Manual Override
 *               description: Manually reactivate before ban expires
 *               value:
 *                 status: active
 *     responses:
 *       200:
 *         description: User account status updated successfully
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
 *                   example: User banned successfully
 *                   description: |
 *                     Message varies by action:
 *                     - "User banned successfully"
 *                     - "User suspended successfully"
 *                     - "User unbanned/reactivated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "64a1b2c3d4e5f6789012"
 *                         email:
 *                           type: string
 *                           example: "user@example.com"
 *                         name:
 *                           type: string
 *                           example: "John Doe"
 *                         status:
 *                           type: string
 *                           enum: [active, banned, suspended]
 *                           example: banned
 *                           description: Current account status
 *                         banReason:
 *                           type: string
 *                           example: "Spamming multiple posts"
 *                           nullable: true
 *                           description: Reason for ban/suspension (null if active)
 *                         banExpiry:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-11-18T22:59:55.000Z"
 *                           nullable: true
 *                           description: When ban expires (null if permanent or active)
 *             examples:
 *               temp_ban_response:
 *                 summary: Temporary Ban Response
 *                 value:
 *                   success: true
 *                   message: User banned successfully
 *                   data:
 *                     user:
 *                       _id: "64a1b2c3d4e5f6789012"
 *                       email: "user@example.com"
 *                       name: "John Doe"
 *                       status: banned
 *                       banReason: "Spamming multiple posts"
 *                       banExpiry: "2025-11-18T22:59:55.000Z"
 *               permanent_ban_response:
 *                 summary: Permanent Ban Response
 *                 value:
 *                   success: true
 *                   message: User banned successfully
 *                   data:
 *                     user:
 *                       _id: "64a1b2c3d4e5f6789012"
 *                       email: "user@example.com"
 *                       name: "John Doe"
 *                       status: banned
 *                       banReason: "Serious terms violation"
 *                       banExpiry: null
 *               reactivate_response:
 *                 summary: Reactivation Response
 *                 value:
 *                   success: true
 *                   message: User unbanned/reactivated successfully
 *                   data:
 *                     user:
 *                       _id: "64a1b2c3d4e5f6789012"
 *                       email: "user@example.com"
 *                       name: "John Doe"
 *                       status: active
 *                       banReason: null
 *                       banExpiry: null
 *       400:
 *         description: Invalid request - bad status value or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_status:
 *                 summary: Invalid Status Value
 *                 value:
 *                   success: false
 *                   message: "Invalid status. Must be one of: active, banned, suspended"
 *               validation_error:
 *                 summary: Validation Error
 *                 value:
 *                   success: false
 *                   message: "Validation error"
 *                   errors:
 *                     - field: "status"
 *                       message: "Status is required"
 *       401:
 *         description: Unauthorized - admin authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "User not found"
 */
router.patch(
  '/users/:id/ban',
  restrictTo('superadmin', 'admin'),
  checkPermission('users'),
  logActivity('update', 'user'),
  adminController.banUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Delete user account and all related data
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete(
  '/users/:id',
  restrictTo('superadmin'),
  logActivity('delete', 'user'),
  adminController.deleteUser
);

// ==================== VIDEO MANAGEMENT ====================

/**
 * @swagger
 * /api/v1/admin/videos:
 *   get:
 *     summary: Get all videos
 *     tags: [Admin Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [uploading, processing, completed, failed]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 */
router.get('/videos', checkPermission('videos'), adminController.getAllVideos);

/**
 * @swagger
 * /api/v1/admin/videos/{id}:
 *   delete:
 *     summary: Delete video
 *     tags: [Admin Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Video deleted successfully
 *       404:
 *         description: Video not found
 */
router.delete(
  '/videos/:id',
  restrictTo('superadmin', 'admin'),
  checkPermission('videos'),
  logActivity('delete', 'video'),
  adminController.deleteVideo
);

// ==================== POST MANAGEMENT ====================

/**
 * @swagger
 * /api/v1/admin/posts:
 *   get:
 *     summary: Get all posts
 *     tags: [Admin Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: bundleStatus
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 */
router.get('/posts', checkPermission('posts'), adminController.getAllPosts);

/**
 * @swagger
 * /api/v1/admin/posts/{id}:
 *   delete:
 *     summary: Delete post
 *     tags: [Admin Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       404:
 *         description: Post not found
 */
router.delete(
  '/posts/:id',
  restrictTo('superadmin', 'admin'),
  checkPermission('posts'),
  logActivity('delete', 'post'),
  adminController.deletePost
);

// ==================== ANALYTICS ====================

/**
 * @swagger
 * /api/v1/admin/analytics/overview:
 *   get:
 *     summary: Get analytics overview
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Analytics overview retrieved
 */
router.get('/analytics/overview', checkPermission('analytics'), adminController.getAnalyticsOverview);

/**
 * @swagger
 * /api/v1/admin/analytics/users:
 *   get:
 *     summary: Get user growth analytics
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: User analytics retrieved
 */
router.get('/analytics/users', checkPermission('analytics'), adminController.getUserAnalytics);

// ==================== SETTINGS ====================

/**
 * @swagger
 * /api/v1/admin/settings:
 *   get:
 *     summary: Get system settings with configurable disclosure levels
 *     description: |
 *       Retrieve system settings from database with three disclosure levels:
 *       
 *       **Disclosure Levels:**
 *       - `public` (default): Secrets completely removed - safe for all admin roles
 *       - `masked` (superadmin only): Secrets partially shown (e.g., "sk_l••••••••x789")
 *       - `full` (superadmin only): Complete secrets shown in plain text (⚠️ use with caution)
 *       
 *       **Access Control:**
 *       - Any admin role can use `public` disclosure
 *       - Only superadmin can use `masked` or `full` disclosure
 *       - Non-superadmin requests for masked/full will silently fallback to public
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: disclosure
 *         schema:
 *           type: string
 *           enum: [public, masked, full]
 *           default: public
 *         description: |
 *           Disclosure level for sensitive settings:
 *           - `public`: No secrets (default, all roles)
 *           - `masked`: Masked secrets like "sk_l••••••••x789" (superadmin only)
 *           - `full`: Complete secrets in plain text (superadmin only, ⚠️ handle with care)
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Settings retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     disclosure:
 *                       type: string
 *                       enum: [public, masked, full]
 *                       description: Actual disclosure level applied
 *                       example: public
 *                     warning:
 *                       type: string
 *                       description: Security warning (only for full disclosure)
 *                       example: "⚠️ This response contains sensitive secrets. Handle with care!"
 *                     settings:
 *                       type: object
 *                       properties:
 *                         cloudinary:
 *                           type: object
 *                           properties:
 *                             cloudName:
 *                               type: string
 *                               example: "your-cloud-name"
 *                             apiKey:
 *                               type: string
 *                               example: "123456789012345"
 *                             apiSecret:
 *                               type: string
 *                               description: Removed in public, masked in masked (abcd••••••efgh), full in full
 *                               example: "abcd••••••••efgh"
 *                         mongodb:
 *                           type: object
 *                           properties:
 *                             uri:
 *                               type: string
 *                               description: Removed in public, masked in masked, full in full
 *                               example: "mong••••••••3306"
 *                         email:
 *                           type: object
 *                           properties:
 *                             provider:
 *                               type: string
 *                               enum: [resend, smtp]
 *                             resend:
 *                               type: object
 *                               properties:
 *                                 apiKey:
 *                                   type: string
 *                                   description: Removed in public, masked in masked, full in full
 *                                 fromEmail:
 *                                   type: string
 *                                 fromName:
 *                                   type: string
 *                             smtp:
 *                               type: object
 *                               properties:
 *                                 host:
 *                                   type: string
 *                                 port:
 *                                   type: number
 *                                 secure:
 *                                   type: boolean
 *                                 user:
 *                                   type: string
 *                                 pass:
 *                                   type: string
 *                                   description: Removed in public, masked in masked, full in full
 *                                 fromEmail:
 *                                   type: string
 *                                 fromName:
 *                                   type: string
 *                         videoUpload:
 *                           type: object
 *                           properties:
 *                             maxFileSize:
 *                               type: number
 *                               example: 100
 *                             allowedFormats:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             uploadPath:
 *                               type: string
 *                         apiKeys:
 *                           type: object
 *                           properties:
 *                             geminiApiKey:
 *                               type: string
 *                               description: Removed in public, masked in masked, full in full
 *                             bundleSocialApiKey:
 *                               type: string
 *                               description: Removed in public, masked in masked, full in full
 *                             bundleSocialOrgId:
 *                               type: string
 *                         urls:
 *                           type: object
 *                           properties:
 *                             productionUrl:
 *                               type: string
 *                             frontendUrl:
 *                               type: string
 *                         app:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             description:
 *                               type: string
 *                             supportEmail:
 *                               type: string
 *                             maintenanceMode:
 *                               type: boolean
 *                             allowNewRegistrations:
 *                               type: boolean
 *                         features:
 *                           type: object
 *                           properties:
 *                             videoEditingEnabled:
 *                               type: boolean
 *                             socialMediaIntegrationEnabled:
 *                               type: boolean
 *                             aiAssistantEnabled:
 *                               type: boolean
 *                             adminPanelEnabled:
 *                               type: boolean
 *       403:
 *         description: Access denied - superadmin role required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Only superadmin can view settings
 */
router.get('/settings', restrictTo('superadmin'), adminController.getSettings);

/**
 * @swagger
 * /api/v1/admin/settings:
 *   patch:
 *     summary: Update system settings (superadmin only)
 *     description: |
 *       Update system configuration stored in database. Changes take effect immediately.
 *       Secrets (JWT, API keys) are excluded - use environment variables for those.
 *       
 *       **Updateable Settings:**
 *       - Cloudinary (cloud name, API key, API secret)
 *       - MongoDB URI
 *       - Email settings (provider: resend/smtp, API keys, SMTP credentials, from email/name)
 *       - Video upload settings (max size, formats, path)
 *       - API keys (Gemini, Bundle.social API key and Org ID)
 *       - URLs (production, frontend)
 *       - App settings (name, description, maintenance mode)
 *       - Feature flags (enable/disable features)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cloudinary:
 *                 type: object
 *                 properties:
 *                   cloudName:
 *                     type: string
 *                     example: "your-cloud-name"
 *                   apiKey:
 *                     type: string
 *                     example: "123456789012345"
 *                   apiSecret:
 *                     type: string
 *                     example: "abcdefghijklmnopqrstuvwxyz"
 *               mongodb:
 *                 type: object
 *                 properties:
 *                   uri:
 *                     type: string
 *                     example: "mongodb+srv://user:pass@cluster.mongodb.net/db"
 *               email:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     enum: [resend, smtp]
 *                     example: "resend"
 *                     description: "Email service provider (resend or smtp)"
 *                   resend:
 *                     type: object
 *                     properties:
 *                       apiKey:
 *                         type: string
 *                         example: "re_xxxxxxxxxxxx"
 *                       fromEmail:
 *                         type: string
 *                         example: "noreply@soloai.com"
 *                       fromName:
 *                         type: string
 *                         example: "Solo AI"
 *                   smtp:
 *                     type: object
 *                     properties:
 *                       host:
 *                         type: string
 *                         example: "smtp.gmail.com"
 *                       port:
 *                         type: integer
 *                         example: 587
 *                       secure:
 *                         type: boolean
 *                         example: false
 *                       user:
 *                         type: string
 *                         example: "your-email@gmail.com"
 *                       pass:
 *                         type: string
 *                         example: "your-gmail-app-password"
 *                       fromEmail:
 *                         type: string
 *                         example: "your-email@gmail.com"
 *                       fromName:
 *                         type: string
 *                         example: "Solo AI"
 *               videoUpload:
 *                 type: object
 *                 properties:
 *                   maxFileSize:
 *                     type: integer
 *                     example: 100
 *                     description: "Max file size in MB (10-500)"
 *                   allowedFormats:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["mp4", "avi", "mov"]
 *                   uploadPath:
 *                     type: string
 *                     example: "./uploads/videos"
 *               apiKeys:
 *                 type: object
 *                 properties:
 *                   geminiApiKey:
 *                     type: string
 *                     example: "AIzaxxxxxxxxxxxxxxxxxxxxxxxx"
 *                   bundleSocialApiKey:
 *                     type: string
 *                     example: "bundle_xxxxxxxxxxxx"
 *                   bundleSocialOrgId:
 *                     type: string
 *                     example: "org_xxxxxxxxxxxx"
 *                     description: "Bundle.social organization ID"
 *               urls:
 *                 type: object
 *                 properties:
 *                   productionUrl:
 *                     type: string
 *                     example: "https://api.soloai.com"
 *                   frontendUrl:
 *                     type: string
 *                     example: "https://app.soloai.com"
 *               app:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Solo AI"
 *                   description:
 *                     type: string
 *                   supportEmail:
 *                     type: string
 *                   maintenanceMode:
 *                     type: boolean
 *                     example: false
 *                   allowNewRegistrations:
 *                     type: boolean
 *                     example: true
 *               features:
 *                 type: object
 *                 properties:
 *                   videoEditingEnabled:
 *                     type: boolean
 *                   socialMediaIntegrationEnabled:
 *                     type: boolean
 *                   aiAssistantEnabled:
 *                     type: boolean
 *                   adminPanelEnabled:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Invalid settings values
 *       403:
 *         description: Only superadmin can update settings
 */
router.patch(
  '/settings',
  restrictTo('superadmin'),
  logActivity('settings_update', 'settings'),
  adminController.updateSettings
);

// ==================== ACTIVITY LOGS ====================

/**
 * @swagger
 * /api/v1/admin/activity-logs:
 *   get:
 *     summary: Get admin activity logs
 *     tags: [Admin Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: adminId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity logs retrieved
 */
router.get('/activity-logs', restrictTo('superadmin', 'admin'), adminController.getActivityLogs);

// ==================== ADMIN MANAGEMENT (SUPERADMIN ONLY) ====================

/**
 * @swagger
 * tags:
 *   - name: Admin Management
 *     description: Superadmin exclusive - manage admin accounts
 */

/**
 * @swagger
 * /api/v1/admin/admins:
 *   get:
 *     summary: Get all admin users (superadmin only)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [superadmin, admin, moderator]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Admins retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     admins:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           role:
 *                             type: string
 *                           permissions:
 *                             type: array
 *                             items:
 *                               type: string
 *                           isActive:
 *                             type: boolean
 *                           createdBy:
 *                             type: object
 *                           createdAt:
 *                             type: string
 *       403:
 *         description: Access denied - superadmin only
 */
router.get(
  '/admins',
  restrictTo('superadmin'),
  adminController.getAllAdmins
);

/**
 * @swagger
 * /api/v1/admin/admins:
 *   post:
 *     summary: Create new admin user (superadmin only)
 *     description: |
 *       Create a new admin account with specified role and permissions.
 *       Only superadmin can create new admin users.
 *       
 *       **Roles:**
 *       - `superadmin`: Full system access (all permissions)
 *       - `admin`: Standard admin with configurable permissions
 *       - `moderator`: Limited admin with specific permissions
 *       
 *       **Permissions:**
 *       - `users`: Manage user accounts
 *       - `media`: Manage media library
 *       - `videos`: Manage videos
 *       - `posts`: Manage social media posts
 *       - `analytics`: View analytics
 *       - `settings`: Modify system settings
 *       - `socialaccounts`: Manage social accounts
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Admin
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.admin@soloai.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *               role:
 *                 type: string
 *                 enum: [superadmin, admin, moderator]
 *                 default: admin
 *                 example: admin
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [users, media, videos, posts, analytics, settings, socialaccounts]
 *                 example: ["users", "media", "posts"]
 *           examples:
 *             full_admin:
 *               summary: Full Admin
 *               value:
 *                 name: John Admin
 *                 email: john.admin@soloai.com
 *                 password: SecurePass123!
 *                 role: admin
 *                 permissions: ["users", "media", "videos", "posts", "analytics"]
 *             moderator:
 *               summary: Content Moderator
 *               value:
 *                 name: Jane Moderator
 *                 email: jane.mod@soloai.com
 *                 password: ModPass123!
 *                 role: moderator
 *                 permissions: ["users", "media", "posts"]
 *     responses:
 *       201:
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *       400:
 *         description: Invalid input or email already exists
 *       403:
 *         description: Access denied - superadmin only
 */
router.post(
  '/admins',
  restrictTo('superadmin'),
  logActivity('create', 'admin'),
  adminController.createAdmin
);

/**
 * @swagger
 * /api/v1/admin/admins/{id}:
 *   patch:
 *     summary: Update admin user (superadmin only)
 *     description: |
 *       Update admin details including role and permissions.
 *       Cannot modify another superadmin account.
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [superadmin, admin, moderator]
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Admin updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Cannot modify superadmin or access denied
 *       404:
 *         description: Admin not found
 */
router.patch(
  '/admins/:id',
  restrictTo('superadmin'),
  logActivity('update', 'admin'),
  adminController.updateAdmin
);

/**
 * @swagger
 * /api/v1/admin/admins/{id}/restrict:
 *   patch:
 *     summary: Restrict or unrestrict admin account (superadmin only)
 *     description: |
 *       Activate or deactivate an admin account.
 *       Deactivated admins cannot login or access the system.
 *       Cannot restrict superadmin accounts or your own account.
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: true to activate, false to deactivate
 *                 example: false
 *               reason:
 *                 type: string
 *                 description: Reason for restriction (optional)
 *                 example: Violated admin policies
 *           examples:
 *             restrict:
 *               summary: Restrict Admin
 *               value:
 *                 isActive: false
 *                 reason: Violated admin policies
 *             unrestrict:
 *               summary: Unrestrict Admin
 *               value:
 *                 isActive: true
 *                 reason: Issues resolved
 *     responses:
 *       200:
 *         description: Admin restricted/unrestricted successfully
 *       400:
 *         description: Missing isActive field
 *       403:
 *         description: Cannot restrict superadmin or self
 *       404:
 *         description: Admin not found
 */
router.patch(
  '/admins/:id/restrict',
  restrictTo('superadmin'),
  logActivity('restrict', 'admin'),
  adminController.restrictAdmin
);

/**
 * @swagger
 * /api/v1/admin/admins/{id}:
 *   delete:
 *     summary: Delete admin user (superadmin only)
 *     description: |
 *       Permanently delete an admin account.
 *       Cannot delete superadmin accounts or your own account.
 *       This action cannot be undone.
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
 *     responses:
 *       200:
 *         description: Admin deleted successfully
 *       403:
 *         description: Cannot delete superadmin or self
 *       404:
 *         description: Admin not found
 */
router.delete(
  '/admins/:id',
  restrictTo('superadmin'),
  logActivity('delete', 'admin'),
  adminController.deleteAdmin
);

module.exports = router;

