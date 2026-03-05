/**
 * Instructor Service
 * 
 * Calls real backend API endpoints via API Gateway.
 * Falls back to mock data if API calls fail (for local dev without backend).
 * 
 * DATABASE SCHEMA ALIGNMENT:
 * - Physical Assessment Materials: persona_media table (media_id, persona_id, media_type, url, title, description, created_at)
 * - Chat Attempts: chats table (chat_id, student_interaction_id, chat_name, chat_context_embeddings, last_accessed, notes)
 * - Chat Messages: messages table (message_id, chat_id, student_sent, message_content, time_sent, quality_score, quality_feedback, suggested_rewrite)
 * - Notes: chats.notes field (text field in chats table)
 * - Key Questions: key_questions table (question_id, rubric_id, question_text, category, order, weight, max_score)
 * - Student Interactions: Links students to personas via student_interaction table
 */

import { getSimulationGroupColor } from '@/lib/colors';
import { apiClient } from '@/lib/api-client';
import { authService } from '@/lib/auth';

/**
 * Represents a simulation group from instructor perspective
 */
export interface InstructorSimulationGroup {
  id: string;              // Unique identifier
  name: string;            // Group name (e.g., "Pregnancy")
  subtitle: string;        // Always "Medical Simulation Group"
  iconUrl?: string;        // Optional icon image URL
  iconColor?: string;      // Fallback color for avatar (hex format)
  accessCode: string;      // Access code for students to join
  studentCount: number;    // Number of students in the group
  patientCount: number;    // Number of patients in the group
}

/**
 * Represents current user data
 */
export interface UserData {
  name: string;            // User's full name
  avatarUrl?: string;      // Optional profile picture URL
}

/**
 * Represents a patient in a simulation group with analytics
 */
export interface PatientAnalytics {
  id: string;                           // Unique identifier
  name: string;                         // Patient name
  instructorCompletionPercentage: number; // 0-100
  llmCompletionPercentage: number;      // 0-100
  studentMessageCount: number;          // Number of messages from students
  aiMessageCount: number;               // Number of AI responses
  studentAccessCount: number;           // Number of times students accessed
}

/**
 * Represents message count data for charts
 */
export interface MessageCountData {
  name: string;                         // Label (e.g., "Messages")
  'Student Messages': number;           // Student message count
  'AI Messages': number;                // AI message count
}

/**
 * Represents a patient for management (maps to personas table in DB)
 */
export interface ManageablePatient {
  id: string;                           // Unique identifier (persona_id in DB)
  simulation_group_id: string;          // Reference to simulation group (simulation_group_id in DB)
  name: string;                         // Patient name (persona_name in DB)
  age: number;                          // Patient age (persona_age in DB)
  gender: string;                       // Patient gender (persona_gender in DB)
  persona_number?: number;              // Patient number (persona_number in DB)
  prompt: string;                       // Patient prompt for LLM (persona_prompt in DB)
  average_wpm?: number;                 // Average words per minute (average_wpm in DB)
  voice_id?: string;                    // Voice ID for TTS (voice_id in DB)
  interaction_mode?: string;            // Interaction mode (interaction_mode in DB)
  llmEvaluationEnabled: boolean;        // Whether LLM evaluation is enabled (derived from settings)
  photoUrl?: string;                    // Optional patient photo URL (stored separately or in media)
}

/**
 * Represents a global rubric question (maps to key_questions table in DB)
 */
export interface GlobalRubricQuestion {
  id: string;                           // Unique identifier (question_id in DB)
  rubric_id?: string;                   // Reference to rubric (rubric_id in DB, null for global)
  title: string;                        // Question title (derived from question_text)
  keyQuestion: string;                  // The key question text (question_text in DB)
  clinicalIntent: string;               // Clinical intent description (stored in category or separate field)
  evaluationCriteria: string;           // Evaluation criteria (stored in separate field)
  required: boolean;                    // Whether required for case completion
  order?: number;                       // Display order (order field in DB)
  weight?: number;                      // Question weight (weight field in DB)
  max_score?: number;                   // Maximum score (max_score field in DB)
}

/**
 * Represents a case material (maps to persona_media table in DB)
 */
