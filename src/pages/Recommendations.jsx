import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Film, Tv, Music, Heart, Search, Compass, ArrowLeft, Globe2, Layers, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import CinematicBackground from '../components/CinematicBackground';
import RecommendationCard from '../components/RecommendationCard';
import { useMood } from '../context/MoodContext';
import { getRecommendationsByMood, calculateMatchScore, mediaCatalog } from '../data/recommendationsData';
import { hasCompletedMoodProfile } from '../utils/moodProfile';

export default function Recommendations() {
  const { moodProfile, savedItems } = useMood();
  const hasProfile = hasCompletedMoodProfile(moodProfile);
  const [activeTab, setActiveTab] = useState(() => (hasProfile ? 'for-you' : 'all')); // 'for-you' | 'all' | 'movie' | 'series' | 'anime' | 'music' | 'saved'
  const [searchQuery, setSearchQuery] = useState('');
  const [isReady, setIsReady] = useState(false);
  const timerRef = useRef(null);

  // Show spinner on mount and on every tab change — cleared after 650 ms
  useEffect(() => {
    setIsReady(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsReady(true), 650);
    return () => clearTimeout(timerRef.current);
  }, [activeTab]);

  const currentMoodId = moodProfile?.mood || 'calm';
  const displayedMoodName = moodProfile?.moodName;

  // Human-readable labels for categories
  const categoryNames = {
    all: 'All',
    movie: 'Movies',
    series: 'Series',
    anime: 'Anime',
    music: 'Music',
  };

  // Compute items list based on mood and active tab
  // For 'for-you' and 'saved', single list is maintained.
  // For 'movie', 'series', 'anime', 'music', 'all':
  // - SECTION 1 ("Matched to Your Mood"):
  //     * Strict language filter: if preferredLanguage is set, ONLY show items in that language (not a mix).
  //     * Deduplication by title: if same title exists in multiple versions, only keep the single preferred-language/highest-scoring version.
  //     * Up to 10 items (or fewer if fewer matches exist, without padding).
  //     * If no language preference, falls back to pure mood-based ranking with title deduplication.
  // - SECTION 2 ("Rest of [Category]"): Remaining items in category in default catalog order.
  const { moodMatchedItems, restItems, isSplitView } = useMemo(() => {
    if (activeTab === 'for-you' || activeTab === 'saved') {
      const singleList = activeTab === 'saved'
        ? savedItems
        : getRecommendationsByMood(currentMoodId, 'for-you', moodProfile);
      return { moodMatchedItems: singleList, restItems: [], isSplitView: false };
    }

    // 1. Get all items in this category from catalog (preserving default catalog order)
    const categoryCatalog = activeTab === 'all'
      ? mediaCatalog
      : mediaCatalog.filter((item) => item.type === activeTab);

    const preferredLanguage = moodProfile?.languagePreference;

    // 2. Filter pool for Section 1:
    // If preferred language set, strictly filter to items in that language; otherwise use full category catalog
    const eligiblePool = preferredLanguage
      ? categoryCatalog.filter((item) => item.language === preferredLanguage)
      : categoryCatalog;

    // 3. Score and sort eligible pool by 6-factor calculateMatchScore
    const scoredCategoryItems = eligiblePool.map((item) => {
      const scoreData = calculateMatchScore(item, moodProfile, { includeLanguage: true });
      return {
        ...item,
        matchScoreData: scoreData,
        matchScore: scoreData.scorePercent,
        matchScore5: scoreData.scoreOutOf5,
        formattedScore: scoreData.formattedScore,
        matchExplanation: scoreData.contributors.slice(0, 2).join(' '),
        sortRank: scoreData.scorePercent,
        rawScore: scoreData.rawScore,
      };
    }).sort((a, b) => b.rawScore - a.rawScore || a.title.localeCompare(b.title));

    // 4. Section 1: Top items up to 10, deduplicated by base title
    // If the same title exists in multiple language versions, only the highest-scoring matching version is included
    const seenTitles = new Set();
    const topItems = [];
    for (const item of scoredCategoryItems) {
      const normTitle = (item.title || '').trim().toLowerCase();
      if (!seenTitles.has(normTitle)) {
        seenTitles.add(normTitle);
        topItems.push(item);
        if (topItems.length >= 10) break;
      }
    }

    const topItemIds = new Set(topItems.map((item) => item.id));

    // 5. Section 2: Remaining items in this category in default catalog order
    const remainingInCatalogOrder = categoryCatalog.filter((item) => !topItemIds.has(item.id));

    return {
      moodMatchedItems: topItems,
      restItems: remainingInCatalogOrder,
      isSplitView: true,
    };
  }, [currentMoodId, activeTab, savedItems, moodProfile]);

  // Helper filter function for search
  const filterByQuery = (list) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.genres && item.genres.some((g) => g.toLowerCase().includes(q))) ||
        (item.artist && item.artist.toLowerCase().includes(q)) ||
        (item.director && item.director.toLowerCase().includes(q)) ||
        (item.language && item.language.toLowerCase().includes(q))
    );
  };

  // Filtered lists for rendering
  const filteredMoodMatched = useMemo(() => filterByQuery(moodMatchedItems), [moodMatchedItems, searchQuery]);
  const filteredRest = useMemo(() => filterByQuery(restItems), [restItems, searchQuery]);
  const totalFilteredCount = filteredMoodMatched.length + filteredRest.length;

  // Category & Tab counts
  const forYouCount = useMemo(() => getRecommendationsByMood(currentMoodId, 'for-you', moodProfile).length, [currentMoodId, moodProfile]);
  const allCount = useMemo(() => mediaCatalog.length, []);
  const moviesCount = useMemo(() => mediaCatalog.filter((item) => item.type === 'movie').length, []);
  const seriesCount = useMemo(() => mediaCatalog.filter((item) => item.type === 'series').length, []);
  const animeCount = useMemo(() => mediaCatalog.filter((item) => item.type === 'anime').length, []);
  const musicCount = useMemo(() => mediaCatalog.filter((item) => item.type === 'music').length, []);

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

        {/* Results Gallery */}
        <div className="relative mt-8">

          {/* Loading overlay — visible while computing/rendering, fades once isReady */}
          <div
            className={`absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-[#05060a]/80 backdrop-blur-sm transition-opacity duration-400 ${
              isReady ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
            style={{ minHeight: '220px' }}
          >
            <Loader2 size={36} className="animate-spin text-purple-400" />
            <p className="mt-4 text-xs font-medium text-white/40 tracking-wide">Finding your recommendations…</p>
          </div>

          {/* Content — fades in after ready */}
          <div className={`transition-opacity duration-400 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
          {totalFilteredCount === 0 ? (
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
          ) : isSplitView ? (
            <div className="space-y-12">
              {/* SECTION 1: Matched to Your Mood (Top 10 ranked purely by mood score) */}
              {filteredMoodMatched.length > 0 && (
                <section>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-2 mb-6">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 shadow-sm shadow-purple-900/30">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                          Matched to Your Mood
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {filteredMoodMatched.length}
                          </span>
                        </h2>
                        <p className="text-xs text-white/50">
                          Top recommendations ranked by 6-factor mood compatibility, energy, emotional need, and quality
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                    {filteredMoodMatched.map((item, idx) => (
                      <RecommendationCard key={item.id} item={item} index={idx} />
                    ))}
                  </div>
                </section>
              )}

              {/* SECTION 2: Rest of [Category Name] (All remaining items in catalog order) */}
              {filteredRest.length > 0 && (
                <section className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-2 mb-6">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-white/70 shadow-sm">
                        <Layers size={16} />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                          Rest of {categoryNames[activeTab] || 'Catalog'}
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/10">
                            {filteredRest.length}
                          </span>
                        </h2>
                        <p className="text-xs text-white/50">
                          Explore all remaining titles in default catalog order
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                    {filteredRest.map((item, idx) => (
                      <RecommendationCard key={item.id} item={item} index={idx} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* Single section view for 'for-you' and 'saved' */
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              {filteredMoodMatched.map((item, idx) => (
                <RecommendationCard key={item.id} item={item} index={idx} />
              ))}
            </div>
          )}
          </div>
        </div>

      </main>

      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>
    </div>
  );
}
