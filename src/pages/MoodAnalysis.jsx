import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, RefreshCw, Heart, Zap, CheckCircle, Info, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import CinematicBackground from '../components/CinematicBackground';
import ScrollDownIndicator from '../components/ScrollDownIndicator';
import { useMood } from '../context/MoodContext';
import { hasCompletedMoodProfile } from '../utils/moodProfile';

export default function MoodAnalysis() {
  const navigate = useNavigate();
  const { moodProfile } = useMood();
  const hasProfile = hasCompletedMoodProfile(moodProfile);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [isFindingRecs, setIsFindingRecs] = useState(false);

  useEffect(() => {
    // Spinner displays until mood data is loaded, then smoothly fades out
    const timer = setTimeout(() => {
      setIsAnalyzing(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  const handleGoToRecommendations = () => {
    setIsFindingRecs(true);
    setTimeout(() => {
      navigate('/recommendations');
    }, 850);
  };

  // Gate: only show the full mood profile when the user completed the chatbot
  // this session (same pattern as Recommendations.jsx). This prevents stale
  // localStorage-restored profile data from a previous session from surfacing.
  const sessionProfileSet =
    typeof sessionStorage !== 'undefined' &&
    !!sessionStorage.getItem('moodmate_session_profile_set');

  if (!sessionProfileSet) {
    return (
      <div className="relative min-h-screen bg-[#030308] text-white flex flex-col justify-between">
        <CinematicBackground />
        <Navbar />
        <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-purple-500/30 bg-[#05060a]/75 p-8 sm:p-12 backdrop-blur-xl shadow-2xl shadow-purple-950/30 max-w-md w-full flex flex-col items-center">
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-purple-500/40 bg-purple-500/15 shadow-[0_0_40px_6px_rgba(168,85,247,0.3)] mb-8">
              <Sparkles size={36} className="text-purple-400" strokeWidth={1.5} />
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Complete the AI chatbot first
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/50 max-w-xs">
              Your Mood Profile is generated after the eight-question check-in. Take the chatbot to see your personalised emotional analysis.
            </p>

            <button
              onClick={() => navigate('/chat')}
              className="mt-10 group flex items-center gap-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-purple-500/40 transition hover:brightness-110 hover:shadow-purple-500/60 hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Take the mood chatbot</span>
            </button>
          </div>
        </main>
        <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
          MoodMate · Affective Discovery Platform
        </footer>
      </div>
    );
  }

  // Legacy guard: if session flag is set but context profile is somehow null (edge case), fall back gracefully
  if (!moodProfile) {
    return (
      <div className="relative min-h-screen bg-[#030308] text-white flex flex-col justify-between">
        <CinematicBackground />
        <Navbar />
        <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-purple-500/30 bg-[#05060a]/75 p-8 sm:p-12 backdrop-blur-xl shadow-2xl shadow-purple-950/30 max-w-md w-full">
            <h1 className="text-3xl font-bold text-white">Complete the chatbot first</h1>
            <p className="mt-4 text-sm text-white/60">Your mood profile will appear after the eight-question check-in.</p>
            <button
              onClick={() => navigate('/chat')}
              className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              Start the chatbot
            </button>
          </div>
        </main>
      </div>
    );
  }

  const valencePercent = hasProfile ? Math.round(moodProfile.valence * 100) : null;
  const energyPercent = hasProfile ? Math.round(moodProfile.energy * 100) : null;
  const displayedMoodName = hasProfile ? moodProfile.moodName : 'No mood profile yet';

  const valence = moodProfile?.valence ?? 0.5;
  const energy = moodProfile?.energy ?? 0.5;

  let moodInsight = '';
  if (valence >= 0.5 && energy >= 0.5) {
    moodInsight = "You're energized and ready — seek dynamic, high-paced content";
  } else if (valence >= 0.5 && energy < 0.5) {
    moodInsight = "You're in a positive, calm space — cozy, feel-good content fits perfectly";
  } else if (valence < 0.5 && energy >= 0.5) {
    moodInsight = "You're tense but engaged — thrilling content can help channel that energy";
  } else {
    moodInsight = "You need comfort and restoration — gentle, soothing content is your match";
  }

  // Convert the existing valence and energy percentages into readable state badges.
  // Thresholds follow the requested emotional-state ranges and remain hidden before assessment.
  const valenceState = valencePercent < 40
    ? { label: 'Anxious', className: 'bg-orange-500/15 text-orange-300 border-orange-400/25' }
    : valencePercent <= 60
      ? { label: 'Neutral', className: 'bg-white/10 text-white/65 border-white/15' }
      : { label: 'Positive', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25' };
  const energyState = energyPercent < 30
    ? { label: 'Low', className: 'bg-sky-500/15 text-sky-300 border-sky-400/25' }
    : energyPercent <= 45
      ? { label: 'Calm', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/25' }
      : energyPercent <= 65
        ? { label: 'Balanced', className: 'bg-white/10 text-white/65 border-white/15' }
        : energyPercent <= 80
          ? { label: 'Energetic', className: 'bg-amber-500/15 text-amber-300 border-amber-400/25' }
          : { label: 'High', className: 'bg-orange-500/15 text-orange-300 border-orange-400/25' };

  return (
    <div className="relative min-h-screen bg-[#030308] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      {/* TRANSITION 1: Chat -> Mood Analysis Loading Overlay */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#030308]/80 backdrop-blur-sm transition-opacity duration-500 ${
          isAnalyzing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Loader2 size={46} className="animate-spin text-purple-400" />
        <p className="mt-5 text-sm font-medium text-white/70 tracking-wide">Analyzing your mood...</p>
      </div>

      {/* TRANSITION 2: Mood Profile -> Recommendations Loading Overlay */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#030308]/80 backdrop-blur-sm transition-opacity duration-500 ${
          isFindingRecs ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Loader2 size={46} className="animate-spin text-purple-400" />
        <p className="mt-5 text-sm font-medium text-white/70 tracking-wide">Finding your recommendations...</p>
      </div>

      <CinematicBackground />
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Mood Profile Summary Card */}
        <div className="rounded-3xl border border-purple-500/30 bg-[#05060a]/75 p-6 sm:p-10 backdrop-blur-xl shadow-2xl shadow-purple-950/30 text-center max-w-3xl mx-auto">
          {/* Header Eyebrow */}
          <div className="text-center max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/15 px-4 py-1.5 text-xs font-medium text-purple-300 shadow-sm shadow-purple-500/25 backdrop-blur-md"
            >
              <Sparkles size={14} className="text-purple-400" />
              <span>{hasProfile ? 'Affective Synthesis Complete' : 'Mood Check-In Required'}</span>
            </motion.div>

            <h1 className="mt-4 text-2xl font-bold text-white/70 sm:text-3xl">
              {hasProfile ? 'We understand you are feeling' : 'Complete the chat to create your mood profile'}
            </h1>

            {/* Primary Mood Title with Glow */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-3"
            >
              <span className="text-gradient-cinematic text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight">
                {displayedMoodName}
              </span>
            </motion.div>

            <p className="mt-4 text-sm leading-relaxed text-white/60 max-w-xl mx-auto sm:text-base">
              {hasProfile
                ? moodProfile.description
                : 'Your mood profile will be available after you complete the existing eight-question check-in.'}
            </p>
          </div>

          {/* Mood Insight Summary & Research Grounding */}
          {hasProfile && (
            <div className="mt-8 text-center max-w-2xl mx-auto border-t border-white/[0.08] pt-6">
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-300 tracking-tight leading-snug">
                {moodInsight}
              </p>
              <p className="mt-2 text-xs text-white/40 italic">
                Your mood is mapped using the Valence-Arousal model, a research-backed framework for understanding emotional states.
              </p>
            </div>
          )}
        </div>

        {/* 3-Column Core Metrics Dashboard */}
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          
          {/* Valence Metric */}
          <div className="rounded-2xl border border-purple-500/30 bg-[#05060a]/75 p-6 backdrop-blur-xl shadow-xl shadow-purple-950/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Emotional Valence
              </span>
              <Heart size={16} className="text-pink-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              {hasProfile && (
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${valenceState.className}`}>
                  {valenceState.label}
                </span>
              )}
              <span className="text-3xl font-bold text-white">{hasProfile ? `${valencePercent}%` : '—'}</span>
              <span className="text-xs text-white/40">
                {hasProfile ? (valencePercent >= 60 ? 'Pleasant' : valencePercent <= 40 ? 'Heavy / Subdued' : 'Balanced') : 'Not assessed'}
              </span>
            </div>
            <div className="mt-3 w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full"
                style={{ width: `${valencePercent ?? 0}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/35">
              <span>Unpleasant</span>
              <span>Neutral</span>
              <span>Pleasant</span>
            </div>
          </div>

          {/* Energy Level Metric */}
          <div className="rounded-2xl border border-purple-500/30 bg-[#05060a]/75 p-6 backdrop-blur-xl shadow-xl shadow-purple-950/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Energy Level
              </span>
              <Zap size={16} className="text-amber-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              {hasProfile && (
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${energyState.className}`}>
                  {energyState.label}
                </span>
              )}
              <span className="text-3xl font-bold text-white">{hasProfile ? `${energyPercent}%` : '—'}</span>
              <span className="text-xs text-white/40">
                {hasProfile ? (energyPercent >= 65 ? 'High Energy' : energyPercent <= 35 ? 'Restorative / Low' : 'Moderate') : 'Not assessed'}
              </span>
            </div>
            <div className="mt-3 w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full"
                style={{ width: `${energyPercent ?? 0}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/35">
              <span>Low / Quiet</span>
              <span>Steady</span>
              <span>High Intensity</span>
            </div>
          </div>

          {/* Core Emotional Need */}
          <div className="rounded-2xl border border-purple-500/30 bg-[#05060a]/75 p-6 backdrop-blur-xl shadow-xl shadow-purple-950/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Target Emotional Need
              </span>
              <CheckCircle size={16} className="text-purple-400" />
            </div>
            <div className="mt-4">
              <span className="text-lg font-bold text-white block truncate">
                {hasProfile ? moodProfile.emotionalNeed : 'Not assessed'}
              </span>
              <span className="mt-1 inline-block rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/20">
                {hasProfile ? `${moodProfile.confidence}% Engine Confidence` : 'Complete the chat to assess'}
              </span>
            </div>
            <p className="mt-3 text-[11px] text-white/40">
              Optimal multimedia strategy mapped to your current headspace.
            </p>
          </div>

        </div>

        {/* Disclaimer */}
        <p className="mt-5 text-center text-[11px] text-white/30 leading-relaxed">
          ⚠️ MoodMate&apos;s mood analysis is for entertainment personalization only and is not a substitute for professional mental health assessment.
        </p>

        {/* Conversational Insights & Extracted Signals */}
        <div className="mt-6 rounded-2xl border border-purple-500/30 bg-[#05060a]/75 p-6 backdrop-blur-xl shadow-xl shadow-purple-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Extracted Conversational Signals</h3>
              <p className="text-xs text-white/45 mt-0.5">
                Linguistic and affective indicators captured during your check-in.
              </p>
            </div>

            {/* Signal Badges */}
            <div className="flex flex-wrap gap-2">
              {hasProfile && moodProfile.extractedSignals.length > 0 ? (
                moodProfile.extractedSignals.map((signal, i) => (
                  <span
                    key={i}
                    className="rounded-lg border border-purple-500/35 bg-purple-500/15 px-3 py-1 text-xs font-medium text-purple-300 shadow-sm shadow-purple-500/20"
                  >
                    #{signal}
                  </span>
                ))
              ) : (
                <span className="text-xs text-white/40">No completed assessment signals yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Methodology & Research Note */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-purple-500/30 bg-[#05060a]/75 p-5 backdrop-blur-xl text-xs text-white/50 shadow-lg shadow-purple-950/20">
          <Info size={16} className="text-purple-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white/70">Affective Computing Methodology: </span>
            Our explainable NLP pipeline maps natural conversation to continuous Valence–Arousal dimensions (inspired by Russell's Circumplex Model of Affect) and fine-grained emotional taxonomies (inspired by GoEmotions and MovieLens quality scoring) to ensure recommendations are transparent and emotionally matched.
          </div>
        </div>

        {/* Action Decision Area */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleGoToRecommendations}
            className="flex w-full sm:w-auto items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-semibold text-black shadow-2xl shadow-purple-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>Discover Personalized Recommendations</span>
            <ArrowRight size={17} />
          </button>

          <button
            onClick={() => navigate('/chat')}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-purple-500/30 bg-white/[0.04] px-6 py-4 text-sm font-medium text-white/80 backdrop-blur-md transition-all hover:border-purple-500/50 hover:bg-white/[0.08] hover:text-white hover:shadow-md hover:shadow-purple-500/20 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Retake Conversation</span>
          </button>
        </div>

      </main>

      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>

      <ScrollDownIndicator />
    </div>
  );
}
