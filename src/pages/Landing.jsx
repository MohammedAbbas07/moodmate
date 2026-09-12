import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles, Film, Tv, Music, Play, CheckCircle2, Sliders, Database, Brain, Globe2, Layers } from 'lucide-react';
import Navbar from '../components/Navbar';
import CinematicBackground from '../components/CinematicBackground';
import { moodModel } from '../utils/moodModel';
import { mediaCatalog } from '../data/recommendationsData';
import { useMood } from '../context/MoodContext';

export default function Landing() {
  const navigate = useNavigate();
  const { updateMoodProfile } = useMood();
  const [selectedDemoMood, setSelectedDemoMood] = useState('calm');

  const demoMoodData = moodModel.moods.find((m) => m.id === selectedDemoMood) || moodModel.moods[0];
  const demoPreviewItems = mediaCatalog.filter((item) => item.moodTags.includes(selectedDemoMood)).slice(0, 4);

  const handleStartWithDemo = (moodObj) => {
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
      confidence: 92,
      extractedSignals: moodObj.keywords.slice(0, 3),
      analyzedAt: new Date().toISOString()
    });
    navigate('/recommendations');
  };

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      {/* Cinematic Parallax Background */}
      <CinematicBackground />

      {/* Top Navbar */}
      <Navbar />

      {/* Hero Section */}
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
        
        {/* Main Hero Header */}
        <div className="mx-auto max-w-4xl text-center">
          
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-300 backdrop-blur-xl shadow-lg shadow-purple-950/20"
          >
            <Sparkles size={13} className="text-purple-400" />
            <span>Mood-Aware Recommendations</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl leading-[1.06]"
          >
            Your current mood.
            <br />
            <span className="text-gradient-cinematic">
              Your next experience.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg"
          >
            Have a brief conversation with MoodMate. We translate your natural thoughts into emotional intelligence to recommend Movies, Series, Anime, and Music tailored to your exact state of mind.
          </motion.p>

          {/* Single Primary CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex items-center justify-center"
          >
            <button
              onClick={() => navigate('/login')}
              className="group flex items-center justify-center gap-3 rounded-full bg-white px-9 py-4 text-sm font-semibold text-black shadow-2xl shadow-white/10 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span>Begin Mood Journey</span>
              <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* Media Categories Ticker */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-12 flex items-center justify-center gap-6 text-xs font-semibold tracking-widest text-white/30 uppercase"
          >
            <span className="flex items-center gap-1.5"><Film size={13} /> MOVIES</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Tv size={13} /> TV SERIES</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Sparkles size={13} /> ANIME</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Music size={13} /> MUSIC</span>
          </motion.div>
        </div>

        {/* Interactive Live Mood Simulator */}
        <section className="mt-20 rounded-3xl border border-white/[0.08] bg-[#07080c]/80 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
          <div className="border-b border-white/[0.07] pb-6">
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">
              Interactive Preview
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl text-white">
              Experience How Recommendations Adapt
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Select an emotional state to preview how our affective matching engine personalizes recommendations.
            </p>
          </div>

          {/* Mood Selector Chips */}
          <div className="mt-6 flex flex-wrap gap-2.5">
            {moodModel.moods.map((m) => {
              const isSelected = selectedDemoMood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedDemoMood(m.id)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'border border-purple-500 bg-purple-500/20 text-white shadow-lg shadow-purple-500/10'
                      : 'border border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          {/* Dynamic Mood Description Banner */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 font-bold text-sm">
                  {Math.round(demoMoodData.valence * 100)}%
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{demoMoodData.name}</h3>
                  <p className="text-xs text-white/50">{demoMoodData.emotionalNeed}</p>
                </div>
              </div>

              <div className="text-xs text-purple-300/80 max-w-md">
                {demoMoodData.suggestedMediaStyle}
              </div>
            </div>
          </div>

          {/* Preview Media Grid — Direct action to recommendations */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {demoPreviewItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleStartWithDemo(demoMoodData)}
                className="group cursor-pointer overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0b12] p-2.5 transition-all duration-300 hover:border-purple-500/40 hover:-translate-y-1"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-white/5">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    {item.type}
                  </span>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={24} className="fill-white text-white" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <p className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-white/40 truncate">
                    {item.genres ? item.genres[0] : item.artist}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Value Grid */}
        <section className="mt-24 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
              <Sliders size={20} />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">Affective Valence & Arousal</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Our engine models emotional positivity and cognitive energy dynamically from your conversational check-in.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              <Sparkles size={20} />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">Unified Cross-Media Suite</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Discover synchronized titles across Movies, TV Series, Anime, and Music in a single cohesive experience.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300">
              <CheckCircle2 size={20} />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">Actionable & Explainable</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Transparent compatibility scores and direct streaming links allow you to enjoy your curated titles immediately.
            </p>
          </div>
        </section>

        {/* Research & Methodological Foundations Section */}
        <section className="mt-28">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">
              Methodological Foundations
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Grounded in Affective Computing Research
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Our prototype architecture draws inspiration from established emotion taxonomies and recommendation science.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-white/[0.07] bg-[#07080c]/90 p-5 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
                <Brain size={18} />
              </div>
              <h4 className="mt-3.5 text-sm font-semibold text-white">GoEmotions</h4>
              <p className="mt-1.5 text-xs text-white/45 leading-relaxed">
                Informed by 27 fine-grained human emotion categories to capture subtle conversational signals beyond binary polarity.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#07080c]/90 p-5 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                <Sliders size={18} />
              </div>
              <h4 className="mt-3.5 text-sm font-semibold text-white">Valence–Arousal</h4>
              <p className="mt-1.5 text-xs text-white/45 leading-relaxed">
                Russell's Circumplex Model maps feelings along continuous Pleasantness and Physiological Energy dimensions.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#07080c]/90 p-5 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300">
                <Database size={18} />
              </div>
              <h4 className="mt-3.5 text-sm font-semibold text-white">MovieLens</h4>
              <p className="mt-1.5 text-xs text-white/45 leading-relaxed">
                Tag-genome and quality baseline principles inspired by standard collaborative filtering recommendation benchmarks.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#07080c]/90 p-5 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                <Layers size={18} />
              </div>
              <h4 className="mt-3.5 text-sm font-semibold text-white">Affective Ranking</h4>
              <p className="mt-1.5 text-xs text-white/45 leading-relaxed">
                6-factor transparent formula synthesizing Mood, Energy, Need, Format, Intent, and Quality into a 5-star match score.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#07080c]/90 p-5 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <Globe2 size={18} />
              </div>
              <h4 className="mt-3.5 text-sm font-semibold text-white">Language Synergy</h4>
              <p className="mt-1.5 text-xs text-white/45 leading-relaxed">
                Personalized multilingual ranking celebrating English, Hindi, Tamil, Telugu, and Malayalam cultural media contexts.
              </p>
            </div>
          </div>

          {/* User Preference Study Insights Box */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400/80">
                  User Preference Study
                </span>
                <h3 className="mt-1 text-sm font-semibold text-white">
                  Solving Media Fatigue Through Affective Matching
                </h3>
                <p className="mt-1 text-xs text-white/50 max-w-3xl leading-relaxed">
                  Catalog overload and decision paralysis frequently occur when users are emotionally exhausted. By replacing manual keyword browsing with empathetic conversational sentiment discovery, MoodMate significantly lowers cognitive load.
                </p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                  <Sparkles size={12} />
                  <span>Cognitive Ease by Design</span>
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#05060a] py-6 text-xs text-white/35">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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

          {/* Right: branding text */}
          <div className="flex items-center gap-2 font-semibold text-white/50">
            <Sparkles size={13} className="text-purple-400/60" />
            <span>MoodMate · Personalized Multimedia Recommendation Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
