import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft, CheckCircle, Loader, Circle } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';

/**
 * PatientsPage Component
 * 
 * Displays a list of patients for a specific simulation group.
 * Shows patient name, avatar placeholder, completion status, and review button.
 */
function PatientsPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  
  // Load user data from mock data service
  const user = mockDataService.getCurrentUser();
  
  // Load patients from mock data service
  const patients = mockDataService.getPatients();

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to home navigation
   */
  const handleBackToHome = () => {
    navigate('/');
  };

  /**
   * Handle review button click
   */
  const handleReview = (patientId: string) => {
    navigate(`/patients/${groupId}/${patientId}`);
  };

  /**
   * Get completion status badge
   */
  const getCompletionStatusBadge = (status: 'not-started' | 'in-progress' | 'completed') => {
    const statusConfig = {
      'completed': {
        icon: CheckCircle,
        text: 'Completed',
        bgColor: SIMULATION_GROUP_COLOR_PALETTE[6], // Green
        textColor: '#FFFFFF'
      },
      'in-progress': {
        icon: Loader,
        text: 'In Progress',
        bgColor: SIMULATION_GROUP_COLOR_PALETTE[2], // Blue
        textColor: '#FFFFFF'
      },
      'not-started': {
        icon: Circle,
        text: 'Not Started',
        bgColor: '#E5E7EB', // Gray
        textColor: '#374151'
      }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
        style={{
          backgroundColor: config.bgColor,
          color: config.textColor
        }}
      >
        <Icon className="w-4 h-4" style={{ color: '#000000' }} />
        <span className="font-medium text-sm">{config.text}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex bg-gray-200 border-b border-border items-center justify-between py-6 px-8">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight text-gray-900 leading-tight text-2xl">
              Patients
            </h1>
            <button
              onClick={handleBackToHome}
              className="text-gray-600 hover:text-gray-900 font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home Page
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <Button
            variant="default"
            onClick={handleSignOut}
            className="bg-gray-800 text-white hover:bg-gray-900 px-6"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6">
        <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                <th className="px-6 py-4 text-center font-semibold text-gray-900">Patient</th>
                <th className="px-6 py-4 text-center font-semibold text-gray-900">Completion Status</th>
                <th className="px-6 py-4 text-center font-semibold text-gray-900">Review</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-gray-200 last:border-b-0"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-center">
                      <UserAvatar
                        name={patient.name}
                        imageUrl={patient.avatarUrl}
                        size="small"
                      />
                      <span className="text-gray-900">{patient.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getCompletionStatusBadge(patient.completionStatus)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      onClick={() => handleReview(patient.id)}
                      variant="default"
                      className="bg-gray-800 text-white hover:bg-gray-900 px-6"
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default PatientsPage;
