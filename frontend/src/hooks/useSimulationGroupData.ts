import { useCallback, useState } from 'react';
import {
  instructorService,
  type KeyQuestionAnalytics, type KeyQuestionCoverage, type DTPCoverage,
  type RecommendationCoverage, type DTPAnalytics, type RecommendationAnalytics,
  type StudentProgressData, type UserData, type OrganizationLabels,
} from '@/services/instructorService';
import * as adminApi from '@/services/adminApiService';
import { mockAdminDataService } from '@/services/adminService';
import { useAsyncResource } from '@/hooks/useAsyncResource';

export interface UseSimulationGroupDataParams {
  groupId: string | undefined;
  organizationId?: string;
  role: 'admin' | 'instructor';
  activeSection?: string;
}

export interface UseSimulationGroupDataReturn {
  simulationGroup: any;
  patientAnalytics: any[];
  students: any[];
  manageablePatients: any[];
  profilePictures: Record<string, string>;
  keyQuestionCoverage: KeyQuestionCoverage[];
  dtpCoverage: DTPCoverage[];
  recommendationCoverage: RecommendationCoverage[];
  labels: OrganizationLabels;
  user: UserData;
  /** Only group metadata blocks the page shell. */
  loading: boolean;
  error: string | null;
  patientsLoading: boolean;
  studentsLoading: boolean;
  analyticsLoading: boolean;
  patientsError: string | null;
  studentsError: string | null;
  analyticsError: string | null;
  analyticsDateRange: { start: string; end: string };
  setAnalyticsDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  keyQuestionAnalytics: KeyQuestionAnalytics[];
  dtpAnalytics: DTPAnalytics[];
  recommendationAnalytics: RecommendationAnalytics[];
  studentProgress: StudentProgressData[];
  selectedPatientId: string;
  setSelectedPatientId: (id: string) => void;
  setManageablePatients: React.Dispatch<React.SetStateAction<any[]>>;
  setSimulationGroup: React.Dispatch<React.SetStateAction<any>>;
  setProfilePictures: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reloadPatients: () => Promise<void>;
}

// Stable fallbacks keep effect dependencies unchanged between renders.
const EMPTY_ROWS: never[] = [];
const EMPTY_PHOTOS: Record<string, string> = {};
const DEFAULT_USER: UserData = { name: 'Instructor', avatarUrl: undefined };
const EMPTY_ANALYTICS = {
  patients: EMPTY_ROWS as Awaited<ReturnType<typeof instructorService.getPatientAnalytics>>,
  questions: EMPTY_ROWS as KeyQuestionCoverage[],
  dtps: EMPTY_ROWS as DTPCoverage[],
  recommendations: EMPTY_ROWS as RecommendationCoverage[],
  warning: null as string | null,
};
const EMPTY_DETAILS = {
  questions: EMPTY_ROWS as KeyQuestionAnalytics[], dtps: EMPTY_ROWS as DTPAnalytics[],
  recommendations: EMPTY_ROWS as RecommendationAnalytics[], progress: EMPTY_ROWS as StudentProgressData[],
};