export interface CaseMaterial {
  id: string;                           // Unique identifier (media_id in DB)
  title: string;                        // Material title
  description: string;                  // Material description
  materialType: string;                 // Type: image, video, document, audio, other (media_type in DB)
  contentUrl?: string;                  // URL to uploaded content (url in DB)
  embedLink?: string;                   // H5P embed link (can be stored in url field)
}

/**
 * Represents a student in a simulation group
 */
export interface Student {
  id: string;                           // Unique identifier
  name: string;                         // Student name
  email: string;                        // Student email
}

/**
 * Represents student details with performance metrics
 */
export interface StudentDetails {
  id: string;                           // Unique identifier
  name: string;                         // Student name
  email: string;                        // Student email
  groupName: string;                    // Simulation group name
  casesAttempted: number;               // Number of cases attempted
  caseCompletionRate: number;           // Completion rate percentage (0-100)
}

/**
 * Represents a chat attempt for a patient (maps to chats table in DB)
 */
export interface ChatAttempt {
  id: string;                           // Unique identifier (chat_id in DB)
  student_interaction_id: string;       // Reference to student interaction (student_interaction_id in DB)
  attemptNumber: number;                // Attempt number (derived from ordering)
  date: string;                         // Date of attempt (derived from last_accessed in DB)
  completionStatus: 'In Progress' | 'Complete'; // Status (derived from completion state)
  score: number | null;                 // Score percentage (null if in progress)
  notes?: string;                       // Notes text (notes field in DB)
}

/**
 * Represents a chat message (maps to messages table in DB)
 */
export interface ChatMessage {
  message_id: string;                   // Unique identifier (message_id in DB)
  chat_id: string;                      // Reference to chat (chat_id in DB)
  student_sent: boolean;                // True if sent by student, false if AI
  message_content: string;              // Message text (message_content in DB)
  time_sent: string;                    // Timestamp (time_sent in DB)
  quality_score?: number;               // Optional quality score (quality_score in DB)
  quality_feedback?: string;            // Optional quality feedback (quality_feedback in DB)
  suggested_rewrite?: string;           // Optional suggested rewrite (suggested_rewrite in DB)
}

/**
 * Represents notes for a chat attempt (stored in chats.notes field in DB)
 */
export interface ChatNotes {
  attemptId: string;                    // Chat attempt ID (chat_id in DB)
  notes: string;                        // Notes text (notes field in chats table)
}

/**
 * Represents patient creation data
 */
export interface PatientCreateData {
  name: string;                         // persona_name
  age: number;                          // persona_age
  gender: string;                       // persona_gender
  prompt: string;                       // persona_prompt
  persona_number?: number;              // persona_number (optional)
  average_wpm?: number;                 // average_wpm (optional)
  voice_id?: string;                    // voice_id (optional)
  interaction_mode?: string;            // interaction_mode (optional)
}

/**
 * Represents patient update data
 */
export interface PatientUpdateData {
  id: string;                           // persona_id
  name: string;                         // persona_name
  age: number;                          // persona_age
  gender: string;                       // persona_gender
  prompt: string;                       // persona_prompt
  photoUrl?: string;                    // Photo URL (stored separately)
  persona_number?: number;              // persona_number (optional)
  average_wpm?: number;                 // average_wpm (optional)
  voice_id?: string;                    // voice_id (optional)
  interaction_mode?: string;            // interaction_mode (optional)
  llmUploadFile?: File;                 // File upload for LLM
  patientInfoFile?: File;               // File upload for patient info
  answerKeyFile?: File;                 // File upload for answer key
}

/**
 * Instructor data service interface
 */
