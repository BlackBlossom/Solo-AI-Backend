const fal = require('@fal-ai/client');
const logger = require('../utils/logger');
const configService = require('./configService');

class FalAiService {
  constructor() {
    this.apiKey = '';
    this.model = 'fal-ai/flux/dev';
    this.initialized = false;
    this.client = null;
    
    // Initialize asynchronously
    this.initPromise = this.initialize();
  }

  /**
   * Initialize Fal.ai client with settings from database (prioritized) or env
   */
  async initialize() {
    try {
      // Get API key from database settings first, fallback to env
      const apiKeys = await configService.getApiKeys();
      this.apiKey = apiKeys.falApiKey || process.env.FAL_API_KEY || '';
      this.model = apiKeys.falModel || process.env.FAL_MODEL || 'fal-ai/flux/dev';
      
      if (!this.apiKey) {
        logger.warn('Fal.ai API key not configured in database or environment - AI caption generation will not work');
        return;
      }

      // Configure Fal.ai client - set credentials directly
      process.env.FAL_KEY = this.apiKey;

      this.initialized = true;
      logger.info('Fal.ai service initialized successfully', {
        source: apiKeys.falApiKey ? 'database' : 'environment',
        model: this.model
      });
    } catch (error) {
      logger.error('Failed to initialize Fal.ai service:', error.message);
      // Fallback to environment variable
      this.apiKey = process.env.FAL_API_KEY || '';
      this.model = process.env.FAL_MODEL || 'fal-ai/flux/dev';
      if (this.apiKey) {
        process.env.FAL_KEY = this.apiKey;
        this.initialized = true;
        logger.info('Fal.ai service initialized with environment variable');
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
    if (!this.apiKey) {
      throw new Error('Fal.ai API key not configured. Please add it in Settings or environment variables.');
    }
  }

  /**
   * Platform-specific configuration for optimal results
   */
  getPlatformConfig(platform) {
    const configs = {
      instagram: {
        maxLength: 2200,
        hashtagCount: '15-20',
        style: 'visually appealing with emojis',
        engagement: 'Call-to-action and questions',
        bestPractices: 'First line hooks attention, use line breaks, emojis strategically'
      },
      tiktok: {
        maxLength: 2200,
        hashtagCount: '3-5 trending',
        style: 'casual, trendy, relatable',
        engagement: 'Hooks in first 3 seconds, trending sounds/challenges',
        bestPractices: 'Short sentences, trending hashtags, speak to Gen Z'
      },
      youtube: {
        maxLength: 5000,
        hashtagCount: '3-5',
        style: 'descriptive and SEO-optimized',
        engagement: 'Timestamps, links, CTAs',
        bestPractices: 'Front-load keywords, include timestamps, promote other videos'
      },
      facebook: {
        maxLength: 63206,
        hashtagCount: '2-3',
        style: 'conversational and story-driven',
        engagement: 'Questions, polls, shareable content',
        bestPractices: 'Tell a story, ask questions, keep it authentic'
      },
      twitter: {
        maxLength: 280,
        hashtagCount: '1-2',
        style: 'concise, witty, newsworthy',
        engagement: 'Threads for longer content',
        bestPractices: 'Lead with impact, use relevant hashtags, be concise'
      },
      linkedin: {
        maxLength: 3000,
        hashtagCount: '3-5',
        style: 'professional, insightful, value-driven',
        engagement: 'Industry insights, professional stories',
        bestPractices: 'Lead with a hook, provide value, use professional tone'
      },
      pinterest: {
        maxLength: 500,
        hashtagCount: '5-10',
        style: 'descriptive, keyword-rich',
        engagement: 'DIY tips, tutorials, inspiration',
        bestPractices: 'Use keywords, describe the pin, include call-to-action'
      }
    };

    return configs[platform.toLowerCase()] || configs.instagram;
  }

  /**
   * Tone-specific instructions
   */
  getToneInstructions(tone) {
    const tones = {
      professional: 'Use formal language, industry terminology, and maintain a polished tone. Focus on credibility and expertise.',
      casual: 'Use conversational language, contractions, and a friendly tone. Sound like talking to a friend.',
      funny: 'Incorporate humor, witty remarks, and playful language. Make it entertaining while staying relevant.',
      inspirational: 'Use motivational language, uplifting phrases, and encouraging words. Inspire action and positivity.',
      educational: 'Use clear explanations, informative language, and structured content. Focus on teaching and providing value.',
      storytelling: 'Create a narrative arc, use descriptive language, and build emotional connection.',
      urgent: 'Create FOMO, use action-oriented language, and emphasize time-sensitivity.',
      luxury: 'Use sophisticated language, emphasize exclusivity, and highlight premium qualities.'
    };

    return tones[tone.toLowerCase()] || tones.casual;
  }

  /**
   * Build optimized prompt for caption generation using Fal.ai
   */
  buildCaptionPrompt(video, options) {
    const { tone, includeHashtags, platform, platforms } = options;
    const platformConfig = this.getPlatformConfig(platform);
    const toneInstructions = this.getToneInstructions(tone);

    const targetPlatforms = platforms && platforms.length > 0 ? platforms : [platform];
    const platformList = targetPlatforms.join(', ');

    return `You are an expert social media content creator. Generate a high-performing caption for this video.

VIDEO DETAILS:
Title: ${video.title || 'Untitled Video'}
Description: ${video.description || 'No description'}
Duration: ${video.duration ? Math.round(video.duration) + ' seconds' : 'Unknown'}

TARGET PLATFORM: ${platformList}
TONE: ${tone} - ${toneInstructions}

PLATFORM REQUIREMENTS:
- Max Length: ${platformConfig.maxLength} characters
- Style: ${platformConfig.style}
- Best Practices: ${platformConfig.bestPractices}

${includeHashtags ? `Include ${platformConfig.hashtagCount} relevant hashtags at the end.` : ''}

Format your response EXACTLY as:
Caption: [Your optimized caption here]
Hashtags: #hashtag1 #hashtag2 #hashtag3

Be concise, engaging, and platform-optimized.`;
  }

  /**
   * Generate caption using Fal.ai text generation
   */
  async generateCaption(video, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        tone = 'casual',
        includeHashtags = true,
        maxLength = 300,
        platform = 'instagram',
        platforms = [],
        model = this.model
      } = options;

      const prompt = this.buildCaptionPrompt(video, {
        tone,
        includeHashtags,
        maxLength,
        platform,
        platforms
      });

      logger.info('Generating caption with Fal.ai:', {
        videoId: video._id,
        tone,
        platform,
        model
      });

      // Call Fal.ai text generation endpoint
      const result = await fal.subscribe(model, {
        input: {
          prompt: prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          enable_safety_checker: true
        },
        logs: false,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            logger.debug('Caption generation in progress');
          }
        }
      });

