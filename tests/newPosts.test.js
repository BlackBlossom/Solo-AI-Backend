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

describe('New Post API Endpoints', () => {
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

  describe('POST /api/v1/posts/create - Immediate Post Creation', () => {
    test('should create immediate post successfully', async () => {
      // Mock successful Bundle.social immediate post creation
      bundleSocialService.createImmediatePost.mockResolvedValue({
        id: 'test-immediate-post-id',
        status: 'PUBLISHED',
        teamId: 'test-team-id'
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Immediate post caption #test',
        hashtags: ['test', 'immediate'],
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
      expect(response.body.message).toBe('Post created and published immediately');
      expect(response.body.data.post).toHaveProperty('bundlePostId', 'test-immediate-post-id');
      expect(response.body.data.post).toHaveProperty('bundleStatus', 'published');

      // Verify post was saved in database
      const savedPost = await Post.findById(response.body.data.post._id);
      expect(savedPost).toBeTruthy();
      expect(savedPost.bundlePostId).toBe('test-immediate-post-id');
      expect(savedPost.bundleStatus).toBe('published');

      // Verify Bundle.social service was called correctly
      expect(bundleSocialService.createImmediatePost).toHaveBeenCalledWith({
        teamId: 'test-team-id',
        title: expect.any(String),
        socialAccountTypes: ['INSTAGRAM'],
        data: expect.objectContaining({
          INSTAGRAM: expect.objectContaining({
            text: 'Immediate post caption #test #test #immediate',
            uploadIds: ['test-bundle-upload-id']
          })
        })
      });
    });

    test('should handle Bundle.social immediate post creation error', async () => {
      // Mock Bundle.social error
      bundleSocialService.createImmediatePost.mockRejectedValue(
        new Error('Bundle.social API Error: Invalid upload ID')
      );

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test immediate post',
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
      expect(response.body.message).toContain('Bundle.social API Error');

      // Verify no post was saved to database
      const posts = await Post.find({});
      expect(posts.length).toBe(0);
    });
  });

  describe('POST /api/v1/posts/schedule - Scheduled Post Creation', () => {
    test('should create scheduled post successfully', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Mock successful Bundle.social scheduled post creation
      bundleSocialService.createScheduledPost.mockResolvedValue({
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
        .post('/api/v1/posts/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Post scheduled successfully');
      expect(response.body.data.post).toHaveProperty('bundlePostId', 'test-scheduled-post-id');
      expect(response.body.data.post).toHaveProperty('bundleStatus', 'scheduled');

      // Verify post was saved in database
      const savedPost = await Post.findById(response.body.data.post._id);
      expect(savedPost).toBeTruthy();
      expect(savedPost.bundlePostId).toBe('test-scheduled-post-id');
      expect(savedPost.bundleStatus).toBe('scheduled');
      expect(new Date(savedPost.scheduledFor).getTime()).toBe(futureDate.getTime());

      // Verify Bundle.social service was called correctly
      expect(bundleSocialService.createScheduledPost).toHaveBeenCalledWith({
        teamId: 'test-team-id',
        title: expect.any(String),
        scheduledFor: futureDate.toISOString(),
        socialAccountTypes: ['INSTAGRAM'],
        data: expect.objectContaining({
          INSTAGRAM: expect.objectContaining({
            text: 'Scheduled post caption #scheduled',
            uploadIds: ['test-bundle-upload-id']
          })
        })
      });
    });

    test('should reject scheduled post with past date', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Past scheduled post',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }],
        scheduledFor: pastDate.toISOString()
      };

      const response = await request(app)
        .post('/api/v1/posts/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('future');
    });

    test('should handle Bundle.social scheduled post creation error', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Mock Bundle.social error
      bundleSocialService.createScheduledPost.mockRejectedValue(
        new Error('Bundle.social API Error: Team not found')
      );

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test scheduled post',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }],
        scheduledFor: futureDate.toISOString()
      };

      const response = await request(app)
        .post('/api/v1/posts/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Bundle.social API Error');

      // Verify no post was saved to database
      const posts = await Post.find({});
      expect(posts.length).toBe(0);
    });
  });

  describe('Validation Tests', () => {
    test('should reject post creation without video upload ID', async () => {
      // Create video without Bundle.social upload ID
      const videoWithoutUpload = await Video.create({
        user: testUser._id,
        title: 'Video Without Upload',
        filename: 'no-upload.mp4',
        originalName: 'no-upload.mp4',
        filePath: '/uploads/videos/no-upload.mp4',
        fileSize: 1000000,
        mimeType: 'video/mp4',
        status: 'completed'
        // bundleUploadId is missing
      });

      const postData = {
        videoId: videoWithoutUpload._id.toString(),
        caption: 'Test post',
        platforms: [{
          name: 'instagram',
          accountId: testSocialAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Bundle.social');
    });

    test('should reject post creation with disconnected social account', async () => {
      // Create disconnected social account
      const disconnectedAccount = await SocialAccount.create({
        user: testUser._id,
        platform: 'twitter',
        bundleAccountId: 'disconnected-account-id',
        username: 'disconnected',
        isConnected: false
      });

      const postData = {
        videoId: testVideo._id.toString(),
        caption: 'Test post',
        platforms: [{
          name: 'twitter',
          accountId: disconnectedAccount.bundleAccountId
        }]
      };

      const response = await request(app)
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Not connected');
    });
  });
});