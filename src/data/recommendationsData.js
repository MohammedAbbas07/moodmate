// NewMoodMate Multimedia Catalog & Emotion-Aware Recommendation Engine
// Research foundations: Russell's Circumplex Model (Valence × Arousal),
// GoEmotions-inspired fine-grained emotion mapping, and MovieLens-style quality weighting.

// ─────────────────────────────────────────────
// 6-FACTOR EMOTION-AWARE SCORING ENGINE
//
// Factors:
//   1. Mood Compatibility        (30%) — Primary mood tag match
//   2. Energy / Arousal Proximity(20%) — |item.energy - user.energy| closeness
//   3. Emotional Need Alignment  (15%) — Fit for user's cognitive/emotional need
//   4. Content Preference Match  (10%) — Matches preferred multimedia format
//   5. User Intent & Language    (15%) — Intended vibe & linguistic affinity
//   6. Content Quality Score     (10%) — Editorial quality & critical baseline
// ─────────────────────────────────────────────
function legacyCalculateMatchScore(item, moodProfile) {
  if (!moodProfile) {
    const base5 = ((item.baseQuality ?? 0.88) * 5).toFixed(1);
    return {
      scoreOutOf5: Number(base5),
      scorePercent: Math.round((item.baseQuality ?? 0.88) * 100),
      formattedScore: `⭐ ${base5}/5 Mood Match`
    };
  }

  const moodId = (moodProfile.moodId || 'calm').toLowerCase();
  const userValence = moodProfile.valence ?? 0.70;
  const userEnergy = moodProfile.energy ?? 0.40;
  const preferredFormat = moodProfile.preferredFormat || 'all';
  const preferredLanguage = moodProfile.preferredLanguage || 'English';

  // 1. Mood Compatibility (0 - 1)
  const isDirectMood = item.moodTags.includes(moodId);
  const isCompatibleMood = item.moodTags.some(t => ['calm', 'reflective', 'upbeat'].includes(t));
  const moodScore = isDirectMood ? 1.0 : isCompatibleMood ? 0.65 : 0.35;

  // 2. Energy / Arousal Compatibility (0 - 1)
  const energyDiff = Math.abs((item.energy ?? 0.50) - userEnergy);
  const energyScore = Math.max(0, 1 - energyDiff * 1.35);

  // 3. Emotional Need Compatibility (0 - 1)
  const valenceDiff = Math.abs((item.valence ?? 0.60) - userValence);
  const needScore = Math.max(0, 1 - valenceDiff * 1.30);

  // 4. Content Preference Match (0 - 1)
  const formatScore = (preferredFormat === 'all' || item.type === preferredFormat) ? 1.0 : 0.60;

  // 5. User Intent & Language Preference (0 - 1)
  let langScore = 0.70; // baseline
  if (preferredLanguage && preferredLanguage !== 'English') {
    if (item.language === preferredLanguage || (item.availableLanguages && item.availableLanguages.includes(preferredLanguage))) {
      langScore = 1.0;
    } else if (item.language === 'English' || (item.availableLanguages && item.availableLanguages.includes('English'))) {
      langScore = 0.78;
    }
  } else {
    // English default
    if (item.language === 'English' || (item.availableLanguages && item.availableLanguages.includes('English'))) {
      langScore = 1.0;
    } else {
      langScore = 0.82;
    }
  }

  // 6. Content Quality Score (0 - 1)
  const qualityScore = item.baseQuality ?? 0.90;

  // Weighted aggregate score (0 - 1)
  const weighted =
    moodScore * 0.30 +
    energyScore * 0.20 +
    needScore * 0.15 +
    formatScore * 0.10 +
    langScore * 0.15 +
    qualityScore * 0.10;

  // Scale to ⭐ X.X / 5 Mood Match (range: 3.8 - 5.0)
  const rawOutOf5 = 3.6 + weighted * 1.4;
  const clampedOutOf5 = Math.min(5.0, Math.max(3.8, rawOutOf5));
  const scoreOutOf5 = Number(clampedOutOf5.toFixed(1));
  const scorePercent = Math.round(Math.min(99, Math.max(75, weighted * 100)));

  return {
    scoreOutOf5,
    scorePercent,
    formattedScore: `⭐ ${scoreOutOf5.toFixed(1)}/5 Mood Match`
  };
}

// ─────────────────────────────────────────────
// MATCH EXPLANATION GENERATOR
// ─────────────────────────────────────────────
function legacyGetMatchExplanation(item, moodProfile) {
  if (!moodProfile) return "Curated for high emotional resonance and narrative quality.";

  const moodId = (moodProfile.moodId || 'calm').toLowerCase();

  if (item.moodSynergy && item.moodSynergy[moodId]) {
    return item.moodSynergy[moodId];
  }

  const userEnergy = moodProfile.energy ?? 0.40;
  const userValence = moodProfile.valence ?? 0.70;

  if (Math.abs((item.energy ?? 0.5) - userEnergy) < 0.20) {
    return `Recommended because its energy and pacing match your ${moodProfile.shortName || 'current'} state.`;
  }
  if (Math.abs((item.valence ?? 0.6) - userValence) < 0.20) {
    return `Recommended because its emotional tone aligns with your current headspace.`;
  }

  return `Selected for its calming atmosphere and emotional compatibility.`;
}

// ─────────────────────────────────────────────
// MEDIA CATALOG
// Curated recognizable titles with official streaming platforms
// ─────────────────────────────────────────────
export const RECOMMENDATION_WEIGHTS = {
  mood: 22,
  energy: 18,
  emotionalNeed: 18,
  contentPreference: 16,
  userIntent: 14,
  quality: 12,
};

const MOOD_NEIGHBORS = {
  calm: ['tired', 'reflective', 'low'], reflective: ['calm', 'low', 'lonely'], upbeat: ['excited', 'bored', 'calm'],
  stressed: ['tired', 'calm', 'low'], tired: ['calm', 'low', 'stressed'], low: ['lonely', 'reflective', 'calm'],
  excited: ['upbeat', 'bored'], bored: ['excited', 'upbeat', 'reflective'], lonely: ['low', 'reflective', 'calm'],
};

const NEED_RULES = {
  'Comfort & Reassurance': { moods: ['calm', 'tired', 'low', 'lonely'], genres: ['comedy', 'family', 'slice of life', 'romance'], maxEnergy: 0.55 },
  Relaxation: { moods: ['calm', 'tired', 'stressed'], genres: ['ambient', 'acoustic', 'melody', 'slice of life'], maxEnergy: 0.45 },
  'Uplift & Encouragement': { moods: ['low', 'stressed', 'upbeat'], genres: ['comedy', 'adventure', 'family'], minEnergy: 0.35 },
  'Escape & Distraction': { moods: ['stressed', 'bored', 'reflective'], genres: ['adventure', 'fantasy', 'mystery', 'thriller', 'sci-fi'], minEnergy: 0.35 },
  'Stimulation & Excitement': { moods: ['excited', 'bored', 'upbeat'], genres: ['action', 'thriller', 'adventure', 'sport'], minEnergy: 0.6 },
  Entertainment: { moods: ['upbeat', 'bored', 'calm'], genres: ['comedy', 'adventure'], minEnergy: 0.35 },
  'Discovery & Exploration': { moods: ['reflective', 'bored', 'excited'], genres: ['adventure', 'documentary', 'fantasy', 'sci-fi'], minEnergy: 0.4 },
};

const INTENT_RULES = {
  relaxation: { moods: ['calm', 'tired'], maxEnergy: 0.45 }, distraction: { moods: ['stressed', 'bored'], genres: ['adventure', 'fantasy', 'mystery', 'thriller'] },
  uplift: { moods: ['low', 'stressed', 'upbeat'], genres: ['comedy', 'family', 'adventure'] }, comfort: { moods: ['calm', 'tired', 'low', 'lonely'], maxEnergy: 0.55 },
  stimulation: { moods: ['excited', 'bored', 'upbeat'], minEnergy: 0.65 }, entertainment: { genres: ['comedy', 'adventure'], minEnergy: 0.35 },
  exploration: { moods: ['reflective', 'bored', 'excited'], genres: ['adventure', 'documentary', 'fantasy', 'sci-fi'] },
};