export interface InstructorDataService {
  getSimulationGroups: () => Promise<InstructorSimulationGroup[]>;
  createSimulationGroup: (data: { name: string; description: string; active: boolean; enableVoice: boolean }) => Promise<InstructorSimulationGroup>;
  getCurrentUser: () => Promise<UserData>;
  getSimulationGroup: (id: string) => Promise<InstructorSimulationGroup | undefined>;
  getPatientAnalytics: (simulationGroupId: string) => Promise<PatientAnalytics[]>;
  getMessageCountData: (patientId: string) => MessageCountData[];
  generateAccessCode: (simulationGroupId: string) => Promise<string>;
  getManageablePatients: (simulationGroupId: string) => Promise<ManageablePatient[]>;
  getPatient: (patientId: string) => ManageablePatient | undefined;
  createPatient: (simulationGroupId: string, patientData: PatientCreateData) => Promise<void>;
  updatePatient: (simulationGroupId: string, patientData: PatientUpdateData) => Promise<void>;
  uploadPatientPhoto: (patientId: string, photoFile: File) => Promise<string>;
  updatePatientLLMEvaluation: (patientId: string, enabled: boolean) => Promise<void>;
  deletePatient: (patientId: string) => Promise<void>;
  getGlobalRubricQuestions: (simulationGroupId: string) => GlobalRubricQuestion[];
  addGlobalRubricQuestion: (simulationGroupId: string, question: GlobalRubricQuestion) => void;
  updateGlobalRubricQuestion: (simulationGroupId: string, question: GlobalRubricQuestion) => void;
  deleteGlobalRubricQuestion: (simulationGroupId: string, questionId: string) => void;
  getCaseSpecificQuestions: (patientId: string) => GlobalRubricQuestion[];
  addCaseSpecificQuestion: (patientId: string, question: GlobalRubricQuestion) => void;
  updateCaseSpecificQuestion: (patientId: string, question: GlobalRubricQuestion) => void;
  deleteCaseSpecificQuestion: (patientId: string, questionId: string) => void;
  getCaseMaterials: (patientId: string) => CaseMaterial[];
  addCaseMaterial: (patientId: string, material: CaseMaterial) => void;
  updateCaseMaterial: (patientId: string, material: CaseMaterial) => void;
  deleteCaseMaterial: (patientId: string, materialId: string) => void;
  getEvaluationPrompt: (simulationGroupId: string) => Promise<string>;
  getStudents: (simulationGroupId: string) => Promise<Student[]>;
  getStudentDetails: (studentId: string) => StudentDetails | undefined;
  getChatAttempts: (studentId: string, patientId: string) => ChatAttempt[];
  getChatMessages: (attemptId: string) => ChatMessage[];
  getChatNotes: (attemptId: string) => string;
  getDefaultPatientPrompt: () => string;
}

/**
 * Hardcoded simulation groups for instructors
 */
async function getSimulationGroups(): Promise<InstructorSimulationGroup[]> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const data = await apiClient.request<any[]>(
      `/instructor/groups?email=${encodeURIComponent(user.email)}`
    );

    return data.map((group, index) => ({
      id: group.simulation_group_id,
      name: group.group_name,
      subtitle: 'Medical Simulation Group',
      iconColor: group.icon_color || getSimulationGroupColor(index),
      accessCode: group.access_code || '',
      studentCount: group.student_count || 0,
      patientCount: group.patient_count || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch instructor groups:', error);
    return [];
  }
}

/**
 * Create a new simulation group
 */
async function createSimulationGroup(data: { name: string; description: string; active: boolean; enableVoice: boolean }): Promise<InstructorSimulationGroup> {
  const user = await authService.getCurrentUser();
  if (!user?.email) throw new Error('Not authenticated');

  const result = await apiClient.request<any>(
    `/instructor/create_simulation_group?instructor_email=${encodeURIComponent(user.email)}`,
    {
      method: 'POST',
      body: {
        group_name: data.name,
        group_description: data.description,
        group_student_access: data.active,
        instructor_voice_enabled: data.enableVoice,
      },
    }
  );

  return {
    id: result.simulation_group_id,
    name: result.group_name,
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(0),
    accessCode: result.group_access_code || '',
    studentCount: 0,
    patientCount: 0,
  };
}

/**
 * Get current instructor user data
 * 
 * @returns User data object
 */
async function getCurrentUser(): Promise<UserData> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const data = await apiClient.request<{ name: string }>(
      `/student/get_name?user_email=${encodeURIComponent(user.email)}`
    );

    return {
      name: data.name || user.email,
      avatarUrl: undefined,
    };
  } catch (error) {
    console.error('Failed to fetch user name:', error);
    throw error;
  }
}

/**
 * Get a specific simulation group by ID
 * 
 * @param id - Simulation group ID
 * @returns Simulation group or undefined if not found
 */
async function getSimulationGroup(id: string): Promise<InstructorSimulationGroup | undefined> {
  try {
    const groups = await getSimulationGroups();
    return groups.find(group => group.id === id);
  } catch (error) {
    console.error('Failed to fetch simulation group:', error);
    return [] as any;
  }
}

