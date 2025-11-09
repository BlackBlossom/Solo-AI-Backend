const LegalContent = require('../models/LegalContent');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendNotFound,
  sendError
} = require('../utils/response');
const logger = require('../utils/logger');

/**
 * @desc Get legal content by type (for public viewing)
 * @route GET /api/v1/legal/:type
 * @access Public
 */
exports.getLegalContent = async (req, res) => {
  try {
    const { type } = req.params;

    // Validate type
    const validTypes = ['privacy_policy', 'terms_of_use', 'faq'];
    if (!validTypes.includes(type)) {
      return sendBadRequest(
        res,
        `Invalid type. Must be one of: ${validTypes.join(', ')}`
      );
    }

    const content = await LegalContent.findOne({
      type,
      isPublished: true,
    }).select('-__v');

    if (!content) {
      return sendNotFound(res, `${type.replace('_', ' ')} not found`);
    }

    return sendSuccess(res, { content });
  } catch (error) {
    logger.error('Error getting legal content:', error);
    return sendError(res, 'Failed to retrieve legal content');
  }
};

/**
 * @desc Get HTML content for web view rendering
 * @route GET /api/v1/legal/:type/view
 * @access Public
 */
exports.getLegalContentView = async (req, res) => {
  try {
    const { type } = req.params;

    // Validate type
    const validTypes = ['privacy_policy', 'terms_of_use', 'faq'];
    if (!validTypes.includes(type)) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Request</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 8px;
              text-align: center;
            }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Invalid Request</h1>
            <p>Invalid content type. Must be one of: ${validTypes.join(', ')}</p>
          </div>
        </body>
        </html>
      `);
    }

    const content = await LegalContent.findOne({
      type,
      isPublished: true,
    });

    if (!content) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Content Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 8px;
              text-align: center;
            }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Content Not Found</h1>
            <p>The requested content is not available at this time.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Generate HTML page matching mobile app design
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <title>${content.title} - SoloAI</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: #1a0a2e;
          color: #e0e0e0;
          line-height: 1.6;
          overflow-x: hidden;
          min-height: 100vh;
        }
        .header {
          background: #1a0a2e;
          padding: 16px 20px;
          position: sticky;
          top: 0;
          z-index: 1000;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #ffffff;
          text-align: center;
        }
        .content-wrapper {
          padding: 16px 20px 24px;
        }
        .content-card {
          background: rgba(60, 40, 100, 0.25);
          border-radius: 16px;
          padding: 24px 20px;
          margin-bottom: 16px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .content h2 {
          color: #ffffff;
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 16px;
          line-height: 1.4;
        }
        .content h3 {
          color: #e0e0e0;
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 20px;
          margin-bottom: 12px;
        }
        .content p {
          color: #b8b8b8;
          font-size: 0.95rem;
          line-height: 1.7;
          margin-bottom: 16px;
        }
        .content ul,
        .content ol {
          margin-left: 0;
          padding-left: 20px;
          margin-bottom: 16px;
        }
        .content li {
          color: #b8b8b8;
          font-size: 0.95rem;
          line-height: 1.7;
          margin-bottom: 12px;
        }
        .content li::marker {
          color: #8b7ab8;
        }
        .content a {
          color: #9b7ed9;
          text-decoration: none;
          font-weight: 500;
        }
        .content strong {
          color: #ffffff;
          font-weight: 600;
        }
        .content blockquote {
          border-left: 3px solid #8b7ab8;
          padding-left: 16px;
          margin: 16px 0;
          font-style: italic;
          color: #a0a0a0;
          background: rgba(139, 122, 184, 0.08);
          padding: 12px 16px;
          border-radius: 8px;
        }
        .footer {
          background: rgba(60, 40, 100, 0.15);
          padding: 24px 20px;
          text-align: center;
          margin-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .footer p {
          color: #808080;
          font-size: 0.85rem;
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .footer a {
          color: #9b7ed9;
          text-decoration: none;
        }
        /* Ensure content sections are separated */
        .content > h2:not(:first-child) {
          margin-top: 32px;
        }
        /* Better spacing for nested lists */
        .content ul ul,
        .content ol ol {
          margin-top: 8px;
          margin-bottom: 8px;
        }
        /* Responsive adjustments */
        @media (max-width: 400px) {
          .content-card {
            padding: 20px 16px;
            border-radius: 12px;
          }
          .content h2 {
            font-size: 1.15rem;
          }
          .content p,
          .content li {
            font-size: 0.9rem;
          }
        }
        /* Better text rendering */
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        /* Hide scrollbar but keep functionality */
        body::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${content.title}</h1>
      </div>
      <div class="content-wrapper">
        <div class="content-card">
          <div class="content">
            ${content.htmlContent}
          </div>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} SoloAI. All rights reserved.</p>
        <p><a href="mailto:support@soloai.app">support@soloai.app</a></p>
      </div>
    </body>
    </html>
  `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('Error rendering legal content view:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            text-align: center;
          }
          h1 { color: #d32f2f; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Error</h1>
          <p>An error occurred while loading the content. Please try again later.</p>
        </div>
      </body>
      </html>
    `);
  }
};

/**
 * @desc Get all legal content links for app display
 * @route GET /api/v1/legal/links
 * @access Public
 */
exports.getLegalLinks = async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/legal`;

    const contents = await LegalContent.find({ isPublished: true }).select(
      'type title updatedAt version'
    );

    const links = contents.map((content) => ({
      type: content.type,
      title: content.title,
      url: `${baseUrl}/${content.type}/view`,
      apiUrl: `${baseUrl}/${content.type}`,
      lastUpdated: content.updatedAt,
      version: content.version,
    }));

    return sendSuccess(res, { links });
  } catch (error) {
    logger.error('Error getting legal links:', error);
    return sendError(res, 'Failed to retrieve legal content links');
  }
};