export function useSimulationGroupData({
  groupId, organizationId, role, activeSection = 'analytics',
}: UseSimulationGroupDataParams): UseSimulationGroupDataReturn {
  const [analyticsDateRange, setAnalyticsDateRange] = useState({ start: '', end: '' });
  const [selection, setSelection] = useState<{ groupId: string | undefined; patientId: string }>({ groupId, patientId: 'overview' });
  const selectedPatientId = selection.groupId === groupId ? selection.patientId : 'overview';
  const setSelectedPatientId = (patientId: string) => setSelection({ groupId, patientId });
  const analyticsActive = activeSection === 'analytics';

  const loadGroup = useCallback(async () => {
    if (!groupId) return undefined;
    if (role === 'admin') {
      const group = await adminApi.getSimulationGroup(groupId, organizationId);
      if (!group) throw new Error('Simulation group not found or unavailable.');
      return { ...group, subtitle: 'Medical Simulation Group' };
    }
    const group = await instructorService.getSimulationGroup(groupId);
    if (!group) throw new Error('Simulation group not found or unavailable.');
    return group;
  }, [groupId, organizationId, role]);
  const [simulationGroup, setSimulationGroup, loading, error] = useAsyncResource<any>(
    `${role}:${organizationId || ''}:${groupId}`, Boolean(groupId), loadGroup, undefined
  );

  const loadUser = useCallback(async () => role === 'admin'
    ? mockAdminDataService.getCurrentUser() : instructorService.getCurrentUser(), [role]);
  const [user] = useAsyncResource(role, true, loadUser, DEFAULT_USER);

  const loadPatients = useCallback(() => instructorService.getManageablePatients(groupId!), [groupId]);
  const [manageablePatients, setManageablePatients, patientsLoading, patientsError] = useAsyncResource<any[]>(
    groupId || '', Boolean(groupId), loadPatients, EMPTY_ROWS
  );
  const reloadPatients = async () => {
    if (!groupId) return;
    try { setManageablePatients(await loadPatients()); }
    catch (err) { console.error('Failed to reload patients:', err); }
  };

  const loadStudents = useCallback(() => instructorService.getStudents(groupId!), [groupId]);
  const [students, , studentsLoading, studentsError] = useAsyncResource<any[]>(
    groupId || '', Boolean(groupId) && (activeSection === 'students' || activeSection === 'viewStudent'), loadStudents, EMPTY_ROWS
  );
  const loadPhotos = useCallback(() => instructorService.fetchProfilePictures(groupId!), [groupId]);
  const [profilePictures, setProfilePictures] = useAsyncResource(
    groupId || '', Boolean(groupId) && (activeSection === 'patients' || activeSection === 'editPatient'), loadPhotos, EMPTY_PHOTOS
  );

  // One path serves initial charts and date changes. Metadata updates no longer
  // re-fetch every chart; reopening Analytics revalidates its last result.
  const loadAnalytics = useCallback(async () => {
    const args = [groupId!, analyticsDateRange.start, analyticsDateRange.end] as const;
    const [patients, questions, dtps, recommendations] = await Promise.allSettled([
      instructorService.getPatientAnalytics(...args), instructorService.getKeyQuestionCoverage(...args),
      instructorService.getDTPCoverage(...args), instructorService.getRecommendationCoverage(...args),
    ]);
    return {
      patients: patients.status === 'fulfilled' ? patients.value : EMPTY_ROWS,
      questions: questions.status === 'fulfilled' ? questions.value : EMPTY_ROWS,
      dtps: dtps.status === 'fulfilled' ? dtps.value : EMPTY_ROWS,
      recommendations: recommendations.status === 'fulfilled' ? recommendations.value : EMPTY_ROWS,
      warning: [patients, questions, dtps, recommendations].some(r => r.status === 'rejected')
        ? 'Some analytics could not be loaded. Reopen Analytics to retry.' : null,
    };
  }, [groupId, analyticsDateRange.start, analyticsDateRange.end]);
  const analyticsKey = `${groupId}:${analyticsDateRange.start}:${analyticsDateRange.end}`;
  const [analytics, , analyticsLoading, analyticsError] = useAsyncResource(
    analyticsKey, Boolean(groupId) && analyticsActive, loadAnalytics, EMPTY_ANALYTICS
  );

  const currentPatientId = analytics.patients.find(p => p.patient_id === selectedPatientId)?.patient_id;
  const loadDetails = useCallback(async () => {
    const args = [groupId!, currentPatientId!, analyticsDateRange.start, analyticsDateRange.end] as const;
    const [questions, dtps, recommendations, progress] = await Promise.allSettled([
      instructorService.getPatientKeyQuestionAnalytics(...args), instructorService.getPatientDTPAnalytics(...args),
      instructorService.getPatientRecommendationAnalytics(...args), instructorService.getStudentProgress(...args),
    ]);
    return {
      questions: questions.status === 'fulfilled' ? questions.value : EMPTY_ROWS,
      dtps: dtps.status === 'fulfilled' ? dtps.value : EMPTY_ROWS,
      recommendations: recommendations.status === 'fulfilled' ? recommendations.value : EMPTY_ROWS,
      progress: progress.status === 'fulfilled' ? progress.value : EMPTY_ROWS,
    };
  }, [groupId, currentPatientId, analyticsDateRange.start, analyticsDateRange.end]);
  const [details] = useAsyncResource(
    `${analyticsKey}:${currentPatientId}`, Boolean(groupId && currentPatientId) && analyticsActive, loadDetails, EMPTY_DETAILS
  );

  return {
    simulationGroup, patientAnalytics: analytics.patients, students, manageablePatients, profilePictures,
    keyQuestionCoverage: analytics.questions, dtpCoverage: analytics.dtps, recommendationCoverage: analytics.recommendations,
    labels: instructorService.getOrganizationLabels(groupId || '1'), user, loading, error,
    patientsLoading, studentsLoading, analyticsLoading, patientsError, studentsError,
    analyticsError: analyticsError || analytics.warning,
    analyticsDateRange, setAnalyticsDateRange,
    keyQuestionAnalytics: details.questions, dtpAnalytics: details.dtps,
    recommendationAnalytics: details.recommendations, studentProgress: details.progress,
    selectedPatientId, setSelectedPatientId, setManageablePatients, setSimulationGroup,
    setProfilePictures, reloadPatients,
  };
}
