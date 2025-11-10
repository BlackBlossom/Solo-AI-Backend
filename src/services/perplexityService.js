const { OpenAI } = require('openai');
const logger = require('../utils/logger');

class PerplexityService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    
    // Initialize OpenAI client with Perplexity base URL
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://api.perplexity.ai'
    });

    // Available models (as of November 2025)
    this.models = {
      search: 'sonar',                          // Fast, lightweight search model (default)
      searchPro: 'sonar-pro',                   // Advanced search with complex queries
      reasoning: 'sonar-reasoning',             // Real-time reasoning with search
      reasoningPro: 'sonar-reasoning-pro',      // Precise reasoning with DeepSeek-R1
      research: 'sonar-deep-research'           // Exhaustive research and reports
    };

    // Default to basic search model (most cost-effective)
    this.defaultModel = this.models.search;
    
    if (!this.apiKey) {
      logger.warn('Perplexity API key not configured - AI caption generation will not work');
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
   * Build optimized system prompt
   */
  buildSystemPrompt() {
    return `You are an expert social media content creator specializing in viral content and platform-specific optimization. 

Your captions:
- Hook attention in the first line
- Are optimized for platform algorithms
- Include strategic emojis
- Encourage engagement (likes, comments, shares)
- Follow best practices for each platform

Format your response EXACTLY as:
Caption: [Your optimized caption here]
Hashtags: #hashtag1 #hashtag2 #hashtag3

Be concise and engaging.`;
  }

  /**
   * Build optimized user prompt for caption generation
   */
  buildCaptionPrompt(video, options) {
    const { tone, includeHashtags, platform, platforms } = options;
    const platformConfig = this.getPlatformConfig(platform);
    const toneInstructions = this.getToneInstructions(tone);

    const targetPlatforms = platforms && platforms.length > 0 ? platforms : [platform];
    const platformList = targetPlatforms.join(', ');

    return `Generate a high-performing caption for this video:

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

Generate the caption now following the format exactly.`;
  }

  /**
   * Generate caption using Perplexity API with official SDK
   */
  async generateCaption(video, options = {}) {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured. Add PERPLEXITY_API_KEY to your .env file.');
    }

    try {
      const {
        tone = 'casual',
        includeHashtags = true,
        maxLength = 300,
        platform = 'instagram',
        platforms = [],
        model = this.defaultModel
      } = options;

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildCaptionPrompt(video, {
        tone,
        includeHashtags,
        maxLength,
        platform,
        platforms
      });

      logger.info('Generating caption with Perplexity SDK:', {
        videoId: video._id,
        tone,
        platform,
        model
      });

      // Call Perplexity API using OpenAI-compatible SDK
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.9
      });

      const generatedText = completion.choices[0].message.content.trim();
      const parsed = this.parseResponse(generatedText, includeHashtags);

      logger.info('Caption generated successfully:', {
        videoId: video._id,
        captionLength: parsed.caption.length,
        hashtagCount: parsed.hashtags.length,
        model: model,
        tokensUsed: completion.usage?.total_tokens || 0
      });

      return {
        caption: parsed.caption,
        hashtags: parsed.hashtags,
        fullText: generatedText,
        model: model,
        platform,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      logger.error('Perplexity caption generation failed:', {
        error: error.message,
        videoId: video._id,
        statusCode: error.status,
        type: error.type
      });

      // Handle specific error types
      if (error.status === 429) {
        throw new Error('Perplexity API rate limit exceeded. Please wait a moment and try again.');
      } else if (error.status === 401 || error.status === 403) {
        throw new Error('Invalid Perplexity API key. Please check your configuration.');
      } else if (error.status === 402) {
        throw new Error('Perplexity API credits exhausted. Please add credits to your account.');
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Unable to connect to Perplexity API. Please check your internet connection.');
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
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured');
    }

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

      logger.info('Generating hashtags with Perplexity:', {
        platform,
        maxCount
      });

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are a social media hashtag expert. Generate only hashtags, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 300
      });

      const hashtagText = completion.choices[0].message.content.trim();
      const hashtags = hashtagText.match(/#\w+/g) || [];
      const cleanedHashtags = hashtags.map(tag => tag.substring(1));

      logger.info('Hashtags generated successfully:', {
        count: cleanedHashtags.length,
        platform
      });

      return cleanedHashtags.slice(0, maxCount);

    } catch (error) {
      logger.error('Hashtag generation failed:', error);
      
      if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      throw new Error(`Failed to generate hashtags: ${error.message}`);
    }
  }

  /**
   * Optimize caption for specific platform
   */
  async optimizeForPlatform(caption, platform) {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured');
    }

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

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `You are a ${platform} optimization specialist. Return only the optimized caption.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 500
      });

      const optimized = completion.choices[0].message.content.trim();

      logger.info('Caption optimized:', {
        platform,
        originalLength: caption.length,
        optimizedLength: optimized.length
      });

      return optimized;

    } catch (error) {
      logger.error('Caption optimization failed:', error);
      
      if (error.status === 429) {
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
          platformConfig: this.getPlatformConfig(platform),
          usage: result.usage
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
   * Check API health and credits
   */
  async checkAPIHealth() {
    if (!this.apiKey) {
      return {
        healthy: false,
        error: 'API key not configured'
      };
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.models.search, // Use basic search model for health check
        messages: [
          { role: 'user', content: 'Say "OK"' }
        ],
        max_tokens: 5
      });

      return {
        healthy: true,
        model: this.models.search,
        response: completion.choices[0].message.content
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        status: error.status
      };
    }
  }
}

module.exports = new PerplexityService();