// ============================================
// ADMIN ROUTES - Content Management
// ============================================

/**
 * @desc Get all legal content (Admin)
 * @route GET /api/v1/admin/legal
 * @access Private (Admin)
 */
exports.getAllLegalContent = async (req, res) => {
  try {
    const contents = await LegalContent.find()
      .populate('lastUpdatedBy', 'name email')
      .sort('-updatedAt');

    return sendSuccess(res, { contents }, contents.length);
  } catch (error) {
    logger.error('Error getting all legal content:', error);
    return sendError(res, 'Failed to retrieve legal content');
  }
};

/**
 * @desc Get single legal content by type (Admin)
 * @route GET /api/v1/admin/legal/:type
 * @access Private (Admin)
 */
exports.getAdminLegalContent = async (req, res) => {
  try {
    const { type } = req.params;

    const content = await LegalContent.findOne({ type }).populate(
      'lastUpdatedBy',
      'name email'
    );

    if (!content) {
      return sendNotFound(res, 'Legal content not found');
    }

    return sendSuccess(res, { content });
  } catch (error) {
    logger.error('Error getting admin legal content:', error);
    return sendError(res, 'Failed to retrieve legal content');
  }
};

/**
 * @desc Create or update legal content (Admin)
 * @route POST /api/v1/admin/legal
 * @access Private (Admin)
 */
exports.createOrUpdateLegalContent = async (req, res) => {
  try {
    const { type, title, content, htmlContent, isPublished } = req.body;

    // Validate required fields
    if (!type || !title || !content || !htmlContent) {
      return sendBadRequest(
        res,
        'Please provide type, title, content, and htmlContent'
      );
    }

    // Validate type
    const validTypes = ['privacy_policy', 'terms_of_use', 'faq'];
    if (!validTypes.includes(type)) {
      return sendBadRequest(
        res,
        `Invalid type. Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Find existing content or create new
    let legalContent = await LegalContent.findOne({ type });

    if (legalContent) {
      // Update existing content
      legalContent.title = title;
      legalContent.content = content;
      legalContent.htmlContent = htmlContent;
      legalContent.lastUpdatedBy = req.admin._id;
      legalContent.version += 1;
      
      if (isPublished !== undefined) {
        legalContent.isPublished = isPublished;
      }

      await legalContent.save();

      return res.status(200).json({
        status: 'success',
        message: 'Legal content updated successfully',
        data: {
          content: legalContent,
        },
      });
    } else {
      // Create new content
      legalContent = await LegalContent.create({
        type,
        title,
        content,
        htmlContent,
        lastUpdatedBy: req.admin._id,
        isPublished: isPublished !== undefined ? isPublished : true,
      });

      return sendCreated(res, { content: legalContent }, 'Legal content created successfully');
    }
  } catch (error) {
    logger.error('Error creating/updating legal content:', error);
    return sendError(res, 'Failed to save legal content');
  }
};

/**
 * @desc Update legal content (Admin)
 * @route PATCH /api/v1/admin/legal/:type
 * @access Private (Admin)
 */
exports.updateLegalContent = async (req, res) => {
  try {
    const { type } = req.params;
    const { title, content, htmlContent, isPublished } = req.body;

    const legalContent = await LegalContent.findOne({ type });

    if (!legalContent) {
      return sendNotFound(res, 'Legal content not found');
    }

    // Update fields
    if (title) legalContent.title = title;
    if (content) legalContent.content = content;
    if (htmlContent) legalContent.htmlContent = htmlContent;
    if (isPublished !== undefined) legalContent.isPublished = isPublished;

    legalContent.lastUpdatedBy = req.admin._id;
    legalContent.version += 1;

    await legalContent.save();

    return res.status(200).json({
      status: 'success',
      message: 'Legal content updated successfully',
      data: {
        content: legalContent,
      },
    });
  } catch (error) {
    logger.error('Error updating legal content:', error);
    return sendError(res, 'Failed to update legal content');
  }
};

/**
 * @desc Delete legal content (Admin)
 * @route DELETE /api/v1/admin/legal/:type
 * @access Private (Admin - Superadmin only)
 */
exports.deleteLegalContent = async (req, res) => {
  try {
    const { type } = req.params;

    const content = await LegalContent.findOneAndDelete({ type });

    if (!content) {
      return sendNotFound(res, 'Legal content not found');
    }

    return res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    logger.error('Error deleting legal content:', error);
    return sendError(res, 'Failed to delete legal content');
  }
};

/**
 * @desc Toggle publish status (Admin)
 * @route PATCH /api/v1/admin/legal/:type/publish
 * @access Private (Admin)
 */
exports.togglePublishStatus = async (req, res) => {
  try {
    const { type } = req.params;

    const content = await LegalContent.findOne({ type });

    if (!content) {
      return sendNotFound(res, 'Legal content not found');
    }

    content.isPublished = !content.isPublished;
    content.lastUpdatedBy = req.admin._id;
    await content.save();

    return res.status(200).json({
      status: 'success',
      message: `Legal content ${content.isPublished ? 'published' : 'unpublished'} successfully`,
      data: {
        content,
      },
    });
  } catch (error) {
    logger.error('Error toggling publish status:', error);
    return sendError(res, 'Failed to update publish status');
  }
};
