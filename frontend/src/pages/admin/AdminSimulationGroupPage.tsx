import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { mockInstructorDataService, type GlobalRubricQuestion, type QuestionBankItem, instructorService } from '@/services/instructorService';
import { mockGroupInstructors, mockOrganizations } from '@/services/adminService';
import { useSimulationGroupData } from '@/hooks/useSimulationGroupData';
import { usePatientEditor } from '@/hooks/usePatientEditor';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useStudentViewer } from '@/hooks/useStudentViewer';
import { useDebriefViewer } from '@/hooks/useDebriefViewer';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Search, Trash2, Plus, Menu, UserPlus, FileCode, HelpCircle } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { useEffect, useState } from 'react';
import { useAuth } from '@/App';
import { AddQuestionDialog } from '@/components/AddQuestionDialog';
import { AddPatientSpecificQuestionDialog } from '@/components/AddPatientSpecificQuestionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AddInstructorDialog } from '@/components/AddInstructorDialog';

import * as adminApi from '@/services/adminApiService';
import AIDebriefDialog from '@/components/AIDebriefDialog';
import { SimulationGroupSidebar } from '@/components/simulation-group/SimulationGroupSidebar';
import { AnalyticsSection } from '@/components/simulation-group/AnalyticsSection';
import { PatientsSection } from '@/components/simulation-group/PatientsSection';
import { StudentsSection } from '@/components/simulation-group/StudentsSection';
import { StudentDetailsPanel } from '@/components/simulation-group/StudentDetailsPanel';
import { EditPatientPanel } from '@/components/simulation-group/EditPatientPanel';
import { RubricSection } from '@/components/simulation-group/RubricSection';
import { studentService } from '@/services/studentService';

/**
 * AdminSimulationGroupPage Component
 * 
 * Displays the simulation group management view for admins.
 * Includes sidebar navigation and content area for analytics, patient management, etc.
 */
