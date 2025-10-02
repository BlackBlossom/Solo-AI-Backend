const axios = require('axios');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiBaseUrl = 'https://api.openai.com/v1';
  }

  // Generate AI caption for video
  async generateCaption(videoData, options = {}) {
    try {
      const {
        prompt = '',
        tone = 'casual',
        includeHashtags = true,
        maxLength = 300,
        platform = 'general'
      } = options;

      // Create context-aware prompt
      const systemPrompt = this.createCaptionPrompt(tone, platform, includeHashtags, maxLength);
      const userPrompt = this.createUserPrompt(videoData, prompt);

      const response = await axios.post(
        `${this.openaiBaseUrl}/chat/completions`,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: Math.min(maxLength * 2, 500),
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds
        }
      );

      const generatedCaption = response.data.choices[0].message.content.trim();
      
      // Extract hashtags if they're included
      const hashtags = includeHashtags ? this.extractHashtags(generatedCaption) : [];
      const captionWithoutHashtags = this.removeHashtags(generatedCaption);

      logger.info('AI caption generated successfully:', {
        videoId: videoData.id,
        captionLength: captionWithoutHashtags.length,
        hashtagCount: hashtags.length
      });

      return {
        caption: captionWithoutHashtags,
        hashtags,
        fullText: generatedCaption
      };
    } catch (error) {
      logger.error('Failed to generate AI caption:', error.response?.data || error.message);
      throw new Error('Failed to generate AI caption');
    }
  }

  // Generate hashtags for content
  async generateHashtags(content, options = {}) {
    try {
      const { maxCount = 10, platform = 'general' } = options;

      const prompt = `Generate ${maxCount} relevant hashtags for this ${platform} content: "${content}". 
                     Return only hashtags separated by spaces, without the # symbol.`;

      const response = await axios.post(
        `${this.openaiBaseUrl}/chat/completions`,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.5,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const hashtagsText = response.data.choices[0].message.content.trim();
      const hashtags = hashtagsText.split(/\s+/).filter(tag => tag.length > 0);

      logger.info('AI hashtags generated:', { count: hashtags.length });
      return hashtags;
    } catch (error) {
      logger.error('Failed to generate AI hashtags:', error.response?.data || error.message);
      throw new Error('Failed to generate hashtags');
    }
  }

  // Optimize caption for specific platform
  async optimizeForPlatform(caption, platform) {
    try {
      const platformGuidelines = this.getPlatformGuidelines(platform);
      
      const prompt = `Optimize this caption for ${platform}: "${caption}"
                     Platform guidelines: ${platformGuidelines}
                     Keep the essence of the message but adapt it for maximum engagement on ${platform}.`;

      const response = await axios.post(
        `${this.openaiBaseUrl}/chat/completions`,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 300,
          temperature: 0.6,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const optimizedCaption = response.data.choices[0].message.content.trim();
      
      logger.info('Caption optimized for platform:', { platform });
      return optimizedCaption;
    } catch (error) {
      logger.error('Failed to optimize caption for platform:', error.response?.data || error.message);
      throw new Error('Failed to optimize caption');
    }
  }

  // Create system prompt for caption generation
  createCaptionPrompt(tone, platform, includeHashtags, maxLength) {
    return `You are a social media content expert. Create engaging captions for video content.
            
            Guidelines:
            - Tone: ${tone}
            - Platform: ${platform}
            - Maximum length: ${maxLength} characters
            - ${includeHashtags ? 'Include relevant hashtags at the end' : 'Do not include hashtags'}
            - Make it engaging and encourage interaction
            - Use emojis appropriately
            - Keep it authentic and relatable`;
  }

  // Create user prompt with video context
  createUserPrompt(videoData, customPrompt) {
    let prompt = `Create a caption for this video:
                  Title: ${videoData.title}
                  Description: ${videoData.description || 'No description provided'}`;
    
    if (customPrompt) {
      prompt += `\nAdditional context: ${customPrompt}`;
    }

    return prompt;
  }

  // Extract hashtags from text
  extractHashtags(text) {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  // Remove hashtags from text
  removeHashtags(text) {
    return text.replace(/#[a-zA-Z0-9_]+/g, '').trim();
  }

  // Get platform-specific guidelines
  getPlatformGuidelines(platform) {
    const guidelines = {
      instagram: 'Use emojis, encourage engagement, 2200 char limit, hashtags important',
      tiktok: 'Short and catchy, trending hashtags, encourage participation',
      youtube: 'Descriptive, SEO-friendly, call-to-action, longer format ok',
      facebook: 'Conversational, story-telling, questions to encourage comments',
      twitter: 'Concise, trending topics, 280 char limit, use threads if needed',
      linkedin: 'Professional tone, industry insights, networking focus'
    };

    return guidelines[platform] || 'General social media best practices';
  }
}

module.exports = new AIService();