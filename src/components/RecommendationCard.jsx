import { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Heart, Star, Music, Film, Tv, Sparkles, ExternalLink } from 'lucide-react';
import { useMood } from '../context/MoodContext';
import { getMatchExplanation, calculateMatchScore, buildStreamSearchUrl } from '../data/recommendationsData';

export default function RecommendationCard({ item, index = 0 }) {
  const { toggleSaveItem, isItemSaved, moodProfile } = useMood();
  const [imageError, setImageError] = useState(false);
  const isSaved = isItemSaved(item.id);

  const getTypeIcon = () => {
    switch (item.type) {
      case 'music':  return <Music size={12} className="text-pink-400" />;
      case 'series': return <Tv size={12} className="text-indigo-400" />;
      case 'anime':  return <Sparkles size={12} className="text-amber-400" />;
      default:       return <Film size={12} className="text-purple-400" />;
    }
  };

  // 6-factor dynamic score calculation
  const scoreData = item.matchScoreData || calculateMatchScore(item, moodProfile);
  const displayScore = typeof scoreData.scoreOutOf5 === 'number'
    ? scoreData.scoreOutOf5.toFixed(1)
    : (scoreData.formattedScore || '4.5');

  // Dynamic 1-sentence mood synergy explanation
  const explanation = item.matchExplanation || getMatchExplanation(item, moodProfile);

  // Use a provider search URL so generic homepages and invalid track IDs are avoided.
  const platformName = item.streamPlatform || (item.type === 'music' ? 'Spotify' : 'Stream');
  const streamUrl = buildStreamSearchUrl(item.title, platformName, item.artist);
  const actionLabel = item.type === 'music' ? `Listen on ${platformName}` : `Watch on ${platformName}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.4) }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0b12] shadow-xl transition-all duration-300 hover:border-purple-500/30 hover:shadow-purple-500/10 hover:-translate-y-1"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/[0.02]">
        {!imageError && item.image ? (
          <img
            src={item.image}
            alt={item.title}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-purple-950/40 to-[#05060a] p-6 text-center">
            {getTypeIcon()}
            <span className="mt-2 text-xs font-semibold text-white/60">{item.title}</span>
          </div>
        )}

        {/* Cinematic dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b12] via-[#0a0b12]/20 to-black/30" />

        {/* Top Badges: Type + ⭐ X.X/5 Mood Match */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md">
            {getTypeIcon()}
            <span>{item.type}</span>
          </span>

          <span
            title="MoodMate 6-Factor Affective Compatibility Rating"
            className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-950/80 px-2.5 py-0.5 text-[10px] font-bold text-purple-200 backdrop-blur-md shadow-md"
          >
            <Star size={10} className="fill-amber-400 text-amber-400" />
            <span>⭐ {displayScore}/5 Mood Match</span>
          </span>
        </div>

        {/* Save to My List Bookmark Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSaveItem(item);
          }}
          title={isSaved ? 'Remove from My List' : 'Save to My List'}
          className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 backdrop-blur-md ${
            isSaved
              ? 'border-pink-500 bg-pink-500/30 text-pink-300'
              : 'border-white/20 bg-black/50 text-white/80 opacity-0 group-hover:opacity-100 hover:border-white hover:text-white'
          }`}
        >
          <Heart size={14} className={isSaved ? 'fill-pink-400 text-pink-400' : ''} />
        </button>

        {/* Quick Stream Action on Hover */}
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black shadow-lg opacity-0 transition-all duration-300 group-hover:opacity-100 hover:scale-105 active:scale-95"
        >
          <Play size={11} className="fill-black" />
          <span>{actionLabel}</span>
        </a>
      </div>

      {/* Card Content Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {/* Metadata Row */}
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <span>{item.year}</span>
            <span>•</span>
            <span>{item.duration || item.artist}</span>
            {item.language && (
              <>
                <span>•</span>
                <span className="text-purple-300/80 font-medium">{item.language}</span>
              </>
            )}
            {item.rating && (
              <>
                <span>•</span>
                <span className="rounded border border-white/10 px-1 text-[9px]">{item.rating}</span>
              </>
            )}
          </div>

          {/* Title */}
          <h3 className="mt-1 text-base font-semibold tracking-tight text-white truncate">
            {item.title}
          </h3>

          {/* Genres / Artist */}
          <p className="mt-0.5 text-[11px] text-purple-300/80 truncate">
            {item.genres ? item.genres.join(' · ') : item.artist}
          </p>

          {/* Mood Synergy Explanation */}
          <p className="mt-2 text-xs leading-relaxed text-white/60 line-clamp-2">
            {explanation}
          </p>
        </div>

        {/* Card Footer: Direct Stream Platform Action */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 transition-colors hover:text-purple-200"
          >
            <Play size={12} className="fill-purple-300" />
            <span>{actionLabel}</span>
            <ExternalLink size={11} className="opacity-60" />
          </a>

          <span className="text-[10px] font-medium text-white/35">
            {platformName}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
