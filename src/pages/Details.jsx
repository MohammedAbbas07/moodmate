import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Play, Heart, ExternalLink, Check, Share2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import CinematicBackground from '../components/CinematicBackground';
import RecommendationCard from '../components/RecommendationCard';

import { useMood } from '../context/MoodContext';
import { getItemById, getRelatedItems, calculateMatchScore, buildStreamSearchUrl } from '../data/recommendationsData';

// Resolve the catalog URL to a readable provider label for detail-page actions.
function getProviderName(streamUrl) {
  if (!streamUrl) return 'Unknown Provider';

  try {
    const hostname = new URL(streamUrl).hostname.replace(/^www\./, '');
    if (hostname.includes('netflix')) return 'Netflix';
    if (hostname.includes('primevideo') || hostname.includes('amazon')) return 'Prime Video';
    if (hostname.includes('hotstar')) return 'Hotstar';
    if (hostname.includes('spotify')) return 'Spotify';
    if (hostname.includes('disneyplus')) return 'Disney+';
    if (hostname.includes('sunnxt')) return 'Sun NXT';
    if (hostname.includes('apple')) return 'Apple TV';
    if (hostname.includes('crunchyroll')) return 'Crunchyroll';
    return hostname.split('.')[0].replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Unknown Provider';
  }
}

export default function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { moodProfile, toggleSaveItem, isItemSaved } = useMood();
  const [copied, setCopied] = useState(false);

  // Retrieve current item dynamically
  const item = useMemo(() => getItemById(id), [id]);
  const relatedItems = useMemo(() => getRelatedItems(id, 4), [id]);
  const [matchScore, setMatchScore] = useState(null);
  const isSaved = item ? isItemSaved(item.id) : false;
  const providerName = getProviderName(item?.streamUrl);
  const streamSearchUrl = item?.streamUrl ? buildStreamSearchUrl(item.title, providerName, item.artist) : null;

  // Calculate the detail-page mood compatibility score from the current profile.
  useEffect(() => {
    setMatchScore(item ? calculateMatchScore(item, moodProfile).scorePercent : null);
  }, [item, moodProfile]);

  if (!item) {
    return (
      <div className="min-h-screen bg-[#05060a] text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-bold">Item not found</h2>
        <button
          onClick={() => navigate('/recommendations')}
          className="mt-4 rounded-full bg-purple-500 px-5 py-2 text-xs font-semibold"
        >
          Return to Recommendations
        </button>
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getMoodExplanation = () => {
    if (item.moodSynergy && moodProfile && item.moodSynergy[moodProfile.mood]) {
      return item.moodSynergy[moodProfile.mood];
    }
    return `This title aligns with your current ${moodProfile?.shortName || 'emotional'} headspace by providing balanced emotional resonance and narrative engagement.`;
  };

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      {/* Background ambient lighting */}
      <CinematicBackground />
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Back navigation button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white transition"
          >
            <ArrowLeft size={16} />
            <span>Back to Discovery</span>
          </button>
        </div>

        {/* Hero Media Detail Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-[#07080c]/90 shadow-2xl backdrop-blur-2xl">
          
          {/* Backdrop Header Image */}
          <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-white/5">
            <img
              src={item.backdrop || item.image}
              alt=""
              className="h-full w-full object-cover opacity-35 filter blur-xs scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-[#07080c]/60 to-transparent" />
          </div>

          {/* Media Info Content Body */}
          <div className="relative -mt-36 sm:-mt-44 px-6 pb-10 sm:px-10">
            <div className="grid gap-8 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] items-start">
              
              {/* Poster Column */}
              <div className="mx-auto w-full max-w-[240px] sm:max-w-[280px]">
                <div className="overflow-hidden rounded-2xl border border-white/[0.15] bg-[#0a0b12] shadow-2xl shadow-black/80 aspect-[3/4]">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Match Score Under Poster */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span className="text-xs font-semibold text-purple-200">Mood Compatibility</span>
                  </div>
                  <span className="text-xs font-extrabold text-purple-300">{matchScore}%</span>
                </div>
              </div>

              {/* Information Column */}
              <div className="flex flex-col justify-between">
                <div>
                  
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-purple-300">
                      {item.type}
                    </span>
                    <span className="text-xs text-white/40">•</span>
                    <span className="text-xs text-white/60">{item.year}</span>
                    <span className="text-xs text-white/40">•</span>
                    <span className="text-xs text-white/60">{item.duration || item.artist}</span>
                    {item.rating && (
                      <>
                        <span className="text-xs text-white/40">•</span>
                        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                          {item.rating}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                    {item.title}
                  </h1>

                  {/* Director / Artist */}
                  <p className="mt-1 text-sm text-purple-300/80">
                    {item.director ? `Directed by ${item.director}` : item.artist ? `Artist: ${item.artist}` : ''}
                  </p>

                  {/* Genres */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.genres?.map((g, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70"
                      >
                        {g}
                      </span>
                    ))}
                  </div>

                  {/* Synopsis */}
                  <div className="mt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Overview & Story
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      {item.synopsis}
                    </p>
                  </div>

                  {/* Mood Synergy Box */}
                  <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                      <Sparkles size={14} className="text-purple-400" />
                      <span>Why MoodMate Selected This For You</span>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm leading-relaxed text-white/75">
                      {getMoodExplanation()}
                    </p>
                  </div>

                  {/* Show the known provider and link to a title-specific search result. */}
                  {streamSearchUrl && (
                    <div className="mt-6">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                        Where to Watch / Listen
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                          {providerName}
                        </span>
                        <a
                          href={streamSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white transition hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-200"
                        >
                          <span>View on {providerName}</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Primary Action Buttons */}
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    {/* Use a generated search URL; unavailable items remain visibly disabled. */}
                    {streamSearchUrl ? (
                      <a
                        href={streamSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-xl shadow-white/10 transition-all hover:scale-105 active:scale-95"
                      >
                        <Play size={16} className="fill-black" />
                        <span>{item.type === 'music' ? `Listen on ${providerName}` : `Watch on ${providerName}`}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Coming soon"
                        className="flex cursor-not-allowed items-center gap-2 rounded-full bg-white/20 px-7 py-3.5 text-sm font-semibold text-white/45"
                      >
                        <Play size={16} />
                        <span>Not available</span>
                      </button>
                    )}

                    <button
                      onClick={() => toggleSaveItem(item)}
                      className={`flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-medium transition-all ${
                        isSaved
                          ? 'border-pink-500 bg-pink-500/20 text-pink-300'
                          : 'border-white/10 bg-white/[0.04] text-white/80 hover:border-white/25 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <Heart size={16} className={isSaved ? 'fill-pink-400 text-pink-400' : ''} />
                      <span>{isSaved ? 'In Your List' : 'Save to My List'}</span>
                    </button>

                    <button
                      onClick={handleShare}
                      title="Share link"
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white transition"
                    >
                      {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Related Titles Section */}
        <section className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Similar Experiences for Your Mood
              </h2>
              <p className="text-xs text-white/40 mt-1">
                Other titles sharing complementary affective qualities.
              </p>
            </div>

            <Link
              to="/recommendations"
              className="text-xs font-semibold text-purple-300 hover:text-purple-200 transition"
            >
              View Full Gallery →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedItems.map((relItem, idx) => (
              <RecommendationCard key={relItem.id} item={relItem} index={idx} />
            ))}
          </div>
        </section>

      </main>

      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>
    </div>
  );
}
