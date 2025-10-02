const request = require('supertest');
const app = require('../src/app');

describe('Integration Tests', () => {
  let authToken;
  let userId;
  let videoId;

  const testUser = {
    name: 'Integration Test User',
    email: 'integration@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!'
  };

  beforeAll(async () => {
    // Register test user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user._id;
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('Health Check', () => {
    it('should return server health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('message', 'Server is running!');
    });
  });

  describe('User Workflow', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should update user preferences', async () => {
      const preferences = {
        defaultPlatforms: ['instagram', 'tiktok'],
        autoGenerateCaption: true
      };

      const response = await request(app)
        .patch('/api/v1/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ preferences })
        .expect(200);

      expect(response.body.data.preferences.defaultPlatforms).toEqual(preferences.defaultPlatforms);
    });
  });

  describe('Video Management', () => {
    it('should get empty videos list initially', async () => {
      const response = await request(app)
        .get('/api/v1/videos')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.videos).toEqual([]);
    });

    // Note: File upload tests would require actual file handling
    // In a real test environment, you would mock multer or use test files
  });

  describe('AI Service', () => {
    it('should get AI service status', async () => {
      const response = await request(app)
        .get('/api/v1/ai/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.status).toHaveProperty('capabilities');
      expect(response.body.data.status).toHaveProperty('supportedPlatforms');
    });

    it('should generate hashtags for content', async () => {
      const response = await request(app)
        .post('/api/v1/ai/hashtags')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test video about cooking delicious pasta',
          maxCount: 5,
          platform: 'instagram'
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('hashtags');
      expect(Array.isArray(response.body.data.hashtags)).toBe(true);
    });
  });

  describe('Social Media Integration', () => {
    it('should get empty connected accounts initially', async () => {
      const response = await request(app)
        .get('/api/v1/social/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.accounts).toEqual([]);
    });

    it('should get authentication URL for platform', async () => {
      const response = await request(app)
        .get('/api/v1/social/auth/instagram?redirectUri=http://localhost:3000/callback')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('authUrl');
      expect(response.body.data.platform).toBe('instagram');
    });
  });

  describe('Posts Management', () => {
    it('should get empty posts list initially', async () => {
      const response = await request(app)
        .get('/api/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.posts).toEqual([]);
    });

    it('should get posts summary', async () => {
      const response = await request(app)
        .get('/api/v1/posts/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.summary).toHaveProperty('totalPosts', 0);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
    });

    it('should handle invalid JSON payload', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send('invalid json')
        .expect(400);
    });
  });
});