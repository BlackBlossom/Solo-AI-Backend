const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const configService = require('./configService');

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
    
    // Initialize asynchronously
    this.initPromise = this.initialize();
  }

  /**
   * Initialize Gemini client with settings from database (prioritized) or env
   */
  async initialize() {
    try {
      // Get API key from database settings first, fallback to env
      const apiKeys = await configService.getApiKeys();
      const geminiKey = apiKeys.geminiApiKey || process.env.GEMINI_API_KEY || '';
      
      if (!geminiKey) {
        logger.warn('Gemini API key not configured in database or environment - AI caption generation will not work');
        return;
      }

      this.genAI = new GoogleGenerativeAI(geminiKey);
      // Use gemini-2.0-flash-exp (latest) or fallback to gemini-1.5-flash
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      this.initialized = true;
      
      logger.info('Gemini service initialized successfully', {
        source: apiKeys.geminiApiKey ? 'database' : 'environment'
      });
    } catch (error) {
      logger.error('Failed to initialize Gemini service:', error.message);
      // Fallback to environment variable
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        this.genAI = new GoogleGenerativeAI(geminiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        this.initialized = true;
        logger.info('Gemini service initialized with environment variable');
      }
    }
  }

  /**
   * Ensure service is initialized before use
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
    if (!this.genAI || !this.model) {
      throw new Error('Gemini API not configured. Please add it in Settings or environment variables.');
    }
  }

  async generateCaption(video, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        prompt = '',
        tone = 'casual',
        includeHashtags = true,
        maxLength = 300,
        platform = 'general'
      } = options;

      // Build the prompt based on video information and user preferences
      let fullPrompt = this.buildPrompt(video, {
        prompt,
        tone,
        includeHashtags,
        maxLength,
        platform
      });

      logger.info('Generating AI caption with Gemini:', { 
        videoId: video._id, 
        tone, 
        platform,
        promptLength: fullPrompt.length 
      });

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      // Parse the response to extract caption and hashtags
      const parsed = this.parseResponse(text, includeHashtags);

      logger.info('AI caption generated successfully:', { 
        videoId: video._id,
        captionLength: parsed.caption.length,
        hashtagCount: parsed.hashtags.length
      });

      return {
        caption: parsed.caption,
        hashtags: parsed.hashtags,
        fullText: text.trim(),
        model: 'gemini-2.5-flash'
      };

    } catch (error) {
      logger.error('Gemini AI caption generation failed:', {
        error: error.message,
        videoId: video._id
      });
      throw new Error(`Failed to generate AI caption: ${error.message}`);
    }
  }
  buildPrompt(video, options) {
    const { prompt, tone, includeHashtags, maxLength, platform } = options;

    let basePrompt = `Generate an engaging social media caption for a video with the following details:

Video Title: ${video.title}
Video Description: ${video.description || 'No description provided'}
Duration: ${video.duration ? Math.round(video.duration) + ' seconds' : 'Unknown'}
Platform: ${platform}

Requirements:
- Tone: ${tone}
- Maximum length: ${maxLength} characters
- Platform optimization: ${platform}`;

    if (includeHashtags) {
      basePrompt += `
- Include relevant hashtags at the end`;
    }

    if (prompt) {
      basePrompt += `
- Additional context: ${prompt}`;
    }

    basePrompt += `

Please create an engaging caption that will perform well on ${platform}. Make it ${tone} in tone and optimized for social media engagement.`;

    if (includeHashtags) {
      basePrompt += `

Format your response as:
Caption: [your caption here]
Hashtags: #hashtag1 #hashtag2 #hashtag3 (etc.)`;
    }

    return basePrompt;
  }

  parseResponse(text, includeHashtags) {
    let caption = '';
    let hashtags = [];

    if (includeHashtags) {
      // Try to parse structured response
      const captionMatch = text.match(/Caption:\s*(.*?)(?=\nHashtags:|$)/s);
      const hashtagMatch = text.match(/Hashtags:\s*(.*?)$/s);

      if (captionMatch) {
        caption = captionMatch[1].trim();
      }

      if (hashtagMatch) {
        const hashtagText = hashtagMatch[1].trim();
        hashtags = hashtagText.match(/#\w+/g) || [];
        hashtags = hashtags.map(tag => tag.substring(1)); // Remove # prefix
      }

      // If structured parsing failed, use the full text as caption and extract hashtags
      if (!caption) {
        caption = text.trim();
        const extractedHashtags = text.match(/#\w+/g) || [];
        hashtags = extractedHashtags.map(tag => tag.substring(1));
        
        // Remove hashtags from caption
        caption = caption.replace(/#\w+/g, '').trim();
      }
    } else {
      caption = text.trim();
    }

    return {
      caption: caption || 'Check out this amazing video!',
      hashtags: hashtags || []
    };
  }

  async generateHashtags(text, options = {}) {
    if (!this.genAI) {
      throw new Error('Gemini API not configured');
    }

    try {
      const { maxHashtags = 10, platform = 'general' } = options;

      const prompt = `Generate relevant hashtags for the following social media content:

Content: ${text}
Platform: ${platform}
Maximum hashtags: ${maxHashtags}

Please provide ${maxHashtags} relevant hashtags that would help this content reach the right audience on ${platform}. Format as a simple list: #hashtag1 #hashtag2 #hashtag3`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const hashtagText = response.text();

      const hashtags = hashtagText.match(/#\w+/g) || [];
      return hashtags.map(tag => tag.substring(1));

    } catch (error) {
      logger.error('Hashtag generation failed:', error.message);
      throw new Error(`Failed to generate hashtags: ${error.message}`);
    }
  }

  async optimizeForPlatform(caption, platform) {
    if (!this.genAI) {
      throw new Error('Gemini API not configured');
    }

    try {
      const prompt = `Optimize the following social media caption for ${platform}:

Original Caption: ${caption}
Target Platform: ${platform}

Please optimize this caption considering ${platform}'s best practices:
- Character limits and formatting
- Engagement patterns
- Platform-specific features (hashtags, mentions, etc.)
- Audience behavior on ${platform}

Provide only the optimized caption without additional explanation.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();

    } catch (error) {
      logger.error('Caption optimization failed:', error.message);
      throw new Error(`Failed to optimize caption: ${error.message}`);
    }
  }
}

module.exports = new GeminiService();