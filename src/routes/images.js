const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { protectAdmin } = require('../middleware/adminAuth');
const { upload } = require('../middleware/imageUpload');

/**
 * @swagger
 * tags:
 *   name: Images
 *   description: Image upload, serve, and management endpoints
 */

/**
 * @swagger
 * /api/v1/images/upload:
 *   post:
 *     summary: Upload an image to the server
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     description: Admin only - Upload an image to the server
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
 *                 description: Image file (jpg, jpeg, png, gif, webp)
 *     responses:
 *       201:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: http://localhost:5000/api/v1/images/serve/1703012345678-image.jpg
 *                     filename:
 *                       type: string
 *                       example: 1703012345678-image.jpg
 *                     size:
 *                       type: number
 *                       example: 102400
 *                     mimetype:
 *                       type: string
 *                       example: image/jpeg
 *       400:
 *         description: No image file provided or invalid file type
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized - Admin role required
 */
router.post('/upload', protectAdmin, upload.single('image'), imageController.uploadImage);

/**
 * @swagger
 * /api/v1/images/serve/{filename}:
 *   get:
 *     summary: Serve an uploaded image publicly
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename of the image to serve
 *         example: 1703012345678-image.jpg
 *     responses:
 *       200:
 *         description: Image file
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/gif:
 *             schema:
 *               type: string
 *               format: binary
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Image not found
 */
router.get('/serve/:filename', imageController.serveImage);

/**
 * @swagger
 * /api/v1/images/{filename}:
 *   delete:
 *     summary: Delete an uploaded image (Admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     description: Admin only - Delete an uploaded image from the server
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename of the image to delete
 *         example: 1703012345678-image.jpg
 *     responses:
 *       200:
 *         description: Image deleted successfully
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
 *                   example: Image deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized - Admin role required
 *       404:
 *         description: Image not found
 */
router.delete('/:filename', protectAdmin, imageController.deleteImage);

/**
 * @swagger
 * /api/v1/images:
 *   get:
 *     summary: List all uploaded images (Admin only)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     description: Admin only - Get a list of all uploaded images
 *     responses:
 *       200:
 *         description: List of all uploaded images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                         example: 1703012345678-image.jpg
 *                       url:
 *                         type: string
 *                         example: http://localhost:5000/api/v1/images/serve/1703012345678-image.jpg
 *                       size:
 *                         type: number
 *                         example: 102400
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized - Admin role required
 */
router.get('/', protectAdmin, imageController.listImages);

module.exports = router;