/**
 * Get patient analytics for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of patient analytics
 */
async function getPatientAnalytics(simulationGroupId: string): Promise<PatientAnalytics[]> {
  try {
    const data = await apiClient.request<any[]>(
      `/instructor/analytics?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((patient) => ({
      id: patient.patient_id,
      name: patient.patient_name,
      instructorCompletionPercentage: patient.instructor_completion_percentage || 0,
      llmCompletionPercentage: patient.ai_score_percentage || 0,
      studentMessageCount: patient.student_message_count || 0,
      aiMessageCount: patient.ai_message_count || 0,
      studentAccessCount: patient.access_count || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch patient analytics:', error);
    return [];
  }
}

/**
 * Get message count data for charts
 * 
 * @param patientId - Patient ID
 * @returns Array with message count data
 */
function getMessageCountData(patientId: string): MessageCountData[] {
  // Find patient across all groups
  for (const groupPatients of Object.values(mockPatientAnalytics)) {
    const patient = groupPatients.find(p => p.id === patientId);
    if (patient) {
      return [
        {
          name: 'Messages',
          'Student Messages': patient.studentMessageCount,
          'AI Messages': patient.aiMessageCount
        }
      ];
    }
  }
  return [];
}

/**
 * Generate a new access code for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns New access code
 */
async function generateAccessCode(simulationGroupId: string): Promise<string> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const data = await apiClient.request<{ access_code: string }>(
      `/instructor/generate_access_code?simulation_group_id=${encodeURIComponent(simulationGroupId)}&instructor_email=${encodeURIComponent(user.email)}`,
      { method: 'POST' }
    );

    return data.access_code;
  } catch (error) {
    console.error('Failed to generate access code:', error);
    // Fallback to mock implementation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    
    const code = Array.from({ length: segments }, () => {
      return Array.from({ length: segmentLength }, () => 
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('');
    }).join('-');
    
    const group = mockInstructorSimulationGroups.find(g => g.id === simulationGroupId);
    if (group) {
      group.accessCode = code;
    }
    
    return code;
  }
}

/**
 * Get manageable patients for a simulation group
 * Maps to: personas table filtered by simulation_group_id
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of manageable patients with all persona fields
 */
async function getManageablePatients(simulationGroupId: string): Promise<ManageablePatient[]> {
  try {
    const data = await apiClient.request<any[]>(
      `/instructor/view_patients?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((patient) => ({
      id: patient.patient_id,
      simulation_group_id: patient.simulation_group_id,
      name: patient.patient_name,
      age: patient.patient_age,
      gender: patient.patient_gender,
      persona_number: patient.patient_number,
      prompt: patient.patient_prompt,
      average_wpm: patient.average_wpm,
      voice_id: patient.voice_id,
      interaction_mode: patient.interaction_mode,
      llmEvaluationEnabled: patient.llm_completion || false,
      photoUrl: patient.photo_url,
    }));
  } catch (error) {
    console.error('Failed to fetch manageable patients:', error);
    return [];
  }
}

/**
 * Get a specific patient by ID
 * Maps to: personas table filtered by persona_id
 * 
 * @param patientId - Patient ID (persona_id in DB)
 * @returns Patient with all persona fields or undefined if not found
 */
function getPatient(patientId: string): ManageablePatient | undefined {
  for (const groupPatients of Object.values(mockManageablePatients)) {
    const patient = groupPatients.find(p => p.id === patientId);
    if (patient) {
      return patient;
    }
  }
  return undefined;
}

/**
 * Create a new patient
 * Maps to: INSERT into personas table
 * 
 * @param simulationGroupId - Simulation group ID
 * @param patientData - New patient data
 */
async function createPatient(simulationGroupId: string, patientData: PatientCreateData): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({
      simulation_group_id: simulationGroupId,
      patient_name: patientData.name,
      patient_number: patientData.persona_number?.toString() || '1',
      patient_age: patientData.age.toString(),
      patient_gender: patientData.gender,
      instructor_email: user.email,
    });

    if (patientData.voice_id) {
      queryParams.append('voice_id', patientData.voice_id);
    }

    await apiClient.request(`/instructor/create_patient?${queryParams.toString()}`, {
      method: 'POST',
      body: {
        patient_prompt: patientData.prompt || DEFAULT_PATIENT_PROMPT,
      },
    });
  } catch (error) {
    console.error('Failed to create patient:', error);
    // Fallback to mock
    const newPatient: ManageablePatient = {
      id: `patient-${Date.now()}`,
      simulation_group_id: simulationGroupId,
      name: patientData.name,
      age: patientData.age,
      gender: patientData.gender,
      prompt: patientData.prompt || DEFAULT_PATIENT_PROMPT,
      persona_number: patientData.persona_number,
      average_wpm: patientData.average_wpm,
      voice_id: patientData.voice_id,
      interaction_mode: patientData.interaction_mode,
      llmEvaluationEnabled: false,
    };
    
    if (!mockManageablePatients[simulationGroupId]) {
      mockManageablePatients[simulationGroupId] = [];
    }
    mockManageablePatients[simulationGroupId].push(newPatient);
  }
}

