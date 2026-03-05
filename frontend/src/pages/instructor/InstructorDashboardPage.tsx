import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import CreateSimulationGroupDialog from '@/components/CreateSimulationGroupDialog';
import { instructorService, type InstructorSimulationGroup } from '@/services/instructorService';
import { getSimulationGroupColor } from '@/lib/colors';
import { useAuth } from '@/App';

/**
 * InstructorDashboardPage Component
 * 
 * Main page component for the instructor dashboard.
 * Similar to student dashboard but with instructor-specific actions.
 */
function InstructorDashboardPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [groups, setGroups] = useState<InstructorSimulationGroup[]>([]);
  const [user, setUser] = useState<{ name: string; avatarUrl?: string }>({ name: 'Instructor', avatarUrl: undefined });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [groupsData, userData] = await Promise.all([
          instructorService.getSimulationGroups(),
          instructorService.getCurrentUser(),
        ]);
        setGroups(groupsData);
        setUser(userData);
      } catch (error) {
        console.error('Error loading instructor dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('Sign out clicked');
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  const handleStudentView = () => {
    try {
      console.log('Switching to student view');
      navigate('/student');
    } catch (error) {
      console.error('Error switching to student view:', error);
    }
  };

  const handleCreateGroup = () => {
    try {
      setIsCreateDialogOpen(true);
    } catch (error) {
      console.error('Error opening create group dialog:', error);
    }
  };

  const handleCreateGroupSubmit = async (data: { name: string; description: string; active: boolean; enableVoice: boolean }) => {
    try {
      console.log('Creating group with data:', data);
      
      const createdGroup = await instructorService.createSimulationGroup(data);
      setGroups(prevGroups => [...prevGroups, {
        ...createdGroup,
        iconColor: getSimulationGroupColor(prevGroups.length),
      }]);
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleViewAnalytics = (groupId: string) => {
    try {
      console.log(`View analytics for group: ${groupId}`);
      navigate(`/instructor/group/${groupId}`);
    } catch (error) {
      console.error('Error viewing analytics:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <DashboardHeader
        title="Instructor Dashboard"
        subtitle="Home Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        onStudentView={handleStudentView}
        showStudentViewButton={true}
      />
      <main className="px-8 py-6">
        <SimulationGroupsSection
          groups={groups.map(g => ({
            ...g,
            simulation_group_id: g.id,
            group_name: g.name,
          }))}
          onJoinGroup={handleCreateGroup}
          onContinueTraining={handleViewAnalytics}
          joinButtonText="+ Create New Group"
          actionButtonText="View Analytics"
          descriptionText="Create simulation groups and view analytics."
        />
      </main>
      <CreateSimulationGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateGroupSubmit}
      />
    </div>
  );
}

export default InstructorDashboardPage;
