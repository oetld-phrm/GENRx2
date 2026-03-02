import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import PatientsPage from './pages/student/PatientsPage';
import PatientDashboardPage from './pages/student/PatientDashboardPage';
import StudentChatPage from './pages/student/StudentChatPage';
import { validateConfig } from './config/aws-config';

// Validate configuration on app load
if (import.meta.env.DEV) {
  if (validateConfig()) {
    console.log('✅ AWS configuration is valid');
  } else {
    console.warn('⚠️ AWS configuration is incomplete. Some features may not work.');
    console.warn('Run: npm run setup (or check .env file)');
  }
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/" element={<StudentDashboardPage />} />
        <Route path="/patients/:groupId" element={<PatientsPage />} />
        <Route path="/patients/:groupId/:patientId" element={<PatientDashboardPage />} />
        <Route path="/patients/:groupId/:patientId/chat" element={<StudentChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