/**
 * Update patient information
 * Maps to: UPDATE personas table
 * 
 * @param simulationGroupId - Simulation group ID
 * @param patientData - Updated patient data
 */
async function updatePatient(simulationGroupId: string, patientData: PatientUpdateData): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    const queryParams = new URLSearchParams({
      patient_id: patientData.id,
      instructor_email: user.email,
      simulation_group_id: simulationGroupId,
    });

    await apiClient.request(`/instructor/edit_patient?${queryParams.toString()}`, {
      method: 'PUT',
      body: {
        patient_name: patientData.name,
        patient_age: patientData.age,
        patient_gender: patientData.gender,
        patient_prompt: patientData.prompt,
      },
    });

    // Handle file uploads if needed
    if (patientData.llmUploadFile) {
      console.log('LLM Upload file:', patientData.llmUploadFile.name);
    }
    if (patientData.patientInfoFile) {
      console.log('Patient Info file:', patientData.patientInfoFile.name);
    }
    if (patientData.answerKeyFile) {
      console.log('Answer Key file:', patientData.answerKeyFile.name);
    }
  } catch (error) {
    console.error('Failed to update patient:', error);
    // Fallback to mock
    const patients = mockManageablePatients[simulationGroupId];
    if (patients) {
      const index = patients.findIndex(p => p.id === patientData.id);
      if (index !== -1) {
        patients[index] = {
          ...patients[index],
          name: patientData.name,
          age: patientData.age,
          gender: patientData.gender,
          prompt: patientData.prompt,
          photoUrl: patientData.photoUrl,
          persona_number: patientData.persona_number,
          average_wpm: patientData.average_wpm,
          voice_id: patientData.voice_id,
          interaction_mode: patientData.interaction_mode,
        };
      }
    }
  }
}

/**
 * Upload patient photo
 * 
 * @param patientId - Patient ID
 * @param photoFile - Photo file to upload
 * @returns Promise with photo URL
 */
async function uploadPatientPhoto(patientId: string, photoFile: File): Promise<string> {
  // Mock implementation - in real app, this would upload to a server
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const photoUrl = reader.result as string;
      // Update patient photo in mock data
      for (const groupPatients of Object.values(mockManageablePatients)) {
        const patient = groupPatients.find(p => p.id === patientId);
        if (patient) {
          patient.photoUrl = photoUrl;
          break;
        }
      }
      resolve(photoUrl);
    };
    reader.readAsDataURL(photoFile);
  });
}

/**
 * Update patient LLM evaluation setting
 * 
 * @param patientId - Patient ID
 * @param enabled - Whether LLM evaluation is enabled
 */
async function updatePatientLLMEvaluation(patientId: string, enabled: boolean): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    await apiClient.request(
      `/instructor/toggle_llm_completion?patient_id=${encodeURIComponent(patientId)}&instructor_email=${encodeURIComponent(user.email)}`,
      {
        method: 'PUT',
        body: {
          llm_completion: enabled,
        },
      }
    );
  } catch (error) {
    console.error('Failed to update LLM evaluation:', error);
    // Fallback to mock
    for (const groupPatients of Object.values(mockManageablePatients)) {
      const patient = groupPatients.find(p => p.id === patientId);
      if (patient) {
        patient.llmEvaluationEnabled = enabled;
        break;
      }
    }
  }
}

/**
 * Delete a patient
 * 
 * @param patientId - Patient ID
 */
