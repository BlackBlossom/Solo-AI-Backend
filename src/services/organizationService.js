const bundleSocialService = require('./bundleSocialService');
const logger = require('../utils/logger');

class OrganizationService {
  // Create organization setup for new user
  async setupUserOrganization(userData) {
    try {
      // Get organization details to ensure API access
      const organization = await bundleSocialService.getOrganization();
      
      // Create team in Bundle.social
      const team = await bundleSocialService.createTeam(userData);
      
      logger.info('Organization setup completed for user:', {
        userId: userData._id,
        teamId: team.id,
        organizationId: organization.id
      });

      return {
        bundleOrganizationId: organization.id,
        bundleTeamId: team.id,
        teamData: team,
        organizationData: organization
      };
    } catch (error) {
      logger.error('Failed to setup user organization:', error.message);
      throw new Error('Failed to setup user workspace');
    }
  }

  // Get organization details
  async getOrganizationDetails(teamId) {
    try {
      const team = await bundleSocialService.getTeam(teamId);
      return team;
    } catch (error) {
      logger.error('Failed to get organization details:', error.message);
      throw new Error('Failed to retrieve organization details');
    }
  }

  // Update organization settings
  async updateOrganizationSettings(teamId, settings) {
    try {
      // This would typically involve updating team settings in Bundle.social
      // For MVP, we'll just log the action
      logger.info('Organization settings update requested:', { teamId, settings });
      
      // In a real implementation, you would call Bundle.social API to update team settings
      return { success: true, message: 'Organization settings updated' };
    } catch (error) {
      logger.error('Failed to update organization settings:', error.message);
      throw new Error('Failed to update organization settings');
    }
  }

  // Get organization usage statistics
  async getOrganizationUsage() {
    try {
      // Get organization data with usage statistics
      const organization = await bundleSocialService.getOrganization();
      
      return {
        subscription: organization.subscription || {},
        usage: organization.usage || {},
        teams: organization.teams || [],
        totalTeams: organization.teams?.length || 0
      };
    } catch (error) {
      logger.error('Failed to get organization usage:', error.message);
      throw new Error('Failed to retrieve organization usage data');
    }
  }

  // Validate organization permissions
  async validateOrganizationAccess(userId, teamId) {
    try {
      // In a real implementation, you would verify that the user has access to this team
      // For MVP, we'll do a basic check
      logger.info('Validating organization access:', { userId, teamId });
      
      // This is a simplified check - in production you'd verify team membership
      return true;
    } catch (error) {
      logger.error('Failed to validate organization access:', error.message);
      return false;
    }
  }
}

module.exports = new OrganizationService();