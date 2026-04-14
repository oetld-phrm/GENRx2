import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { instructorService, type GlobalRubricQuestion, type CaseMaterial, type QuestionBankItem, type StudentProgressData } from '@/services/instructorService';
import { useSimulationGroupData } from '@/hooks/useSimulationGroupData';
import { usePatientEditor } from '@/hooks/usePatientEditor';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useStudentViewer } from '@/hooks/useStudentViewer';
import { useDebriefViewer } from '@/hooks/useDebriefViewer';
import { studentService } from '@/services/studentService';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Search, Trash2, Edit, Plus, Menu, Camera, Upload, HelpCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/App';
import AIDebriefDialog from '../../components/AIDebriefDialog';
import { SimulationGroupSidebar } from '@/components/simulation-group/SimulationGroupSidebar';
import { AnalyticsSection } from '@/components/simulation-group/AnalyticsSection';
import { PatientsSection } from '@/components/simulation-group/PatientsSection';
import { StudentsSection } from '@/components/simulation-group/StudentsSection';
import { StudentDetailsPanel } from '@/components/simulation-group/StudentDetailsPanel';
import { EditPatientPanel } from '@/components/simulation-group/EditPatientPanel';
import { RubricSection } from '@/components/simulation-group/RubricSection';

/**
 * InstructorSimulationGroupPage Component
 *
 * Displays the simulation group management view for instructors.
 * Includes sidebar navigation and content area for analytics, patient management, etc.
 */
