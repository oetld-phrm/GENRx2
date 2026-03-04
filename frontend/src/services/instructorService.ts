/**
 * Instructor Service (Populated with Mock Data for now)
 * 
 * Provides hardcoded data for instructor views including simulation groups,
 * patient analytics, and access codes.
 * Designed for easy replacement with APIs
 */

import { getSimulationGroupColor } from '@/lib/colors';

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
 * Represents a patient for management
 */
export interface ManageablePatient {
  id: string;                           // Unique identifier
  name: string;                         // Patient name
  age: number;                          // Patient age
  gender: string;                       // Patient gender
  llmEvaluationEnabled: boolean;        // Whether LLM evaluation is enabled
}

/**
 * Represents a global rubric question
 */
export interface GlobalRubricQuestion {
  id: string;                           // Unique identifier
  title: string;                        // Question title
  keyQuestion: string;                  // The key question text
  clinicalIntent: string;               // Clinical intent description
  evaluationCriteria: string;           // Evaluation criteria
  required: boolean;                    // Whether required for case completion
}

/**
 * Mock data service interface
 */
export interface MockInstructorDataService {
  getSimulationGroups: () => InstructorSimulationGroup[];
  getCurrentUser: () => UserData;
  getSimulationGroup: (id: string) => InstructorSimulationGroup | undefined;
  getPatientAnalytics: (simulationGroupId: string) => PatientAnalytics[];
  getMessageCountData: (patientId: string) => MessageCountData[];
  generateAccessCode: (simulationGroupId: string) => string;
  getManageablePatients: (simulationGroupId: string) => ManageablePatient[];
  updatePatientLLMEvaluation: (patientId: string, enabled: boolean) => void;
  deletePatient: (patientId: string) => void;
  getGlobalRubricQuestions: (simulationGroupId: string) => GlobalRubricQuestion[];
  addGlobalRubricQuestion: (simulationGroupId: string, question: GlobalRubricQuestion) => void;
  updateGlobalRubricQuestion: (simulationGroupId: string, question: GlobalRubricQuestion) => void;
  deleteGlobalRubricQuestion: (simulationGroupId: string, questionId: string) => void;
}

/**
 * Hardcoded simulation groups for instructors
 */
const mockInstructorSimulationGroups: InstructorSimulationGroup[] = [
  {
    id: '1',
    name: 'Chronic Pain',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(0),
    accessCode: 'NB3W-PI3I-Q2EH-WPA3',
    studentCount: 24,
    patientCount: 2
  },
  {
    id: '2',
    name: 'Acne',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(1),
    accessCode: 'XY7Z-AB2C-DE4F-GH8I',
    studentCount: 18,
    patientCount: 3
  },
  {
    id: '3',
    name: 'Diabetes Management',
    subtitle: 'Medical Simulation Group',
    iconColor: getSimulationGroupColor(2),
    accessCode: 'PQ9R-ST1U-VW3X-YZ5A',
    studentCount: 32,
    patientCount: 2
  }
];

/**
 * Hardcoded user data for instructor
 */
const mockInstructorUserData: UserData = {
  name: 'Dr. Sarah Johnson',
  avatarUrl: undefined // Will display initials
};

/**
 * Hardcoded patient analytics data
 */
const mockPatientAnalytics: Record<string, PatientAnalytics[]> = {
  '1': [ // Chronic Pain group
    {
      id: 'pamela',
      name: 'Pamela',
      instructorCompletionPercentage: 60,
      llmCompletionPercentage: 0,
      studentMessageCount: 49,
      aiMessageCount: 36,
      studentAccessCount: 10
    },
    {
      id: 'timothy',
      name: 'Timothy',
      instructorCompletionPercentage: 0,
      llmCompletionPercentage: 0,
      studentMessageCount: 32,
      aiMessageCount: 28,
      studentAccessCount: 8
    }
  ],
  '2': [ // Acne group
    {
      id: 'john',
      name: 'John Davis',
      instructorCompletionPercentage: 15,
      llmCompletionPercentage: 20,
      studentMessageCount: 65,
      aiMessageCount: 52,
      studentAccessCount: 15
    }
  ]
};

/**
 * Hardcoded manageable patients data
 */
const mockManageablePatients: Record<string, ManageablePatient[]> = {
  '1': [ // Chronic Pain group
    {
      id: 'pamela',
      name: 'Pamela',
      age: 56,
      gender: 'Female',
      llmEvaluationEnabled: true
    },
    {
      id: 'timothy',
      name: 'Timothy',
      age: 42,
      gender: 'Other',
      llmEvaluationEnabled: true
    }
  ],
  '2': [ // Acne group
    {
      id: 'john',
      name: 'John',
      age: 38,
      gender: 'Male',
      llmEvaluationEnabled: false
    }
  ]
};

/**
 * Hardcoded global rubric questions data
 */
