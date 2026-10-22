import { useState, useCallback } from 'react';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import PageContainer from '@/components/PageContainer';
import DashboardHeader from '@/components/DashboardHeader';
import SimulationGroupsSection from '@/components/SimulationGroupsSection';
import CreateSimulationGroupDialog, { type AdminCreateData } from '@/components/CreateSimulationGroupDialog';
import { mockAdminDataService, mockOrganizations } from '@/services/adminService';
import {type InstructorSimulationGroup } from '@/services/instructorService';
import { getSimulationGroupColor, UI_COLORS } from '@/lib/colors';
import { useAuth } from '@/App';
import * as adminApi from '@/services/adminApiService';
import { DashboardSkeleton } from '@/components/skeletons';
import { useNotification } from '@/components/notifications';

/**
 * AdminOrganizationPage Component
 * 
 * Page for viewing and managing simulation groups within a specific organization.
 */
const EMPTY_GROUPS: InstructorSimulationGroup[] = [];

function AdminOrganizationPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { showNotification } = useNotification();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  // The two resource hooks start together and cannot publish an old route's response.
  const loadGroups = useCallback(async (): Promise<InstructorSimulationGroup[]> => {
    const data = await adminApi.getAllSimulationGroups(organizationId);
    return data.map((g, i) => ({
      simulation_group_id: g.simulation_group_id, group_name: g.group_name,
      subtitle: g.group_description || 'Simulation Group', icon_color: getSimulationGroupColor(i),
      group_access_code: g.group_access_code || '', student_count: g.student_count || 0,
      instructor_count: g.instructor_count || 0, persona_count: g.persona_count || 0,
      organization_id: g.organization_id || '',
    }));
  }, [organizationId]);
  const loadOrganization = useCallback(async () => {
    if (!organizationId) return null;
    try { return await adminApi.getOrganization(organizationId); }
    catch (err) {
      console.error('Failed to load organization:', err);
      return mockOrganizations.find(o => o.organization_id === organizationId) || null;
    }
  }, [organizationId]);
  const [groups, setGroups, groupsLoading, groupsError] = useAsyncResource(
    organizationId || '', Boolean(organizationId), loadGroups, EMPTY_GROUPS
  );
  const [organization, , organizationLoading] = useAsyncResource(
    organizationId || '', Boolean(organizationId), loadOrganization, null
  );
  const loading = groupsLoading || organizationLoading;

  // Load user data from mock data service with error handling
  let user = mockAdminDataService.getCurrentUser();

  if (!user || !user.name) {
    console.warn('User data is missing or invalid, using default values');
    user = {
      name: 'Admin',
      avatarUrl: undefined
    };
  }

  const handleSignOut = async () => {
    try {
      console.log('Sign out clicked');
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  const handleBackToAllOrganizations = () => {
    try {
      navigate('/admin');
    } catch (error) {
      console.error('Error navigating back to organizations:', error);
    }
  };

  const handleCreateGroup = () => {
    try {
      setIsCreateDialogOpen(true);
    } catch (error) {
      console.error('Error opening create group dialog:', error);
    }
  };

  const handleCreateGroupSubmit = async (data: AdminCreateData) => {
    try {
      const created = await adminApi.createSimulationGroup({
        group_name: data.name,
        group_description: data.description,
        group_student_access: data.active,
        system_prompt: data.systemPrompt || '',
        organization_id: organizationId,
        // instructor_voice_enabled: data.enableVoice,  // uncomment after migration 005 runs
      });

      // Enroll any specified instructors
      const instructorEmails = data.instructors.split(',').map(i => i.trim()).filter(i => i);
      for (const email of instructorEmails) {
        try {
          await adminApi.addInstructorToGroup(created.simulation_group_id, email);
        } catch (err) {
          const message = err instanceof Error ? err.message : `Failed to enroll instructor ${email}.`;
          showNotification({ message, type: 'error' });
        }
      }

      const newGroup: InstructorSimulationGroup = {
        simulation_group_id: created.simulation_group_id,
        group_name: created.group_name,
        subtitle: 'Medical Simulation Group',
        icon_color: getSimulationGroupColor(groups.length),
        group_access_code: created.group_access_code || '',
        student_count: 0,
        instructor_count: instructorEmails.length,
        persona_count: 0,
        organization_id: created.organization_id || '',
      };
      setGroups(prevGroups => [...prevGroups, newGroup]);
    } catch (error) {
      console.error('Error creating group via API, adding locally:', error);
      // Fallback: add to local state
      const instructorEmails = data.instructors.split(',').map(i => i.trim()).filter(i => i);
      const fallbackGroup: InstructorSimulationGroup = {
        simulation_group_id: `group-${Date.now()}`,
        group_name: data.name,
        subtitle: 'Medical Simulation Group',
        icon_color: getSimulationGroupColor(groups.length),
        group_access_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
        student_count: 0,
        instructor_count: instructorEmails.length,
        persona_count: 0,
        organization_id: '',
      };
      setGroups(prevGroups => [...prevGroups, fallbackGroup]);
    }
  };

  const handleViewAnalytics = (groupId: string) => {
    try {
      console.log(`View analytics for group: ${groupId}`);
      // Navigate to simulation group page
      navigate(`/admin/organization/${organizationId}/group/${groupId}`);
    } catch (error) {
      console.error('Error viewing analytics:', error);
    }
  };

  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<{ open: boolean; groupId: string; groupName: string }>({
    open: false, groupId: '', groupName: ''
  });

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.simulation_group_id === groupId);
    const groupName = group ? group.group_name : 'this simulation group';
    setDeleteGroupConfirm({ open: true, groupId, groupName });
  };

  const handleConfirmDeleteGroup = async () => {
    try {
      await adminApi.deleteSimulationGroup(deleteGroupConfirm.groupId);
    } catch (error) {
      console.error('Error deleting group via API, removing locally:', error);
    }
    // Remove from state regardless (optimistic for mock, confirmed for real)
    setGroups(prevGroups => prevGroups.filter(g => g.simulation_group_id !== deleteGroupConfirm.groupId));
    setDeleteGroupConfirm({ open: false, groupId: '', groupName: '' });
  };

  if (loading) {
    return <DashboardSkeleton cardCount={3} />;
  }

  return (
    <PageContainer>
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Organization Page"
        userName={user.name}
        userAvatarUrl={user.avatarUrl}
        onSignOut={handleSignOut}
        showStudentViewButton={false}
        onStudentView={() => navigate('/student')}
        showManageBanksButton={true}
        onManageBanks={() => navigate(`/admin/organization/${organizationId}/banks`)}
      />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Back to All Organizations button */}
        <div className="mb-6">
          <button
            onClick={handleBackToAllOrganizations}
            className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            style={{ color: UI_COLORS.text.body }}
            onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
            onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Organizations
          </button>
        </div>

        {groupsError && <p role="alert" className="mb-4" style={{ color: UI_COLORS.text.error }}>{groupsError}</p>}
        <SimulationGroupsSection
          groups={groups.map(g => ({ ...g, name: g.group_name }))}
          onJoinGroup={handleCreateGroup}
          onContinueTraining={handleViewAnalytics}
          joinButtonText="+ Create New Group"
          actionButtonText="Manage Group"
          descriptionText="Edit simulation groups and view analytics."
          sectionTitle={organization ? `${organization.name} Simulation Groups` : 'Simulation Groups'}
          emptyStateText="No simulation groups exist for this organization yet. Create one to get started."
          showCounts={true}
          showDeleteButton={true}
          onDeleteGroup={handleDeleteGroup}
          countLabels={{
            students: organization?.user_role || 'Students',
            instructors: 'Instructors',
            patients: organization?.ai_persona || 'Patients'
          }}
        />
      </main>
      <CreateSimulationGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        role="admin"
        onCreate={handleCreateGroupSubmit}
      />

      {/* Delete Simulation Group Confirmation Dialog */}
      <Dialog open={deleteGroupConfirm.open} onOpenChange={(open) => setDeleteGroupConfirm(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>Delete Simulation Group</DialogTitle>
            <DialogDescription style={{ color: UI_COLORS.text.body }}>
              Are you sure you want to delete "{deleteGroupConfirm.groupName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupConfirm(prev => ({ ...prev, open: false }))} style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}>Cancel</Button>
            <Button onClick={handleConfirmDeleteGroup} style={{ backgroundColor: '#ef4444', color: '#fff' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default AdminOrganizationPage;