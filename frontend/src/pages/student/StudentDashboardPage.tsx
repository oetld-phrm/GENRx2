import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import { mockDataService } from '@/services/studentService';

/**
 * StudentDashboardPage Component
 * 
 * Main page component that orchestrates the student dashboard.
 * Loads simulation groups and user data from mockDataService.
 * Handles sign out, join group, and continue training events.
 */
function StudentDashboardPage() {
  // Load simulation groups from mock data service
  const groups = mockDataService.getSimulationGroups();
  
  // Load user data from mock data service with error handling
  let user = mockDataService.getCurrentUser();
  
  // Error handling for missing user data (Requirement 12.1, 12.2)
  if (!user || !user.name) {
    console.warn('User data is missing or invalid, using default values');
    user = {
      name: 'Student',
      avatarUrl: undefined
    };
  }

  /**
   * Handle sign out event
   * Phase 1: Logs to console
   * Future: Will call API and redirect to login
   * 
   * Requirement 8.2
   */
  const handleSignOut = () => {
    try {
      console.log('Sign out clicked');
      // Future: Call API and redirect to login
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  /**
   * Handle join group event
   * Phase 1: Logs to console
   * Future: Will show modal or navigate to join page
   * 
   * Requirement 6.3
   */
  const handleJoinGroup = () => {
    try {
      console.log('Join group clicked');
      // Future: Show modal or navigate to join page
    } catch (error) {
      console.error('Error during join group:', error);
    }
  };

  /**
   * Handle continue training event
   * Phase 1: Logs group ID to console
   * Future: Will navigate to simulation page
   * 
   * Requirement 7.2
   * 
   * @param groupId - The ID of the simulation group to continue training in
   */
  const handleContinueTraining = (groupId: string) => {
    try {
      console.log(`Continue training for group: ${groupId}`);
      // Future: Navigate to simulation page
    } catch (error) {
      console.error('Error during continue training:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <DashboardHeader
        title="Student Dashboard"
        subtitle="Home Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
      />
      <main className="px-8 py-6">
        <SimulationGroupsSection
          groups={groups}
          onJoinGroup={handleJoinGroup}
          onContinueTraining={handleContinueTraining}
        />
      </main>
    </div>
  );
}

export default StudentDashboardPage;