async function deletePatient(patientId: string): Promise<void> {
  try {
    const user = await authService.getCurrentUser();
    if (!user?.email) throw new Error('Not authenticated');

    await apiClient.request(
      `/instructor/delete_patient?patient_id=${encodeURIComponent(patientId)}&instructor_email=${encodeURIComponent(user.email)}`,
      {
        method: 'DELETE',
      }
    );
  } catch (error) {
    console.error('Failed to delete patient:', error);
    // Fallback to mock
    for (const groupId of Object.keys(mockManageablePatients)) {
      mockManageablePatients[groupId] = mockManageablePatients[groupId].filter(
        p => p.id !== patientId
      );
    }
  }
}

/**
 * Get global rubric questions for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of global rubric questions
 */
function getGlobalRubricQuestions(simulationGroupId: string): GlobalRubricQuestion[] {
  return [];
}

/**
 * Add a new global rubric question
 * 
 * @param simulationGroupId - Simulation group ID
 * @param question - Question to add
 */
function addGlobalRubricQuestion(simulationGroupId: string, question: GlobalRubricQuestion): void {
  if (!mockGlobalRubricQuestions[simulationGroupId]) {
    mockGlobalRubricQuestions[simulationGroupId] = [];
  }
  mockGlobalRubricQuestions[simulationGroupId].push(question);
}

/**
 * Update a global rubric question
 * 
 * @param simulationGroupId - Simulation group ID
 * @param question - Updated question
 */
function updateGlobalRubricQuestion(simulationGroupId: string, question: GlobalRubricQuestion): void {
  const questions = mockGlobalRubricQuestions[simulationGroupId];
  if (questions) {
    const index = questions.findIndex(q => q.id === question.id);
    if (index !== -1) {
      questions[index] = question;
    }
  }
}

/**
 * Delete a global rubric question
 * 
 * @param simulationGroupId - Simulation group ID
 * @param questionId - Question ID to delete
 */
function deleteGlobalRubricQuestion(simulationGroupId: string, questionId: string): void {
  const questions = mockGlobalRubricQuestions[simulationGroupId];
  if (questions) {
    mockGlobalRubricQuestions[simulationGroupId] = questions.filter(q => q.id !== questionId);
  }
}

/**
 * Get evaluation prompt for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Evaluation prompt as markdown string
 */
