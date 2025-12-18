const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '🎬 Video Editing & Social Media API',
      version: '1.0.0',
      description: `
# 🚀 Comprehensive Video Editing & Social Media Management API

A powerful, modern REST API built with **Node.js**, **Express**, and **MongoDB** for video editing and social media management. Features seamless **Bundle.social** integration for multi-platform publishing and AI-powered content generation.

## 🌟 Key Features

- **🔐 Advanced JWT Authentication** - Secure user registration, login with refresh tokens
- **🌐 Social Login Support** - Email, Google, and Apple authentication
- **👤 Enhanced User Profiles** - Comprehensive personal information management
- **🔄 Refresh Token System** - Persistent sessions without frequent re-login
- **📹 Video Management** - Upload, process, and manage video content
- **🤖 AI Content Generation** - Fal.ai-powered captions and hashtags
- **📱 Social Media Integration** - Connect Instagram, Twitter, Facebook, LinkedIn, TikTok, YouTube
- **📊 Analytics & Insights** - Real-time performance tracking
- **⏰ Post Scheduling** - Schedule content across multiple platforms
- **☁️ Bundle.social Integration** - Professional social media management
- **📈 Rate Limiting** - API protection and fair usage

## 🚦 Getting Started

1. **Register** a new account using \`/auth/register\` with your preferred login type (email/google/apple)
2. **Login** to get your JWT tokens from \`/auth/login\`
3. **Authorize** by clicking the 🔒 button above and enter: \`Bearer YOUR_ACCESS_TOKEN\`
4. **Stay logged in** using \`/auth/refresh-token\` to get new access tokens
5. **Update your profile** with personal details using \`/users/profile\`
6. **Explore** and test all available endpoints

### 🔑 Authentication Types
- **Email**: Traditional email/password authentication  
- **Google**: OAuth-based Google sign-in (no password required)
- **Apple**: OAuth-based Apple sign-in (no password required)

## 📋 Rate Limits

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes  
- **File Upload**: 10 requests per hour
- **AI Services**: 20 requests per hour

## 🔗 Useful Links

- [Bundle.social Documentation](https://docs.bundle.social)
- [Fal.ai Documentation](https://fal.ai/docs)  
- [Project Repository](https://github.com/your-username/video-editing-backend)
      `,
      termsOfService: 'https://your-domain.com/terms',
      contact: {
        name: '🛠️ API Support Team',
        email: 'support@your-domain.com',
        url: 'https://your-domain.com/support'
      },
      license: {
        name: 'MIT License',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      ...(process.env.PRODUCTION_URL ? [{
        url: process.env.PRODUCTION_URL,
        description: '🚀 Production Server'
      }] : []),
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: '💻 Development Server'
      }
    ],
    tags: [
      {
        name: 'Admin Authentication',
        description: '🔐 Admin login, logout, and token management'
      },
      {
        name: 'Admin Dashboard',
        description: '📊 Dashboard statistics and overview'
      },
      {
        name: 'Admin Media',
        description: '🖼️ Media management (images, stickers, GIFs, audio, fonts)'
      },
      {
        name: 'Admin Users',
        description: '👥 User management and moderation'
      },
      {
        name: 'Admin Videos',
        description: '🎥 Video content management'
      },
      {
        name: 'Admin Posts',
        description: '📱 Social media post management'
      },
      {
        name: 'Admin Analytics',
        description: '📈 Analytics and reporting'
      },
      {
        name: 'Admin Settings',
        description: '⚙️ System settings and configuration'
      },
      {
        name: 'Admin Activity',
        description: '📝 Activity logs and audit trails'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['email'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique user identifier',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe',
              minLength: 2,
              maxLength: 50
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address (unique)',
              example: 'john@example.com'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'User date of birth (must be 13+ years old)',
              example: '1990-05-15'
            },
            gender: {
              type: 'string',
              enum: ['male', 'female', 'other', 'prefer_not_to_say'],
              description: 'User gender',
              example: 'male'
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number with country code',
              example: '+1234567890'
            },
            loginType: {
              type: 'string',
              enum: ['email', 'google', 'apple'],
              description: 'Type of authentication used',
              default: 'email',
              example: 'email'
            },
            status: {
              type: 'string',
              enum: ['active', 'banned', 'suspended'],
              description: 'Account status - active (normal access), banned (prohibited), suspended (restricted)',
              default: 'active',
              example: 'active'
            },
            banReason: {
              type: 'string',
              description: 'Reason for ban or suspension (shown to user when attempting login)',
              nullable: true,
              example: 'Violation of terms of service'
            },
            banExpiry: {
              type: 'string',
              format: 'date-time',
              description: 'When the ban expires (null for permanent bans or active accounts)',
              nullable: true,
              example: '2025-11-18T22:59:55.000Z'
            },
            profilePicture: {
              type: 'string',
              description: 'Cloudinary URL to profile picture',
              nullable: true,
              example: 'https://res.cloudinary.com/your-cloud/image/upload/v1234567890/solo-ai/profiles/profile-123_456789.jpg'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Whether email is verified',
              default: false
            },
            bundleOrganizationId: {
              type: 'string',
              description: 'Bundle.social organization ID',
              example: 'org_1234567890'
            },
            bundleTeamId: {
              type: 'string',
              description: 'Bundle.social team ID (unique)',
              example: 'team_1234567890'
            },
            socialAccounts: {
              type: 'array',
              description: 'Connected social media accounts',
              items: {
                type: 'object',
                properties: {
                  socialAccountId: { type: 'string' },
                  platform: { type: 'string' },
                  username: { type: 'string' },
                  displayName: { type: 'string' },
                  profilePicture: { type: 'string' }
                }
              }
            },
            posts: {
              type: 'array',
              description: 'User posts',
              items: {
                type: 'string',
                description: 'Post ID reference'
              }
            },
            videos: {
              type: 'array',
              description: 'User videos',
              items: {
                type: 'string',
                description: 'Video ID reference'
              }
            },
            preferences: {
              type: 'object',
              properties: {
                defaultPlatforms: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin']
                  }
                },
                autoGenerateCaption: {
                  type: 'boolean',
                  default: true
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            }
          }
        },
        SocialAccount: {
          type: 'object',
          required: ['platform', 'platformAccountId', 'platformUsername', 'bundleAccountId'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique social account identifier',
              example: '507f1f77bcf86cd799439012'
            },
            platform: {
              type: 'string',
              enum: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'],
              description: 'Social media platform',
              example: 'instagram'
            },
            platformAccountId: {
              type: 'string',
              description: 'Platform-specific account ID',
              example: '17841405822304914'
            },
            platformUsername: {
              type: 'string',
              description: 'Username on the platform',
              example: 'johndoe'
            },
            platformDisplayName: {
              type: 'string',
              description: 'Display name on the platform',
              example: 'John Doe'
            },
            bundleAccountId: {
              type: 'string',
              description: 'Bundle.social account identifier (unique)',
              example: 'bundle_acc_1234567890'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the account is active',
              default: true
            },
            isConnected: {
              type: 'boolean',
              description: 'Whether the account is connected',
              default: true
            },
            connectedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the account was connected'
            },
            lastSyncAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last synchronization with platform'
            },
            metadata: {
              type: 'object',
              properties: {
                profilePicture: { type: 'string' },
                followerCount: { type: 'number' },
                followingCount: { type: 'number' },
                postCount: { type: 'number' },
                isVerified: { type: 'boolean', default: false },
                businessAccount: { type: 'boolean', default: false }
              }
            },
            settings: {
              type: 'object',
              properties: {
                defaultVisibility: {
                  type: 'string',
                  enum: ['public', 'private', 'unlisted'],
                  default: 'public'
                },
                autoPublish: { type: 'boolean', default: false },
                defaultHashtags: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        },
        Video: {
          type: 'object',
          required: ['title', 'filename', 'originalName', 'filePath', 'fileSize', 'mimeType'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique video identifier',
              example: '507f1f77bcf86cd799439013'
            },
            title: {
              type: 'string',
              description: 'Video title',
              example: 'My Amazing Travel Video',
              minLength: 1,
              maxLength: 100
            },
            description: {
              type: 'string',
              description: 'Video description',
              example: 'A breathtaking journey through the mountains',
              maxLength: 500
            },
            filename: {
              type: 'string',
              description: 'System filename',
              example: 'video_1634567890_abc123.mp4'
            },
            originalName: {
              type: 'string',
              description: 'Original filename from upload',
              example: 'travel_video.mp4'
            },
            filePath: {
              type: 'string',
              description: 'Server file path',
              example: '/uploads/videos/video_1634567890_abc123.mp4'
            },
            fileSize: {
              type: 'number',
              description: 'File size in bytes',
              example: 52428800
            },
            mimeType: {
              type: 'string',
              description: 'MIME type of the video',
              example: 'video/mp4'
            },
            duration: {
              type: 'number',
              description: 'Video duration in seconds',
              example: 120.5
            },
            dimensions: {
              type: 'object',
              properties: {
                width: { type: 'number', example: 1920 },
                height: { type: 'number', example: 1080 }
              }
            },
            format: {
              type: 'string',
              description: 'Video format',
              example: 'mp4'
            },
            bitrate: {
              type: 'number',
              description: 'Video bitrate',
              example: 5000
            },
            thumbnailPath: {
              type: 'string',
              description: 'Path to generated thumbnail',
              example: '/uploads/thumbnails/video_1634567890_abc123.jpg'
            },
            status: {
              type: 'string',
              enum: ['uploading', 'processing', 'completed', 'failed'],
              description: 'Video processing status',
              example: 'completed'
            },
            bundleUploadId: {
              type: 'string',
              description: 'Bundle.social upload ID',
              example: 'bundle_upload_1234567890'
            },
            edits: {
              type: 'object',
              properties: {
                trimStart: { type: 'number', default: 0 },
                trimEnd: { type: 'number' },
                speed: { type: 'number', default: 1, minimum: 0.25, maximum: 4 },
                filters: {
                  type: 'array',
                  items: { type: 'string' }
                },
                overlays: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['text', 'sticker', 'drawing']
                      },
                      data: { type: 'object' },
                      position: {
                        type: 'object',
                        properties: {
                          x: { type: 'number' },
                          y: { type: 'number' }
                        }
                      },
                      timestamp: { type: 'number' }
                    }
                  }
                }
              }
            },
            aiGeneratedCaption: {
              type: 'string',
              description: 'AI-generated caption for the video'
            },
            aiGeneratedHashtags: {
              type: 'array',
              items: { type: 'string' },
              description: 'AI-generated hashtags'
            },
            user: {
              type: 'string',
              description: 'ID of the user who uploaded the video',
              example: '507f1f77bcf86cd799439011'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Post: {
          type: 'object',
          required: ['caption', 'platforms'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique post identifier',
              example: '507f1f77bcf86cd799439014'
            },
            caption: {
              type: 'string',
              description: 'Post caption/content',
              example: 'Check out this amazing sunset! 🌅 #travel #sunset #nature',
              minLength: 1,
              maxLength: 2200
            },
            video: {
              type: 'string',
              description: 'Associated video ID',
              example: '507f1f77bcf86cd799439013'
            },
            hashtags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Post hashtags (without # symbol)',
              example: ['travel', 'sunset', 'nature']
            },
            platforms: {
              type: 'array',
              description: 'Target platforms for publishing',
              items: {
                type: 'object',
                required: ['name', 'accountId'],
                properties: {
                  name: {
                    type: 'string',
                    enum: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'],
                    example: 'instagram'
                  },
                  accountId: {
                    type: 'string',
                    description: 'Social account ID',
                    example: '507f1f77bcf86cd799439012'
                  },
                  postId: {
                    type: 'string',
                    description: 'Platform post ID after publishing'
                  },
                  publishedAt: {
                    type: 'string',
                    format: 'date-time'
                  },
                  status: {
                    type: 'string',
                    enum: ['pending', 'scheduled', 'published', 'failed'],
                    default: 'pending'
                  },
                  errorMessage: {
                    type: 'string',
                    description: 'Error message if publishing failed'
                  }
                }
              }
            },
            scheduledFor: {
              type: 'string',
              format: 'date-time',
              description: 'When the post is scheduled to be published',
              example: '2024-01-15T10:00:00Z'
            },
            publishedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the post was actually published'
            },
            bundlePostId: {
              type: 'string',
              description: 'Bundle.social post identifier',
              example: 'bundle_post_1234567890'
            },
            bundleStatus: {
              type: 'string',
              enum: ['draft', 'scheduled', 'published', 'failed'],
              description: 'Bundle.social post status',
              default: 'draft'
            },
            settings: {
              type: 'object',
              properties: {
                autoPublish: { type: 'boolean', default: false },
                allowComments: { type: 'boolean', default: true },
                allowLikes: { type: 'boolean', default: true },
                visibility: {
                  type: 'string',
                  enum: ['public', 'private', 'unlisted'],
                  default: 'public'
                }
              }
            },
            analytics: {
              type: 'object',
              description: 'Post analytics data from Bundle.social',
              properties: {
                views: { type: 'number', default: 0, example: 1250 },
                likes: { type: 'number', default: 0, example: 89 },
                comments: { type: 'number', default: 0, example: 15 },
                shares: { type: 'number', default: 0, example: 7 },
                lastUpdated: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            },
            user: {
              type: 'string',
              description: 'ID of the user who created the post',
              example: '507f1f77bcf86cd799439011'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        AuthTokens: {
          type: 'object',
          description: 'JWT authentication tokens',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token (expires in 24h)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token (expires in 7d)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            expiresIn: {
              type: 'string',
              description: 'Access token expiration time',
              example: '24h'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john@example.com'
            },
            password: {
              type: 'string',
              description: 'User password (required only for email login)',
              example: 'securePassword123',
              minLength: 6
            },
            loginType: {
              type: 'string',
              enum: ['email', 'google', 'apple'],
              description: 'Type of login authentication',
              default: 'email',
              example: 'email'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'loginType'],
          properties: {
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe',
              minLength: 2,
              maxLength: 50
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john@example.com'
            },
            password: {
              type: 'string',
              description: 'User password (required only for email registration). Must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
              example: 'SecurePass123!',
              minLength: 8
            },
            confirmPassword: {
              type: 'string',
              description: 'Password confirmation (required only for email registration). Must match the password field',
              example: 'SecurePass123!',
              minLength: 8
            },
            loginType: {
              type: 'string',
              enum: ['email', 'google', 'apple'],
              description: 'Type of authentication to use',
              default: 'email',
              example: 'email'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'User date of birth (optional)',
              example: '1990-05-15'
            },
            gender: {
              type: 'string',
              enum: ['male', 'female', 'other', 'prefer_not_to_say'],
              description: 'User gender (optional)',
              example: 'male'
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number with country code (optional)',
              example: '+1234567890'
            }
          }
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'Valid refresh token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          }
        },
        ProfileUpdateRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe',
              minLength: 2,
              maxLength: 50
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'User date of birth (must be 13+ years old)',
              example: '1990-05-15'
            },
            gender: {
              type: 'string',
              enum: ['male', 'female', 'other', 'prefer_not_to_say'],
              description: 'User gender',
              example: 'male'
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number with country code',
              example: '+1234567890'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            error: {
              type: 'string',
              description: 'Detailed error information'
            }
          }
        },
        AICaptionRequest: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Additional context or specific instructions for caption generation',
              maxLength: 500,
              example: 'Focus on lifestyle and fun vibes'
            },
            tone: {
              type: 'string',
              enum: ['professional', 'casual', 'funny', 'inspirational', 'educational'],
              default: 'casual',
              description: 'Tone of the generated caption',
              example: 'casual'
            },
            includeHashtags: {
              type: 'boolean',
              default: true,
              description: 'Whether to include relevant hashtags',
              example: true
            },
            maxLength: {
              type: 'integer',
              minimum: 50,
              maximum: 2200,
              default: 300,
              description: 'Maximum length of the generated caption',
              example: 300
            },
            platform: {
              type: 'string',
              enum: ['general', 'instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'],
              default: 'general',
              description: 'Target social media platform for optimization',
              example: 'instagram'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;