      // Extract text from result
      let generatedText = '';
      if (result.output && typeof result.output === 'string') {
        generatedText = result.output;
      } else if (result.data && result.data.output) {
        generatedText = result.data.output;
      } else if (result.text) {
        generatedText = result.text;
      } else {
        throw new Error('Unexpected response format from Fal.ai');
      }

      const parsed = this.parseResponse(generatedText, includeHashtags);

      logger.info('Caption generated successfully:', {
        videoId: video._id,
        captionLength: parsed.caption.length,
        hashtagCount: parsed.hashtags.length,
        model: model
      });

      return {
        caption: parsed.caption,
        hashtags: parsed.hashtags,
        fullText: generatedText,
        model: model,
        platform
      };

    } catch (error) {
      logger.error('Fal.ai caption generation failed:', {
        error: error.message,
        videoId: video._id
      });

      // Handle specific error types
      if (error.message.includes('rate limit')) {
        throw new Error('Fal.ai API rate limit exceeded. Please wait a moment and try again.');
      } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
        throw new Error('Invalid Fal.ai API key. Please check your configuration.');
      } else if (error.message.includes('quota') || error.message.includes('credits')) {
        throw new Error('Fal.ai API credits exhausted. Please add credits to your account.');
      } else {
        throw new Error(`Caption generation failed: ${error.message}`);
      }
    }
  }

  /**
   * Parse response to extract caption and hashtags
   */
  parseResponse(text, includeHashtags) {
    let caption = '';
    let hashtags = [];

    if (includeHashtags) {
      // Try structured parsing
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

      // Fallback: Extract from full text
      if (!caption) {
        caption = text.trim();
        const extractedHashtags = text.match(/#\w+/g) || [];
        hashtags = extractedHashtags.map(tag => tag.substring(1));
        caption = caption.replace(/\n*#\w+(\s+#\w+)*\s*$/g, '').trim();
      }
    } else {
      caption = text.replace(/^Caption:\s*/i, '').trim();
    }

    return {
      caption: caption || 'Check out this amazing video! 🎥✨',
      hashtags: hashtags || []
    };
  }

  /**
   * Generate hashtags only
   */
  async generateHashtags(content, options = {}) {
    await this.ensureInitialized();

    try {
      const { maxCount = 10, platform = 'instagram' } = options;
      const platformConfig = this.getPlatformConfig(platform);

      const prompt = `Generate ${maxCount} trending, relevant hashtags for ${platform} for this content:

"${content}"

Requirements:
- Mix of high-volume and niche hashtags
- Currently trending on ${platform}
- Include branded, community, and discovery hashtags
- ${platformConfig.hashtagCount} strategy for optimal ${platform} performance

Format: #hashtag1 #hashtag2 #hashtag3...`;

      logger.info('Generating hashtags with Fal.ai:', {
        platform,
        maxCount
      });

      const result = await fal.subscribe(this.model, {
        input: {
          prompt: prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5
        },
        logs: false
      });

      let hashtagText = '';
      if (result.output && typeof result.output === 'string') {
        hashtagText = result.output;
      } else if (result.data && result.data.output) {
        hashtagText = result.data.output;
      } else if (result.text) {
        hashtagText = result.text;
      }

      const hashtags = hashtagText.match(/#\w+/g) || [];
      const cleanedHashtags = hashtags.map(tag => tag.substring(1));

      logger.info('Hashtags generated successfully:', {
        count: cleanedHashtags.length,
        platform
      });

      return cleanedHashtags.slice(0, maxCount);

    } catch (error) {
      logger.error('Hashtag generation failed:', error);
      
      if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      throw new Error(`Failed to generate hashtags: ${error.message}`);
    }
  }

  /**
   * Optimize caption for specific platform
   */
  async optimizeForPlatform(caption, platform) {
    await this.ensureInitialized();

    try {
      const platformConfig = this.getPlatformConfig(platform);

      const prompt = `Optimize this caption for ${platform}:

"${caption}"

Requirements:
- Max length: ${platformConfig.maxLength} characters
- Style: ${platformConfig.style}
- Best practices: ${platformConfig.bestPractices}
- Keep core message intact

Provide ONLY the optimized caption, no explanations.`;

      logger.info('Optimizing caption for platform:', {
        platform,
        originalLength: caption.length
      });

      const result = await fal.subscribe(this.model, {
        input: {
          prompt: prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5
        },
        logs: false
      });

      let optimized = '';
      if (result.output && typeof result.output === 'string') {
        optimized = result.output.trim();
      } else if (result.data && result.data.output) {
        optimized = result.data.output.trim();
      } else if (result.text) {
        optimized = result.text.trim();
      }

      logger.info('Caption optimized:', {
        platform,
        originalLength: caption.length,
        optimizedLength: optimized.length
      });

      return optimized;

    } catch (error) {
      logger.error('Caption optimization failed:', error);
      
      if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded.');
      }
      throw new Error(`Optimization failed: ${error.message}`);
    }
  }

  /**
   * Generate multi-platform captions
   */
  async generateMultiPlatformSuggestions(video, platforms, tone = 'casual') {
    const suggestions = {};

    for (const platform of platforms) {
      try {
        const result = await this.generateCaption(video, {
          platform,
          tone,
          includeHashtags: true,
          maxLength: this.getPlatformConfig(platform).maxLength
        });

        suggestions[platform] = {
          caption: result.caption,
          hashtags: result.hashtags,
          characterCount: result.caption.length,
          platformConfig: this.getPlatformConfig(platform)
        };

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        logger.warn(`Failed to generate for ${platform}:`, error.message);
        suggestions[platform] = {
          error: error.message,
          caption: '',
          hashtags: []
        };
      }
    }

    return suggestions;
  }

  /**
   * Check API health
   */
  async checkAPIHealth() {
    await this.ensureInitialized();

    try {
      const result = await fal.subscribe(this.model, {
        input: {
          prompt: 'Say "OK"',
          num_inference_steps: 1,
          guidance_scale: 1
        },
        logs: false
      });

      return {
        healthy: true,
        model: this.model,
        response: result.output || result.text || 'OK'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = new FalAiService();
