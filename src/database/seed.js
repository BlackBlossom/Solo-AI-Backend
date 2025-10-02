const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const SocialAccount = require('../models/SocialAccount');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ Connected to MongoDB for seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Sample data
const sampleUsers = [
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'Password123!',
    bundleOrganizationId: 'org_sample_123',
    bundleTeamId: 'team_sample_123',
    emailVerified: true,
    preferences: {
      defaultPlatforms: ['instagram', 'tiktok'],
      autoGenerateCaption: true
    }
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    password: 'Password123!',
    bundleOrganizationId: 'org_sample_124',
    bundleTeamId: 'team_sample_124',
    emailVerified: true,
    preferences: {
      defaultPlatforms: ['youtube', 'facebook'],
      autoGenerateCaption: false
    }
  }
];

// Seed function
const seedDatabase = async () => {
  try {
    await connectDB();

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Video.deleteMany({});
    await Post.deleteMany({});
    await SocialAccount.deleteMany({});

    // Create users
    console.log('👥 Creating sample users...');
    const createdUsers = [];
    
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }

    console.log(`✅ Created ${createdUsers.length} users`);

    // Create sample videos
    console.log('🎥 Creating sample videos...');
    const sampleVideos = [
      {
        user: createdUsers[0]._id,
        title: 'My First Video',
        description: 'This is a sample video for testing',
        filename: 'sample_video_1.mp4',
        originalName: 'sample_video.mp4',
        filePath: '/uploads/videos/sample_video_1.mp4',
        fileSize: 15728640, // 15MB
        mimeType: 'video/mp4',
        duration: 120,
        dimensions: { width: 1920, height: 1080 },
        status: 'completed',
        aiGeneratedCaption: 'Check out this amazing video! #video #content',
        aiGeneratedHashtags: ['video', 'content', 'amazing']
      },
      {
        user: createdUsers[1]._id,
        title: 'Tutorial Video',
        description: 'A helpful tutorial video',
        filename: 'tutorial_video_1.mp4',
        originalName: 'tutorial.mp4',
        filePath: '/uploads/videos/tutorial_video_1.mp4',
        fileSize: 25165824, // 24MB
        mimeType: 'video/mp4',
        duration: 300,
        dimensions: { width: 1280, height: 720 },
        status: 'completed',
        aiGeneratedCaption: 'Learn something new today! #tutorial #learning',
        aiGeneratedHashtags: ['tutorial', 'learning', 'education']
      }
    ];

    const createdVideos = await Video.insertMany(sampleVideos);
    console.log(`✅ Created ${createdVideos.length} videos`);

    // Create sample social accounts
    console.log('📱 Creating sample social accounts...');
    const sampleSocialAccounts = [
      {
        user: createdUsers[0]._id,
        platform: 'instagram',
        platformAccountId: 'instagram_123',
        platformUsername: 'johndoe_insta',
        platformDisplayName: 'John Doe',
        bundleAccountId: 'bundle_ig_123',
        metadata: {
          followerCount: 1500,
          followingCount: 300,
          postCount: 45,
          isVerified: false
        }
      },
      {
        user: createdUsers[0]._id,
        platform: 'tiktok',
        platformAccountId: 'tiktok_123',
        platformUsername: 'johndoe_tiktok',
        platformDisplayName: 'John Doe',
        bundleAccountId: 'bundle_tt_123',
        metadata: {
          followerCount: 5000,
          followingCount: 100,
          postCount: 23,
          isVerified: false
        }
      }
    ];

    const createdSocialAccounts = await SocialAccount.insertMany(sampleSocialAccounts);
    console.log(`✅ Created ${createdSocialAccounts.length} social accounts`);

    // Create sample posts
    console.log('📝 Creating sample posts...');
    const samplePosts = [
      {
        user: createdUsers[0]._id,
        video: createdVideos[0]._id,
        caption: 'Check out my latest video! Really excited to share this with you all. #video #content #excited',
        hashtags: ['video', 'content', 'excited', 'latest'],
        platforms: [{
          name: 'instagram',
          accountId: createdSocialAccounts[0].bundleAccountId,
          status: 'published',
          publishedAt: new Date()
        }],
        bundleStatus: 'published',
        publishedAt: new Date(),
        analytics: {
          views: 250,
          likes: 45,
          comments: 12,
          shares: 3
        }
      }
    ];

    const createdPosts = await Post.insertMany(samplePosts);
    console.log(`✅ Created ${createdPosts.length} posts`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\nSample accounts created:');
    sampleUsers.forEach(user => {
      console.log(`  📧 ${user.email} / ${user.password}`);
    });

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;