function clamp(value, minimum = 0, maximum = 1) { return Math.min(maximum, Math.max(minimum, value)); }
function normalizedGenres(item) { return (item.genres || []).map((genre) => genre.toLowerCase()); }
function ruleScore(item, rule) {
  if (!rule) return null;
  const moods = item.moodTags || [];
  const genres = normalizedGenres(item);
  const parts = [];
  if (rule.moods?.length) parts.push(rule.moods.some((mood) => moods.includes(mood)) ? 1 : 0.25);
  if (rule.genres?.length) parts.push(rule.genres.some((genre) => genres.includes(genre)) ? 1 : 0.3);
  if (rule.maxEnergy !== undefined) parts.push(item.energy <= rule.maxEnergy ? 1 : clamp(1 - (item.energy - rule.maxEnergy) * 1.6));
  if (rule.minEnergy !== undefined) parts.push(item.energy >= rule.minEnergy ? 1 : clamp(1 - (rule.minEnergy - item.energy) * 1.6));
  return parts.reduce((sum, score) => sum + score, 0) / parts.length;
}
function genreMatches(item, genres) {
  const catalogGenres = normalizedGenres(item);
  return genres.filter((genre) => {
    const normalized = genre.toLowerCase();
    return catalogGenres.some((catalogGenre) => catalogGenre === normalized || (normalized === 'romance' && catalogGenre === 'romantic') || (normalized === 'science fiction' && catalogGenre === 'sci-fi'));
  });
}
function languageAdjustment(item, languagePreference) {
  if (!languagePreference) return { score: 0, label: null };
  if (item.language === languagePreference) return { score: 10, label: 'Selected in ' + languagePreference + ' based on your language preference.' };
  if (item.availableLanguages?.includes(languagePreference)) return { score: 6, label: 'Available in ' + languagePreference + ' based on your language preference.' };
  return { score: 0, label: null };
}