function AdminSimulationGroupPage() {
  const navigate = useNavigate();
  const { organizationId, groupId } = useParams();
  const { user: authUser } = useAuth();
  const [activeSection, setActiveSection] = useState<'analytics' | 'patients' | 'students' | 'instructors' | 'prompts' | 'rubric' | 'questionBank' | 'editPatient' | 'viewStudent'>('analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [instructorSearchQuery, setInstructorSearchQuery] = useState('');
  const [enableVoiceForAll, setEnableVoiceForAll] = useState(false);
  const [maxMessagesPerChat, setMaxMessagesPerChat] = useState<number | null>(null);
  const [maxMessagesInput, setMaxMessagesInput] = useState<string>('');
  const [selectedPromptType, setSelectedPromptType] = useState<'system' | 'evaluation'>('system');
  const [systemPromptText, setSystemPromptText] = useState('Pretend to be a patient with the context you are given. You are helping the pharmacist practice their skills interacting with a patient.');
  const [evaluationPromptText, setEvaluationPromptText] = useState('');
  const [, setIsPromptUnsaved] = useState(false);
  const [promptHistory, setPromptHistory] = useState<Array<{id: string; text: string; saved_at: string; modified_by_email: string | null; modified_by_first_name: string | null; modified_by_last_name: string | null}>>([]);
  // Student viewer state — extracted to useStudentViewer hook (initialized after simulationGroup is available)

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

  // Global Rubric state
  const [globalRubricQuestions, setGlobalRubricQuestions] = useState<GlobalRubricQuestion[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [rubricSearchQuery, setRubricSearchQuery] = useState('');
  const [isMainSidebarVisible, setIsMainSidebarVisible] = useState(true);

  // Question Bank state — extracted to useQuestionBank hook
  const questionBank = useQuestionBank({ role: 'admin' });
  const {
    questionBankTab, setQuestionBankTab,
    setGlobalBankQuestions,
    setPatientSpecificBankQuestions,
    filteredGlobalQuestions: filteredGlobalBankQuestions,
    filteredPatientQuestions: filteredPatientBankQuestions,
    includedQuestionIds, setIncludedQuestionIds,
    allExistingTags,
    questionBankSearchQuery, setQuestionBankSearchQuery,
    questionBankTagFilter, setQuestionBankTagFilter,
    isAddQuestionDialogOpen, setIsAddQuestionDialogOpen,
    isAddPatientQuestionDialogOpen, setIsAddPatientQuestionDialogOpen,
    addQuestionType, setAddQuestionType,
    selectedPatientForQuestionBank, setSelectedPatientForQuestionBank,
  } = questionBank;

  const [isAddInstructorDialogOpen, setIsAddInstructorDialogOpen] = useState(false);

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
  } = useSimulationGroupData({ groupId, organizationId, role: 'admin' });

  const patientEditor = usePatientEditor({
    groupId,
    role: 'admin',
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

  // Load instructors from API (real backend)
  const [instructors, setInstructors] = useState<adminApi.AdminInstructor[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);

  // Organization details (loaded from API with mock fallback)
  const [organization, setOrganization] = useState<adminApi.AdminOrganization | null>(null);

  const {
    aiPersonaPlural: aiPersonaLabelPlural,
    aiPersonaLower: aiPersonaLabelLower,
    userRole: userRoleLabel,
  } = labels;

  // Initial data loading is handled by useSimulationGroupData hook
  // Load admin-specific data (question bank, organization, message limit) separately
  useEffect(() => {
    const loadAdminData = async () => {
      if (!groupId) return;

      try {
        // Load question bank data
        const [bankGlobal, bankPatient] = await Promise.all([
          organizationId
            ? adminApi.getQuestionBankQuestions(organizationId).catch(err => { console.error('Failed to load global questions:', err); return [] as QuestionBankItem[]; })
            : instructorService.getGlobalQuestionBank().catch(err => { console.error('Failed to load global questions:', err); return [] as QuestionBankItem[]; }),
          Promise.resolve(instructorService.getPatientSpecificQuestionBank()),
        ]);

        // Split questions by tags: patient_specific vs global
        if (organizationId) {
          const global: QuestionBankItem[] = [];
          const patientSpecific: QuestionBankItem[] = [];
          for (const q of bankGlobal) {
            if (q.tags?.includes('patient_specific')) {
              patientSpecific.push(q);
            } else {
              global.push(q);
            }
          }
          setGlobalBankQuestions(global);
          setPatientSpecificBankQuestions(patientSpecific);
        } else {
          setGlobalBankQuestions(bankGlobal);
          setPatientSpecificBankQuestions(bankPatient);
        }

        // Load message limit from admin API
        const adminGroupData = await adminApi.getSimulationGroup(groupId).catch(() => undefined);
        if (adminGroupData?.max_messages_per_chat != null) {
          setMaxMessagesPerChat(adminGroupData.max_messages_per_chat);
          setMaxMessagesInput(String(adminGroupData.max_messages_per_chat));
        } else {
          setMaxMessagesPerChat(null);
          setMaxMessagesInput('');
        }
      } catch (error) {
        console.error('Error loading admin-specific data:', error);
      }

      // Load organization details from API, fall back to mock
      if (organizationId) {
        try {
          const orgData = await adminApi.getOrganization(organizationId);
          setOrganization(orgData);
        } catch (err) {
          console.error('Failed to load organization from API, using mock:', err);
          const mockOrg = mockOrganizations.find(o => o.organization_id === organizationId) || null;
          setOrganization(mockOrg);
        }
      }
    };

    loadAdminData();
  }, [groupId, organizationId]);

  // Load system prompt and debrief prompt in parallel on mount
  useEffect(() => {
    if (!groupId) return;
    const loadPrompts = async () => {
      try {
        const [systemPrompt, debriefPrompt] = await Promise.all([
          instructorService.getEvaluationPrompt(groupId).catch(err => { console.error('Failed to load system prompt:', err); return ''; }),
          instructorService.getDebriefPrompt(groupId).catch(err => { console.error('Failed to load debrief prompt:', err); return ''; }),
        ]);
        setSystemPromptText(systemPrompt);
        setEvaluationPromptText(debriefPrompt);
      } catch (error) {
        console.error('Error loading prompts:', error);
      }
    };
    loadPrompts();
  }, [groupId]);

  // Fetch prompt history when prompt type or groupId changes
  useEffect(() => {
    if (!groupId) return;
    const loadHistory = async () => {
      const type = selectedPromptType === 'system' ? 'system' : 'debrief';
      const history = await instructorService.getPromptHistory(groupId, type);
      setPromptHistory(history);
    };
    loadHistory();
  }, [groupId, selectedPromptType]);

  // Analytics date range filtering is handled by useSimulationGroupData hook

  // Load instructors from real API when section is active, fall back to mock
  useEffect(() => {
    if (activeSection === 'instructors' && groupId) {
      setInstructorsLoading(true);
      adminApi.getGroupInstructors(groupId)
        .then(setInstructors)
        .catch((err) => {
          console.error('Failed to load group instructors, using mock data:', err);
          setInstructors(mockGroupInstructors);
        })
        .finally(() => setInstructorsLoading(false));
    }
  }, [activeSection, groupId]);

  // Load assigned questions from API when rubric or questionBank section is activated
  useEffect(() => {
    if ((activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'editPatient') && groupId) {
      instructorService.getSimulationGroupQuestions(groupId)
        .then((assigned: any[]) => {
          // Filter to only global questions (no persona_id) for the global rubric view
          const globalAssigned = assigned.filter((q: any) => !q.persona_id);
          const rubricQuestions: GlobalRubricQuestion[] = globalAssigned.map((q: any) => ({
            id: q.question_id,
            title: q.title || '',
            keyQuestion: q.question_text || '',
            clinicalIntent: '',
            evaluationCriteria: q.evaluation_criteria || '',
            required: q.is_mandatory ?? false,
          }));
          setGlobalRubricQuestions(rubricQuestions);
          // Only update includedQuestionIds for rubric/questionBank (not editPatient, which handles its own)
          if (activeSection !== 'editPatient') {
            setIncludedQuestionIds(new Set(globalAssigned.map((q: any) => q.question_id)));
          }
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

  // Fallback values
  const accessCode = simulationGroup?.group_access_code || 'XXXX-XXXX-XXXX-XXXX';

  // Filter patients based on search query
  const filteredPatients = manageablePatients.filter(patient =>
    patient.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Student filtering is now handled by StudentsSection component

  // Filter instructors based on search query
  const filteredInstructors = instructors.filter(instructor => {
    const fullName = `${instructor.first_name} ${instructor.last_name}`.toLowerCase();
    return fullName.includes(instructorSearchQuery.toLowerCase()) ||
      instructor.user_email.toLowerCase().includes(instructorSearchQuery.toLowerCase());
  });

  const handleSignOut = () => {
    navigate('/login');
  };

  const handleBackToAllGroups = () => {
    navigate(`/admin/organization/${organizationId}`);
  };

  const handleStudentView = async () => {
    // If we're on a sim group page, auto-enroll as student and go directly to that group
    if (groupId && accessCode && accessCode !== 'XXXX-XXXX-XXXX-XXXX') {
      try {
        const result = await studentService.joinGroup(accessCode);
        if (result?.success) {
          navigate(`/patients/${groupId}`);
        } else {
          console.error('Failed to enroll as student in group:', { groupId, accessCode });
          window.alert('Unable to enroll in this simulation group. Taking you to the student dashboard instead.');
          navigate('/student');
        }
      } catch (error) {
        console.error('Unexpected error while enrolling as student:', error);
        window.alert('An unexpected error occurred while enrolling in this simulation group. Taking you to the student dashboard instead.');
        navigate('/student');
      }
    } else {
      navigate('/student');
    }
  };

  const handleInstructorView = async () => {
    if (groupId) {
      try {
        const user = await import('@/lib/auth').then(m => m.authService.getCurrentUser());
        if (user?.email) {
          await adminApi.enrollInstructorInGroup(groupId, user.email);
        }
      } catch (err) {
        console.error('Failed to enroll as instructor:', err);
      }
      navigate(`/instructor/group/${groupId}`);
    } else {
      navigate('/instructor');
    }
  };

  const handleGenerateAccessCode = async () => {
    if (!groupId) return;
    try {
      const result = await adminApi.regenerateAccessCode(groupId);
      // Update local state with the new access code
      setSimulationGroup((prev: any) => prev ? { ...prev, group_access_code: result.access_code } : prev);
    } catch (err) {
      console.error('Failed to regenerate access code via API, using mock:', err);
      const newCode = await mockInstructorDataService.generateAccessCode(groupId);
      setSimulationGroup((prev: any) => prev ? { ...prev, group_access_code: newCode } : prev);
    }
  };

  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };


  const handleDeletePatient = (patientId: string) => {
    if (confirm(`Are you sure you want to delete this ${aiPersonaLabelLower}?`)) {
      setManageablePatients(prevPatients =>
        prevPatients.filter(patient => patient.patient_id !== patientId)
      );
      mockInstructorDataService.deletePatient(patientId);
    }
  };

  const handleEditPatient = (patientId: string) => {
    patientEditor.startEditing(patientId);

    // Also update includedQuestionIds from the API for the question bank
    if (groupId) {
      instructorService.getSimulationGroupQuestions(groupId, patientId)
        .then((assigned: any[]) => {
          setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
        })
        .catch(() => {
          setIncludedQuestionIds(new Set());
        });
    }

    setActiveSection('editPatient');
  };

  const handleBackFromEditPatient = () => {
    patientEditor.stopEditing();
    setActiveSection('patients');
  };

  const handleViewStudent = async (studentId: string) => {
    await viewStudent(studentId);
    setActiveSection('viewStudent');
  };

  const handleBackFromViewStudent = () => {
    closeStudentView();
    setActiveSection('students');
  };

  const handleAddNewInstructor = () => {
    setIsAddInstructorDialogOpen(true);
  };

  const handleAddInstructorSubmit = async (email: string, name: string) => {
    if (!groupId) return;
    try {
      // Elevate to instructor role (if needed) + enroll in this group
      await adminApi.addInstructorToGroup(groupId, email);
      // Refresh the instructor list from the API
      const updated = await adminApi.getGroupInstructors(groupId);
      setInstructors(updated);
    } catch (err) {
      console.error('Failed to add instructor via API, adding locally:', err);
      // Fallback: add to local state so the UI still works
      const [first_name, ...rest] = name.split(' ');
      const last_name = rest.join(' ') || '';
      setInstructors(prev => [...prev, { user_email: email, first_name, last_name }]);
    }
  };

  const handleRemoveInstructor = async (instructorEmail: string) => {
    if (!groupId) return;
    const instructor = instructors.find(i => i.user_email === instructorEmail);
    const displayName = instructor ? `${instructor.first_name} ${instructor.last_name}` : instructorEmail;
    if (confirm(`Are you sure you want to remove ${displayName} from this group?`)) {
      try {
        await adminApi.removeInstructorFromGroup(groupId, instructorEmail);
        const updated = await adminApi.getGroupInstructors(groupId);
        setInstructors(updated);
      } catch (err) {
        console.error('Failed to remove instructor via API, removing locally:', err);
        // Fallback: remove from local state
        setInstructors(prev => prev.filter(i => i.user_email !== instructorEmail));
      }
    }
  };

  const handleLoadDefaultPrompt = async () => {
    if (selectedPromptType === 'system') {
      const prompt = await instructorService.getEvaluationPrompt(groupId || '1');
      setSystemPromptText(prompt);
    } else {
      const prompt = await instructorService.getDefaultDebriefPrompt();
      setEvaluationPromptText(prompt);
    }
    setIsPromptUnsaved(true);
  };

  const handleSavePrompt = async () => {
    if (!groupId) return;
    try {
      const email = authUser?.email || '';
      if (selectedPromptType === 'evaluation') {
        await instructorService.updateDebriefPrompt(groupId, email, evaluationPromptText);
      } else {
        await instructorService.updateSystemPrompt(groupId, email, systemPromptText);
      }
      setIsPromptUnsaved(false);
      // Refresh prompt history after save
      const type = selectedPromptType === 'system' ? 'system' : 'debrief';
      const history = await instructorService.getPromptHistory(groupId, type);
      setPromptHistory(history);
      alert('Prompt saved successfully!');
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('Failed to save prompt. Please try again.');
    }
  };

  const handleRestorePromptVersion = (versionText: string) => {
    if (confirm('Are you sure you want to restore this version?')) {
      if (selectedPromptType === 'system') {
        setSystemPromptText(versionText);
      } else {
        setEvaluationPromptText(versionText);
      }
      console.log('Restored prompt version');
    }
  };

  const handleSavePatientChanges = async () => {
    await patientEditor.savePatient();
  };

  const handleCreateNewPatient = () => {
    patientEditor.startCreating();
    setActiveSection('editPatient');
  };

  const handleDeleteQuestion = () => {
    if (!selectedQuestionId) return;
    if (confirm('Are you sure you want to remove this question from the global rubric? It will remain in the question bank.')) {
      instructorService.deleteGlobalRubricQuestion(groupId || '1', selectedQuestionId);
      const updatedQuestions = instructorService.getGlobalRubricQuestions(groupId || '1');
      setGlobalRubricQuestions(updatedQuestions);
      setSelectedQuestionId(updatedQuestions[0]?.id || null);

      setIncludedQuestionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedQuestionId);
        return newSet;
      });
    }
  };

  const handleSaveQuestion = () => {
    if (!selectedQuestion) return;
    instructorService.updateGlobalRubricQuestion(groupId || '1', selectedQuestion);
    console.log('Saving question:', selectedQuestion);
  };

  const handleUpdateQuestionField = (field: keyof GlobalRubricQuestion, value: string | boolean) => {
    if (!selectedQuestionId) return;
    setGlobalRubricQuestions(globalRubricQuestions.map(q =>
      q.id === selectedQuestionId ? { ...q, [field]: value } : q
    ));
  };




  const handleSaveNewQuestion = async (question: {
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
  }) => {
    const newQuestionId = `bank-${addQuestionType}-${Date.now()}`;
    const newBankQuestion: QuestionBankItem = {
      id: newQuestionId,
      title: question.title,
      questionText: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      isMandatory: question.required,
      isActive: true,
      tags: addQuestionType === 'patientSpecific' ? ['patient_specific'] : [],
      usedBySimulationGroups: [],
      usedByPatients: addQuestionType === 'patientSpecific' ? [] : undefined
    };

    if (addQuestionType === 'global') {
      if (organizationId) {
        try {
          await adminApi.createQuestionBankQuestion(organizationId, {
            title: question.title,
            question_text: question.keyQuestion,
            evaluation_criteria: question.evaluationCriteria,
            is_mandatory: question.required,
            tags: [],
          });
          // Reload questions from admin API (org-scoped)
          const allQuestions = await adminApi.getQuestionBankQuestions(organizationId);
          const global = allQuestions.filter(q => !q.tags?.includes('patient_specific'));
          setGlobalBankQuestions(global);
        } catch (err) {
          console.error('Failed to create question via API, falling back to mock:', err);
          instructorService.addToGlobalQuestionBank(newBankQuestion);
          setGlobalBankQuestions(prev => [...prev, newBankQuestion]);
        }
      } else {
        // No org context — local-only fallback
        instructorService.addToGlobalQuestionBank(newBankQuestion);
        setGlobalBankQuestions(prev => [...prev, newBankQuestion]);
      }
    } else {
      instructorService.addToPatientSpecificQuestionBank(newBankQuestion);
      setPatientSpecificBankQuestions(instructorService.getPatientSpecificQuestionBank());
    }

    console.log('Saved new question to bank:', addQuestionType, question);
  };

  const handleSaveNewPatientQuestion = async (question: {
    patientId: string;
    title: string;
    keyQuestion: string;
    clinicalIntent: string;
    evaluationCriteria: string;
    required: boolean;
  }) => {
    const newQuestionId = `bank-patient-${Date.now()}`;
    const newBankQuestion: QuestionBankItem = {
      id: newQuestionId,
      title: question.title,
      questionText: question.keyQuestion,
      clinicalIntent: question.clinicalIntent,
      evaluationCriteria: question.evaluationCriteria,
      isMandatory: question.required,
      isActive: true,
      tags: ['patient_specific'],
      usedBySimulationGroups: [],
      usedByPatients: []
    };

    mockInstructorDataService.addToPatientSpecificQuestionBank(newBankQuestion);
    setPatientSpecificBankQuestions(mockInstructorDataService.getPatientSpecificQuestionBank());

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

    try {
      // 1. Create the question in the question_bank via real API
      const created = await adminApi.createQuestionBankQuestion(organizationId!, {
        title: question.title,
        question_text: question.keyQuestion,
        evaluation_criteria: question.evaluationCriteria,
        is_mandatory: question.required,
      });

      // 2. Assign it to the group with persona_id to make it patient-specific
      await instructorService.assignQuestionToGroup(
        groupId || '',
        created.id,
        question.patientId
      );

      // 3. Refresh the question bank from the API
      const updatedBank = await instructorService.getGlobalQuestionBank();
      setGlobalBankQuestions(updatedBank);

      // 4. Update UI state for the included checkmark
      if (questionBankTab === 'patientSpecific' && selectedPatientForQuestionBank === question.patientId) {
        setIncludedQuestionIds(prev => {
          const newSet = new Set(prev);
          newSet.add(created.id);
          return newSet;
        });
      }

      console.log('Created patient-specific question via API:', created.id);
    } catch (err) {
      console.error('Failed to create patient-specific question:', err);
    }
  };

  const handleToggleQuestionInclusion = async (questionId: string, bankQuestion: QuestionBankItem, isChecked: boolean) => {
    const newSet = new Set(includedQuestionIds);
    const isGlobal = questionBankTab === 'global' || questionId.startsWith('bank-global-');
    const personaId = !isGlobal ? selectedPatientForQuestionBank : undefined;

    try {
      if (isChecked) {
        newSet.add(questionId);

        // Call API to assign question to group (with persona for patient-specific)
        await instructorService.assignQuestionToGroup(groupId || '1', questionId, personaId || undefined);

        if (isGlobal) {
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

        // Call API to unassign question
        await instructorService.unassignQuestion(questionId);

        if (isGlobal) {
          instructorService.deleteGlobalRubricQuestion(groupId || '1', questionId);
          setGlobalRubricQuestions(instructorService.getGlobalRubricQuestions(groupId || '1'));
        }
      }

      setIncludedQuestionIds(newSet);
    } catch (err) {
      console.error('Failed to update question assignment:', err);
    }
  };


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

          <UserAvatar name={user.name} imageUrl={user.avatarUrl} size="medium" />
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
              Back to {organization?.name || 'Organization'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="default"
            onClick={handleInstructorView}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Instructor View
          </Button>
          <Button
            variant="default"
            onClick={handleStudentView}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
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

      <div className="flex flex-1 overflow-hidden">
        <SimulationGroupSidebar
          activeSection={activeSection}
          onSectionChange={(section) => setActiveSection(section as typeof activeSection)}
          sections={[
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
            { id: 'patients', label: `Manage ${aiPersonaLabelPlural}`, icon: <Users className="w-5 h-5" /> },
            { id: 'students', label: `Manage ${userRoleLabel}s`, icon: <UserCog className="w-5 h-5" /> },
            { id: 'instructors', label: 'Manage Instructors', icon: <UserPlus className="w-5 h-5" /> },
            { id: 'rubric', label: 'Global Rubric', icon: <FileText className="w-5 h-5" /> },
            { id: 'questionBank', label: 'Question Bank', icon: <HelpCircle className="w-5 h-5" /> },
            { id: 'prompts', label: 'Manage Prompts', icon: <FileCode className="w-5 h-5" /> },
          ]}
          accessCode={accessCode}
          onCopyAccessCode={handleCopyAccessCode}
          onGenerateAccessCode={() => setIsAccessCodeDialogOpen(true)}
          isVisible={isMainSidebarVisible}
          onToggleVisibility={() => setIsMainSidebarVisible(!isMainSidebarVisible)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ padding: activeSection === 'rubric' || activeSection === 'questionBank' || activeSection === 'prompts' || activeSection === 'editPatient' || activeSection === 'viewStudent' ? '0' : '2rem' }}>
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
              onToggleVoice={async (newValue) => {
                setEnableVoiceForAll(newValue);
                if (groupId) {
                  try {
                    await adminApi.updateGroupAccess({
                      simulation_group_id: groupId,
                      access: true,
                      // admin_voice_enabled: newValue,      // uncomment after migration 005 runs
                      // instructor_voice_enabled: newValue,  // uncomment after migration 005 runs
                    });
                  } catch (err) {
                    console.error('Failed to update voice setting via API:', err);
                    // State already updated locally, so UI stays consistent
                  }
                }
              }}
            >
              {/* Message Limit Setting */}
              <div className="border rounded-xl p-5 space-y-3" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                <label className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                  Max messages per conversation
                </label>
                <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                  Limit the number of messages a student can send in a single conversation. Leave empty for unlimited.
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxMessagesInput}
                    onChange={(e) => setMaxMessagesInput(e.target.value)}
                    className="w-32 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default }}
                  />
                  <Button
                    onClick={async () => {
                      if (!groupId) return;
                      const parsed = maxMessagesInput.trim() === '' ? null : parseInt(maxMessagesInput, 10);
                      if (parsed !== null && (isNaN(parsed) || parsed < 1)) return;
                      try {
                        await adminApi.updateGroupMessageLimit(groupId, parsed);
                        setMaxMessagesPerChat(parsed);
                      } catch (err) {
                        console.error('Failed to update message limit:', err);
                      }
                    }}
                    disabled={(() => {
                      const parsed = maxMessagesInput.trim() === '' ? null : parseInt(maxMessagesInput, 10);
                      if (parsed !== null && (isNaN(parsed) || parsed < 1)) return true;
                      return parsed === maxMessagesPerChat;
                    })()}
                    className="px-4 py-2 text-sm font-medium transition-colors"
                    style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                  >
                    Save
                  </Button>
                  {maxMessagesPerChat != null && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!groupId) return;
                        try {
                          await adminApi.updateGroupMessageLimit(groupId, null);
                          setMaxMessagesPerChat(null);
                          setMaxMessagesInput('');
                        } catch (err) {
                          console.error('Failed to remove message limit:', err);
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium"
                    >
                      Remove limit
                    </Button>
                  )}
                </div>
                {maxMessagesPerChat != null && (
                  <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                    Current limit: {maxMessagesPerChat} messages per conversation
                  </p>
                )}
              </div>
            </PatientsSection>
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

          {activeSection === 'instructors' && (
            <div className="space-y-6 max-w-5xl">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: UI_COLORS.text.muted }} />
                  <Input
                    placeholder="Search by Instructor Name"
                    value={instructorSearchQuery}
                    onChange={(e) => setInstructorSearchQuery(e.target.value)}
                    className="pl-10 py-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                  />
                </div>
                <Button
                  onClick={handleAddNewInstructor}
                  className="px-6 py-6 gap-2 transition-colors"
                  style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                >
                  <Plus className="w-5 h-5" />
                  Add Instructor
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden" style={{ borderColor: UI_COLORS.border.default }}>
                <div className="grid grid-cols-[2fr_3fr_auto] gap-4 px-6 py-4" style={{ backgroundColor: UI_COLORS.background.tableHeader }}>
                  {['Instructor Name', 'Email Address', 'Actions'].map(h => (
                    <div key={h} className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>{h}</div>
                  ))}
                </div>
                {instructorsLoading ? (
                  <div className="px-6 py-8 text-center" style={{ color: UI_COLORS.text.muted }}>
                    Loading instructors...
                  </div>
                ) : filteredInstructors.length === 0 ? (
                  <div className="px-6 py-8 text-center" style={{ color: UI_COLORS.text.muted }}>
                    {instructorSearchQuery ? 'No instructors match your search.' : 'No instructors assigned to this group yet.'}
                  </div>
                ) : (
                  filteredInstructors.map((instructor) => (
                    <div key={instructor.user_email} className="grid grid-cols-[2fr_3fr_auto] gap-4 px-6 py-4 border-t items-center" style={{ borderColor: UI_COLORS.border.default }}>
                      <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{instructor.first_name} {instructor.last_name}</div>
                      <div className="text-base" style={{ color: UI_COLORS.text.heading }}>{instructor.user_email}</div>
                      <div>
                        <button
                          onClick={() => handleRemoveInstructor(instructor.user_email)}
                          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                          style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                          aria-label="Remove instructor from group"
                          title="Remove from group"
                        >
                          <Trash2 className="w-5 h-5" style={{ color: UI_COLORS.status.error }} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSection === 'questionBank' && (
            <div className="h-full flex flex-col">
              <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>Question Bank</h2>
                <div className="flex gap-2 border-b" style={{ borderColor: UI_COLORS.border.default }}>
                  <button
                    onClick={() => {
                      setQuestionBankTab('global');
                      setQuestionBankSearchQuery('');
                      setQuestionBankTagFilter('');
                      const globalRubric = instructorService.getGlobalRubricQuestions(groupId || '1');
                      setIncludedQuestionIds(new Set(globalRubric.map(q => q.id)));
                    }}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{ color: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body, borderColor: questionBankTab === 'global' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent', backgroundColor: 'transparent', cursor: 'pointer' }}
                  >
                    Global Questions
                  </button>
                  <button
                    onClick={() => {
                      setQuestionBankTab('patientSpecific');
                      setQuestionBankSearchQuery('');
                      setQuestionBankTagFilter('');
                      if (selectedPatientForQuestionBank && groupId) {
                        instructorService.getSimulationGroupQuestions(groupId, selectedPatientForQuestionBank)
                          .then((assigned: any[]) => {
                            setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
                          })
                          .catch(() => setIncludedQuestionIds(new Set()));
                      } else {
                        setIncludedQuestionIds(new Set());
                      }
                    }}
                    className="px-6 py-3 font-medium transition-colors border-b-2"
                    style={{ color: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : UI_COLORS.text.body, borderColor: questionBankTab === 'patientSpecific' ? SIMULATION_GROUP_COLOR_PALETTE[2] : 'transparent', backgroundColor: 'transparent', cursor: 'pointer' }}
                  >
                    Patient-Specific Questions
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-3">
                  {/* Search and Tag Filter */}
                  <div className="flex gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: UI_COLORS.text.muted }} />
                      <Input
                        placeholder="Search questions..."
                        value={questionBankSearchQuery}
                        onChange={(e) => setQuestionBankSearchQuery(e.target.value)}
                        className="pl-9 py-2 text-sm"
                        style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}
                      />
                    </div>
                    <select
                      value={questionBankTagFilter}
                      onChange={(e) => setQuestionBankTagFilter(e.target.value)}
                      className="px-3 py-2 rounded-md border text-sm"
                      style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading, minWidth: '10rem' }}
                    >
                      <option value="">All Tags</option>
                      {allExistingTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>

                  {questionBankTab === 'global' && (
                    <>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>Select which global questions should be included in this simulation group's rubric.</p>
                      <Button
                        onClick={() => { setAddQuestionType('global'); setIsAddQuestionDialogOpen(true); }}
                        className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                        style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        <Plus className="w-5 h-5" />
                        Add New Global Question
                      </Button>
                      {filteredGlobalBankQuestions.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                          {questionBankSearchQuery || questionBankTagFilter ? 'No questions match your filters.' : 'No global questions yet.'}
                        </p>
                      ) : filteredGlobalBankQuestions.map((question) => (
                        <div key={question.id} className="flex items-center justify-between p-4 rounded-lg border transition-colors" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                          <div className="flex-1 min-w-0 mr-3">
                            <span className="text-sm font-medium block" style={{ color: UI_COLORS.text.heading }}>{question.title}</span>
                            {(question.tags || []).filter(t => t !== 'patient_specific').length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {question.tags!.filter(t => t !== 'patient_specific').map(tag => (
                                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includedQuestionIds.has(question.id)}
                              onChange={(e) => handleToggleQuestionInclusion(question.id, question, e.target.checked)}
                              className="w-5 h-5 rounded cursor-pointer"
                              style={{ accentColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
                            />
                            <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Include</span>
                          </label>
                        </div>
                      ))}
                    </>
                  )}

                  {questionBankTab === 'patientSpecific' && (
                    <>
                      <p className="text-sm mb-4" style={{ color: UI_COLORS.text.muted }}>Select a patient to manage their patient-specific questions.</p>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: UI_COLORS.text.heading }}>Select Patient</label>
                        <select
                          value={selectedPatientForQuestionBank || ''}
                          onChange={(e) => {
                            const patientId = e.target.value || null;
                            setSelectedPatientForQuestionBank(patientId);
                            if (patientId && groupId) {
                              // Load assigned questions for this patient from API
                              instructorService.getSimulationGroupQuestions(groupId, patientId)
                                .then((assigned: any[]) => {
                                  setIncludedQuestionIds(new Set(assigned.map((q: any) => q.question_id)));
                                })
                                .catch(() => setIncludedQuestionIds(new Set()));
                            } else {
                              setIncludedQuestionIds(new Set());
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg border"
                          style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                        >
                          <option value="">-- Select a patient --</option>
                          {manageablePatients.map((patient) => (
                            <option key={patient.patient_id} value={patient.patient_id}>{patient.patient_name}</option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={() => setIsAddPatientQuestionDialogOpen(true)}
                        className="w-full justify-start gap-2 py-3 h-auto font-medium transition-colors mb-4"
                        style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                      >
                        <Plus className="w-5 h-5" />
                        Add New Patient-Specific Question
                      </Button>
                      {selectedPatientForQuestionBank ? (
                        filteredPatientBankQuestions.length === 0 ? (
                          <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>
                            {questionBankSearchQuery || questionBankTagFilter ? 'No questions match your filters.' : 'No patient-specific questions yet.'}
                          </p>
                        ) : filteredPatientBankQuestions.map((question) => (
                          <div key={question.id} className="flex items-center justify-between p-4 rounded-lg border transition-colors" style={{ borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white }}>
                            <div className="flex-1 min-w-0 mr-3">
                              <span className="text-sm font-medium block" style={{ color: UI_COLORS.text.heading }}>{question.title}</span>
                              {(question.tags || []).filter(t => t !== 'patient_specific').length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {question.tags!.filter(t => t !== 'patient_specific').map(tag => (
                                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={includedQuestionIds.has(question.id)}
                                onChange={(e) => handleToggleQuestionInclusion(question.id, question, e.target.checked)}
                                className="w-5 h-5 rounded cursor-pointer"
                                style={{ accentColor: SIMULATION_GROUP_COLOR_PALETTE[2] }}
                              />
                              <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Include</span>
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-center py-8" style={{ color: UI_COLORS.text.muted }}>Please select a patient to manage their questions.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'prompts' && (
            <div className="flex h-full relative">
              <aside className="flex flex-col border-r" style={{ backgroundColor: UI_COLORS.background.white, borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: UI_COLORS.border.default, width: '16rem', minWidth: '16rem' }}>
                <div className="p-6">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>Prompt Type</h3>
                  <div className="space-y-2">
                    {(['system', 'evaluation'] as const).map((type) => (
                      <Button
                        key={type}
                        onClick={() => setSelectedPromptType(type)}
                        variant="ghost"
                        className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
                        style={{ backgroundColor: selectedPromptType === type ? UI_COLORS.background.tableHeader : 'transparent', color: UI_COLORS.text.heading }}
                      >
                        {type === 'system' ? 'System Prompt' : 'Debrief Prompt'}
                      </Button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-6" style={{ color: UI_COLORS.text.heading }}>
                      {selectedPromptType === 'system' ? 'System Prompt' : 'Debrief Prompt'}
                    </h2>
                    <div className="space-y-4">
                      <label className="text-sm font-medium" style={{ color: UI_COLORS.text.heading }}>Edit Prompt</label>
                      <textarea
                        value={String(selectedPromptType === 'system' ? systemPromptText : evaluationPromptText)}
                        onChange={(e) => {
                          if (selectedPromptType === 'system') {
                            setSystemPromptText(e.target.value);
                          } else {
                            setEvaluationPromptText(e.target.value);
                          }
                          setIsPromptUnsaved(true);
                        }}
                        placeholder={selectedPromptType === 'evaluation' ? 'No custom debrief prompt configured.' : 'Prompt goes here...'}
                        rows={6}
                        className="w-full px-4 py-3 rounded-md resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.white, color: UI_COLORS.text.heading }}
                      />
                      <div className="flex gap-3 justify-end">
                        <Button onClick={handleLoadDefaultPrompt} variant="outline" className="px-6 transition-colors" style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading, backgroundColor: UI_COLORS.background.white }}>
                          Load Default Prompt
                        </Button>
                        <Button
                          onClick={handleSavePrompt}
                          className="px-6 transition-colors"
                          style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
                        >
                          Save Prompt
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                      {selectedPromptType === 'system' ? 'System' : 'Debrief'} Prompt History
                    </h3>
                    <p className="text-sm mb-6" style={{ color: UI_COLORS.text.muted }}>Browse earlier versions. Restore any version you want to use.</p>
                    {promptHistory.length === 0 && (
                      <p className="text-sm italic" style={{ color: UI_COLORS.text.muted }}>No history yet. Save a prompt to start tracking changes.</p>
                    )}
                    {promptHistory.map((version, index) => (
                      <div key={version.id} className="border rounded-lg p-6 mb-4" style={{ borderColor: UI_COLORS.border.default }}>
                        <textarea
                          value={String(version.text)}
                          readOnly
                          placeholder="Prompt goes here..."
                          rows={4}
                          className="w-full px-4 py-3 rounded-md resize-none mb-4"
                          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default, backgroundColor: UI_COLORS.background.tableHeader, color: UI_COLORS.text.heading }}
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                              Version {index + 1} of {promptHistory.length}
                            </span>
                            <span className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                              Saved: {new Date(version.saved_at).toLocaleString()}
                            </span>
                            {version.modified_by_email && (
                              <span className="text-sm" style={{ color: UI_COLORS.text.muted }}>
                                by {version.modified_by_first_name && version.modified_by_last_name
                                  ? `${version.modified_by_first_name} ${version.modified_by_last_name}`
                                  : version.modified_by_email}
                              </span>
                            )}
                          </div>
                          <Button onClick={() => handleRestorePromptVersion(version.text)} variant="outline" className="px-6 transition-colors" style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading, backgroundColor: UI_COLORS.background.white }}>
                            Restore This Version
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'rubric' && (
            <RubricSection
              questions={globalRubricQuestions}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={setSelectedQuestionId}
              searchQuery={rubricSearchQuery}
              onSearchChange={setRubricSearchQuery}
              onSaveQuestion={handleSaveQuestion}
              onDeleteQuestion={handleDeleteQuestion}
              onUpdateField={handleUpdateQuestionField}
            />
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
                mockInstructorDataService.updateCaseSpecificQuestion(patientId, question);
              }}
              onDeleteCaseQuestion={(patientId, questionId) => {
                mockInstructorDataService.deleteCaseSpecificQuestion(patientId, questionId);
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

      <AddQuestionDialog
        open={isAddQuestionDialogOpen}
        onOpenChange={setIsAddQuestionDialogOpen}
        questionType={addQuestionType}
        existingTags={allExistingTags}
        onSave={handleSaveNewQuestion}
      />

      <AddPatientSpecificQuestionDialog
        open={isAddPatientQuestionDialogOpen}
        onOpenChange={setIsAddPatientQuestionDialogOpen}
        patients={manageablePatients.map(p => ({ id: p.patient_id, name: p.patient_name }))}
        onSave={handleSaveNewPatientQuestion}
      />

      <AddInstructorDialog
        open={isAddInstructorDialogOpen}
        onOpenChange={setIsAddInstructorDialogOpen}
        onAddInstructor={handleAddInstructorSubmit}
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

      <AIDebriefDialog
        isOpen={isAIDebriefOpen}
        onClose={closeDebrief}
        data={selectedDebriefData}
        simulationGroupId={groupId}
      />
    </PageContainer>
  );
}

export default AdminSimulationGroupPage;
