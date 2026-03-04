import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UserAvatar from '@/components/UserAvatar';
import { mockInstructorDataService, type GlobalRubricQuestion } from '@/services/instructorService';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Key, Copy, Search, Trash2, Edit, Plus, Menu } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * InstructorSimulationGroupPage Component
 * 
 * Displays the simulation group management view for instructors.
 * Includes sidebar navigation and content area for analytics, patient management, etc.
 */
function InstructorSimulationGroupPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [activeSection, setActiveSection] = useState<'analytics' | 'patients' | 'students' | 'rubric' | 'prompt'>('analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [enableVoiceForAll, setEnableVoiceForAll] = useState(false);
  
  // Global Rubric state
  const [globalRubricQuestions, setGlobalRubricQuestions] = useState<GlobalRubricQuestion[]>(() => 
    mockInstructorDataService.getGlobalRubricQuestions(groupId || '1')
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(() => {
    const questions = mockInstructorDataService.getGlobalRubricQuestions(groupId || '1');
    return questions[0]?.id || null;
  });
  const [rubricSearchQuery, setRubricSearchQuery] = useState('');
  const [isMainSidebarVisible, setIsMainSidebarVisible] = useState(true);
  
  // Get selected question
  const selectedQuestion = globalRubricQuestions.find(q => q.id === selectedQuestionId);
  
  // Filter questions based on search
  const filteredRubricQuestions = globalRubricQuestions.filter(q =>
    q.title.toLowerCase().includes(rubricSearchQuery.toLowerCase())
  );
  
  // Load data from instructor service
  const user = mockInstructorDataService.getCurrentUser();
  const simulationGroup = mockInstructorDataService.getSimulationGroup(groupId || '1');
  const patientAnalytics = mockInstructorDataService.getPatientAnalytics(groupId || '1');
  
  // Use state for manageable patients so we can trigger re-renders
  const [manageablePatients, setManageablePatients] = useState(() => 
    mockInstructorDataService.getManageablePatients(groupId || '1')
  );
  
  // State for selected patient
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    patientAnalytics.length > 0 ? patientAnalytics[0].id : ''
  );
  
  // Get current patient data
  const currentPatient = patientAnalytics.find(p => p.id === selectedPatientId);
  const messageCountData = currentPatient 
    ? mockInstructorDataService.getMessageCountData(selectedPatientId)
    : [];
  
  // Fallback values
  const simulationGroupName = simulationGroup?.name || 'Simulation Group';
  const accessCode = simulationGroup?.accessCode || 'XXXX-XXXX-XXXX-XXXX';
  
  // Filter patients based on search query (user searches by name, but ID is the unique identifier)
  const filteredPatients = manageablePatients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to all groups navigation
   */
  const handleBackToAllGroups = () => {
    navigate('/');
  };

  /**
   * Handle student view navigation
   */
  const handleStudentView = () => {
    navigate('/student');
  };

  /**
   * Handle generate new access code
   */
  const handleGenerateAccessCode = () => {
    if (groupId) {
      const newCode = mockInstructorDataService.generateAccessCode(groupId);
      console.log('Generated new access code:', newCode);
      // Force re-render by navigating to same route
      navigate(`/instructor/group/${groupId}`, { replace: true });
    }
  };

  /**
   * Handle copy access code
   */
  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };

  /**
   * Handle toggle LLM evaluation for a patient
   */
  const handleToggleLLMEvaluation = (patientId: string, currentValue: boolean) => {
    // Update the state directly with a new array
    setManageablePatients(prevPatients => 
      prevPatients.map(patient => 
        patient.id === patientId 
          ? { ...patient, llmEvaluationEnabled: !currentValue }
          : patient
      )
    );
    // Also update the service data for consistency
    mockInstructorDataService.updatePatientLLMEvaluation(patientId, !currentValue);
  };

  /**
   * Handle delete patient
   */
  const handleDeletePatient = (patientId: string) => {
    if (confirm('Are you sure you want to delete this patient?')) {
      // Update the state directly with filtered array
      setManageablePatients(prevPatients => 
        prevPatients.filter(patient => patient.id !== patientId)
      );
      // Also update the service data for consistency
      mockInstructorDataService.deletePatient(patientId);
    }
  };

  /**
   * Handle edit patient
   */
  const handleEditPatient = (patientId: string) => {
    console.log('Edit patient:', patientId);
    // TODO: Implement edit patient dialog
  };

  /**
   * Handle create new patient
   */
  const handleCreateNewPatient = () => {
    console.log('Create new patient');
    // TODO: Implement create patient dialog
  };

  /**
   * Handle add new key question
   */
  const handleAddNewKeyQuestion = () => {
    const newQuestion: GlobalRubricQuestion = {
      id: `q-${Date.now()}`,
      title: 'New Question',
      keyQuestion: '',
      clinicalIntent: '',
      evaluationCriteria: '',
      required: false,
    };
    mockInstructorDataService.addGlobalRubricQuestion(groupId || '1', newQuestion);
    setGlobalRubricQuestions(mockInstructorDataService.getGlobalRubricQuestions(groupId || '1'));
    setSelectedQuestionId(newQuestion.id);
  };

  /**
   * Handle delete question
   */
  const handleDeleteQuestion = () => {
    if (!selectedQuestionId) return;
    if (confirm('Are you sure you want to delete this question?')) {
      mockInstructorDataService.deleteGlobalRubricQuestion(groupId || '1', selectedQuestionId);
      const updatedQuestions = mockInstructorDataService.getGlobalRubricQuestions(groupId || '1');
      setGlobalRubricQuestions(updatedQuestions);
      setSelectedQuestionId(updatedQuestions[0]?.id || null);
    }
  };

  /**
   * Handle save question changes
   */
  const handleSaveQuestion = () => {
    if (!selectedQuestion) return;
    mockInstructorDataService.updateGlobalRubricQuestion(groupId || '1', selectedQuestion);
    console.log('Saving question:', selectedQuestion);
    // TODO: API call to save question
  };

  /**
   * Handle update question field
   */
  const handleUpdateQuestionField = (field: keyof GlobalRubricQuestion, value: string | boolean) => {
    if (!selectedQuestionId) return;
    setGlobalRubricQuestions(globalRubricQuestions.map(q => 
      q.id === selectedQuestionId ? { ...q, [field]: value } : q
    ));
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: UI_COLORS.background.white }}>
      {/* Header */}
      <header className="flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
        <div className="flex items-center gap-4">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsMainSidebarVisible(!isMainSidebarVisible)}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight leading-tight text-2xl" style={{ color: UI_COLORS.text.heading }}>
              Simulation Group View
            </h1>
            <button
              onClick={handleBackToAllGroups}
              className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
              style={{ color: UI_COLORS.text.body }}
              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All Groups
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="default"
            onClick={handleStudentView}
            className="px-6 transition-colors"
            style={{ 
              backgroundColor: UI_COLORS.button.primary,
              color: UI_COLORS.button.text
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Student View
          </Button>
          
          <Button
            variant="default"
            onClick={handleSignOut}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
          >
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside 
          className="flex flex-col transition-all duration-300 ease-in-out border-r"
          aria-hidden={!isMainSidebarVisible}
          style={{ 
            backgroundColor: UI_COLORS.background.white, 
            borderRightWidth: isMainSidebarVisible ? '1px' : '0px',
            borderRightStyle: 'solid',
            borderRightColor: UI_COLORS.border.default,
            width: isMainSidebarVisible ? '16rem' : '0rem',
            minWidth: isMainSidebarVisible ? '16rem' : '0rem',
            overflow: 'hidden',
            opacity: isMainSidebarVisible ? 1 : 0,
            pointerEvents: isMainSidebarVisible ? 'auto' : 'none',
          }}
        >
          {/* Navigation Buttons */}
          <nav className="flex-1 p-4 space-y-2">
          <Button
            onClick={() => setActiveSection('analytics')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'analytics' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </Button>

          <Button
            onClick={() => setActiveSection('patients')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'patients' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <Users className="w-5 h-5" />
            Manage Patients
          </Button>

          <Button
            onClick={() => setActiveSection('students')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'students' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <UserCog className="w-5 h-5" />
            Manage Students
          </Button>

          <Button
            onClick={() => setActiveSection('rubric')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'rubric' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <FileText className="w-5 h-5" />
            Global Rubric
          </Button>

          <Button
            onClick={() => setActiveSection('prompt')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'prompt' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <Eye className="w-5 h-5" />
            View Evaluation Prompt
          </Button>
        </nav>

        {/* Access Code Section */}
        <div className="border-t p-4 space-y-3" style={{ borderColor: UI_COLORS.border.default }}>
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
              Access Code
            </p>
            <div className="flex items-center gap-2 p-3 rounded-md border" style={{ 
              backgroundColor: UI_COLORS.background.tableHeader,
              borderColor: UI_COLORS.border.default
            }}>
              <Key className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
              <span className="font-mono text-sm flex-1" style={{ color: UI_COLORS.text.heading }}>
                {accessCode}
              </span>
              <button
                onClick={handleCopyAccessCode}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                title="Copy access code"
              >
                <Copy className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
              </button>
            </div>
          </div>
          
          <Button
            onClick={handleGenerateAccessCode}
            variant="outline"
            className="w-full justify-center gap-2 py-2.5 h-auto font-medium"
            style={{
              borderColor: UI_COLORS.border.default,
              color: UI_COLORS.text.heading
            }}
          >
            Generate new access code
          </Button>
        </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden" style={{ padding: activeSection === 'rubric' ? '0' : '2rem' }}>
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              {/* Simulation Group Title */}
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: UI_COLORS.text.heading }}>
                {simulationGroupName}
              </h2>

              {/* Patient Tabs */}
              <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                {patientAnalytics.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{
                      color: selectedPatientId === patient.id ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                      borderColor: selectedPatientId === patient.id ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                      backgroundColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    {patient.name}
                  </button>
                ))}
              </div>

              {/* Patient Overview Section */}
              {currentPatient && (
              <div className="border rounded-lg p-6" style={{ borderColor: UI_COLORS.border.default }}>
                <h3 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>
                  {currentPatient.name} Overview
                </h3>

                {/* Progress Bars */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  {/* Instructor Completion Percentage */}
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                      Instructor Completion Percentage:
                    </p>
                    <div className="w-full h-2 rounded-full mb-2" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                      <div 
                        className="h-full rounded-full" 
                        style={{ 
                          width: `${currentPatient.instructorCompletionPercentage}%`,
                          backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[4]
                        }}
                      />
                    </div>
                    <p className="text-sm text-right" style={{ color: UI_COLORS.text.body }}>
                      {currentPatient.instructorCompletionPercentage.toFixed(2)}%
                    </p>
                  </div>

                  {/* LLM Completion Percentage */}
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                      LLM Completion Percentage:
                    </p>
                    <div className="w-full h-2 rounded-full mb-2" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                      <div 
                        className="h-full rounded-full" 
                        style={{ 
                          width: `${currentPatient.llmCompletionPercentage}%`,
                          backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[4]
                        }}
                      />
                    </div>
                    <p className="text-sm text-right" style={{ color: UI_COLORS.text.body }}>
                      {currentPatient.llmCompletionPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Message Counts */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      Student Message Count: {currentPatient.studentMessageCount}
                    </p>
                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      AI Message Count: {currentPatient.aiMessageCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: UI_COLORS.text.body }}>
                      Student Access Count: {currentPatient.studentAccessCount}
                    </p>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="mt-8">
                  <h4 className="text-lg font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                    Message Count
                  </h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={messageCountData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      barSize={60}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: UI_COLORS.text.body }}
                        axisLine={{ stroke: UI_COLORS.border.default }}
                      />
                      <YAxis 
                        tick={{ fill: UI_COLORS.text.body }}
                        axisLine={{ stroke: UI_COLORS.border.default }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: UI_COLORS.background.white,
                          border: `1px solid ${UI_COLORS.border.default}`,
                          borderRadius: '6px'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ color: UI_COLORS.text.body }}
                      />
                      <Bar 
                        dataKey="Student Messages" 
                        fill={SIMULATION_GROUP_COLOR_PALETTE[2]} 
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="AI Messages" 
                        fill={SIMULATION_GROUP_COLOR_PALETTE[5]} 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              )}
            </div>
          )}
          
          {activeSection === 'patients' && (
            <div className="space-y-6 max-w-4xl">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                <Input
                  placeholder="Search by Patient Name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ 
                    borderWidth: '1px', 
                    borderStyle: 'solid', 
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.white
                  }}
                />
              </div>

              {/* Patient Table */}
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                {/* Table Header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_2fr_2fr] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Patient Name
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Age
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Gender
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    LLM Evaluation
                  </div>
                  <div className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                    Actions
                  </div>
                </div>

                {/* Table Rows */}
                {filteredPatients.map((patient) => (
                  <div 
                    key={patient.id}
                    className="grid grid-cols-[2fr_1fr_1fr_2fr_2fr] gap-4 px-6 py-4 border-t items-center"
                    style={{ borderColor: UI_COLORS.border.default }}
                  >
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {patient.name}
                    </div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {patient.age}
                    </div>
                    <div className="text-base" style={{ color: UI_COLORS.text.heading }}>
                      {patient.gender}
                    </div>
                    <div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={patient.llmEvaluationEnabled}
                        onClick={() => handleToggleLLMEvaluation(patient.id, patient.llmEvaluationEnabled)}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ 
                          backgroundColor: patient.llmEvaluationEnabled ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                        }}
                      >
                        <span
                          className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                          style={{
                            transform: patient.llmEvaluationEnabled ? 'translateX(22px)' : 'translateX(2px)'
                          }}
                        />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleEditPatient(patient.id)}
                        className="px-6 py-2 text-sm font-medium transition-colors"
                        style={{ 
                          backgroundColor: UI_COLORS.button.primary, 
                          color: UI_COLORS.button.text 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <button
                        onClick={() => handleDeletePatient(patient.id)}
                        className="p-2 rounded transition-colors"
                        style={{ 
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.hover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create New Patient Button */}
              <Button
                onClick={handleCreateNewPatient}
                className="px-6 py-6 text-base font-medium transition-colors"
                style={{ 
                  backgroundColor: UI_COLORS.button.primary, 
                  color: UI_COLORS.button.text 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Patient
              </Button>

              {/* Enable Voice for All Patients */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableVoiceForAll}
                  onClick={() => setEnableVoiceForAll(!enableVoiceForAll)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ 
                    backgroundColor: enableVoiceForAll ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                  }}
                >
                  <span
                    className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                    style={{
                      transform: enableVoiceForAll ? 'translateX(22px)' : 'translateX(2px)'
                    }}
                  />
                </button>
                <span 
                  className="text-sm font-medium"
                  style={{ color: UI_COLORS.text.body }}
                >
                  Enable voice conversations for all patients
                </span>
              </div>
            </div>
          )}
          
          {activeSection === 'students' && (
            <div>
              {/* Manage Students content will go here */}
            </div>
          )}
          
          {activeSection === 'rubric' && (
            <div className="flex h-full relative">
              {/* Question List Sidebar */}
              <aside 
                className="flex flex-col border-r"
                style={{ 
                  backgroundColor: UI_COLORS.background.white, 
                  borderRightWidth: '1px',
                  borderRightStyle: 'solid',
                  borderRightColor: UI_COLORS.border.default,
                  width: '20rem',
                  minWidth: '20rem',
                }}
              >
                {/* Header */}
                <div style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
                  <div className="px-6 pt-6 pb-6">
                    <h2 className="font-semibold text-lg mb-3" style={{ color: UI_COLORS.text.heading }}>
                      GLOBAL RUBRIC
                    </h2>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>
                      These questions apply to all patients in this simulation group.
                      Global key questions can only be edited here.
                    </p>
                    <p className="text-xs mb-4" style={{ color: UI_COLORS.text.muted }}>
                      In each patient's page, global key questions are view-only.
                    </p>
                    
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                      <Input
                        placeholder="Search Global Key Questions"
                        value={rubricSearchQuery}
                        onChange={(e) => setRubricSearchQuery(e.target.value)}
                        className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        style={{ 
                          borderWidth: '1px', 
                          borderStyle: 'solid', 
                          borderColor: UI_COLORS.border.default,
                          backgroundColor: UI_COLORS.background.white
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Question List */}
                <div className="flex-1 overflow-y-auto">
                  {filteredRubricQuestions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => setSelectedQuestionId(question.id)}
                      className="w-full text-left py-3 transition-colors"
                      style={{
                        backgroundColor: selectedQuestionId === question.id ? UI_COLORS.background.tableHeader : 'transparent',
                        borderBottomWidth: '1px',
                        borderBottomStyle: 'solid',
                        borderBottomColor: UI_COLORS.border.default,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedQuestionId !== question.id) {
                          e.currentTarget.style.backgroundColor = UI_COLORS.background.hoverLight;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedQuestionId !== question.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div className="px-6">
                        <p className="text-sm font-medium mb-1" style={{ color: UI_COLORS.text.heading }}>
                          Q{globalRubricQuestions.indexOf(question) + 1} - {question.title}
                        </p>
                        <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                          [{question.required ? 'Required' : 'Optional'}]
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Add New Question Button */}
                <div style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }}>
                  <div className="p-6">
                    <Button
                      onClick={handleAddNewKeyQuestion}
                      className="w-full justify-start gap-2 py-2.5 h-auto font-medium transition-colors"
                      style={{ 
                        backgroundColor: UI_COLORS.button.primary, 
                        color: UI_COLORS.button.text 
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                    >
                      <Plus className="w-5 h-5" />
                      Add new Key Question
                    </Button>
                  </div>
                </div>
              </aside>

              {/* Question Detail Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8">
                  {selectedQuestion ? (
                    <div className="max-w-4xl space-y-6">
                      <h2 className="text-2xl font-bold" style={{ color: UI_COLORS.text.heading }}>
                        Question {globalRubricQuestions.indexOf(selectedQuestion) + 1}
                      </h2>

                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Title
                        </label>
                        <Input
                          value={selectedQuestion.title}
                          onChange={(e) => handleUpdateQuestionField('title', e.target.value)}
                          className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        />
                      </div>

                      {/* Key Question */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Key Question
                        </label>
                        <textarea
                          value={selectedQuestion.keyQuestion}
                          onChange={(e) => handleUpdateQuestionField('keyQuestion', e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            outlineColor: UI_COLORS.border.medium,
                            minHeight: '100px',
                          }}
                        />
                      </div>

                      {/* Clinical Intent */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Clinical Intent
                        </label>
                        <textarea
                          value={selectedQuestion.clinicalIntent}
                          onChange={(e) => handleUpdateQuestionField('clinicalIntent', e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            outlineColor: UI_COLORS.border.medium,
                            minHeight: '100px',
                          }}
                        />
                      </div>

                      {/* Evaluation Criteria */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                          Evaluation Criteria
                        </label>
                        <textarea
                          value={selectedQuestion.evaluationCriteria}
                          onChange={(e) => handleUpdateQuestionField('evaluationCriteria', e.target.value)}
                          className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                          style={{ 
                            borderWidth: '1px', 
                            borderStyle: 'solid', 
                            borderColor: UI_COLORS.border.default,
                            outlineColor: UI_COLORS.border.medium,
                            minHeight: '150px',
                          }}
                        />
                      </div>

                      {/* Required Toggle */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selectedQuestion.required}
                          onClick={() => handleUpdateQuestionField('required', !selectedQuestion.required)}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{ 
                            backgroundColor: selectedQuestion.required ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive 
                          }}
                        >
                          <span
                            className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                            style={{
                              transform: selectedQuestion.required ? 'translateX(22px)' : 'translateX(2px)'
                            }}
                          />
                        </button>
                        <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                          Required for Case Completion
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-4 pt-4">
                        <Button
                          onClick={handleSaveQuestion}
                          className="px-8 py-3 text-base font-medium transition-colors"
                          style={{ 
                            backgroundColor: UI_COLORS.button.primary, 
                            color: UI_COLORS.button.text 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          Save Changes
                        </Button>
                        <Button
                          onClick={handleDeleteQuestion}
                          variant="outline"
                          className="px-8 py-3 text-base font-medium transition-colors text-white"
                          style={{ 
                            backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                            borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full" style={{ color: UI_COLORS.text.light }}>
                      <p>Select a question to edit or create a new one</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeSection === 'prompt' && (
            <div>
              {/* View Evaluation Prompt content will go here */}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default InstructorSimulationGroupPage;