// Build provider search URLs so every stream action lands on a title search.
// Music uses title and artist text instead of unreliable catalog track IDs.
export function buildStreamSearchUrl(title, provider, artist = '') {
  const encodedTitle = encodeURIComponent(title || '');
  const encodedMusicQuery = encodeURIComponent([title, artist].filter(Boolean).join(' '));
  const normalizedProvider = (provider || '').toLowerCase();

  if (normalizedProvider.includes('netflix')) return `https://www.netflix.com/search?q=${encodedTitle}`;
  if (normalizedProvider.includes('prime')) return `https://www.amazon.com/s?k=${encodedTitle}&i=instant-video`;
  if (normalizedProvider.includes('hotstar')) return `https://www.hotstar.com/in/search?q=${encodedTitle}`;
  if (normalizedProvider.includes('sunnxt')) return `https://www.sunnxt.com/search/${encodedTitle}`;
  if (normalizedProvider.includes('crunchyroll')) return `https://www.crunchyroll.com/search?q=${encodedTitle}`;
  if (normalizedProvider.includes('spotify')) return `https://open.spotify.com/search/${encodedMusicQuery}`;
  if (normalizedProvider.includes('youtube music')) return `https://music.youtube.com/search?q=${encodedMusicQuery}`;
  if (normalizedProvider.includes('disney')) return `https://www.google.com/search?q=${encodeURIComponent(`${title} watch online`)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} watch online`)}`;
}

/**
 * Six independent core factors (weights total 100): mood 22, energy 18,
 * emotional need 18, content preference 16, intent 14, quality 12.
 * Genre (+0 to 12) and language (+0 to 10) are separate bounded adjustments.
 */
export function calculateMatchScore(item, moodProfile) {
  if (!moodProfile?.assessmentStatus) {
    const scorePercent = Math.round((item.baseQuality ?? 0.5) * 100);
    return { scorePercent, scoreOutOf5: Number((scorePercent / 20).toFixed(1)), formattedScore: String(scorePercent) + '% Catalog Quality', factorScores: {}, adjustments: {}, contributors: [] };
  }

  const mood = moodProfile.mood;
  const moodTags = item.moodTags || [];
  const tagScore = moodTags.includes(mood) ? 1 : MOOD_NEIGHBORS[mood]?.some((neighbor) => moodTags.includes(neighbor)) ? 0.6 : 0.2;
  const valenceScore = Number.isFinite(moodProfile.valence) ? clamp(1 - Math.abs((item.valence ?? 0.5) - moodProfile.valence)) : 0.5;
  const targetEnergy = moodProfile.userIntent === 'stimulation' ? Math.max(moodProfile.energy ?? 0.5, 0.75) : moodProfile.energy;
  const factorScores = {
    mood: clamp(tagScore * 0.65 + valenceScore * 0.35),
    energy: Number.isFinite(targetEnergy) ? clamp(1 - Math.abs((item.energy ?? 0.5) - targetEnergy) * 1.25) : null,
    emotionalNeed: ruleScore(item, NEED_RULES[moodProfile.emotionalNeed]),
    contentPreference: moodProfile.contentPreference && moodProfile.contentPreference !== 'all' ? (item.type === moodProfile.contentPreference ? 1 : 0.12) : null,
    userIntent: ruleScore(item, INTENT_RULES[moodProfile.userIntent]),
    quality: clamp(item.baseQuality ?? 0.5),
  };
  const activeWeights = Object.entries(RECOMMENDATION_WEIGHTS).filter(([factor]) => factorScores[factor] !== null);
  const coreScore = activeWeights.reduce((sum, [factor, weight]) => sum + factorScores[factor] * weight, 0) / activeWeights.reduce((sum, [, weight]) => sum + weight, 0);
  const preferredGenres = Array.isArray(moodProfile.genrePreference) ? moodProfile.genrePreference : [];
  const matchedGenres = genreMatches(item, preferredGenres);
  const genreAdjustment = preferredGenres.length ? (matchedGenres.length / preferredGenres.length) * 12 : 0;
  const language = languageAdjustment(item, moodProfile.languagePreference);
  const scorePercent = Math.round(clamp(coreScore + genreAdjustment + language.score, 0, 100));
  const contributors = [];
  if (matchedGenres.length) contributors.push('Matches your preference for ' + matchedGenres.join(' and ').toLowerCase() + ' ' + (moodProfile.contentPreference !== 'all' ? moodProfile.contentPreference + 's.' : 'content.'));
  if (language.label) contributors.push(language.label);
  if (factorScores.emotionalNeed !== null && factorScores.emotionalNeed >= 0.7) contributors.push('Fits your current need for ' + moodProfile.emotionalNeed.toLowerCase() + '.');
  if (factorScores.energy !== null && factorScores.energy >= 0.72) contributors.push('Fits your ' + (targetEnergy <= 0.4 ? 'low-energy' : targetEnergy >= 0.7 ? 'high-energy' : 'current energy') + ' state.');
  if (factorScores.userIntent !== null && factorScores.userIntent >= 0.7) contributors.push('Supports your goal of ' + moodProfile.userIntent + '.');
  if (!contributors.length && factorScores.mood >= 0.72) contributors.push('Aligns with your current ' + (moodProfile.shortName?.toLowerCase() || mood) + ' mood.');
  if (!contributors.length) contributors.push('A balanced match based on the signals currently available.');
  return { scorePercent, scoreOutOf5: Number((scorePercent / 20).toFixed(1)), formattedScore: String(scorePercent) + '% Mood Match', factorScores, adjustments: { genre: genreAdjustment, language: language.score }, contributors };
}

export function getMatchExplanation(item, moodProfile) {
  return calculateMatchScore(item, moodProfile).contributors.slice(0, 2).join(' ');
}

const legacyMediaCatalog = [
  // ══════════════════════════════════════════
  // MOVIES
  // ══════════════════════════════════════════
  {
    id: 'mov-1',
    type: 'movie',
    title: 'The Secret Life of Walter Mitty',
    year: '2013',
    duration: '1h 54m',
    rating: 'PG',
    director: 'Ben Stiller',
    genres: ['Adventure', 'Comedy', 'Drama'],
    language: 'English',
    availableLanguages: ['English', 'Hindi'],
    valence: 0.80,
    energy: 0.45,
    baseQuality: 0.94,
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A daydreaming photo manager at Life magazine embarks on an unexpected real-world global journey.',
    moodSynergy: {
      calm: 'Stunning Icelandic landscapes and a warm acoustic soundtrack create a meditative, gentle escape.',
      reflective: 'Explores intentional living, overcoming passive dreaming, and finding beauty in ordinary life.',
      low: 'A reassuring reminder that unexpected beauty and new beginnings are always possible.',
      tired: 'Visually serene vistas that soothe without demanding intense cognitive effort.'
    },
    moodTags: ['calm', 'reflective', 'low', 'tired'],
    streamPlatform: 'Disney+',
    streamUrl: 'https://www.disneyplus.com'
  },
  {
    id: 'mov-2',
    type: 'movie',
    title: 'Spider-Man: Into the Spider-Verse',
    year: '2018',
    duration: '1h 57m',
    rating: 'PG',
    director: 'Bob Persichetti, Peter Ramsey',
    genres: ['Animation', 'Action', 'Adventure'],
    language: 'English',
    availableLanguages: ['English', 'Hindi', 'Tamil', 'Telugu'],
    valence: 0.88,
    energy: 0.90,
    baseQuality: 0.98,
    image: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Teenager Miles Morales becomes the new Spider-Man and joins alternate-universe heroes to stop a multiverse threat.',
    moodSynergy: {
      upbeat: 'Revolutionary visual style and an infectious hip-hop soundtrack multiply high energy.',
      excited: 'Fast-paced adrenaline, witty humor, and jaw-dropping animation craft.',
      bored: 'Relentless creativity and rapid-fire visual storytelling instantly eliminate boredom.'
    },
    moodTags: ['upbeat', 'excited', 'bored'],
    streamPlatform: 'Netflix',
    streamUrl: 'https://www.netflix.com'
  },
  {
    id: 'mov-3',
    type: 'movie',
    title: 'Inception',
    year: '2010',
    duration: '2h 28m',
    rating: 'PG-13',
    director: 'Christopher Nolan',
    genres: ['Sci-Fi', 'Action', 'Thriller'],
    language: 'English',
    availableLanguages: ['English', 'Hindi', 'Tamil', 'Telugu'],
    valence: 0.65,
    energy: 0.80,
    baseQuality: 0.96,
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A skilled thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.',
    moodSynergy: {
      reflective: "Christopher Nolan's layered dream architecture and Hans Zimmer's score stimulate deep analytical focus.",
      bored: 'Multi-tiered heist tension demands complete immersion, curing mental restlessness.',
      excited: 'High-concept mind-bending set pieces and breathtaking zero-gravity combat.'
    },
    moodTags: ['reflective', 'bored', 'excited'],
    streamPlatform: 'Prime Video',
    streamUrl: 'https://www.amazon.com/gp/video/storefront'
  },
  {
    id: 'mov-4',
    type: 'movie',
    title: 'Good Will Hunting',
    year: '1997',
    duration: '2h 06m',
    rating: 'R',
    director: 'Gus Van Sant',
    genres: ['Drama', 'Romance'],
    language: 'English',
    availableLanguages: ['English'],
    valence: 0.68,
    energy: 0.35,
    baseQuality: 0.95,
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A brilliant but troubled janitor at MIT receives emotional guidance and therapy from an empathetic psychologist.',
    moodSynergy: {
      reflective: 'Dialogue-driven exploration of vulnerability, unspoken trauma, and profound human connection.',
      lonely: 'Deeply comforting portrayal of unconditional friendship and empathetic mentorship.',
      low: 'Cathartic emotional payoff with memorable performances that leave you feeling heard.'
    },
    moodTags: ['reflective', 'lonely', 'low', 'calm'],
    streamPlatform: 'Prime Video',
    streamUrl: 'https://www.amazon.com'
  },
  {
    id: 'mov-5',
    type: 'movie',
    title: 'Paddington 2',
    year: '2017',
    duration: '1h 43m',
    rating: 'PG',
    director: 'Paul King',
    genres: ['Comedy', 'Family', 'Adventure'],
    language: 'English',
    availableLanguages: ['English', 'Hindi'],
    valence: 0.95,
    energy: 0.55,
    baseQuality: 0.97,
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Paddington gets framed for the theft of an antique pop-up book and wins over everyone in prison with kindness.',
    moodSynergy: {
      stressed: 'Pure comfort food for the soul. Relieves anxiety in minutes with boundless charm.',
      tired: 'Effortless viewing with zero emotional friction and heartwarming visual comedy.',
      upbeat: 'Infectious optimism and warm humanity that multiply cheerful feelings.'
    },
    moodTags: ['stressed', 'tired', 'upbeat', 'calm'],
    streamPlatform: 'Netflix',
    streamUrl: 'https://www.netflix.com'
  },
  {
    id: 'mov-6',
    type: 'movie',
    title: 'Kumbalangi Nights',
    year: '2019',
    duration: '2h 15m',
    rating: 'TV-14',
    director: 'Madhu C. Narayanan',
    genres: ['Drama', 'Family', 'Comedy'],
    language: 'Malayalam',
    availableLanguages: ['Malayalam', 'English', 'Tamil', 'Telugu', 'Hindi'],
    valence: 0.82,
    energy: 0.40,
    baseQuality: 0.96,
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Four brothers sharing a dysfunctional relationship in a scenic island village find healing and solidarity through unexpected events.',
    moodSynergy: {
      calm: 'Serene backwater visuals and warm acoustic melodies provide deep, soul-healing comfort.',
      reflective: 'Tender exploration of brotherhood, mental vulnerability, and wholesome love.',
      lonely: 'The home becomes a sanctuary of belonging, welcoming everyone into warmth.'
    },
    moodTags: ['calm', 'reflective', 'lonely', 'low'],
    streamPlatform: 'Prime Video',
    streamUrl: 'https://www.amazon.com'
  },
  {
    id: 'mov-7',
    type: 'movie',
    title: '3 Idiots',
    year: '2009',
    duration: '2h 50m',
    rating: 'PG-13',
    director: 'Rajkumar Hirani',
    genres: ['Comedy', 'Drama'],
    language: 'Hindi',
    availableLanguages: ['Hindi', 'English', 'Tamil', 'Telugu'],
    valence: 0.90,
    energy: 0.70,
    baseQuality: 0.97,
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Two friends embark on a journey across India to find their lost college companion who inspired them to think differently.',
    moodSynergy: {
      upbeat: 'Inspirational laughter, iconic friendship anthem, and uplifting life perspective.',
      stressed: 'Takes the pressure off career and societal stress with profound humor and heart.',
      lonely: 'Celebrates unconditional friendship that transcends time and distance.'
    },
    moodTags: ['upbeat', 'stressed', 'lonely', 'excited'],
    streamPlatform: 'Prime Video',
    streamUrl: 'https://www.amazon.com'
  },
  {
    id: 'mov-8',
    type: 'movie',
    title: '96',
    year: '2018',
    duration: '2h 38m',
    rating: 'TV-14',
    director: 'C. Prem Kumar',
    genres: ['Romance', 'Drama', 'Nostalgia'],
    language: 'Tamil',
    availableLanguages: ['Tamil', 'Telugu', 'English', 'Hindi'],
    valence: 0.65,
    energy: 0.35,
    baseQuality: 0.95,
    image: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Two high school sweethearts meet at a reunion after 22 years and spend a poignant, unforgettable night together.',
    moodSynergy: {
      reflective: 'Govind Vasantha\'s soulful violin score and poetic dialogue stir sweet nostalgia.',
      lonely: 'Tender companionship celebrating quiet love that lingers across time.',
      calm: 'Slow, graceful storytelling bathed in nighttime gentle warmth.'
    },
    moodTags: ['reflective', 'lonely', 'calm', 'low'],
    streamPlatform: 'Sun NXT',
    streamUrl: 'https://www.sunnxt.com'
  },

  // ══════════════════════════════════════════
  // SERIES (TV SHOWS)
  // ══════════════════════════════════════════
  {
    id: 'ser-1',
    type: 'series',
    title: 'Ted Lasso',
    year: '2020–2023',
    duration: '3 Seasons',
    rating: 'TV-MA',
    director: 'Jason Sudeikis, Bill Lawrence',
    genres: ['Comedy', 'Drama', 'Sport'],
    language: 'English',
    availableLanguages: ['English', 'Hindi'],
    valence: 0.90,
    energy: 0.55,
    baseQuality: 0.98,
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1489944445391-11dd35d63ecf?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'An optimistic American football coach manages a struggling British soccer team with relentless kindness.',
    moodSynergy: {
      stressed: 'A warm antidote to cynicism. Reduces tension through wholesome camaraderie.',
      low: 'Kind, supportive, and restorative—restores faith in people and gentle perseverance.',
      lonely: 'The clubhouse becomes an empathetic family with deep loyalty and heart.'
    },
    moodTags: ['stressed', 'low', 'lonely', 'calm', 'upbeat'],
    streamPlatform: 'Apple TV+',
    streamUrl: 'https://tv.apple.com'
  },
  {
    id: 'ser-2',
    type: 'series',
    title: 'Panchayat',
    year: '2020–Present',
    duration: '3 Seasons',
    rating: 'TV-14',
    director: 'Deepak Kumar Mishra',
    genres: ['Comedy', 'Drama', 'Slice of Life'],
    language: 'Hindi',
    availableLanguages: ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'English'],
    valence: 0.85,
    energy: 0.45,
    baseQuality: 0.97,
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'An engineering graduate takes up a job as a secretary of a rural village panchayat office, discovering quirky warmth.',
    moodSynergy: {
      calm: 'Gentle rural acoustic warmth with zero toxicity and endearing characters.',
      stressed: 'Soothing antidote to corporate hustle with grounded humor and village life.',
      lonely: 'Heartwarming community bonds that make you smile with every episode.'
    },
    moodTags: ['calm', 'stressed', 'lonely', 'upbeat', 'tired'],
    streamPlatform: 'Prime Video',
    streamUrl: 'https://www.amazon.com'
  },
  {
    id: 'ser-3',
    type: 'series',
    title: 'The Bear',
    year: '2022–Present',
    duration: '3 Seasons',
    rating: 'TV-MA',
    director: 'Christopher Storer',
    genres: ['Drama', 'Comedy'],
    language: 'English',
    availableLanguages: ['English', 'Hindi'],
    valence: 0.60,
    energy: 0.82,
    baseQuality: 0.96,
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80',
    synopsis: "A fine-dining chef returns home to Chicago to run his deceased brother's chaotic Italian beef sandwich shop.",
    moodSynergy: {
      reflective: 'Captures the raw beauty of dedication, chosen family, and the pursuit of excellence.',
      bored: 'Electric, pulsating kitchen pace that commands full sensory focus.'
    },
    moodTags: ['reflective', 'bored', 'excited'],
    streamPlatform: 'Disney+ Hotstar',
    streamUrl: 'https://www.hotstar.com'
  },
  {
    id: 'ser-4',
    type: 'series',
    title: 'Stranger Things',
    year: '2016–Present',
    duration: '4 Seasons',
    rating: 'TV-14',
    director: 'The Duffer Brothers',
    genres: ['Sci-Fi', 'Horror', 'Drama'],
    language: 'English',
    availableLanguages: ['English', 'Hindi', 'Tamil', 'Telugu'],
    valence: 0.65,
    energy: 0.85,
    baseQuality: 0.93,
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A group of friends in 1980s Indiana witness supernatural forces and government conspiracies.',
    moodSynergy: {
      excited: '80s synth nostalgia, fast-paced supernatural mystery, and friendship.',
      bored: 'Gripping episode cliffhangers that pull you into irresistible binge momentum.'
    },
    moodTags: ['excited', 'bored', 'upbeat'],
    streamPlatform: 'Netflix',
    streamUrl: 'https://www.netflix.com'
  },
  {
    id: 'ser-5',
    type: 'series',
    title: "Schitt's Creek",
    year: '2015–2020',
    duration: '6 Seasons',
    rating: 'TV-14',
    director: 'Dan Levy, Eugene Levy',
    genres: ['Comedy'],
    language: 'English',
    availableLanguages: ['English'],
    valence: 0.92,
    energy: 0.50,
    baseQuality: 0.95,
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A formerly wealthy family loses their fortune and relocates to a small town, growing closer than ever.',
    moodSynergy: {
      stressed: 'Zero anxiety, pure cozy humor that warms the room without demanding emotional effort.',
      tired: 'Effortless viewing packed with memorable one-liners and wholesome character growth.',
      lonely: 'A celebration of family, community acceptance, and love that feels welcoming.'
    },
    moodTags: ['stressed', 'tired', 'lonely', 'calm', 'upbeat'],
    streamPlatform: 'Netflix',
    streamUrl: 'https://www.netflix.com'
  },
  {
    id: 'ser-6',
    type: 'series',
    title: 'Suzhal: The Vortex',
    year: '2022–Present',
    duration: '2 Seasons',
    rating: 'TV-MA',
    director: 'Pushkar & Gayatri',
    genres: ['Mystery', 'Crime', 'Thriller'],
    language: 'Tamil',
    availableLanguages: ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'English'],
    valence: 0.50,
    energy: 0.75,
    baseQuality: 0.94,
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'An investigation into a missing girl unearths deep-rooted secrets in a small industrial town during a local festival.',
    moodSynergy: {
      reflective: 'Atmospheric cinematography and layered character writing pull you into a gripping mystery.',
      bored: 'Relentless suspense and visual grandeur keep your eyes glued to the screen.'
    },
    moodTags: ['reflective', 'bored', 'excited'],
    streamPlatform: 'Prime Video',
    streamUrl: 'https://www.amazon.com'
  },

  // ══════════════════════════════════════════
  // ANIME
  // ══════════════════════════════════════════
  {
    id: 'ani-1',
    type: 'anime',
    title: 'Spirited Away',
    year: '2001',
    duration: '2h 05m',
    rating: 'PG',
    director: 'Hayao Miyazaki',
    genres: ['Animation', 'Adventure', 'Fantasy'],
    language: 'Japanese',
    availableLanguages: ['English', 'Hindi', 'Japanese', 'Tamil'],
    valence: 0.78,
    energy: 0.40,
    baseQuality: 0.99,
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A 10-year-old girl wanders into a spirit world during her family\'s move and must find courage to save her parents.',
    moodSynergy: {
      calm: "Joe Hisaishi's legendary piano score and Studio Ghibli watercolors create a dreamlike sanctuary.",
      reflective: 'Timeless themes of resilience, growing up, memory, and quiet gratitude.',
      low: 'Gentle escapism that nourishes tired spirits with wonder and visual poetry.'
    },
    moodTags: ['calm', 'reflective', 'low', 'tired'],
    streamPlatform: 'Netflix',
    streamUrl: 'https://www.netflix.com'
  },
  {
    id: 'ani-2',
    type: 'anime',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    year: '2019–Present',
    duration: '4 Seasons',
    rating: 'TV-MA',
    director: 'Haruo Sotozaki',
    genres: ['Anime', 'Action', 'Fantasy'],
    language: 'Japanese',
    availableLanguages: ['English', 'Hindi', 'Japanese', 'Tamil', 'Telugu'],
    valence: 0.72,
    energy: 0.92,
    baseQuality: 0.96,
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Tanjiro sets out on a perilous journey to become a demon slayer and cure his sister Nezuko.',
    moodSynergy: {
      excited: "Ufotable's world-class visual effects, thrilling swordsmanship, and epic battle tracks.",
      upbeat: "Tanjiro's unwavering resolve and compassion provide immense inspirational energy.",
      bored: 'Hyper-kinetic fight choreography that guarantees zero dull moments.'
    },
    moodTags: ['excited', 'upbeat', 'bored'],
    streamPlatform: 'Crunchyroll',
    streamUrl: 'https://www.crunchyroll.com'
  },
  {
    id: 'ani-3',
    type: 'anime',
    title: 'Your Name (Kimi no Na wa)',
    year: '2016',
    duration: '1h 46m',
    rating: 'PG',
    director: 'Makoto Shinkai',
    genres: ['Animation', 'Drama', 'Fantasy', 'Romance'],
    language: 'Japanese',
    availableLanguages: ['English', 'Hindi', 'Japanese'],
    valence: 0.80,
    energy: 0.55,
    baseQuality: 0.98,
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Two teenagers share a magical connection upon discovering they are swapping bodies across time and space.',
    moodSynergy: {
      reflective: 'Breathtaking visual skies and RADWIMPS soundtrack create deep emotional resonance on destiny.',
      lonely: 'Speaks directly to the universal yearning to find someone who understands you completely.',
      calm: 'Immersive celestial aesthetics transport you to a peaceful, wonder-filled universe.'
    },
    moodTags: ['reflective', 'lonely', 'calm', 'upbeat'],
    streamPlatform: 'Crunchyroll',
    streamUrl: 'https://www.crunchyroll.com'
  },
  {
    id: 'ani-4',
    type: 'anime',
    title: 'Haikyu!!',
    year: '2014–2020',
    duration: '4 Seasons',
    rating: 'TV-14',
    director: 'Susumu Mitsunaka',
    genres: ['Anime', 'Sports', 'Comedy'],
    language: 'Japanese',
    availableLanguages: ['English', 'Japanese', 'Hindi'],
    valence: 0.88,
    energy: 0.88,
    baseQuality: 0.95,
    image: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Determined to become a volleyball legend despite his short stature, Hinata joins Karasuno High School.',
    moodSynergy: {
      upbeat: 'Pure unadulterated motivation and infectious team spirit that makes you want to conquer challenges.',
      tired: 'Inspires tired spirits with an irresistible surge of positive willpower and humor.',
      excited: 'Nail-biting match points and hyper-dynamic animation that gets your pulse racing.'
    },
    moodTags: ['upbeat', 'tired', 'excited', 'lonely'],
    streamPlatform: 'Netflix',
    streamUrl: 'https://www.netflix.com'
  },
  {
    id: 'ani-5',
    type: 'anime',
    title: 'Laid-Back Camp (Yuru Camp)',
    year: '2018–Present',
    duration: '3 Seasons',
    rating: 'TV-PG',
    director: 'Yoshiaki Kyogoku',
    genres: ['Anime', 'Slice of Life', 'Comedy'],
    language: 'Japanese',
    availableLanguages: ['English', 'Japanese'],
    valence: 0.88,
    energy: 0.20,
    baseQuality: 0.92,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'High school girls explore scenic camping sites across Japan, cooking delicious meals near Mount Fuji.',
    moodSynergy: {
      stressed: 'Clinically proven level of soothing calm. Acoustic guitar tunes melt stress away.',
      tired: 'Low-effort, ultra-relaxing slice-of-life anime ideal for unwinding in bed.',
      calm: "Celebrates solitude, nature's quiet majesty, and unhurried peace."
    },
    moodTags: ['stressed', 'tired', 'calm'],
    streamPlatform: 'Crunchyroll',
    streamUrl: 'https://www.crunchyroll.com'
  },
  {
    id: 'ani-6',
    type: 'anime',
    title: 'Violet Evergarden',
    year: '2018',
    duration: '1 Season',
    rating: 'TV-14',
    director: 'Taichi Ishidate',
    genres: ['Drama', 'Fantasy', 'Slice of Life'],
    language: 'Japanese',
    availableLanguages: ['English', 'Hindi', 'Japanese'],
    valence: 0.58,
    energy: 0.30,
    baseQuality: 0.97,
    image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A former soldier searches for the meaning of "I love you" while working as an Auto Memory Doll writing letters.',
    moodSynergy: {
      low: 'A moving journey through grief, recovery, and the restorative power of human words.',
      lonely: 'Every episode is a tender meditation on what it means to be truly understood.',
      reflective: 'Kyoto Animation at its peak with an orchestral soundtrack that stirs the heart.'
    },
    moodTags: ['low', 'lonely', 'reflective', 'calm'],
    streamPlatform: 'Netflix',
    streamUrl: 'https://www.netflix.com'
  },

  // ══════════════════════════════════════════
  // MUSIC (Direct Spotify Links)
  // ══════════════════════════════════════════
  {
    id: 'mus-1',
    type: 'music',
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy',
    year: '2016',
    duration: '3:50',
    genres: ['R&B', 'Electropop'],
    language: 'English',
    availableLanguages: ['English'],
    valence: 0.72,
    energy: 0.88,
    baseQuality: 0.94,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
    synopsis: "Sleek, dark electro-pop anthem with Daft Punk's signature vocoder pulse and hypnotic groove.",
    moodSynergy: {
      upbeat: 'Confident, stylish baseline that injects instant charisma and forward drive.',
      excited: 'Driving nighttime city rhythm suited for feeling focused and unstoppable.',
      calm: 'Smooth enough to loop comfortably while remaining mentally engaged.'
    },
    moodTags: ['upbeat', 'excited', 'calm'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/7MXVkk9YM50ug0w6EHafzg'
  },
  {
    id: 'mus-2',
    type: 'music',
    title: 'Until I Found You',
    artist: 'Stephen Sanchez',
    album: 'Easy on My Eyes',
    year: '2021',
    duration: '2:57',
    genres: ['Indie Pop', 'Retro', 'Doo-Wop'],
    language: 'English',
    availableLanguages: ['English'],
    valence: 0.82,
    energy: 0.30,
    baseQuality: 0.92,
    image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Warm, timeless 1950s-style romantic ballad with swooning reverb guitars and tender vocals.',
    moodSynergy: {
      calm: 'Nostalgic, warm, and comforting acoustic melody that gently settles the pulse.',
      reflective: 'Stirs sweet memories and romantic contemplation.',
      low: 'Gentle warmth that feels like a cozy embrace on a quiet evening.'
    },
    moodTags: ['calm', 'reflective', 'low', 'lonely'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/0T5iIrXA4p5G9F2rg9P2xF'
  },
  {
    id: 'mus-3',
    type: 'music',
    title: 'Kesariya',
    artist: 'Arijit Singh, Pritam',
    album: 'Brahmāstra',
    year: '2022',
    duration: '4:28',
    genres: ['Bollywood', 'Romantic', 'Sufi-Pop'],
    language: 'Hindi',
    availableLanguages: ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'English'],
    valence: 0.85,
    energy: 0.65,
    baseQuality: 0.96,
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A lush, soaring romantic anthem with traditional shehnai undertones and Arijit Singh’s soulful melody.',
    moodSynergy: {
      upbeat: 'Uplifting romantic resonance with a melody that brings an instant smile.',
      calm: 'Soul-stirring vocals that feel comforting, warm, and restorative.',
      reflective: 'Evokes deep feeling and nostalgia with every chorus.'
    },
    moodTags: ['upbeat', 'calm', 'reflective', 'lonely'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/6RWVlhL5yM4v3t1Vp0uQ2q'
  },
  {
    id: 'mus-4',
    type: 'music',
    title: 'Aaradhike',
    artist: 'Sooraj Santhosh, Sushin Shyam',
    album: 'Ambili',
    year: '2019',
    duration: '4:15',
    genres: ['Indie Folk', 'Acoustic', 'Melody'],
    language: 'Malayalam',
    availableLanguages: ['Malayalam', 'English'],
    valence: 0.88,
    energy: 0.38,
    baseQuality: 0.95,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A breezy, warm acoustic journey celebrating innocence and scenic mountain wanderlust.',
    moodSynergy: {
      calm: 'Serene acoustic guitar and gentle ukulele that feels like morning breeze in the hills.',
      stressed: 'Melts mental tension effortlessly with soothing, pure vocal harmony.',
      upbeat: 'Sweet optimism and wanderlust to brighten any quiet moment.'
    },
    moodTags: ['calm', 'stressed', 'upbeat', 'tired'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/3vU0u1zG9x0C9d2F8x1A5B'
  },
  {
    id: 'mus-5',
    type: 'music',
    title: 'Nenjame Nenjame',
    artist: 'Anirudh Ravichander, Shakthisree Gopalan',
    album: 'Maamannan',
    year: '2023',
    duration: '4:45',
    genres: ['Melody', 'Soul', 'Contemporary'],
    language: 'Tamil',
    availableLanguages: ['Tamil', 'Telugu', 'Hindi', 'English'],
    valence: 0.68,
    energy: 0.40,
    baseQuality: 0.95,
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A soothing, tender ballad exploring empathy, resilience, and compassionate companionship.',
    moodSynergy: {
      reflective: 'Deeply expressive vocal performance that honors quiet introspection.',
      lonely: 'Tender lyrics that comfort the heart like an empathetic conversation.',
      low: 'Gentle warmth that provides catharsis and solace.'
    },
    moodTags: ['reflective', 'lonely', 'low', 'calm'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/7zQ9X2K3M4v5T6Y7U8I9O0'
  },
  {
    id: 'mus-6',
    type: 'music',
    title: 'Samajavaragamana',
    artist: 'Sid Sriram, Thaman S',
    album: 'Ala Vaikunthapurramuloo',
    year: '2020',
    duration: '3:43',
    genres: ['Carnatic-Pop', 'Melody'],
    language: 'Telugu',
    availableLanguages: ['Telugu', 'Tamil', 'Hindi', 'Malayalam', 'English'],
    valence: 0.85,
    energy: 0.60,
    baseQuality: 0.96,
    image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'A melodious fusion of classical Carnatic phrasing with modern acoustic guitars and upbeat percussion.',
    moodSynergy: {
      upbeat: 'Infectious rhythm and Sid Sriram’s vocal flair create pure positive energy.',
      calm: 'Soulful acoustic flow that is pleasant and easy to groove with.',
      excited: 'Bright acoustic chords that lift the spirit instantly.'
    },
    moodTags: ['upbeat', 'calm', 'excited'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/5uC8x2v1N0m9L3k4J5H6G7'
  },
  {
    id: 'mus-7',
    type: 'music',
    title: 'Weightless',
    artist: 'Marconi Union',
    album: 'Weightless',
    year: '2011',
    duration: '8:08',
    genres: ['Ambient', 'Relaxation'],
    language: 'English',
    availableLanguages: ['English'],
    valence: 0.72,
    energy: 0.10,
    baseQuality: 0.94,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Engineered in collaboration with sound therapists, scientifically recognized to reduce heart rate and anxiety.',
    moodSynergy: {
      stressed: 'Specifically designed to lower cortisol levels through calming harmonic frequencies.',
      tired: 'Gently transitions an overstimulated mind into restorative rest and stillness.'
    },
    moodTags: ['stressed', 'tired', 'calm'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/6kkwzB6hXLIONkEk9JciA6'
  },
  {
    id: 'mus-8',
    type: 'music',
    title: 'Yellow',
    artist: 'Coldplay',
    album: 'Parachutes',
    year: '2000',
    duration: '4:29',
    genres: ['Alternative Rock', 'Acoustic'],
    language: 'English',
    availableLanguages: ['English'],
    valence: 0.70,
    energy: 0.38,
    baseQuality: 0.93,
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
    backdrop: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80',
    synopsis: 'Atmospheric, soaring acoustic rock anthem celebrating unconditional devotion under starlit skies.',
    moodSynergy: {
      calm: 'Timeless guitar warmth that feels like sunset on an open beach.',
      reflective: 'Evocative lyrics encouraging quiet gratitude and gentle reflection.',
      low: 'Reassuring and tender without being overwhelming.'
    },
    moodTags: ['calm', 'reflective', 'low', 'tired', 'lonely'],
    streamPlatform: 'Spotify',
    streamUrl: 'https://open.spotify.com/track/3AJwUDP919kvQ9QcozQPxg'
  }
];

// One title per mood/language/type combination keeps the catalog predictable
// while still giving every assessment route a local-language recommendation.
const CATALOG_MOODS = [
  { id: 'happy', valence: 0.9, energy: 0.72, description: 'A bright, feel-good pick designed to keep the smile going.' },
  { id: 'sad', valence: 0.28, energy: 0.3, description: 'A tender story that makes room for difficult feelings and gentle hope.' },
  { id: 'calm', valence: 0.72, energy: 0.25, description: 'A measured, soothing choice for an unhurried evening.' },
  { id: 'energetic', valence: 0.82, energy: 0.9, description: 'A lively, high-momentum pick for turning energy into fun.' },
  { id: 'stressed', valence: 0.62, energy: 0.2, description: 'A reassuring choice that helps release pressure without demanding too much.' },
  { id: 'peaceful', valence: 0.8, energy: 0.18, description: 'A serene experience for protecting a quiet, peaceful headspace.' },
  { id: 'melancholic', valence: 0.42, energy: 0.32, description: 'A beautifully reflective choice for sitting with nostalgia.' },
  { id: 'energized', valence: 0.88, energy: 0.96, description: 'A propulsive favorite for channeling momentum into celebration.' },
  { id: 'anxious', valence: 0.58, energy: 0.22, description: 'A grounding selection with enough warmth to settle a busy mind.' },
  { id: 'relaxed', valence: 0.78, energy: 0.2, description: 'An easygoing selection for a comfortable, restorative pause.' },
];

const CATALOG_LANGUAGES = [
  { name: 'Hindi', code: 'hindi' },
  { name: 'Tamil', code: 'tamil' },
  { name: 'English', code: 'eng' },
  { name: 'Malayalam', code: 'malayalam' },
  { name: 'Telugu', code: 'tel' },
];

const CATALOG_TYPES = {
  movie: {
    platform: 'Prime Video',
    director: 'MoodMate Film Collective',
    titles: {
      Hindi: ['3 Idiots', 'Queen', 'Taare Zameen Par', 'Gully Boy', 'Zindagi Na Milegi Dobara', 'Kapoor & Sons', 'Tamasha', 'Dangal', 'Yeh Jawaani Hai Deewani', 'Karwaan'],
      Tamil: ['96', 'Vikram Vedha', 'Kadaisi Vivasayi', 'Soorarai Pottru', 'Jigarthanda', 'Raja Rani', 'Pariyerum Perumal', 'Kaithi', 'Oh My Kadavule', 'Pannaiyarum Padminiyum'],
      English: ['The Intouchables', 'Little Miss Sunshine', 'The Secret Life of Walter Mitty', 'The Martian', 'About Time', 'The Pursuit of Happyness', 'Chef', 'Paddington 2', 'Sing Street', 'The Grand Budapest Hotel'],
      Malayalam: ['Bangalore Days', 'Ustad Hotel', 'Kumbalangi Nights', 'Thondimuthalum Driksakshiyum', 'Minnal Murali', 'Premam', 'Home', 'Jaya Jaya Jaya Jaya Hey', 'Sudani from Nigeria', 'Android Kunjappan Version 5.25'],
      Telugu: ['Pelli Choopulu', 'Jersey', 'C/O Kancharapalem', 'Sita Ramam', 'Ala Vaikunthapurramuloo', 'Mahanati', 'Agent Sai Srinivasa Athreya', 'RRR', 'Fidaa', 'Oh Baby'],
    },
    genres: ['Drama', 'Comedy', 'Romance'],
  },
  series: {
    platform: 'Netflix',
    director: 'MoodMate Series Studio',
    titles: {
      Hindi: ['Panchayat', 'The Family Man', 'Kota Factory', 'Gullak', 'Rocket Boys', 'Made in Heaven', 'Aspirants', 'Permanent Roommates', 'TVF Tripling', 'Yeh Meri Family'],
      Tamil: ['Suzhal: The Vortex', 'Vadhandhi', 'Iru Dhuruvam', 'Queen', 'Auto Shankar', 'November Story', 'Fingertip', 'Paper Rocket', 'Time Enna Boss', 'Story of Things'],
      English: ['Ted Lasso', 'Schitt\'s Creek', 'The Bear', 'Only Murders in the Building', 'The Good Place', 'The Queen\'s Gambit', 'Anne with an E', 'Brooklyn Nine-Nine', 'Heartstopper', 'Our Planet'],
      Malayalam: ['Perilloor Premier League', 'Masterpeace', 'Maharani', 'Jaya Jaya Jaya Jaya Hey Stories', 'Kerala Crime Files', '1000 Babies', 'The Village', 'Oru Kattil Oru Muri', 'Love Under Construction', 'Manorathangal'],
      Telugu: ['Modern Love Hyderabad', 'Masti’s', 'CommitMental', 'Puli Meka', 'Save the Tigers', '9 Hours', 'Dhootha', 'Loser', 'Kumari Srimathi', 'Aha Naa Pellanta'],
    },
    genres: ['Drama', 'Comedy', 'Slice of Life'],
  },
  anime: {
    platform: 'Crunchyroll',
    director: '',
    titles: {
      Hindi: ['Doraemon: Nobita’s New Adventure', 'Pokémon Horizons', 'Naruto', 'One Piece', 'Haikyu!!', 'My Hero Academia', 'Your Name', 'Spirited Away', 'A Silent Voice', 'Demon Slayer'],
      Tamil: ['Doraemon: Nobita’s Sky Utopia', 'Pokémon Indigo League', 'Naruto Shippuden', 'One Piece: Wano', 'Haikyu!!', 'Your Name', 'Weathering with You', 'Suzume', 'Jujutsu Kaisen', 'Demon Slayer: Mugen Train'],
      English: ['Fullmetal Alchemist: Brotherhood', 'Cowboy Bebop', 'Spy x Family', 'Frieren: Beyond Journey\'s End', 'Mob Psycho 100', 'Attack on Titan', 'One Punch Man', 'Violet Evergarden', 'Kiki\'s Delivery Service', 'My Neighbor Totoro'],
      Malayalam: ['Doraemon: Nobita’s Little Star Wars', 'Pokémon Journeys', 'Naruto', 'One Piece', 'Haikyu!!', 'My Hero Academia', 'Your Name', 'Spirited Away', 'Suzume', 'Demon Slayer'],
      Telugu: ['Doraemon: Nobita’s Treasure Island', 'Pokémon Horizons', 'Naruto', 'One Piece', 'Haikyu!!', 'Your Name', 'Weathering with You', 'Jujutsu Kaisen', 'My Hero Academia', 'Demon Slayer'],
    },
    genres: ['Animation', 'Adventure', 'Fantasy'],
  },
  music: {
    platform: 'Spotify',
    director: '',
    artists: { Hindi: 'Arijit Singh', Tamil: 'Anirudh Ravichander', English: 'Coldplay', Malayalam: 'Sushin Shyam', Telugu: 'Sid Sriram' },
    titles: {
      Hindi: ['Gallan Goodiyaan', 'Agar Tum Saath Ho', 'Ilahi', 'Badtameez Dil', 'Kabira', 'Phir Le Aya Dil', 'Kun Faya Kun', 'Zinda', 'Love You Zindagi', 'Iktara'],
      Tamil: ['Vaathi Coming', 'Unakkenna Venum Sollu', 'Nenjame Nenjame', 'Arabic Kuthu', 'Enjoy Enjaami', 'Munbe Vaa', 'Maruvaarthai', 'Megham Karukatha', 'Chellamma', 'Katchi Sera'],
      English: ['Walking on Sunshine', 'Fix You', 'Weightless', 'Don’t Stop Me Now', 'Viva La Vida', 'The Night We Met', 'A Sky Full of Stars', 'Titanium', 'Here Comes the Sun', 'Bloom'],
      Malayalam: ['Aaradhike', 'Pavizha Mazha', 'Malare', 'Jimikki Kammal', 'Onakka Munthiri', 'Uyiril Thodum', 'Cherathukal', 'Parudeesa', 'Kudukku', 'Puthiyoru Lokam'],
      Telugu: ['Samajavaragamana', 'Inkem Inkem Inkem Kaavaale', 'Butta Bomma', 'Ramuloo Ramulaa', 'Neeli Neeli Aakasam', 'Vachindamma', 'Oh Sita Hey Rama', 'Maate Vinadhuga', 'Mind Block', 'Naatu Naatu'],
    },
    genres: ['Melody', 'Pop', 'Contemporary'],
  },
};

const PLATFORM_URLS = {
  'Prime Video': 'https://www.primevideo.com',
  Netflix: 'https://www.netflix.com',
  Crunchyroll: 'https://www.crunchyroll.com',
  Spotify: 'https://open.spotify.com',
};

const generatedCatalog = CATALOG_MOODS.flatMap((mood, moodIndex) => CATALOG_LANGUAGES.flatMap((language) => Object.entries(CATALOG_TYPES).map(([type, definition]) => {
  const title = definition.titles[language.name][moodIndex];
  const id = `${type === 'movie' ? 'mov' : type === 'series' ? 'ser' : type === 'anime' ? 'ani' : 'mus'}-${language.code}-${moodIndex + 1}`;
  return {
    id,
    title,
    type,
    language: language.name,
    genres: definition.genres,
    mood: [mood.id],
    moodTags: [mood.id],
    artist: type === 'music' ? definition.artists[language.name] : '',
    director: type === 'movie' || type === 'series' ? definition.director : '',
    description: `${title} is ${definition.genres[0].toLowerCase()} content in ${language.name}. ${mood.description}`,
    synopsis: `${title} is ${definition.genres[0].toLowerCase()} content in ${language.name}. ${mood.description}`,
    streamPlatform: definition.platform,
    streamUrl: PLATFORM_URLS[definition.platform],
    thumbnail: 'https://via.placeholder.com/300x450',
    image: 'https://via.placeholder.com/300x450',
    rating: Number((7.4 + ((moodIndex + language.code.length) % 22) / 10).toFixed(1)),
    releaseYear: 2010 + ((moodIndex * 3 + language.code.length) % 15),
    year: String(2010 + ((moodIndex * 3 + language.code.length) % 15)),
    availableLanguages: language.name === 'English' ? ['English'] : [language.name, 'English'],
    valence: mood.valence,
    energy: mood.energy,
    baseQuality: 0.82 + ((moodIndex + language.name.length) % 15) / 100,
  };
})));

export const mediaCatalog = [...legacyMediaCatalog, ...generatedCatalog];

// ─────────────────────────────────────────────
// QUERY & RANKING HELPERS
// ─────────────────────────────────────────────

/**
 * Filter & Rank recommendations tailored to detected mood profile and active category filter.
 * - 'for-you': Curated personalized suite generated specifically from current session (mood, language, format).
 * - 'all': Complete recommendation catalog sorted by match score.
 * - 'movie' | 'series' | 'anime' | 'music': Category-filtered view sorted by match score.
 */
function legacyGetRecommendationsByMood(moodId = 'calm', formatFilter = 'for-you', moodProfile = null) {
  const normalizedMood = (moodId || 'calm').toLowerCase();
  const preferredFormat = moodProfile?.preferredFormat || 'all';
  const preferredLang = moodProfile?.preferredLanguage || 'English';

  // 1. If formatFilter is a specific media type
  if (['movie', 'series', 'anime', 'music'].includes(formatFilter)) {
    const categoryItems = mediaCatalog.filter(item => item.type === formatFilter);
    const scored = categoryItems.map(item => {
      const scoreData = calculateMatchScore(item, moodProfile || { moodId: normalizedMood, valence: 0.70, energy: 0.40, preferredLanguage: preferredLang });
      const explanation = getMatchExplanation(item, moodProfile || { moodId: normalizedMood });
      return {
        ...item,
        matchScoreData: scoreData,
        matchScore: scoreData.scorePercent,
        matchScore5: scoreData.scoreOutOf5,
        formattedScore: scoreData.formattedScore,
        matchExplanation: explanation,
        sortRank: scoreData.scoreOutOf5
      };
    });
    return scored.sort((a, b) => b.sortRank - a.sortRank);
  }

  // 2. Score complete catalog across all items
  const scoredAll = mediaCatalog.map(item => {
    const scoreData = calculateMatchScore(item, moodProfile || { moodId: normalizedMood, valence: 0.70, energy: 0.40, preferredLanguage: preferredLang });
    const explanation = getMatchExplanation(item, moodProfile || { moodId: normalizedMood });

    // Format bonus if user specified a preference
    let formatBonus = 0;
    if (preferredFormat !== 'all' && item.type === preferredFormat) {
      formatBonus = 0.35;
    }

    return {
      ...item,
      matchScoreData: scoreData,
      matchScore: scoreData.scorePercent,
      matchScore5: scoreData.scoreOutOf5,
      formattedScore: scoreData.formattedScore,
      matchExplanation: explanation,
      sortRank: scoreData.scoreOutOf5 + formatBonus
    };
  });

  // Apply language blending if regional language selected
  let rankedPool = scoredAll;
  if (preferredLang && preferredLang !== 'English') {
    const langMatched = scoredAll
      .filter(item => item.language === preferredLang || (item.availableLanguages && item.availableLanguages.includes(preferredLang)))
      .sort((a, b) => b.sortRank - a.sortRank);

    const globalItems = scoredAll
      .filter(item => !(item.language === preferredLang || (item.availableLanguages && item.availableLanguages.includes(preferredLang))))
      .sort((a, b) => b.sortRank - a.sortRank);

    const blended = [];
    let lIdx = 0;
    let gIdx = 0;
    while (lIdx < langMatched.length || gIdx < globalItems.length) {
      for (let i = 0; i < 3 && lIdx < langMatched.length; i++) {
        blended.push(langMatched[lIdx++]);
      }
      for (let i = 0; i < 2 && gIdx < globalItems.length; i++) {
        blended.push(globalItems[gIdx++]);
      }
    }
    rankedPool = blended;
  } else {
    rankedPool = scoredAll.sort((a, b) => b.sortRank - a.sortRank);
  }

  // 3. 'for-you' filter: Return the curated personalized suite specifically tailored to this session
  if (formatFilter === 'for-you') {
    if (preferredFormat !== 'all') {
      // Primary focus on preferred format + top cross-format complementary items
      const preferredItems = rankedPool.filter(item => item.type === preferredFormat).slice(0, 5);
      const complementaryItems = rankedPool.filter(item => item.type !== preferredFormat).slice(0, 3);
      return [...preferredItems, ...complementaryItems];
    }
    // High-affinity personalized selection (top 6-8 items directly matching current mood/session)
    const strongMatches = rankedPool.filter(item => item.matchScore5 >= 4.4 || item.moodTags.includes(normalizedMood)).slice(0, 8);
    return strongMatches.length >= 4 ? strongMatches : rankedPool.slice(0, 8);
  }

  // 4. 'all' filter: Return complete catalog
  return rankedPool;
}

/**
 * Retrieve single item by ID
 */
function scoreCatalog(items, moodProfile) {
  return items.map((item) => {
    const scoreData = calculateMatchScore(item, moodProfile);
    return {
      ...item,
      matchScoreData: scoreData,
      matchScore: scoreData.scorePercent,
      matchScore5: scoreData.scoreOutOf5,
      formattedScore: scoreData.formattedScore,
      matchExplanation: scoreData.contributors.slice(0, 2).join(' '),
      sortRank: scoreData.scorePercent,
    };
  }).sort((first, second) => second.sortRank - first.sortRank || first.title.localeCompare(second.title));
}

function diversifyForYou(rankedItems, moodProfile) {
  const preferredType = moodProfile.contentPreference;
  const preferredLanguage = moodProfile.languagePreference;
  const languageRank = (item) => {
    if (!preferredLanguage) return 0;
    if (item.language === preferredLanguage) return 2;
    if (item.availableLanguages?.includes(preferredLanguage)) return 1;
    return 0;
  };
  const scoreSorted = (items) => [...items].sort((first, second) => second.sortRank - first.sortRank || first.title.localeCompare(second.title));
  const preferenceSorted = scoreSorted(rankedItems).sort((first, second) => languageRank(second) - languageRank(first));

  // Keep the requested type as the majority of For You while retaining a few alternatives.
  // The first three slots require both the requested type and requested language.
  // The next three stay with the requested type, then the final two add media diversity.
  if (preferredType && preferredType !== 'all') {
    const preferredItems = scoreSorted(preferenceSorted.filter((item) => item.type === preferredType));
    const languageItems = preferredItems.filter((item) => item.language === preferredLanguage);
    const topLanguageIds = new Set(languageItems.slice(0, 3).map((item) => item.id));
    const remainingPreferredItems = preferredItems.filter((item) => !topLanguageIds.has(item.id));
    const diverseItems = scoreSorted(preferenceSorted.filter((item) => item.type !== preferredType));
    return [
      ...languageItems.slice(0, 3),
      ...remainingPreferredItems.slice(0, 3),
      ...diverseItems.slice(0, 2),
    ].slice(0, 8);
  }

  const genres = Array.isArray(moodProfile.genrePreference) ? moodProfile.genrePreference : [];
  if (genres.length > 0 || preferredLanguage) return preferenceSorted.slice(0, 8);

  const typeCounts = {};
  const selected = [];
  rankedItems.forEach((item) => {
    if (selected.length >= 8) return;
    if ((typeCounts[item.type] || 0) >= 3) return;
    selected.push(item);
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  });
  return selected.length >= 6 ? selected : rankedItems.slice(0, 8);
}

/**
 * One ranking path for every tab. The displayed match score is the same value
 * used to sort cards; language is already included as a bounded adjustment.
 */
export function getRecommendationsByMood(moodId = null, formatFilter = 'for-you', moodProfile = null) {
  if (!moodProfile?.assessmentStatus && formatFilter === 'for-you') return [];

  const pool = ['movie', 'series', 'anime', 'music'].includes(formatFilter)
    ? mediaCatalog.filter((item) => item.type === formatFilter)
    : mediaCatalog;
  const rankedItems = scoreCatalog(pool, moodProfile);

  if (formatFilter === 'for-you') return diversifyForYou(rankedItems, moodProfile);
  return rankedItems;
}

export function getItemById(id) {
  if (!id) return null;
  return mediaCatalog.find(item => item.id === id) || null;
}

/**
 * Retrieve related recommendations
 */
export function getRelatedItems(currentId, count = 4) {
  const current = getItemById(currentId);
  if (!current) return mediaCatalog.slice(0, count);

  return mediaCatalog
    .filter(item => item.id !== current.id)
    .filter(item => item.type === current.type || item.genres.some(g => current.genres.includes(g)))
    .slice(0, count);
}

export default {
  mediaCatalog,
  calculateMatchScore,
  getMatchExplanation,
  getRecommendationsByMood,
  getItemById,
  getRelatedItems
};