function InstructorSimulationGroupPage() {
  const navigate = useNavigate();
  const { signOut, user: authUser } = useAuth();
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const adminReturnUrl = searchParams.get('returnUrl');
  const [activeSection, setActiveSection] = useState<'analytics' | 'patients' | 'students' | 'rubric' | 'questionBank' | 'prompt' | 'editPatient' | 'viewStudent'>('analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [enableVoiceForAll, setEnableVoiceForAll] = useState(false);
  // Student viewer state — extracted to useStudentViewer hook (initialized after simulationGroup is available)

  // Patient Specific Analytics - now from useSimulationGroupData hook

  // Global Rubric state
  const [globalRubricQuestions, setGlobalRubricQuestions] = useState<GlobalRubricQuestion[]>(() =>
    instructorService.getGlobalRubricQuestions(groupId || '1')
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(() => {
    const questions = instructorService.getGlobalRubricQuestions(groupId || '1');
    return questions[0]?.id || null;
  });
  const [rubricSearchQuery, setRubricSearchQuery] = useState('');
  const [isMainSidebarVisible, setIsMainSidebarVisible] = useState(true);

  // Question Bank state — extracted to useQuestionBank hook
  const questionBank = useQuestionBank({ role: 'instructor' });
  const {
    questionBankTab, setQuestionBankTab,
    globalBankQuestions, setGlobalBankQuestions,
    patientSpecificBankQuestions, setPatientSpecificBankQuestions,
    filteredGlobalQuestions, filteredPatientQuestions,
    includedQuestionIds, setIncludedQuestionIds,
    pendingQuestionIds, setPendingQuestionIds,
    allExistingTags,
    globalQuestionSearchQuery, setGlobalQuestionSearchQuery,
    patientQuestionSearchQuery, setPatientQuestionSearchQuery,
    globalPagination,
    patientPagination, setPatientPagination,
    handleGlobalPageChange, handlePatientPageChange,
    handleGlobalItemsPerPageChange, handlePatientItemsPerPageChange,
    getPaginatedQuestions, getTotalPages,
    handleTogglePendingQuestion,
    hasPendingChanges, pendingAddCount, pendingRemoveCount,
    handleResetSelections,
    isAddQuestionDialogOpen, setIsAddQuestionDialogOpen,
    isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen,
    selectedPatientForQuestionBank, setSelectedPatientForQuestionBank,
    setQuestionBankLoading, setQuestionBankError,
  } = questionBank;

  const [caseQuestionSearchQuery, setCaseQuestionSearchQuery] = useState('');
  const [globalRubricSearchQuery, setGlobalRubricSearchQuery] = useState('');

  // Filter case questions based on search
  const filteredCaseQuestions = patientEditor.caseSpecificQuestions.filter(q =>
    q.title.toLowerCase().includes(caseQuestionSearchQuery.toLowerCase())
  );

  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

  // Get selected material
  const selectedMaterial = patientEditor.caseMaterials.find(m => m.id === patientEditor.selectedMaterialId);

  // Filter materials based on search
  const filteredMaterials = patientEditor.caseMaterials.filter(m =>
    m.title.toLowerCase().includes(materialSearchQuery.toLowerCase())
  );

  // Get selected question
  const selectedQuestion = globalRubricQuestions.find(q => q.id === selectedQuestionId);

  // Shared data loading hook
  const {
    simulationGroup, setSimulationGroup,
    patientAnalytics,
    students,
    manageablePatients, setManageablePatients,
    profilePictures, setProfilePictures,
    keyQuestionCoverage,
    labels,
    user,
    loading,
    analyticsDateRange, setAnalyticsDateRange,
    keyQuestionAnalytics,
    studentProgress,
    selectedPatientId, setSelectedPatientId,
    reloadPatients,
  } = useSimulationGroupData({ groupId, role: 'instructor' });

  const patientEditor = usePatientEditor({
    groupId,
    role: 'instructor',
    manageablePatients,
    setManageablePatients,
    profilePictures,
    setProfilePictures,
    reloadPatients,
  });

  const {
    selectedStudentId,
    studentDetails,
    studentDetailsLoading,
    studentPatientData,
    expandedAttemptId,
    selectedPatientFilter,
    viewStudent,
    closeStudentView,
    setExpandedAttemptId,
    setSelectedPatientFilter,
  } = useStudentViewer({ groupId, groupName: simulationGroup?.group_name });

  const [isAccessCodeDialogOpen, setIsAccessCodeDialogOpen] = useState(false);
  const [, setEvaluationPromptText] = useState('');
  const [debriefPromptText, setDebriefPromptText] = useState('');

  // AI Debrief and PDF generation — extracted to useDebriefViewer hook
  const {
    isAIDebriefOpen,
    selectedDebriefData,
    isFetchingDebrief,
    isGeneratingPdf,
    attemptPdfRefs,
    viewDebrief: handleViewAIDebrief,
    closeDebrief,
    downloadPdf,
  } = useDebriefViewer({ groupId });

  const {
    aiPersona: aiPersonaLabel,
    aiPersonaPlural: aiPersonaLabelPlural,
    aiPersonaLower: aiPersonaLabelLower,
    userRole: userRoleLabel,
  } = labels;

  // manageablePatients and profilePictures are now from the hook

  // Initial data loading is handled by useSimulationGroupData hook
  // Load prompts separately (not part of shared hook)
  useEffect(() => {
    if (!groupId) return;
    const loadPrompts = async () => {
      try {
        const [evalPrompt, debriefPrompt] = await Promise.all([
          instructorService.getEvaluationPrompt(groupId),
          instructorService.getDebriefPrompt(groupId),
        ]);
        setEvaluationPromptText(evalPrompt);
        setDebriefPromptText(debriefPrompt);
      } catch (error) {
        console.error('Error loading prompts:', error);
      }
    };
    loadPrompts();
  }, [groupId]);

  // Analytics date range filtering is handled by useSimulationGroupData hook

  // Load question bank data when the questionBank section is activated
  useEffect(() => {
    if (activeSection === 'questionBank') {
      const loadQuestionBank = async () => {
        try {
          setQuestionBankLoading(true);
          setQuestionBankError(null);
          const questions = await instructorService.getGlobalQuestionBank();
          setGlobalBankQuestions(questions);
        } catch (err) {
          setQuestionBankError(err instanceof Error ? err.message : 'Failed to load question bank');
        } finally {
          setQuestionBankLoading(false);
        }
      };
      loadQuestionBank();
    }
  }, [activeSection]);

  // Load assigned questions from API when rubric or questionBank section is activated
  useEffect(() => {
    if ((activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'editPatient') && groupId) {
      instructorService.getSimulationGroupQuestions(groupId)
        .then((assigned: any[]) => {
          const rubricQuestions: GlobalRubricQuestion[] = assigned.map((q: any) => ({
            id: q.question_id,
            group_question_id: q.group_question_id,
            title: q.title || '',
            keyQuestion: q.question_text || '',
            clinicalIntent: '',
            evaluationCriteria: q.evaluation_criteria || '',
            required: q.is_mandatory ?? false,
          }));
          setGlobalRubricQuestions(rubricQuestions);
          setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
          setPendingQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
          if (rubricQuestions.length > 0 && !selectedQuestionId) {
            setSelectedQuestionId(rubricQuestions[0].id);
          }
        })
        .catch((err: any) => {
          console.error('Failed to load assigned questions:', err);
        });
    }
  }, [activeSection, groupId]);

  // selectedPatientId is now from useSimulationGroupData hook

  // currentPatient, messageCountData, donutColors, totalMessages moved to AnalyticsSection component

  // keyQuestionAnalytics is now from useSimulationGroupData hook

  // studentProgress is now from useSimulationGroupData hook

  // Score distribution for current patient

  // Fallback values
  const simulationGroupName = simulationGroup?.group_name || 'Simulation Group';
  const accessCode = simulationGroup?.group_access_code || 'XXXX-XXXX-XXXX-XXXX';

  // Filter patients based on search query
  const filteredPatients = manageablePatients.filter(patient =>
    (patient.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Student filtering is now handled by StudentsSection component

  /**
   * Handle sign out event
   */
  const handleSignOut = async () => {
    await signOut();
  };

  /**
   * Handle back to all groups navigation
   */
  const handleBackToAllGroups = () => {
    navigate('/instructor');
  };

  /**
   * Handle student view navigation
   */
  const handleStudentView = async () => {
    // If we're on a sim group page, auto-enroll as student and go directly to that group
    if (groupId && accessCode && accessCode !== 'XXXX-XXXX-XXXX-XXXX') {
      const result = await studentService.joinGroup(accessCode);
      if (result?.success) {
        navigate(`/patients/${groupId}`);
      } else {
        // Enrollment failed; notify the user and send them to the general student view
        window.alert('Unable to join this simulation group as a student. Redirecting to your student dashboard.');
        navigate('/student');
      }
    } else {
      navigate('/student');
    }
  };

  const hasAdminRole = authUser?.groups.includes('admin') || false;

  const handleAdminView = () => {
    const orgId = simulationGroup?.organization_id;
    if (orgId && groupId) {
      navigate(`/admin/organization/${orgId}/group/${groupId}`);
    } else {
      navigate('/admin');
    }
  };

  /**
   * Handle generate new access code
   */
  const handleGenerateAccessCode = async () => {
    if (groupId) {
      try {
        const newCode = await instructorService.generateAccessCode(groupId);
        console.log('Generated new access code:', newCode);
        const groupData = await instructorService.getSimulationGroup(groupId);
        setSimulationGroup(groupData);
      } catch (error) {
        console.error('Error generating access code:', error);
      }
    }
  };

  /**
   * Handle copy access code
   */
  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };

  /**
   * Handle delete patient
   */
  const handleDeletePatient = (patientId: string) => {
    if (confirm(`Are you sure you want to delete this ${aiPersonaLabelLower}?`)) {
      setManageablePatients(prevPatients =>
        prevPatients.filter(patient => patient.id !== patientId)
      );
      instructorService.deletePatient(patientId);
    }
  };

  /**
   * Handle edit patient - delegates to patientEditor hook
   */
  const handleEditPatient = (patientId: string) => {
    patientEditor.startEditing(patientId);

    const questionIds = instructorService.getPatientCaseSpecificQuestionIds(patientId);
    setIncludedQuestionIds(questionIds);
    setPendingQuestionIds(new Set(questionIds));

    setActiveSection('editPatient');
  };

  /**
   * Handle back from edit patient
   */
  const handleBackFromEditPatient = () => {
    patientEditor.stopEditing();
    setActiveSection('patients');
  };

  /**
   * Handle view student
   */
  const handleViewStudent = async (studentId: string) => {
    await viewStudent(studentId);
    setActiveSection('viewStudent');
  };

  /**
   * Handle back from view student
   */
  const handleBackFromViewStudent = () => {
    closeStudentView();
    setActiveSection('students');
  };

  /**
   * Handle save patient changes - delegates to patientEditor hook
   */
  const handleSavePatientChanges = async () => {
    await patientEditor.savePatient();
    handleBackFromEditPatient();
  };

  /**
   * Handle create new patient - delegates to patientEditor hook
   */
  const handleCreateNewPatient = () => {
    patientEditor.startCreating();
    setActiveSection('editPatient');
  };

  /**
   * Handle save question changes
   */
  const handleSaveQuestion = async () => {
    if (!selectedQuestion) {
      console.warn('handleSaveQuestion: no selectedQuestion');
      return;
    }
    try {
      await instructorService.updateGlobalRubricQuestion(groupId || '1', selectedQuestion);
      alert('Question saved successfully.');
    } catch (error) {
      console.error('Failed to save question:', error);
      alert('Failed to save question. Please try again.');
    }
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

  /**
   * Handle save new patient-specific question from dialog
   */
  const handleSaveNewPatientQuestion = (question: {
    patientId: string;
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
  }) => {
    const newQuestionId = `bank-patient-${Date.now()}`;
    const newBankQuestion: any = {
      id: newQuestionId,
      title: question.title,
      questionText: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      isMandatory: question.required,
      isActive: true,
      usedBySimulationGroups: [],
      usedByPatients: []
    };

    instructorService.addToPatientSpecificQuestionBank(newBankQuestion);
    setPatientSpecificBankQuestions(instructorService.getPatientSpecificQuestionBank());

    const newCaseQuestion: GlobalRubricQuestion = {
      id: newQuestionId,
      title: question.title,
      keyQuestion: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      required: question.required,
    };

    instructorService.addCaseSpecificQuestion(question.patientId, newCaseQuestion);

    if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank === question.patientId) {
      setIncludedQuestionIds(prev => {
        const newSet = new Set(prev);
        newSet.add(newQuestionId);
        return newSet;
      });
    }

    if (patientEditor.selectedPatientForEdit === question.patientId) {
      patientEditor.setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(question.patientId));
    }

    console.log('Saved new patient-specific question:', question);
  };

  /**
   * Handle toggle question inclusion in rubric (called only on confirm)
   */
  const handleToggleQuestionInclusion = async (questionId: string, bankQuestion: any, isChecked: boolean) => {
    const newSet = new Set(includedQuestionIds);

    try {
      if (isChecked) {
        newSet.add(questionId);

        if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
          await instructorService.assignQuestionToGroup(groupId || '1', questionId);

          const existingQuestion = globalRubricQuestions.find(q => q.id === questionId);
          if (!existingQuestion) {
            const newGlobalRubricQuestion: GlobalRubricQuestion = {
              id: questionId,
              title: bankQuestion.title,
              keyQuestion: bankQuestion.questionText,
              clinicalIntent: bankQuestion.clinicalIntent,
              evaluationCriteria: bankQuestion.evaluationCriteria,
              required: bankQuestion.isMandatory,
            };

            instructorService.addGlobalRubricQuestion(groupId || '1', newGlobalRubricQuestion);
            setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
          }
        }
      } else {
        newSet.delete(questionId);

        if (questionBankTab === 'global' || questionId.startsWith('bank-global-')) {
          await instructorService.unassignQuestion(questionId);

          instructorService.deleteGlobalRubricQuestion(groupId || '1', questionId);
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }
      }

      setIncludedQuestionIds(newSet);
    } catch (err) {
      setQuestionBankError(err instanceof Error ? err.message : 'Failed to update question assignment');
    }
  };

  /**
   * Handle toggling a pending checkbox
   */
  /**
   * Confirm pending selection changes and apply to rubric
   */
  const handleConfirmSelections = async () => {
    const allBankQuestions = questionBankTab === 'global' ? globalBankQuestions : patientSpecificBankQuestions;

    try {
      if (questionBankTab === 'global') {
        const idsToAdd = Array.from(pendingQuestionIds).filter(id => !includedQuestionIds.has(id));
        const idsToRemove = Array.from(includedQuestionIds).filter(id => !pendingQuestionIds.has(id));

        if (idsToAdd.length > 0) {
          await instructorService.assignQuestionToGroup(groupId || '1', idsToAdd);
          for (const id of idsToAdd) {
            const bankQ = allBankQuestions.find(q => q.id === id);
            if (bankQ) {
              const existingQuestion = globalRubricQuestions.find(q => q.id === id);
              if (!existingQuestion) {
                const newGlobalRubricQuestion: GlobalRubricQuestion = {
                  id: bankQ.id,
                  title: bankQ.title,
                  keyQuestion: bankQ.questionText,
                  clinicalIntent: bankQ.clinicalIntent,
                  evaluationCriteria: bankQ.evaluationCriteria,
                  required: bankQ.isMandatory,
                };
                instructorService.addGlobalRubricQuestion(groupId || '1', newGlobalRubricQuestion);
              }
            }
          }
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }

        for (const id of idsToRemove) {
          const bankQ = allBankQuestions.find(q => q.id === id);
          if (bankQ) await handleToggleQuestionInclusion(id, bankQ, false);
        }
      } else if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank) {
        pendingQuestionIds.forEach(id => {
          if (!includedQuestionIds.has(id)) {
            const bankQ = allBankQuestions.find(q => q.id === id);
            if (bankQ) {
              const newCaseQuestion: GlobalRubricQuestion = {
                id: bankQ.id,
                title: bankQ.title,
                keyQuestion: bankQ.questionText,
                clinicalIntent: bankQ.clinicalIntent,
                evaluationCriteria: bankQ.evaluationCriteria,
                required: bankQ.isMandatory,
              };
              instructorService.addCaseSpecificQuestion(selectedPatientForQuestionBank, newCaseQuestion);
              if (patientEditor.selectedPatientForEdit === selectedPatientForQuestionBank) {
                patientEditor.setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(selectedPatientForQuestionBank));
              }
            }
          }
        });
        includedQuestionIds.forEach(id => {
          if (!pendingQuestionIds.has(id)) {
            instructorService.deleteCaseSpecificQuestion(selectedPatientForQuestionBank, id);
            if (patientEditor.selectedPatientForEdit === selectedPatientForQuestionBank) {
              patientEditor.setCaseSpecificQuestions(instructorService.getCaseSpecificQuestions(selectedPatientForQuestionBank));
            }
          }
        });
      }

      setIncludedQuestionIds(new Set(pendingQuestionIds));
    } catch (err) {
      setQuestionBankError(err instanceof Error ? err.message : 'Failed to confirm selections');
    }
  };

  // Paginated question lists (derived from hook's filtered lists)
  const paginatedGlobalQuestions = getPaginatedQuestions(
    filteredGlobalQuestions,
    globalPagination.currentPage,
    globalPagination.itemsPerPage
  );

  const paginatedPatientQuestions = getPaginatedQuestions(
    filteredPatientQuestions,
    patientPagination.currentPage,
    patientPagination.itemsPerPage
  );

  const globalTotalPages = getTotalPages(filteredGlobalQuestions.length, globalPagination.itemsPerPage);
  const patientTotalPages = getTotalPages(filteredPatientQuestions.length, patientPagination.itemsPerPage);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <p style={{ color: UI_COLORS.text.muted }}>Loading...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <header className="flex-shrink-0 flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
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
          {adminReturnUrl && (
            <Button
              variant="default"
              onClick={() => navigate(adminReturnUrl)}
              className="px-6 transition-colors"
              style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
            >
              Back to Admin View
            </Button>
          )}
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

          {hasAdminRole && (
            <Button
              variant="default"
              onClick={handleAdminView}
              className="px-6 transition-colors"
              style={{
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
            >
              Admin View
            </Button>
          )}

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

      <div className="flex flex-1 overflow-hidden">
        <SimulationGroupSidebar
          activeSection={activeSection}
          onSectionChange={(section) => setActiveSection(section as typeof activeSection)}
          sections={[
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
            { id: 'patients', label: `Manage ${aiPersonaLabelPlural}`, icon: <Users className="w-5 h-5" /> },
            { id: 'students', label: `Manage ${userRoleLabel}s`, icon: <UserCog className="w-5 h-5" /> },
            { id: 'rubric', label: 'Global Key Questions', icon: <FileText className="w-5 h-5" /> },
            {
              id: 'questionBank',
              label: 'Question Bank',
              icon: <HelpCircle className="w-5 h-5" />,
              onClick: () => {
                setActiveSection('questionBank');
                if (questionBankTab === 'global') {
                  const globalRubric = instructorService.getGlobalRubricQuestions(groupId || '1');
                  const questionIds = new Set(globalRubric.map(q => q.id));
                  setIncludedQuestionIds(questionIds);
                  setPendingQuestionIds(new Set(questionIds));
                } else if (selectedPatientForQuestionBank) {
                  const questionIds = instructorService.getPatientCaseSpecificQuestionIds(selectedPatientForQuestionBank);
                  setIncludedQuestionIds(questionIds);
                  setPendingQuestionIds(new Set(questionIds));
                } else {
                  setIncludedQuestionIds(new Set());
                  setPendingQuestionIds(new Set());
                }
              },
            },
            { id: 'prompt', label: 'View Debrief Prompt', icon: <Eye className="w-5 h-5" /> },
          ]}
          accessCode={accessCode}
          onCopyAccessCode={handleCopyAccessCode}
          onGenerateAccessCode={() => setIsAccessCodeDialogOpen(true)}
          isVisible={isMainSidebarVisible}
          onToggleVisibility={() => setIsMainSidebarVisible(!isMainSidebarVisible)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ padding: activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'editPatient' || activeSection === 'viewStudent' ? '0' : '2rem' }}>
          {activeSection === 'analytics' && (
            <AnalyticsSection
              patientAnalytics={patientAnalytics}
              analyticsDateRange={analyticsDateRange}
              onDateRangeChange={setAnalyticsDateRange}
              keyQuestionCoverage={keyQuestionCoverage}
              keyQuestionAnalytics={keyQuestionAnalytics}
              studentProgress={studentProgress}
              selectedPatientId={selectedPatientId}
              onPatientSelect={setSelectedPatientId}
              labels={labels}
              simulationGroup={simulationGroup}
              onNavigateToSection={(section) => setActiveSection(section as typeof activeSection)}
            />
          )}

          {activeSection === 'patients' && (
            <PatientsSection
              patients={manageablePatients}
              profilePictures={profilePictures}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onEditPatient={handleEditPatient}
              onDeletePatient={handleDeletePatient}
              onCreatePatient={handleCreateNewPatient}
              labels={labels}
              enableVoiceForAll={enableVoiceForAll}
              onToggleVoice={setEnableVoiceForAll}
            />
          )}

          {activeSection === 'students' && (
            <StudentsSection
              students={students}
              searchQuery={studentSearchQuery}
              onSearchChange={setStudentSearchQuery}
              onViewStudent={handleViewStudent}
              labels={labels}
            />
          )}

          {activeSection === 'rubric' && (
            <RubricSection
              questions={globalRubricQuestions}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={setSelectedQuestionId}
              searchQuery={rubricSearchQuery}
              onSearchChange={setRubricSearchQuery}
              onSaveQuestion={handleSaveQuestion}
              onUpdateField={handleUpdateQuestionField}
            />
          )}

          {activeSection === 'questionBank' && (
            <div className="h-full flex flex-col">
              <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                  Question Bank
                </h2>

                {/* Tab Switcher */}
                <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                  <button
                    onClick={() => {
                      setQuestionBankTab('global');
                      const globalRubric = instructorService.getGlobalRubricQuestions(groupId || '1');
                      const questionIds = new Set(globalRubric.map(q => q.id));
                      setIncludedQuestionIds(questionIds);
                      setPendingQuestionIds(new Set(questionIds));
                    }}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{
                      color: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                      borderColor: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                      backgroundColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    Global Questions
                  </button>
                  <button
                    onClick={() => {
                      setQuestionBankTab('patientSpecific');
                      if (selectedPatientForQuestionBank) {
                        const questionIds = instructorService.getPatientCaseSpecificQuestionIds(selectedPatientForQuestionBank);
                        setIncludedQuestionIds(questionIds);
                        setPendingQuestionIds(new Set(questionIds));
                      } else {
                        setIncludedQuestionIds(new Set());
                        setPendingQuestionIds(new Set());
                      }
                    }}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{
                      color: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body,
                      borderColor: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent',
                      backgroundColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    Patient-Specific Questions
                  </button>
                </div>
              </div>

              {/* Question List */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-3">
                  {questionBankTab === 'global' && (
                    <>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                        Select which global questions should be included in this simulation group&apos;s rubric. These are questions
                        that are saved in the question bank and are visible to be included for all patients in this simulation group.
                      </p>

                      {/* Search Bar */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                        <Input
                          type="text"
                          placeholder="Search global questions..."
                          value={globalQuestionSearchQuery}
                          onChange={(e) => setGlobalQuestionSearchQuery(e.target.value)}
                          className="pl-10"
                          style={{
                            borderColor: UI_COLORS.border.default,
                          }}
                        />
                      </div>

                      {/* Pagination Info */}
                      {filteredGlobalQuestions.length > 0 && (
                        <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                          <span>
                            Showing {((globalPagination.currentPage - 1) * globalPagination.itemsPerPage) + 1}&ndash;
                            {Math.min(globalPagination.currentPage * globalPagination.itemsPerPage, filteredGlobalQuestions.length)} of {filteredGlobalQuestions.length} questions
                          </span>
                        </div>
                      )}

                      {/* Global questions from question bank */}
                      <Accordion type="single" collapsible className="space-y-2">
                        {paginatedGlobalQuestions.map((question) => (
                          <AccordionItem
                            key={question.id}
                            value={question.id}
                            style={{
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: UI_COLORS.border.default,
                              borderRadius: '0.5rem',
                              overflow: 'hidden'
                            }}
                          >
                            <AccordionTrigger
                              className="px-4 hover:no-underline"
                              style={{
                                backgroundColor: UI_COLORS.background.white,
                                color: UI_COLORS.text.heading
                              }}
                            >
                              <div className="flex items-center justify-between w-full pr-4">
                                <span className="font-medium text-sm">
                                  {question.title}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                    {question.isMandatory ? 'Required' : 'Optional'}
                                  </span>
                                  <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={pendingQuestionIds.has(question.id)}
                                      onChange={() => handleTogglePendingQuestion(question.id)}
                                      className="w-5 h-5 rounded cursor-pointer"
                                      style={{
                                        accentColor: SIMULATION_GROUP_COLOR_PALETTE[2],
                                      }}
                                    />
                                    <span className="text-sm" style={{ color: UI_COLORS.text.body }}>
                                      Include
                                    </span>
                                  </label>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent
                              className="px-4 pb-4"
                              style={{ backgroundColor: UI_COLORS.background.white }}
                            >
                              <div className="space-y-3 pt-3">
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Title</label>
                                  <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{question.title || '\u2014'}</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Key Question</label>
                                  <p className="text-sm" style={{ color: question.questionText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.questionText || '\u2014'}</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                                  <p className="text-sm" style={{ color: question.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.clinicalIntent || '\u2014'}</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                                  <p className="text-sm whitespace-pre-line" style={{ color: question.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.evaluationCriteria || '\u2014'}</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Requirement</label>
                                  <span
                                    className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: question.isMandatory ? '#dcfce7' : '#f3f4f6',
                                      color: question.isMandatory ? '#166534' : '#6b7280'
                                    }}
                                  >
                                    {question.isMandatory ? 'Required' : 'Optional'}
                                  </span>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>

                      {/* Confirm / Reset Buttons */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={handleConfirmSelections}
                            disabled={!hasPendingChanges}
                            className="px-6 py-2 font-medium transition-colors"
                            style={{
                              backgroundColor: hasPendingChanges ? UI_COLORS.button.primary : UI_COLORS.background.tableHeader,
                              color: hasPendingChanges ? UI_COLORS.button.text : UI_COLORS.text.muted,
                              cursor: hasPendingChanges ? 'pointer' : 'not-allowed',
                            }}
                            onMouseEnter={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
                            onMouseLeave={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
                          >
                            Confirm Selections
                          </Button>
                          {hasPendingChanges && (
                            <button
                              onClick={handleResetSelections}
                              className="text-sm font-medium transition-colors bg-transparent border-0 cursor-pointer p-0"
                              style={{ color: UI_COLORS.text.muted }}
                              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        {hasPendingChanges && (
                          <span className="text-xs" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}>
                            {pendingAddCount > 0 && `+${pendingAddCount} to add`}
                            {pendingAddCount > 0 && pendingRemoveCount > 0 && ', '}
                            {pendingRemoveCount > 0 && `${pendingRemoveCount} to remove`}
                          </span>
                        )}
                      </div>

                      {/* Pagination Controls */}
                      {globalTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Items per page:</span>
                            <select
                              value={globalPagination.itemsPerPage}
                              onChange={(e) => handleGlobalItemsPerPageChange(Number(e.target.value))}
                              className="px-3 py-1 rounded border text-sm"
                              style={{
                                borderColor: UI_COLORS.border.default,
                                backgroundColor: UI_COLORS.background.white,
                                color: UI_COLORS.text.heading,
                              }}
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleGlobalPageChange(globalPagination.currentPage - 1)}
                              disabled={globalPagination.currentPage === 1}
                              variant="outline"
                              className="px-3 py-1 text-sm"
                              style={{
                                opacity: globalPagination.currentPage === 1 ? 0.5 : 1,
                                cursor: globalPagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Previous
                            </Button>

                            <span className="text-sm px-3" style={{ color: UI_COLORS.text.body }}>
                              Page {globalPagination.currentPage} of {globalTotalPages}
                            </span>

                            <Button
                              onClick={() => handleGlobalPageChange(globalPagination.currentPage + 1)}
                              disabled={globalPagination.currentPage === globalTotalPages}
                              variant="outline"
                              className="px-3 py-1 text-sm"
                              style={{
                                opacity: globalPagination.currentPage === globalTotalPages ? 0.5 : 1,
                                cursor: globalPagination.currentPage === globalTotalPages ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {questionBankTab === 'patientSpecific' && (
                    <>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>
                        Select a patient to manage their patient-specific questions. A patient-specific question
                        is asked in the context of one particular patient and will depend on the patient&apos;s unique details.
                      </p>

                      {/* Patient Selector */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>
                          Select Patient
                        </label>
                        <select
                          value={selectedPatientForQuestionBank || ''}
                          onChange={(e) => {
                            const patientId = e.target.value || null;
                            setSelectedPatientForQuestionBank(patientId);
                            setPatientPagination({ currentPage: 1, itemsPerPage: patientPagination.itemsPerPage });
                            if (patientId) {
                              const questionIds = instructorService.getPatientCaseSpecificQuestionIds(patientId);
                              setIncludedQuestionIds(questionIds);
                              setPendingQuestionIds(new Set(questionIds));
                            } else {
                              setIncludedQuestionIds(new Set());
                              setPendingQuestionIds(new Set());
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg border"
                          style={{
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white,
                            color: UI_COLORS.text.heading,
                          }}
                        >
                          <option value="">-- Select a patient --</option>
                          {manageablePatients.map((patient) => (
                            <option key={patient.id} value={patient.id}>
                              {patient.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Search Bar */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                        <Input
                          type="text"
                          placeholder="Search patient-specific questions..."
                          value={patientQuestionSearchQuery}
                          onChange={(e) => setPatientQuestionSearchQuery(e.target.value)}
                          className="pl-10"
                          style={{
                            borderColor: UI_COLORS.border.default,
                          }}
                        />
                      </div>

                      {selectedPatientForQuestionBank ? (
                        <>
                          {/* Pagination Info */}
                          {filteredPatientQuestions.length > 0 && (
                            <div className="flex items-center justify-between mb-3 text-sm" style={{ color: UI_COLORS.text.muted }}>
                              <span>
                                Showing {((patientPagination.currentPage - 1) * patientPagination.itemsPerPage) + 1}&ndash;
                                {Math.min(patientPagination.currentPage * patientPagination.itemsPerPage, filteredPatientQuestions.length)} of {filteredPatientQuestions.length} questions
                              </span>
                            </div>
                          )}

                          {/* Patient-specific questions from question bank */}
                          <Accordion type="single" collapsible className="space-y-2">
                            {paginatedPatientQuestions.map((question) => (
                              <AccordionItem
                                key={question.id}
                                value={question.id}
                                style={{
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  borderColor: UI_COLORS.border.default,
                                  borderRadius: '0.5rem',
                                  overflow: 'hidden'
                                }}
                              >
                                <AccordionTrigger
                                  className="px-4 hover:no-underline"
                                  style={{
                                    backgroundColor: UI_COLORS.background.white,
                                    color: UI_COLORS.text.heading
                                  }}
                                >
                                  <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium text-sm">
                                      {question.title}
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                        {question.isMandatory ? 'Required' : 'Optional'}
                                      </span>
                                      <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={pendingQuestionIds.has(question.id)}
                                          onChange={() => handleTogglePendingQuestion(question.id)}
                                          className="w-5 h-5 rounded cursor-pointer"
                                          style={{
                                            accentColor: SIMULATION_GROUP_COLOR_PALETTE[2],
                                          }}
                                        />
                                        <span className="text-sm" style={{ color: UI_COLORS.text.body }}>
                                          Include
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent
                                  className="px-4 pb-4"
                                  style={{ backgroundColor: UI_COLORS.background.white }}
                                >
                                  <div className="space-y-3 pt-3">
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Title</label>
                                      <p className="text-sm" style={{ color: UI_COLORS.text.body }}>{question.title || '\u2014'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Key Question</label>
                                      <p className="text-sm" style={{ color: question.questionText ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.questionText || '\u2014'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Clinical Intent</label>
                                      <p className="text-sm" style={{ color: question.clinicalIntent ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.clinicalIntent || '\u2014'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Evaluation Criteria</label>
                                      <p className="text-sm whitespace-pre-line" style={{ color: question.evaluationCriteria ? UI_COLORS.text.body : UI_COLORS.text.muted }}>{question.evaluationCriteria || '\u2014'}</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold mb-1" style={{ color: UI_COLORS.text.muted }}>Requirement</label>
                                      <span
                                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                                        style={{
                                          backgroundColor: question.isMandatory ? '#dcfce7' : '#f3f4f6',
                                          color: question.isMandatory ? '#166534' : '#6b7280'
                                        }}
                                      >
                                        {question.isMandatory ? 'Required' : 'Optional'}
                                      </span>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>

                          {/* Confirm / Reset Buttons */}
                          <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                            <div className="flex items-center gap-3">
                              <Button
                                onClick={handleConfirmSelections}
                                disabled={!hasPendingChanges}
                                className="px-6 py-2 font-medium transition-colors"
                                style={{
                                  backgroundColor: hasPendingChanges ? UI_COLORS.button.primary : UI_COLORS.background.tableHeader,
                                  color: hasPendingChanges ? UI_COLORS.button.text : UI_COLORS.text.muted,
                                  cursor: hasPendingChanges ? 'pointer' : 'not-allowed',
                                }}
                                onMouseEnter={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover)}
                                onMouseLeave={(e) => hasPendingChanges && (e.currentTarget.style.backgroundColor = UI_COLORS.button.primary)}
                              >
                                Confirm Selections
                              </Button>
                              {hasPendingChanges && (
                                <button
                                  onClick={handleResetSelections}
                                  className="text-sm font-medium transition-colors bg-transparent border-0 cursor-pointer p-0"
                                  style={{ color: UI_COLORS.text.muted }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
                                  onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.muted}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            {hasPendingChanges && (
                              <span className="text-xs" style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}>
                                {pendingAddCount > 0 && `+${pendingAddCount} to add`}
                                {pendingAddCount > 0 && pendingRemoveCount > 0 && ', '}
                                {pendingRemoveCount > 0 && `${pendingRemoveCount} to remove`}
                              </span>
                            )}
                          </div>

                          {/* Pagination Controls */}
                          {patientTotalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: UI_COLORS.border.default }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Items per page:</span>
                                <select
                                  value={patientPagination.itemsPerPage}
                                  onChange={(e) => handlePatientItemsPerPageChange(Number(e.target.value))}
                                  className="px-3 py-1 rounded border text-sm"
                                  style={{
                                    borderColor: UI_COLORS.border.default,
                                    backgroundColor: UI_COLORS.background.white,
                                    color: UI_COLORS.text.heading,
                                  }}
                                >
                                  <option value={5}>5</option>
                                  <option value={10}>10</option>
                                  <option value={25}>25</option>
                                  <option value={50}>50</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => handlePatientPageChange(patientPagination.currentPage - 1)}
                                  disabled={patientPagination.currentPage === 1}
                                  variant="outline"
                                  className="px-3 py-1 text-sm"
                                  style={{
                                    opacity: patientPagination.currentPage === 1 ? 0.5 : 1,
                                    cursor: patientPagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Previous
                                </Button>

                                <span className="text-sm px-3" style={{ color: UI_COLORS.text.body }}>
                                  Page {patientPagination.currentPage} of {patientTotalPages}
                                </span>

                                <Button
                                  onClick={() => handlePatientPageChange(patientPagination.currentPage + 1)}
                                  disabled={patientPagination.currentPage === patientTotalPages}
                                  variant="outline"
                                  className="px-3 py-1 text-sm"
                                  style={{
                                    opacity: patientPagination.currentPage === patientTotalPages ? 0.5 : 1,
                                    cursor: patientPagination.currentPage === patientTotalPages ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                          Please select a patient to manage their questions.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'prompt' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                View Debrief Prompt
              </h2>

              <div>
                <textarea
                  readOnly
                  className="w-full px-4 py-3 rounded-lg resize-none text-sm font-mono cursor-default"
                  style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: UI_COLORS.border.default,
                    backgroundColor: UI_COLORS.background.tableHeader,
                    minHeight: '500px',
                  }}
                  defaultValue={debriefPromptText || 'Default built-in debrief prompt is in use.'}
                />
              </div>
            </div>
          )}

          {activeSection === 'editPatient' && (
            <EditPatientPanel
              patientEditor={patientEditor}
              profilePictures={profilePictures}
              onBack={handleBackFromEditPatient}
              labels={labels}
              groupId={groupId || ''}
              globalRubricQuestions={globalRubricQuestions}
              onSavePatient={handleSavePatientChanges}
              onSaveCaseQuestion={(patientId, question) => {
                instructorService.updateCaseSpecificQuestion(patientId, question);
              }}
              onDeleteCaseQuestion={(patientId, questionId) => {
                instructorService.deleteCaseSpecificQuestion(patientId, questionId);
              }}
            />
          )}

          {activeSection === 'viewStudent' && selectedStudentId && (
            <StudentDetailsPanel
              studentDetails={studentDetails}
              studentDetailsLoading={studentDetailsLoading}
              studentPatientData={studentPatientData}
              expandedAttemptId={expandedAttemptId}
              onExpandAttempt={setExpandedAttemptId}
              selectedPatientFilter={selectedPatientFilter}
              onPatientFilterChange={setSelectedPatientFilter}
              onViewDebrief={handleViewAIDebrief}
              isFetchingDebrief={isFetchingDebrief}
              onDownloadPdf={async (attemptId) => {
                const el = attemptPdfRefs.current[String(attemptId)];
                if (!el) return;
                await downloadPdf(attemptId, el);
              }}
              isGeneratingPdf={isGeneratingPdf}
              onBack={handleBackFromViewStudent}
              attemptPdfRefs={attemptPdfRefs}
              labels={labels}
            />
          )}
        </main>
      </div>

      {/* AI Debrief Dialog */}
      <AIDebriefDialog
        isOpen={isAIDebriefOpen}
        onClose={closeDebrief}
        data={selectedDebriefData}
        simulationGroupId={groupId}
      />

      {/* Add Question Dialog */}
      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType={questionBankTab === 'global' ? 'global' : 'patientSpecific'}
        existingTags={allExistingTags}
        onSave={handleSaveNewPatientQuestion}
      />

      {/* Add Patient-Specific Question Dialog */}
      <AddPatientSpecificQuestionDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        patients={manageablePatients.map(p => ({ id: p.id, name: p.name }))}
        onSave={handleSaveNewPatientQuestion}
      />

      {/* Confirm Generate New Access Code Dialog */}
      <Dialog open={isAccessCodeDialogOpen} onOpenChange={setIsAccessCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>Generate New Access Code</DialogTitle>
            <DialogDescription style={{ color: UI_COLORS.text.body }}>
              Are you sure? This will permanently replace the current access code. Any students using the old code will no longer be able to join.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAccessCodeDialogOpen(false)}
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsAccessCodeDialogOpen(false);
                await handleGenerateAccessCode();
              }}
              style={{ backgroundColor: UI_COLORS.status.error, color: UI_COLORS.button.text }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default InstructorSimulationGroupPage;

                        <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                              LLM Upload
                            </span>
                            {patientEditor.uploadStatus['llm'] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                            {patientEditor.uploadStatus['llm'] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                            {patientEditor.uploadStatus['llm'] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                          </div>
                          <label className={`cursor-pointer ${patientEditor.uploadStatus['llm'] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
                            <input
                              type="file"
                              onChange={(e) => patientEditor.handleFileUpload('llm', e)}
                              className="hidden"
                            />
                            <div
                              className="p-2 rounded-lg transition-colors flex items-center gap-2"
                              style={{
                                backgroundColor: UI_COLORS.background.tableHeader,
                                color: UI_COLORS.text.body
                              }}
                            >
                              <Upload className="w-5 h-5" />
                              Upload
                            </div>
                          </label>
                        </div>

                        {/* Patient Information */}
                        <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                              Patient Information
                            </span>
                            {patientEditor.uploadStatus['patientInfo'] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                            {patientEditor.uploadStatus['patientInfo'] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                            {patientEditor.uploadStatus['patientInfo'] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                          </div>
                          <label className={`cursor-pointer ${patientEditor.uploadStatus['patientInfo'] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
                            <input
                              type="file"
                              onChange={(e) => patientEditor.handleFileUpload('patientInfo', e)}
                              className="hidden"
                            />
                            <div
                              className="p-2 rounded-lg transition-colors flex items-center gap-2"
                              style={{
                                backgroundColor: UI_COLORS.background.tableHeader,
                                color: UI_COLORS.text.body
                              }}
                            >
                              <Upload className="w-5 h-5" />
                              Upload
                            </div>
                          </label>
                        </div>

                        {/* Answer Key */}
                        <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: UI_COLORS.border.default }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>
                              Answer Key
                            </span>
                            {patientEditor.uploadStatus['answerKey'] === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: UI_COLORS.text.muted }} />}
                            {patientEditor.uploadStatus['answerKey'] === 'success' && <span className="flex items-center gap-1 text-sm" style={{ color: '#16a34a' }}><CheckCircle className="w-4 h-4" /> Uploaded</span>}
                            {patientEditor.uploadStatus['answerKey'] === 'error' && <span className="flex items-center gap-1 text-sm" style={{ color: '#dc2626' }}><XCircle className="w-4 h-4" /> Failed</span>}
                          </div>
                          <label className={`cursor-pointer ${patientEditor.uploadStatus['answerKey'] === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
                            <input
                              type="file"
                              onChange={(e) => patientEditor.handleFileUpload('answerKey', e)}
                              className="hidden"
                            />
                            <div
                              className="p-2 rounded-lg transition-colors flex items-center gap-2"
                              style={{
                                backgroundColor: UI_COLORS.background.tableHeader,
                                color: UI_COLORS.text.body
                              }}
                            >
                              <Upload className="w-5 h-5" />
                              Upload
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="pt-4">
                        <Button
                          onClick={handleSavePatientChanges}
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
                      </div>
                    </div>
                  )}

                  {patientEditor.editPatientTab === 'questions' && (
                    <div className="max-w-5xl mx-auto p-8 space-y-6">
                      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                        Case-Specific Key Questions
                      </h2>

                      {/* Search */}
                      <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                        <Input
                          placeholder="Search Key Questions"
                          value={caseQuestionSearchQuery}
                          onChange={(e) => setCaseQuestionSearchQuery(e.target.value)}
                          className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        />
                      </div>

                      {/* Local Patient Specific Questions Section */}
                      <div className="space-y-4">
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
                          Click on a Key Question entry to expand and edit it.
                        </p>

                        <Accordion type="single" collapsible className="space-y-2">
                          {filteredCaseQuestions.map((question, index) => (
                            <AccordionItem
                              key={question.id}
                              value={question.id}
                              style={{
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: UI_COLORS.border.default,
                                borderRadius: '0.5rem',
                                overflow: 'hidden'
                              }}
                            >
                              <AccordionTrigger
                                className="px-4 hover:no-underline"
                                style={{
                                  backgroundColor: UI_COLORS.background.white,
                                  color: UI_COLORS.text.heading
                                }}
                              >
                                <div className="flex items-center justify-between w-full pr-4">
                                  <span className="font-medium">
                                    Q{index + 1} - {question.title}
                                  </span>
                                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                    {question.required ? 'Required' : 'Optional'}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent
                                className="px-4 pb-4"
                                style={{ backgroundColor: UI_COLORS.background.white }}
                              >
                                <div className="space-y-4 pt-4">
                                  {/* Title */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                      Title
                                    </label>
                                    <Input
                                      value={question.title}
                                      onChange={(e) => {
                                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, title: e.target.value } : q
                                        );
                                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      placeholder="Chest Pain Characterization"
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
                                      value={question.keyQuestion}
                                      onChange={(e) => {
                                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, keyQuestion: e.target.value } : q
                                        );
                                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      placeholder="Assess the characteristics of the patient's chest pain..."
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
                                      value={question.clinicalIntent}
                                      onChange={(e) => {
                                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, clinicalIntent: e.target.value } : q
                                        );
                                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      placeholder="This question evaluates the student's ability..."
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
                                      value={question.evaluationCriteria}
                                      onChange={(e) => {
                                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, evaluationCriteria: e.target.value } : q
                                        );
                                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      placeholder="The student attempts to identify at least 3-4 of the following..."
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
                                      aria-checked={question.required}
                                      onClick={() => {
                                        const updatedQuestions = patientEditor.caseSpecificQuestions.map(q =>
                                          q.id === question.id ? { ...q, required: !q.required } : q
                                        );
                                        patientEditor.setCaseSpecificQuestions(updatedQuestions);
                                      }}
                                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                      style={{
                                        backgroundColor: question.required ? UI_COLORS.toggle.active : UI_COLORS.toggle.inactive
                                      }}
                                    >
                                      <span
                                        className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                                        style={{
                                          transform: question.required ? 'translateX(22px)' : 'translateX(2px)'
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
                                      onClick={() => {
                                        if (patientEditor.selectedPatientForEdit) {
                                          instructorService.updateCaseSpecificQuestion(patientEditor.selectedPatientForEdit, question);
                                        }
                                      }}
                                      className="px-8 py-3 text-base font-medium transition-colors"
                                      style={{
                                        backgroundColor: UI_COLORS.button.primary,
                                        color: UI_COLORS.button.text
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        if (patientEditor.selectedPatientForEdit) {
                                          instructorService.deleteCaseSpecificQuestion(patientEditor.selectedPatientForEdit, question.id);
                                          patientEditor.setCaseSpecificQuestions(patientEditor.caseSpecificQuestions.filter(q => q.id !== question.id));
                                        }
                                      }}
                                      variant="outline"
                                      className="px-8 py-3 text-base font-medium transition-colors text-white"
                                      style={{
                                        backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                        borderColor: SIMULATION_GROUP_COLOR_PALETTE[0],
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>

                      {/* Divider */}
                      <div className="my-8" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: UI_COLORS.border.default }} />

                      {/* Global Key Questions Section */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg" style={{ color: UI_COLORS.text.heading }}>
                          GLOBAL KEY QUESTIONS
                        </h3>
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
                          The following global questions are shown for reference to prevent redundancy. Edit global questions from the Global Rubric tab.
                        </p>

                        {/* Search Bar for Global Questions */}
                        <div className="relative mb-6">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                          <Input
                            placeholder="Search Global Questions"
                            value={globalRubricSearchQuery}
                            onChange={(e) => setGlobalRubricSearchQuery(e.target.value)}
                            className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            style={{
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: UI_COLORS.border.default,
                              backgroundColor: UI_COLORS.background.white
                            }}
                          />
                        </div>

                        <Accordion type="single" collapsible className="space-y-2">
                          {(() => {
                            const filteredGlobalRubric = globalRubricQuestions.filter(q =>
                              q.title.toLowerCase().includes(globalRubricSearchQuery.toLowerCase())
                            );
                            return filteredGlobalRubric.map((question, index) => (
                              <AccordionItem
                                key={question.id}
                                value={question.id}
                                style={{
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  borderColor: UI_COLORS.border.default,
                                  borderRadius: '0.5rem',
                                  overflow: 'hidden',
                                  opacity: 0.7,
                                }}
                              >
                                <AccordionTrigger
                                  className="px-4 hover:no-underline"
                                  style={{
                                    backgroundColor: UI_COLORS.background.tableHeader,
                                    color: UI_COLORS.text.heading
                                  }}
                                >
                                  <div className="flex items-center justify-between w-full pr-4">
                                    <span className="font-medium text-sm">
                                      Q{index + 1} - {question.title}
                                    </span>
                                    <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                      {question.required ? 'Required' : 'Optional'}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent
                                  className="px-4 pb-4"
                                  style={{ backgroundColor: UI_COLORS.background.white }}
                                >
                                  <div className="space-y-4 pt-4">
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Title</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body
                                      }}>
                                        {question.title}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Key Question</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base whitespace-pre-wrap" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body,
                                        minHeight: '150px',
                                      }}>
                                        {question.keyQuestion}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Clinical Intent</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base whitespace-pre-wrap" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body,
                                        minHeight: '100px',
                                      }}>
                                        {question.clinicalIntent}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>Evaluation Criteria</label>
                                      <div className="w-full px-3 py-3 rounded-lg text-base whitespace-pre-wrap" style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.hoverLight,
                                        color: UI_COLORS.text.body,
                                        minHeight: '100px',
                                      }}>
                                        {question.evaluationCriteria}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                                        {question.required ? 'Required for Case Completion' : 'Optional'}
                                      </span>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ));
                          })()}
                        </Accordion>
                      </div>
                    </div>
                  )}

                  {patientEditor.editPatientTab === 'materials' && (
                    <div className="max-w-5xl mx-auto p-8 space-y-6">
                      <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                        Physical Assessment Materials
                      </h2>

                      {/* Add New Material Button */}
                      <div className="mb-6">
                        <Button
                          onClick={patientEditor.handleAddNewCaseMaterial}
                          className="justify-start gap-2 py-2.5 h-auto font-medium transition-colors"
                          style={{
                            backgroundColor: UI_COLORS.button.primary,
                            color: UI_COLORS.button.text
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          <Plus className="w-5 h-5" />
                          Add new Material
                        </Button>
                      </div>

                      {/* Search */}
                      <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                        <Input
                          placeholder="Search Materials"
                          value={materialSearchQuery}
                          onChange={(e) => setMaterialSearchQuery(e.target.value)}
                          className="pl-9 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          style={{
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: UI_COLORS.border.default,
                            backgroundColor: UI_COLORS.background.white
                          }}
                        />
                      </div>

                      {/* Materials Accordion */}
                      <div className="space-y-4">
                        <p className="text-xs italic mb-4" style={{ color: UI_COLORS.text.muted }}>
                          Click on a Material entry to expand and edit it.
                        </p>

                        <Accordion type="single" collapsible className="space-y-2">
                          {filteredMaterials.map((material) => (
                            <AccordionItem
                              key={material.id}
                              value={material.id}
                              style={{
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: UI_COLORS.border.default,
                                borderRadius: '0.5rem',
                                overflow: 'hidden'
                              }}
                            >
                              <AccordionTrigger
                                className="px-4 hover:no-underline"
                                style={{
                                  backgroundColor: UI_COLORS.background.white,
                                  color: UI_COLORS.text.heading
                                }}
                              >
                                <div className="flex items-center justify-between w-full pr-4">
                                  <span className="font-medium">
                                    {material.title}
                                  </span>
                                  <span className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                                    {material.materialType}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent
                                className="px-4 pb-4"
                                style={{ backgroundColor: UI_COLORS.background.white }}
                              >
                                <div className="space-y-4 pt-4">
                                  {/* Title */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                      Title
                                    </label>
                                    <Input
                                      value={material.title}
                                      onChange={(e) => {
                                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, title: e.target.value } : m
                                        );
                                        patientEditor.setCaseMaterials(updatedMaterials);
                                      }}
                                      placeholder="Chest X-Ray"
                                      className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                      style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.white
                                      }}
                                    />
                                  </div>

                                  {/* Description */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                      Description
                                    </label>
                                    <textarea
                                      value={material.description}
                                      onChange={(e) => {
                                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, description: e.target.value } : m
                                        );
                                        patientEditor.setCaseMaterials(updatedMaterials);
                                      }}
                                      placeholder="Frontal chest radiograph obtained as part of the patient's clinical evaluation."
                                      className="w-full px-3 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 text-base"
                                      style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        outlineColor: UI_COLORS.border.medium,
                                        minHeight: '80px',
                                      }}
                                    />
                                  </div>

                                  {/* Material Type */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                      Material Type
                                    </label>
                                    <select
                                      value={material.materialType}
                                      onChange={(e) => {
                                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, materialType: e.target.value as CaseMaterial['materialType'] } : m
                                        );
                                        patientEditor.setCaseMaterials(updatedMaterials);
                                      }}
                                      className="w-full px-3 py-3 rounded-lg text-base focus:outline-none focus:ring-2"
                                      style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.white,
                                        outlineColor: UI_COLORS.border.medium,
                                      }}
                                    >
                                      <option value="kaltura">Kaltura</option>
                                      <option value="panopto">Panopto</option>
                                      <option value="h5p">H5P</option>
                                    </select>
                                  </div>

                                  {/* Content Upload/Embed */}
                                  <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
                                      Embed Link
                                    </label>
                                    <Input
                                      value={material.embedLink || ''}
                                      onChange={(e) => {
                                        const updatedMaterials = patientEditor.caseMaterials.map(m =>
                                          m.id === material.id ? { ...m, embedLink: e.target.value } : m
                                        );
                                        patientEditor.setCaseMaterials(updatedMaterials);
                                      }}
                                      placeholder="https://..."
                                      className="w-full py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                                      style={{
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        borderColor: UI_COLORS.border.default,
                                        backgroundColor: UI_COLORS.background.white
                                      }}
                                    />
                                  </div>

                                  {/* Preview */}
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Eye className="w-5 h-5" style={{ color: UI_COLORS.text.body }} />
                                      <span className="font-medium" style={{ color: UI_COLORS.text.heading }}>Preview</span>
                                    </div>
                                    {material.embedLink ? (
                                      <div
                                        className="rounded-lg overflow-hidden"
                                        style={{
                                          position: 'relative',
                                          width: '100%',
                                          paddingBottom: '56.25%',
                                          height: 0,
                                          borderWidth: '1px',
                                          borderStyle: 'solid',
                                          borderColor: UI_COLORS.border.default,
                                        }}
                                      >
                                        <iframe
                                          src={material.embedLink}
                                          title={material.title || 'Preview'}
                                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                          allowFullScreen
                                          allow="autoplay *; fullscreen *; encrypted-media *"
                                          sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
                                        />
                                      </div>
                                    ) : (
                                      <div
                                        className="border rounded-lg p-8 flex items-center justify-center"
                                        style={{ borderColor: UI_COLORS.border.default, minHeight: '120px' }}
                                      >
                                        <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>Enter an embed link above to see a preview</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-4 pt-4">
                                    <Button
                                      onClick={() => {
                                        if (patientEditor.selectedPatientForEdit) {
                                          patientEditor.setSelectedMaterialId(material.id);
                                          patientEditor.handleSaveCaseMaterial();
                                        }
                                      }}
                                      className="px-8 py-3 text-base font-medium transition-colors"
                                      style={{
                                        backgroundColor: UI_COLORS.button.primary,
                                        color: UI_COLORS.button.text
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={async () => {
                                        if (patientEditor.selectedPatientForEdit) {
                                          try {
                                            await instructorService.deleteCaseMaterial(patientEditor.selectedPatientForEdit, material.id);
                                            patientEditor.setCaseMaterials(patientEditor.caseMaterials.filter(m => m.id !== material.id));
                                          } catch (error) {
                                            console.error('Failed to delete material:', error);
                                          }
                                        }
                                      }}
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
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'viewStudent' && selectedStudentId && (
            <StudentDetailsPanel
              studentDetails={studentDetails}
              studentDetailsLoading={studentDetailsLoading}
              studentPatientData={studentPatientData}
              expandedAttemptId={expandedAttemptId}
              onExpandAttempt={setExpandedAttemptId}
              selectedPatientFilter={selectedPatientFilter}
              onPatientFilterChange={setSelectedPatientFilter}
              onViewDebrief={handleViewAIDebrief}
              isFetchingDebrief={isFetchingDebrief}
              onDownloadPdf={async (attemptId) => {
                const el = attemptPdfRefs.current[String(attemptId)];
                if (!el) return;
                await downloadPdf(attemptId, el);
              }}
              isGeneratingPdf={isGeneratingPdf}
              onBack={handleBackFromViewStudent}
              attemptPdfRefs={attemptPdfRefs}
              labels={labels}
            />
          )}
        </main>
      </div>

      {/* AI Debrief Dialog */}
      <AIDebriefDialog
        isOpen={isAIDebriefOpen}
        onClose={closeDebrief}
        data={selectedDebriefData}
        simulationGroupId={groupId}
      />

      {/* Add Question Dialog */}
      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType={addQuestionType}
        existingTags={allExistingTags}
        onSave={handleSaveQuestion}
      />

      {/* Add Patient-Specific Question Dialog */}
      <AddPatientSpecificQuestionDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        patients={manageablePatients.map(p => ({ id: p.id, name: p.name }))}
        onSave={handleSaveNewPatientQuestion}
      />

      {/* Confirm Generate New Access Code Dialog */}
      <Dialog open={isAccessCodeDialogOpen} onOpenChange={setIsAccessCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: UI_COLORS.text.heading }}>Generate New Access Code</DialogTitle>
            <DialogDescription style={{ color: UI_COLORS.text.body }}>
              Are you sure? This will permanently replace the current access code. Any students using the old code will no longer be able to join.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAccessCodeDialogOpen(false)}
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsAccessCodeDialogOpen(false);
                await handleGenerateAccessCode();
              }}
              style={{ backgroundColor: UI_COLORS.status.error, color: UI_COLORS.button.text }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default InstructorSimulationGroupPage;