const mockGlobalRubricQuestions: Record<string, GlobalRubricQuestion[]> = {
  '1': [ // Chronic Pain group
    {
      id: '1',
      title: 'Medication History',
      keyQuestion: 'Ask the patient about current medications, including prescription, OTC, and supplements.',
      clinicalIntent: 'This question evaluates the student\'s ability to identify medications that may contribute to adverse reactions or drug interactions.',
      evaluationCriteria: 'Student should attempt to identify:\n• Current medications\n• Dosage if relevant\n• Duration of use\n• Recent medication changes',
      required: true,
    },
    {
      id: '2',
      title: 'Allergy History',
      keyQuestion: 'Ask the patient about any known allergies, including medications, foods, and environmental allergens.',
      clinicalIntent: 'This question evaluates the student\'s ability to identify potential allergic reactions and contraindications.',
      evaluationCriteria: 'Student should attempt to identify:\n• Known allergies\n• Type of reaction\n• Severity of reaction\n• Management strategies',
      required: true,
    },
    {
      id: '3',
      title: 'Symptom Duration',
      keyQuestion: 'Ask the patient how long they have been experiencing their current symptoms.',
      clinicalIntent: 'This question evaluates the student\'s ability to establish a timeline for the patient\'s condition.',
      evaluationCriteria: 'Student should attempt to identify:\n• Onset of symptoms\n• Duration of symptoms\n• Progression of symptoms\n• Any triggering events',
      required: false,
    },
  ],
  '2': [ // Acne group - can have different questions
    {
      id: '1',
      title: 'Skin Care Routine',
      keyQuestion: 'Ask the patient about their current skin care routine and products used.',
      clinicalIntent: 'This question evaluates the student\'s ability to identify potential irritants or contributing factors.',
      evaluationCriteria: 'Student should attempt to identify:\n• Current products used\n• Frequency of use\n• Any recent changes\n• Skin sensitivity',
      required: true,
    },
  ]
};

/**
 * Get all simulation groups for instructor
 * 
 * @returns Array of simulation groups
 */
function getSimulationGroups(): InstructorSimulationGroup[] {
  return mockInstructorSimulationGroups;
}

/**
 * Get current instructor user data
 * 
 * @returns User data object
 */
function getCurrentUser(): UserData {
  return mockInstructorUserData;
}

/**
 * Get a specific simulation group by ID
 * 
 * @param id - Simulation group ID
 * @returns Simulation group or undefined if not found
 */
function getSimulationGroup(id: string): InstructorSimulationGroup | undefined {
  return mockInstructorSimulationGroups.find(group => group.id === id);
}

/**
 * Get patient analytics for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of patient analytics
 */
function getPatientAnalytics(simulationGroupId: string): PatientAnalytics[] {
  return mockPatientAnalytics[simulationGroupId] || [];
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
function generateAccessCode(simulationGroupId: string): string {
  // Mock implementation - generates random code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;
  
  const code = Array.from({ length: segments }, () => {
    return Array.from({ length: segmentLength }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }).join('-');
  
  // Update the mock data
  const group = mockInstructorSimulationGroups.find(g => g.id === simulationGroupId);
  if (group) {
    group.accessCode = code;
  }
  
  return code;
}

/**
 * Get manageable patients for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of manageable patients
 */
function getManageablePatients(simulationGroupId: string): ManageablePatient[] {
  return mockManageablePatients[simulationGroupId] || [];
}

/**
 * Update patient LLM evaluation setting
 * 
 * @param patientId - Patient ID
 * @param enabled - Whether LLM evaluation is enabled
 */
function updatePatientLLMEvaluation(patientId: string, enabled: boolean): void {
  // Find and update patient across all groups
  for (const groupPatients of Object.values(mockManageablePatients)) {
    const patient = groupPatients.find(p => p.id === patientId);
    if (patient) {
      patient.llmEvaluationEnabled = enabled;
      break;
    }
  }
}

/**
 * Delete a patient
 * 
 * @param patientId - Patient ID
 */
function deletePatient(patientId: string): void {
  // Remove patient from all groups
  for (const groupId of Object.keys(mockManageablePatients)) {
    mockManageablePatients[groupId] = mockManageablePatients[groupId].filter(
      p => p.id !== patientId
    );
  }
}

/**
 * Get global rubric questions for a simulation group
 * 
 * @param simulationGroupId - Simulation group ID
 * @returns Array of global rubric questions
 */
function getGlobalRubricQuestions(simulationGroupId: string): GlobalRubricQuestion[] {
  return mockGlobalRubricQuestions[simulationGroupId] || [];
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
 * Mock instructor data service object
 * Provides methods to retrieve hardcoded data for now
 */
export const mockInstructorDataService: MockInstructorDataService = {
  getSimulationGroups,
  getCurrentUser,
  getSimulationGroup,
  getPatientAnalytics,
  getMessageCountData,
  generateAccessCode,
  getManageablePatients,
  updatePatientLLMEvaluation,
  deletePatient,
  getGlobalRubricQuestions,
  addGlobalRubricQuestion,
  updateGlobalRubricQuestion,
  deleteGlobalRubricQuestion
};
