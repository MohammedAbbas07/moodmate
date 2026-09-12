import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MoodProvider } from './context/MoodContext';
import ScrollToTop from './components/ScrollToTop';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Chat from './pages/Chat';
import MoodAnalysis from './pages/MoodAnalysis';
import Recommendations from './pages/Recommendations';
import Details from './pages/Details';
import AboutUs from './pages/AboutUs';
import TermsAndConditions from './pages/TermsAndConditions';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <MoodProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Landing / Home */}
          <Route path="/" element={<Landing />} />

          {/* Authentication / Entry */}
          <Route path="/login" element={<Login />} />

          {/* Welcome / Onboarding */}
          <Route path="/welcome" element={<Welcome />} />

          {/* Conversational Mood AI Chatbot */}
          <Route path="/chat" element={<Chat />} />

          {/* Affective Mood Analysis Dashboard */}
          <Route path="/mood-analysis" element={<MoodAnalysis />} />

          {/* Personalized Multimedia Recommendations */}
          <Route path="/recommendations" element={<Recommendations />} />

          {/* Dynamic Item Details */}
          <Route path="/details/:id" element={<Details />} />

          {/* About Us */}
          <Route path="/about" element={<AboutUs />} />

          {/* Terms & Conditions */}
          <Route path="/terms" element={<TermsAndConditions />} />

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </MoodProvider>
  );
}

