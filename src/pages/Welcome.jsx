import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, MessageSquare } from 'lucide-react';
import Navbar from '../components/Navbar';
import CinematicBackground from '../components/CinematicBackground';
import { useMood } from '../context/MoodContext';
import { moodModel } from '../utils/moodModel';

export default function Welcome() {
  const navigate = useNavigate();
  const { user, updateMoodProfile } = useMood();

  const handleInstantPick = (moodObj) => {
    updateMoodProfile({
      mood: moodObj.id,
      moodName: moodObj.name,
      shortName: moodObj.shortName,
      valence: moodObj.valence,
      energy: moodObj.energy,
      primaryColor: moodObj.primaryColor,
      badgeClass: moodObj.badgeClass,
      description: moodObj.description,
      emotionalNeed: moodObj.emotionalNeed,
      suggestedMediaStyle: moodObj.suggestedMediaStyle,
      contentPreference: 'all',
      genrePreference: [],
      userIntent: null,
      languagePreference: 'English',
      confidence: 88,
      extractedSignals: moodObj.keywords.slice(0, 3),
      analyzedAt: new Date().toISOString()
    });
    navigate('/recommendations');
  };

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      <CinematicBackground />
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Welcome Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-300 backdrop-blur-md">
            <Sparkles size={14} className="text-purple-400" />
            <span>Welcome, {user?.name || 'Explorer'}</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-white">
            Let's find entertainment that <br />
            <span className="text-gradient-cinematic">feels right for you today.</span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-white/55 sm:text-lg">
            MoodMate discovers what you should watch or listen to by understanding your state of mind through a brief, comfortable AI conversation.
          </p>

          {/* Primary CTA right below hero content — no scrolling required */}
          <div className="mt-8 flex items-center justify-center">
            <button
              onClick={() => navigate('/chat')}
              className="group flex items-center justify-center gap-3 rounded-full bg-white px-9 py-4 text-sm font-semibold text-black shadow-2xl shadow-white/10 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <MessageSquare size={17} className="text-black" />
              <span>Start Conversation with AI</span>
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* 3-Step Journey Architecture Cards (Secondary Context) */}
        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0b12]/80 p-6 backdrop-blur-xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300 font-bold text-xs">
              01
            </div>
            <h3 className="mt-4 text-sm font-semibold text-white">1. Conversational Chat</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">
              Tell our assistant what's on your mind. We extract emotional nuances, stress signals, and energy levels.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0b12]/80 p-6 backdrop-blur-xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 font-bold text-xs">
              02
            </div>
            <h3 className="mt-4 text-sm font-semibold text-white">2. Affective Modeling</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">
              We map your input onto the Circumplex Affective Model (Valence & Energy) to pinpoint your core emotional need.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0a0b12]/80 p-6 backdrop-blur-xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300 font-bold text-xs">
              03
            </div>
            <h3 className="mt-4 text-sm font-semibold text-white">3. Tailored Media</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">
              Get an instant curated suite of recognizable Movies, TV Shows, Anime, and Music with "Why this fits" explainers.
            </p>
          </div>
        </div>

        {/* Alternative: Instant Vibe Picker */}
        <div className="mt-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">
            Or choose a state directly for instant recommendations
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {moodModel.moods.map((m) => (
              <button
                key={m.id}
                onClick={() => handleInstantPick(m)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-white/70 transition hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-white"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 px-4 text-[11px] text-white/25">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          {/* Bottom-left: nav-pill-style links */}
          <nav className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 shadow-inner backdrop-blur-md">
            <a
              href="/about"
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-white/60 transition-all hover:text-white hover:bg-white/[0.04]"
            >
              About Us
            </a>
            <span className="text-white/15 select-none">·</span>
            <a
              href="/terms"
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-white/60 transition-all hover:text-white hover:bg-white/[0.04]"
            >
              Terms &amp; Conditions
            </a>
          </nav>
          <span>MoodMate · Affective Discovery Platform</span>
        </div>
      </footer>
    </div>
  );
}