async function getEvaluationPrompt(simulationGroupId: string): Promise<string> {
  try {
    const data = await apiClient.request<{ system_prompt: string }>(
      `/instructor/get_prompt?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.system_prompt || mockEvaluationPrompt;
  } catch (error) {
    console.error('Failed to fetch evaluation prompt:', error);
    return [] as any;
  }
}

/**
 * Get students for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of students
 */
async function getStudents(simulationGroupId: string): Promise<Student[]> {
  try {
    const data = await apiClient.request<any[]>(
      `/instructor/view_students?simulation_group_id=${encodeURIComponent(simulationGroupId)}`
    );

    return data.map((student) => ({
      id: student.user_id,
      name: `${student.first_name} ${student.last_name}`.trim() || student.username,
      email: student.user_email,
    }));
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return [];
  }
}

/**
 * Get student details by ID
 * 
 * @param studentId - Student ID
 * @returns Student details or undefined if not found
 */
function getStudentDetails(studentId: string): StudentDetails | undefined {
  return [] as any;
}

/**
 * Get chat attempts for a student and patient
 * Maps to: chats table filtered by student_interaction_id
 * 
 * @param studentId - Student ID (user_id in DB)
 * @param patientId - Patient ID (persona_id via student_interaction)
 * @returns Array of chat attempts
 */
function getChatAttempts(studentId: string, patientId: string): ChatAttempt[] {
  return [];
}

/**
 * Get chat messages for an attempt
 * Maps to: messages table filtered by chat_id
 * 
 * @param attemptId - Chat attempt ID (chat_id in DB)
 * @returns Array of chat messages ordered by time_sent
 */
function getChatMessages(attemptId: string): ChatMessage[] {
  return [];
}

/**
 * Get notes for an attempt
 * Maps to: chats.notes field
 * 
 * @param attemptId - Chat attempt ID (chat_id in DB)
 * @returns Notes text from chats.notes field
 */
function getChatNotes(attemptId: string): string {
  return [] as any;
}

/**
 * Get case-specific questions for a patient
 * 
 * @param patientId - Patient ID
 * @returns Array of case-specific questions
 */
function getCaseSpecificQuestions(patientId: string): GlobalRubricQuestion[] {
  return [];
}

/**
 * Add a new case-specific question
 * 
 * @param patientId - Patient ID
 * @param question - Question to add
 */
function addCaseSpecificQuestion(patientId: string, question: GlobalRubricQuestion): void {
  if (!mockCaseSpecificQuestions[patientId]) {
    mockCaseSpecificQuestions[patientId] = [];
  }
  mockCaseSpecificQuestions[patientId].push(question);
}

/**
 * Update a case-specific question
 * 
 * @param patientId - Patient ID
 * @param question - Updated question
 */
function updateCaseSpecificQuestion(patientId: string, question: GlobalRubricQuestion): void {
  const questions = mockCaseSpecificQuestions[patientId];
  if (questions) {
    const index = questions.findIndex(q => q.id === question.id);
    if (index !== -1) {
      questions[index] = question;
    }
  }
}

/**
 * Delete a case-specific question
 * 
 * @param patientId - Patient ID
 * @param questionId - Question ID to delete
 */
function deleteCaseSpecificQuestion(patientId: string, questionId: string): void {
  const questions = mockCaseSpecificQuestions[patientId];
  if (questions) {
    mockCaseSpecificQuestions[patientId] = questions.filter(q => q.id !== questionId);
  }
}

/**
 * Get case materials for a patient
 * Maps to: persona_media table filtered by persona_id
 * 
 * @param patientId - Patient ID (persona_id in DB)
 * @returns Array of case materials (physical assessment materials)
 */
function getCaseMaterials(patientId: string): CaseMaterial[] {
  return [];
}

/**
 * Add a new case material
 * 
 * @param patientId - Patient ID
 * @param material - Material to add
 */
function addCaseMaterial(patientId: string, material: CaseMaterial): void {
  if (!mockCaseMaterials[patientId]) {
    mockCaseMaterials[patientId] = [];
  }
  mockCaseMaterials[patientId].push(material);
}

/**
 * Update a case material
 * 
 * @param patientId - Patient ID
 * @param material - Updated material
 */
function updateCaseMaterial(patientId: string, material: CaseMaterial): void {
  const materials = mockCaseMaterials[patientId];
  if (materials) {
    const index = materials.findIndex(m => m.id === material.id);
    if (index !== -1) {
      materials[index] = material;
    }
  }
}

/**
 * Delete a case material
 * 
 * @param patientId - Patient ID
 * @param materialId - Material ID to delete
 */
function deleteCaseMaterial(patientId: string, materialId: string): void {
  const materials = mockCaseMaterials[patientId];
  if (materials) {
    mockCaseMaterials[patientId] = materials.filter(m => m.id !== materialId);
  }
}

/**
 * Get the default patient prompt
 * 
 * @returns Default patient prompt text
 */
function getDefaultPatientPrompt(): string {
  return DEFAULT_PATIENT_PROMPT;
}

/**
 * Instructor data service object
 * Calls real API endpoints with fallback to mock data
 */
export const instructorService: InstructorDataService = {
  getSimulationGroups,
  createSimulationGroup,
  getCurrentUser,
  getSimulationGroup,
  getPatientAnalytics,
  getMessageCountData,
  generateAccessCode,
  getManageablePatients,
  getPatient,
  createPatient,
  updatePatient,
  uploadPatientPhoto,
  updatePatientLLMEvaluation,
  deletePatient,
  getGlobalRubricQuestions,
  addGlobalRubricQuestion,
  updateGlobalRubricQuestion,
  deleteGlobalRubricQuestion,
  getCaseSpecificQuestions,
  addCaseSpecificQuestion,
  updateCaseSpecificQuestion,
  deleteCaseSpecificQuestion,
  getCaseMaterials,
  addCaseMaterial,
  updateCaseMaterial,
  deleteCaseMaterial,
  getEvaluationPrompt,
  getStudents,
  getStudentDetails,
  getChatAttempts,
  getChatMessages,
  getChatNotes,
  getDefaultPatientPrompt
};

// Keep backward-compatible export
export const mockInstructorDataService = instructorService;
