const admin = require('firebase-admin');
const logger = require('../utils/logger');
const configService = require('./configService');

class FirebaseService {
  constructor() {
    this.app = null;
    this.messaging = null;
    this.initialized = false;
    this.initPromise = this.initialize();
  }

  /**
   * Initialize Firebase Admin SDK with service account from database
   */
  async initialize() {
    try {
      // Get Firebase config from database settings
      const firebaseConfig = await configService.getFirebaseConfig();
      
      if (!firebaseConfig || !firebaseConfig.serviceAccount) {
        logger.warn('Firebase service account not configured - Push notifications will not work');
        return;
      }

      // Parse service account JSON
      let serviceAccount;
      try {
        if (typeof firebaseConfig.serviceAccount === 'string') {
          serviceAccount = JSON.parse(firebaseConfig.serviceAccount);
        } else {
          serviceAccount = firebaseConfig.serviceAccount;
        }
      } catch (parseError) {
        logger.error('Failed to parse Firebase service account JSON:', parseError.message);
        return;
      }

      // Validate required fields
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        logger.error('Invalid Firebase service account - missing required fields');
        return;
      }

      // Initialize Firebase Admin
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

      this.messaging = admin.messaging(this.app);
      this.initialized = true;

      logger.info('Firebase service initialized successfully', {
        projectId: serviceAccount.project_id,
        source: firebaseConfig.serviceAccount ? 'database' : 'environment'
      });
    } catch (error) {
      logger.error('Failed to initialize Firebase service:', error.message);
      // Don't throw - allow app to continue without push notifications
    }
  }

  /**
   * Ensure service is initialized before use
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
    if (!this.messaging) {
      throw new Error('Firebase Cloud Messaging not configured. Please add service account in Settings.');
    }
  }

  /**
   * Send notification to a single device
   * @param {string} token - FCM device token
   * @param {object} notification - Notification data
   * @returns {Promise<object>} Send result
   */
  async sendToDevice(token, notification) {
    await this.ensureInitialized();

    try {
      const message = this.buildMessage(token, notification);
      const response = await this.messaging.send(message);

      logger.info('Notification sent successfully to device:', {
        token: token.substring(0, 20) + '...',
        messageId: response
      });

      return {
        success: true,
        messageId: response,
        token: token
      };
    } catch (error) {
      logger.error('Failed to send notification to device:', {
        error: error.message,
        token: token.substring(0, 20) + '...'
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        token: token
      };
    }
  }

  /**
   * Send notification to multiple devices
   * @param {string[]} tokens - Array of FCM device tokens
   * @param {object} notification - Notification data
   * @returns {Promise<object>} Batch send result
   */
  async sendToMultipleDevices(tokens, notification) {
    await this.ensureInitialized();

    if (!tokens || tokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        results: []
      };
    }

    // FCM allows sending to max 500 tokens at once
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push(tokens.slice(i, i + batchSize));
    }

    const allResults = [];
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const batch of batches) {
      try {
        const message = this.buildMulticastMessage(batch, notification);
        const response = await this.messaging.sendEachForMulticast(message);

        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        // Process individual results
        response.responses.forEach((resp, idx) => {
          allResults.push({
            token: batch[idx],
            success: resp.success,
            messageId: resp.messageId,
            error: resp.error ? {
              code: resp.error.code,
              message: resp.error.message
            } : null
          });
        });

        logger.info('Batch notification sent:', {
          batchSize: batch.length,
          successCount: response.successCount,
          failureCount: response.failureCount
        });
      } catch (error) {
        logger.error('Failed to send batch notification:', error.message);
        totalFailure += batch.length;
        
        // Mark all tokens in this batch as failed
        batch.forEach(token => {
          allResults.push({
            token: token,
            success: false,
            error: {
              code: error.code,
              message: error.message
            }
          });
        });
      }
    }

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      totalTokens: tokens.length,
      results: allResults
    };
  }

  /**
   * Send notification to a topic
   * @param {string} topic - FCM topic name
   * @param {object} notification - Notification data
   * @returns {Promise<object>} Send result
   */
  async sendToTopic(topic, notification) {
    await this.ensureInitialized();

    try {
      const message = {
        topic: topic,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl || undefined
        },
        data: notification.data || {},
        android: notification.android || {
          priority: notification.priority === 'high' ? 'high' : 'normal',
          notification: {
            sound: 'default',
            clickAction: notification.deepLink || undefined
          }
        },
        apns: notification.apns || {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true
            }
          },
          fcmOptions: {
            imageUrl: notification.imageUrl || undefined
          }
        }
      };

      const response = await this.messaging.send(message);

      logger.info('Notification sent to topic successfully:', {
        topic: topic,
        messageId: response
      });

      return {
        success: true,
        messageId: response,
        topic: topic
      };
    } catch (error) {
      logger.error('Failed to send notification to topic:', {
        error: error.message,
        topic: topic
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        topic: topic
      };
    }
  }

  /**
   * Subscribe tokens to a topic
   * @param {string[]} tokens - Array of FCM device tokens
   * @param {string} topic - Topic name
   * @returns {Promise<object>} Subscription result
   */
  async subscribeToTopic(tokens, topic) {
    await this.ensureInitialized();

    try {
      const response = await this.messaging.subscribeToTopic(tokens, topic);

      logger.info('Tokens subscribed to topic:', {
        topic: topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors
      };
    } catch (error) {
      logger.error('Failed to subscribe tokens to topic:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unsubscribe tokens from a topic
   * @param {string[]} tokens - Array of FCM device tokens
   * @param {string} topic - Topic name
   * @returns {Promise<object>} Unsubscription result
   */
  async unsubscribeFromTopic(tokens, topic) {
    await this.ensureInitialized();

    try {
      const response = await this.messaging.unsubscribeFromTopic(tokens, topic);

      logger.info('Tokens unsubscribed from topic:', {
        topic: topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount
      };
    } catch (error) {
      logger.error('Failed to unsubscribe tokens from topic:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build FCM message for single device
   */
  buildMessage(token, notification) {
    return {
      token: token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl || undefined
      },
      data: notification.data || {},
      android: {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: {
          sound: 'default',
          clickAction: notification.deepLink || undefined,
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
            category: notification.type || 'default'
          }
        },
        fcmOptions: {
          imageUrl: notification.imageUrl || undefined
        }
      },
      webpush: notification.webpush || undefined
    };
  }

  /**
   * Build FCM multicast message for multiple devices
   */
  buildMulticastMessage(tokens, notification) {
    return {
      tokens: tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl || undefined
      },
      data: notification.data || {},
      android: {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: {
          sound: 'default',
          clickAction: notification.deepLink || undefined,
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
            category: notification.type || 'default'
          }
        },
        fcmOptions: {
          imageUrl: notification.imageUrl || undefined
        }
      }
    };
  }

  /**
   * Validate a device token
   * @param {string} token - FCM device token
   * @returns {Promise<boolean>} True if valid
   */
  async validateToken(token) {
    await this.ensureInitialized();

    try {
      // Try to send a dry-run message
      await this.messaging.send({
        token: token,
        notification: {
          title: 'Test',
          body: 'Test'
        }
      }, true); // dry-run mode

      return true;
    } catch (error) {
      logger.warn('Invalid FCM token:', {
        token: token.substring(0, 20) + '...',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check Firebase service health
   * @returns {Promise<object>} Health status
   */
  async checkHealth() {
    try {
      if (!this.initialized || !this.messaging) {
        return {
          healthy: false,
          initialized: false,
          error: 'Firebase service not initialized'
        };
      }

      // Try a simple dry-run operation
      await this.messaging.send({
        token: 'test-token',
        notification: { title: 'Test', body: 'Test' }
      }, true);

      return {
        healthy: true,
        initialized: true,
        projectId: this.app.options.projectId
      };
    } catch (error) {
      // Dry-run with invalid token should fail with specific error
      if (error.code === 'messaging/invalid-argument') {
        return {
          healthy: true,
          initialized: true,
          projectId: this.app.options.projectId
        };
      }

      return {
        healthy: false,
        initialized: this.initialized,
        error: error.message
      };
    }
  }
}

module.exports = new FirebaseService();
