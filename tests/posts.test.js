const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Video = require('../src/models/Video');
const Post = require('../src/models/Post');
const SocialAccount = require('../src/models/SocialAccount');
const bundleSocialService = require('../src/services/bundleSocialService');

// Mock Bundle.social service
jest.mock('../src/services/bundleSocialService');

describe('POST /api/v1/posts/create', () => {
  let authToken;
  let testUser;
  let testVideo;
  let testSocialAccount;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.TEST_DATABASE_URI || 'mongodb://localhost:27017/video-editing-test';
    await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    await Video.deleteMany({});
    await Post.deleteMany({});
    await SocialAccount.deleteMany({});

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test@123',
      loginType: 'email',
      bundleOrganizationId: 'test-org-id',
      bundleTeamId: 'test-team-id'
    });

    // Create test video with Bundle.social upload ID
    testVideo = await Video.create({
      user: testUser._id,
      title: 'Test Video',
      description: 'Test video description',
      filename: 'test-video.mp4',
      originalName: 'test-video.mp4',
      filePath: '/uploads/videos/test-video.mp4',
      fileSize: 1000000,
      mimeType: 'video/mp4',
      status: 'completed',
      bundleUploadId: 'test-bundle-upload-id'
    });

    // Create test social account
    testSocialAccount = await SocialAccount.create({
      user: testUser._id,
      platform: 'instagram',
      bundleAccountId: 'test-bundle-account-id',
      username: 'testuser',
      isConnected: true
    });

    // Generate auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test@123',
        loginType: 'email'
      });

    authToken = loginResponse.body.data.accessToken;
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Successful Post Creation', () => {
    test('should create post successfully with valid data', async () => {
      // Mock successful Bundle.social post creation
      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-bundle-post-id',
        status: 'DRAFT',
        teamId: 'test-team-id'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test post caption #test',
        hashtags: ['test', 'automation'],
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post created successfully');
      expect(response.body.data.post).toHaveProperty('bundlePostId', 'test-bundle-post-id');
      expect(response.body.data.post).toHaveProperty('bundleStatus', 'DRAFT');

      // Verify post was saved in database
      const savedPost = await Post.findById(response.body.data.post._id);
      expect(savedPost).toBeTruthy();
      expect(savedPost.bundlePostId).toBe('test-bundle-post-id');

      // Verify Bundle.social service was called correctly
      expect(bundleSocialService.createPost).toHaveBeenCalledWith({
        teamId: 'test-team-id',
        title: expect.any(String),
        scheduledFor: undefined,
        status: 'DRAFT',
        socialAccountTypes: ['INSTAGRAM'],
        data: expect.objectContaining({
          INSTAGRAM: expect.objectContaining({
            text: 'Test post caption #test #test #automation',
            uploadIds: ['test-bundle-upload-id']
          })
        })
      });
    });

    test('should create scheduled post successfully', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-scheduled-post-id',
        status: 'SCHEDULED',
        teamId: 'test-team-id'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Scheduled post caption',
        hashtags: ['scheduled'],
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }],
        scheduledFor: futureDate.toISOString()
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.data.post.bundleStatus).toBe('SCHEDULED');

      // Verify Bundle.social was called with scheduled status
      expect(bundleSocialService.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SCHEDULED',
          scheduledFor: futureDate.toISOString()
        })
      );
    });

    test('should handle multiple platforms correctly', async () => {
      // Create additional social accounts
      await SocialAccount.create({
        user: testUser._id,
        platform: 'tiktok',
        bundleAccountId: 'test-tiktok-account-id',
        username: 'testuser_tiktok',
        isConnected: true
      });

      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-multi-platform-post-id',
        status: 'DRAFT',
        teamId: 'test-team-id'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Multi-platform post',
        platforms: [
          { name: 'instagram', accountId: 'test-bundle-account-id' },
          { name: 'tiktok', accountId: 'test-tiktok-account-id' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      // Verify multiple platforms were processed
      expect(bundleSocialService.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          socialAccountTypes: ['INSTAGRAM', 'TIKTOK'],
          data: expect.objectContaining({
            INSTAGRAM: expect.any(Object),
            TIKTOK: expect.any(Object)
          })
        })
      );
    });
  });

  describe('Validation Errors', () => {
    test('should fail when video not found', async () => {
      const postData = {
        videoId: new mongoose.Types.ObjectId().toString(),
        caption: 'Test caption',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Video not found');
    });

    test('should fail when video has no Bundle.social upload ID', async () => {
      // Create video without bundleUploadId
      const videoWithoutBundle = await Video.create({
        user: testUser._id,
        title: 'Video Without Bundle',
        filename: 'test.mp4',
        originalName: 'test.mp4',
        filePath: '/uploads/test.mp4',
        fileSize: 1000,
        mimeType: 'video/mp4',
        status: 'completed'
        // No bundleUploadId
      });

      const postData = {
        videoId: videoWithoutBundle._id.toString(),
        caption: 'Test caption',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(500);

      expect(response.body.message).toContain('Video must be uploaded to Bundle.social before creating posts');
    });

    test('should fail when platform not connected', async () => {
      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test caption',
        platforms: [{
          name: 'youtube', // Not connected
          accountId: 'non-existent-account'
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(400);

      expect(response.body.message).toContain('Not connected to: youtube');
    });

    test('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should fail without authentication', async () => {
      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test caption',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .send(postData)
        .expect(401);

      expect(response.body.message).toContain('token');
    });
  });

  describe('Bundle.social Integration Failures', () => {
    test('should rollback database entry when Bundle.social creation fails', async () => {
      // Mock Bundle.social failure
      bundleSocialService.createPost.mockRejectedValue(
        new Error('Bundle.social API error')
      );

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test caption',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to create post on social media platform');

      // Verify no post was saved in database (rollback successful)
      const postCount = await Post.countDocuments({ user: testUser._id });
      expect(postCount).toBe(0);
    });

    test('should handle Bundle.social timeout gracefully', async () => {
      // Mock timeout error
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ECONNABORTED';
      bundleSocialService.createPost.mockRejectedValue(timeoutError);

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test caption',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(500);

      expect(response.body.message).toContain('Request timeout');

      // Verify rollback
      const postCount = await Post.countDocuments({ user: testUser._id });
      expect(postCount).toBe(0);
    });

    test('should handle Bundle.social validation errors', async () => {
      // Mock validation error from Bundle.social
      const validationError = new Error('Bundle.social upload failed: Invalid upload ID');
      bundleSocialService.createPost.mockRejectedValue(validationError);

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test caption',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(500);

      expect(response.body.message).toContain('Invalid upload ID');

      // Verify rollback
      const postCount = await Post.countDocuments({ user: testUser._id });
      expect(postCount).toBe(0);
    });
  });

  describe('Platform-Specific Data Formatting', () => {
    test('should format Instagram data correctly', async () => {
      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-post-id',
        status: 'DRAFT'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Instagram post',
        platforms: [{ name: 'instagram', accountId: 'test-account' }]
      };

      await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(bundleSocialService.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            INSTAGRAM: expect.objectContaining({
              type: expect.stringMatching(/^(REEL|POST)$/),
              text: 'Instagram post',
              uploadIds: ['test-bundle-upload-id']
            })
          })
        })
      );
    });

    test('should format TikTok data correctly', async () => {
      await SocialAccount.create({
        user: testUser._id,
        platform: 'tiktok',
        bundleAccountId: 'test-tiktok-account',
        username: 'testuser_tiktok',
        isConnected: true
      });

      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-post-id',
        status: 'DRAFT'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'TikTok post',
        platforms: [{ name: 'tiktok', accountId: 'test-tiktok-account' }]
      };

      await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(bundleSocialService.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            TIKTOK: expect.objectContaining({
              text: 'TikTok post',
              uploadIds: ['test-bundle-upload-id'],
              privacy: 'PUBLIC_TO_EVERYONE',
              isBrandContent: false
            })
          })
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long captions', async () => {
      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-post-id',
        status: 'DRAFT'
      });

      const longCaption = 'A'.repeat(2000); // Very long caption
      const postData = {
        videoId: testVideo._id.toString(),
        caption: longCaption,
        platforms: [{ name: 'instagram', accountId: 'test-account' }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.data.post.caption).toBe(longCaption);
    });

    test('should handle posts with no hashtags', async () => {
      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-post-id',
        status: 'DRAFT'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Post without hashtags',
        platforms: [{ name: 'instagram', accountId: 'test-account' }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.data.post.hashtags).toEqual([]);
    });

    test('should handle concurrent post creation attempts', async () => {
      bundleSocialService.createPost.mockResolvedValue({
        id: 'test-post-id',
        status: 'DRAFT'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Concurrent post',
        platforms: [{ name: 'instagram', accountId: 'test-account' }]
      };

      // Create multiple concurrent requests
      const promises = Array(3).fill().map(() =>
        request(app)
          .post('/api/v1/posts/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send(postData)
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify all posts were created
      const postCount = await Post.countDocuments({ user: testUser._id });
      expect(postCount).toBe(3);
    });
  });
});