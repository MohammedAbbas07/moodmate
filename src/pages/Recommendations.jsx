import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Film, Tv, Music, Heart, Search, Compass, ArrowLeft, Globe2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import CinematicBackground from '../components/CinematicBackground';
import RecommendationCard from '../components/RecommendationCard';
import { useMood } from '../context/MoodContext';
import { getRecommendationsByMood } from '../data/recommendationsData';
import { hasCompletedMoodProfile } from '../utils/moodProfile';

export default function Recommendations() {
  const { moodProfile, savedItems } = useMood();
  const hasProfile = hasCompletedMoodProfile(moodProfile);
  const [activeTab, setActiveTab] = useState(() => (hasProfile ? 'for-you' : 'all')); // 'for-you' | 'all' | 'movie' | 'series' | 'anime' | 'music' | 'saved'
  const [searchQuery, setSearchQuery] = useState('');

  const currentMoodId = moodProfile?.mood || 'calm';
  const displayedMoodName = moodProfile?.moodName;

  // Compute items list based on mood and active tab
  const items = useMemo(() => {
    if (activeTab === 'saved') {
      return savedItems;
    }
    return getRecommendationsByMood(currentMoodId, activeTab, moodProfile);
  }, [currentMoodId, activeTab, savedItems, moodProfile]);

  // Apply search query filter
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.genres && item.genres.some((g) => g.toLowerCase().includes(q))) ||
        (item.artist && item.artist.toLowerCase().includes(q)) ||
        (item.director && item.director.toLowerCase().includes(q)) ||
        (item.language && item.language.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Category & Tab counts
  const forYouCount = useMemo(() => getRecommendationsByMood(currentMoodId, 'for-you', moodProfile).length, [currentMoodId, moodProfile]);
  const allCount = useMemo(() => getRecommendationsByMood(currentMoodId, 'all', moodProfile).length, [currentMoodId, moodProfile]);
  const moviesCount = useMemo(() => getRecommendationsByMood(currentMoodId, 'movie', moodProfile).length, [currentMoodId, moodProfile]);
  const seriesCount = useMemo(() => getRecommendationsByMood(currentMoodId, 'series', moodProfile).length, [currentMoodId, moodProfile]);
  const animeCount = useMemo(() => getRecommendationsByMood(currentMoodId, 'anime', moodProfile).length, [currentMoodId, moodProfile]);
  const musicCount = useMemo(() => getRecommendationsByMood(currentMoodId, 'music', moodProfile).length, [currentMoodId, moodProfile]);

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      <CinematicBackground />
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Mood Header Banner */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#07080c]/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                  <Sparkles size={12} />
                  <span>{hasProfile ? `Personalized for ${displayedMoodName}` : 'Browse the catalog'}</span>
                </span>
                
                {hasProfile && moodProfile.languagePreference && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70">
                    <Globe2 size={12} className="text-purple-300" />
                    <span>{moodProfile.languagePreference} Focus</span>
                  </span>
                )}

                <span className="text-xs text-white/40">
                  {hasProfile ? `${moodProfile.confidence}% Engine Confidence` : 'Complete the chat for a personalized profile'}
                </span>
              </div>

              <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight sm:text-4xl text-white">
                Here is what feels right for you today
              </h1>

              <p className="mt-2 text-sm text-white/55 max-w-2xl">
                {hasProfile ? moodProfile.suggestedMediaStyle : 'Complete the eight-question chat when you want recommendations tailored to your current mood.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/80 hover:border-white/20 hover:text-white transition"
              >
                <ArrowLeft size={14} />
                <span>Retake Chat</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Filter Navigation & Search Bar */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Format Tabs: For You (Default), All, Movies, Series, Anime, Music, Saved */}
          <div className="flex w-full md:w-auto items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none rounded-2xl border border-white/[0.07] bg-[#0a0b12]/80 p-1.5 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('for-you')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'for-you'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Sparkles size={14} className={activeTab === 'for-you' ? 'text-white' : 'text-purple-400'} />
              <span>For You ({forYouCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Compass size={14} />
              <span>All ({allCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('movie')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'movie'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Film size={14} />
              <span>Movies ({moviesCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('series')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'series'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Tv size={14} />
              <span>Series ({seriesCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('anime')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'anime'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Sparkles size={14} />
              <span>Anime ({animeCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('music')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'music'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Music size={14} />
              <span>Music ({musicCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'saved'
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Heart size={14} className={savedItems.length > 0 ? 'text-pink-300 fill-pink-300/30' : ''} />
              <span>Saved ({savedItems.length})</span>
            </button>
          </div>

          {/* Search Input Box */}
          <div className="relative w-full md:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, genre, artist, language..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-4 text-xs text-white placeholder-white/25 outline-none transition focus:border-purple-500/50 focus:bg-white/[0.06]"
            />
          </div>
        </div>

        {/* Results Gallery Grid */}
        <div className="mt-8">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              {filteredItems.map((item, idx) => (
                <RecommendationCard key={item.id} item={item} index={idx} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/[0.08] bg-[#0a0b12]/60 py-16 px-6 text-center backdrop-blur-xl">
              <Compass size={32} className="mx-auto text-white/30" />
              <h3 className="mt-4 text-base font-semibold text-white">No matches found</h3>
              <p className="mt-1 text-xs text-white/40 max-w-sm mx-auto">
                {activeTab === 'saved'
                  ? 'You have not saved any items yet. Click the heart on any card to build your personal watchlist.'
                  : 'Try adjusting your search query or switching to another category.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-purple-300 hover:bg-white/10"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>

      </main>

      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>
    </div>
  );
}
