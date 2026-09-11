// NewMoodMate Multimedia Catalog & Emotion-Aware Recommendation Engine
// Research foundations: Russell's Circumplex Model (Valence × Arousal),
// GoEmotions-inspired fine-grained emotion mapping, and MovieLens-style quality weighting.

// ─────────────────────────────────────────────
    title: 'Kumbalangi Nights',
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
  const userValence = moodProfile.valence ?? 0.70;
  const userEnergy = moodProfile.energy ?? 0.40;

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

export function buildStreamSearchUrl(title, provider, artist = '') {
  const encodedTitle = encodeURIComponent(title || '');
  const encodedMusicQuery = encodeURIComponent([title, artist].filter(Boolean).join(' '));
  const normalizedProvider = (provider || '').toLowerCase();

  if (normalizedProvider.includes('netflix')) return `https://www.netflix.com/search?q=${encodedTitle}`;
  if (normalizedProvider.includes('prime')) return `https://www.amazon.com/s?k=${encodedTitle}&i=instant-video`;
  if (normalizedProvider.includes('hotstar')) return `https://www.hotstar.com/in/search?q=${encodedTitle}`;
  if (normalizedProvider.replace(/\s+/g, '').includes('sunnxt')) return `https://www.sunnxt.com/search?q=${encodedTitle}`;
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
export function calculateMatchScore(item, moodProfile, options = {}) {
  if (!moodProfile?.assessmentStatus) {
    const scorePercent = Math.round((item.baseQuality ?? 0.5) * 100);
    const scoreOutOf5 = Number((scorePercent / 20).toFixed(1));
    return {
      scorePercent,
      scoreOutOf5,
      formattedScore: `${scoreOutOf5.toFixed(1)}`,
      rawScore: scorePercent,
      factorScores: {},
      adjustments: {},
      contributors: ['Selected for baseline editorial quality.'],
    };
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
  const totalActiveWeight = activeWeights.reduce((sum, [, weight]) => sum + weight, 0);
  const coreScore = (activeWeights.reduce((sum, [factor, weight]) => sum + factorScores[factor] * weight, 0) / (totalActiveWeight || 1)) * 100;
  const preferredGenres = Array.isArray(moodProfile.genrePreference) ? moodProfile.genrePreference : [];
  const matchedGenres = genreMatches(item, preferredGenres);
  const genreAdjustment = preferredGenres.length ? (matchedGenres.length / preferredGenres.length) * 12 : 0;
  const applyLanguage = options.includeLanguage !== false && moodProfile.languagePreference;
  const language = applyLanguage ? languageAdjustment(item, moodProfile.languagePreference) : { score: 0, label: null };
  const rawScore = clamp(coreScore + genreAdjustment + language.score, 0, 100);
  const scorePercent = Math.round(rawScore);
  const scoreOutOf5 = Number((scorePercent / 20).toFixed(1));
  const contributors = [];
  if (matchedGenres.length) contributors.push('Matches your preference for ' + matchedGenres.join(' and ').toLowerCase() + ' ' + (moodProfile.contentPreference !== 'all' ? moodProfile.contentPreference + 's.' : 'content.'));
  if (language.label) contributors.push(language.label);
  if (factorScores.emotionalNeed !== null && factorScores.emotionalNeed >= 0.7) contributors.push('Fits your current need for ' + moodProfile.emotionalNeed.toLowerCase() + '.');
  if (factorScores.energy !== null && factorScores.energy >= 0.72) contributors.push('Fits your ' + (targetEnergy <= 0.4 ? 'low-energy' : targetEnergy >= 0.7 ? 'high-energy' : 'current energy') + ' state.');
  if (factorScores.userIntent !== null && factorScores.userIntent >= 0.7) contributors.push('Supports your goal of ' + moodProfile.userIntent + '.');
  if (!contributors.length && factorScores.mood >= 0.72) contributors.push('Aligns with your current ' + (moodProfile.shortName?.toLowerCase() || mood) + ' mood.');
  if (!contributors.length) contributors.push('A balanced match based on the signals currently available.');
  return {
    scorePercent,
    scoreOutOf5,
    formattedScore: `${scoreOutOf5.toFixed(1)}`,
    rawScore,
    factorScores,
    adjustments: { genre: genreAdjustment, language: language.score },
    contributors,
  };
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
        title: 'Drishyam',
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
      Hindi: ['Lagaan', 'Queen', 'Taare Zameen Par', 'Gully Boy', 'Zindagi Na Milegi Dobara', 'Kapoor & Sons', 'Tamasha', 'Dangal', 'Yeh Jawaani Hai Deewani', 'Karwaan'],
      Tamil: ['Vikram Vedha', 'Kadaisi Vivasayi', 'Soorarai Pottru', 'Jigarthanda', 'Raja Rani', 'Pariyerum Perumal', 'Kaithi', 'Oh My Kadavule', 'Pannaiyarum Padminiyum', 'Jana Nayagan'],
      English: ['The Truman Show', 'Little Miss Sunshine', 'The Secret Life of Walter Mitty', 'The Martian', 'About Time', 'The Pursuit of Happyness', 'Chef', 'The Prestige', 'Sing Street', 'The Grand Budapest Hotel'],
      Malayalam: ['Bangalore Days', 'Ustad Hotel', 'Drishyam', 'Thondimuthalum Driksakshiyum', 'Minnal Murali', 'Premam', 'Home', 'Jaya Jaya Jaya Jaya Hey', 'Sudani from Nigeria', 'Android Kunjappan Version 5.25'],
      Telugu: ['Pelli Choopulu', 'Jersey', 'C/O Kancharapalem', 'Sita Ramam', 'Ala Vaikunthapurramuloo', 'Mahanati', 'Agent Sai Srinivasa Athreya', 'RRR', 'Fidaa', 'Oh Baby'],
    },
    genres: ['Drama', 'Comedy', 'Romance'],
  },
  series: {
    platform: 'Netflix',
    director: 'MoodMate Series Studio',
    titles: {
      Hindi: ['Scam 1992', 'The Family Man', 'Kota Factory', 'Gullak', 'Rocket Boys', 'Made in Heaven', 'Aspirants', 'Permanent Roommates', 'TVF Tripling', 'Yeh Meri Family'],
      Tamil: ['Ayali', 'Vadhandhi', 'Iru Dhuruvam', 'Queen', 'Auto Shankar', 'November Story', 'Fingertip', 'Paper Rocket', 'Time Enna Boss', 'Story of Things'],
      English: ['Breaking Bad', 'Schitt\'s Creek', 'The Bear', 'Only Murders in the Building', 'The Good Place', 'The Queen\'s Gambit', 'Anne with an E', 'Brooklyn Nine-Nine', 'Heartstopper', 'Our Planet'],
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
      Tamil: ['Vaathi Coming', 'Unakkenna Venum Sollu', 'Vaseegara', 'Arabic Kuthu', 'Enjoy Enjaami', 'Munbe Vaa', 'Maruvaarthai', 'Megham Karukatha', 'Chellamma', 'Katchi Sera'],
      English: ['Walking on Sunshine', 'Fix You', 'Clocks', 'Don’t Stop Me Now', 'Viva La Vida', 'The Night We Met', 'A Sky Full of Stars', 'Titanium', 'Here Comes the Sun', 'Bloom'],
      Malayalam: ['Muthal Nee Mudivum Nee', 'Pavizha Mazha', 'Malare', 'Jimikki Kammal', 'Onakka Munthiri', 'Uyiril Thodum', 'Cherathukal', 'Parudeesa', 'Kudukku', 'Puthiyoru Lokam'],
      Telugu: ['Yenti Yenti', 'Inkem Inkem Inkem Kaavaale', 'Butta Bomma', 'Ramuloo Ramulaa', 'Neeli Neeli Aakasam', 'Vachindamma', 'Oh Sita Hey Rama', 'Maate Vinadhuga', 'Mind Block', 'Naatu Naatu'],
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

export const mediaCatalog = [
  {
    "id": "mov-1",
    "type": "movie",
    "title": "The Secret Life of Walter Mitty",
    "year": "2013",
    "duration": "1h 54m",
    "rating": "PG",
    "director": "Ben Stiller",
    "genres": [
      "Adventure",
      "Comedy",
      "Drama"
    ],
    "language": "English",
    "availableLanguages": [
      "English",
      "Hindi"
    ],
    "valence": 0.8,
    "energy": 0.45,
    "baseQuality": 0.94,
    "image": "https://image.tmdb.org/t/p/w500/iAo1hlzsPV9XpYcLQp6Ud065tGO.jpg",
    "backdrop": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "A timid magazine photo manager who lives life vicariously through daydreams embarks on a true-life adventure when a negative goes missing.",
    "moodSynergy": {
      "calm": "Stunning Icelandic landscapes and a warm acoustic soundtrack create a meditative, gentle escape.",
      "reflective": "Explores intentional living, overcoming passive dreaming, and finding beauty in ordinary life.",
      "low": "A reassuring reminder that unexpected beauty and new beginnings are always possible.",
      "tired": "Visually serene vistas that soothe without demanding intense cognitive effort."
    },
    "moodTags": [
      "calm",
      "reflective",
      "low",
      "tired"
    ],
    "streamPlatform": "Disney+",
    "streamUrl": "https://www.disneyplus.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/iAo1hlzsPV9XpYcLQp6Ud065tGO.jpg",
    "description": "A timid magazine photo manager who lives life vicariously through daydreams embarks on a true-life adventure when a negative goes missing."
  },
  {
    "id": "mov-2",
    "type": "movie",
    "title": "Spider-Man: Into the Spider-Verse",
    "year": "2018",
    "duration": "1h 57m",
    "rating": "PG",
    "director": "Bob Persichetti, Peter Ramsey",
    "genres": [
      "Animation",
      "Action",
      "Adventure"
    ],
    "language": "English",
    "availableLanguages": [
      "English",
      "Hindi",
      "Tamil",
      "Telugu"
    ],
    "valence": 0.88,
    "energy": 0.9,
    "baseQuality": 0.98,
    "image": "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    "backdrop": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Struggling to find his place in the world while juggling school and family, Brooklyn teenager Miles Morales is unexpectedly bitten by a radioactive spider and develops unfathomable powers just like the one and only Spider-Man. While wrestling with the implications of his new abilities, Miles discovers a super collider created by the madman Wilson \"Kingpin\" Fisk, causing others from across the Spider-Verse to be inadvertently transported to his dimension.",
    "moodSynergy": {
      "upbeat": "Revolutionary visual style and an infectious hip-hop soundtrack multiply high energy.",
      "excited": "Fast-paced adrenaline, witty humor, and jaw-dropping animation craft.",
      "bored": "Relentless creativity and rapid-fire visual storytelling instantly eliminate boredom."
    },
    "moodTags": [
      "upbeat",
      "excited",
      "bored"
    ],
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    "description": "Struggling to find his place in the world while juggling school and family, Brooklyn teenager Miles Morales is unexpectedly bitten by a radioactive spider and develops unfathomable powers just like the one and only Spider-Man. While wrestling with the implications of his new abilities, Miles discovers a super collider created by the madman Wilson \"Kingpin\" Fisk, causing others from across the Spider-Verse to be inadvertently transported to his dimension."
  },
  {
    "id": "mov-3",
    "type": "movie",
    "title": "Inception",
    "year": "2010",
    "duration": "2h 28m",
    "rating": "PG-13",
    "director": "Christopher Nolan",
    "genres": [
      "Sci-Fi",
      "Action",
      "Thriller"
    ],
    "language": "English",
    "availableLanguages": [
      "English",
      "Hindi",
      "Tamil",
      "Telugu"
    ],
    "valence": 0.65,
    "energy": 0.8,
    "baseQuality": 0.96,
    "image": "https://image.tmdb.org/t/p/w500/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
    "backdrop": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: \"inception\", the implantation of another person's idea into a target's subconscious.",
    "moodSynergy": {
      "reflective": "Christopher Nolan's layered dream architecture and Hans Zimmer's score stimulate deep analytical focus.",
      "bored": "Multi-tiered heist tension demands complete immersion, curing mental restlessness.",
      "excited": "High-concept mind-bending set pieces and breathtaking zero-gravity combat."
    },
    "moodTags": [
      "reflective",
      "bored",
      "excited"
    ],
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.amazon.com/gp/video/storefront",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
    "description": "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: \"inception\", the implantation of another person's idea into a target's subconscious."
  },
  {
    "id": "mov-4",
    "type": "movie",
    "title": "Good Will Hunting",
    "year": "1997",
    "duration": "2h 06m",
    "rating": "R",
    "director": "Gus Van Sant",
    "genres": [
      "Drama",
      "Romance"
    ],
    "language": "English",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.68,
    "energy": 0.35,
    "baseQuality": 0.95,
    "image": "https://image.tmdb.org/t/p/w500/z2FnLKpFi1HPO7BEJxdkv6hpJSU.jpg",
    "backdrop": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Will Hunting is a headstrong, working-class genius who is failing the lessons of life. After one too many run-ins with the law, Will's last chance is a psychology professor, who might be the only man who can reach him.",
    "moodSynergy": {
      "reflective": "Dialogue-driven exploration of vulnerability, unspoken trauma, and profound human connection.",
      "lonely": "Deeply comforting portrayal of unconditional friendship and empathetic mentorship.",
      "low": "Cathartic emotional payoff with memorable performances that leave you feeling heard."
    },
    "moodTags": [
      "reflective",
      "lonely",
      "low",
      "calm"
    ],
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.amazon.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/z2FnLKpFi1HPO7BEJxdkv6hpJSU.jpg",
    "description": "Will Hunting is a headstrong, working-class genius who is failing the lessons of life. After one too many run-ins with the law, Will's last chance is a psychology professor, who might be the only man who can reach him."
  },
  {
    "id": "mov-5",
    "type": "movie",
    "title": "Paddington 2",
    "year": "2017",
    "duration": "1h 43m",
    "rating": "PG",
    "director": "Paul King",
    "genres": [
      "Comedy",
      "Family",
      "Adventure"
    ],
    "language": "English",
    "availableLanguages": [
      "English",
      "Hindi"
    ],
    "valence": 0.95,
    "energy": 0.55,
    "baseQuality": 0.97,
    "image": "https://image.tmdb.org/t/p/w500/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
    "backdrop": "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Paddington, now happily settled with the Browns, picks up a series of odd jobs to buy the perfect present for his Aunt Lucy, but it is stolen.",
    "moodSynergy": {
      "stressed": "Pure comfort food for the soul. Relieves anxiety in minutes with boundless charm.",
      "tired": "Effortless viewing with zero emotional friction and heartwarming visual comedy.",
      "upbeat": "Infectious optimism and warm humanity that multiply cheerful feelings."
    },
    "moodTags": [
      "stressed",
      "tired",
      "upbeat",
      "calm"
    ],
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
    "description": "Paddington, now happily settled with the Browns, picks up a series of odd jobs to buy the perfect present for his Aunt Lucy, but it is stolen."
  },
  {
    "id": "mov-6",
    "type": "movie",
    "title": "Kumbalangi Nights",
    "year": "2019",
    "duration": "2h 15m",
    "rating": "TV-14",
    "director": "Madhu C. Narayanan",
    "genres": [
      "Drama",
      "Family",
      "Comedy"
    ],
    "language": "Malayalam",
    "availableLanguages": [
      "Malayalam",
      "English",
      "Tamil",
      "Telugu",
      "Hindi"
    ],
    "valence": 0.82,
    "energy": 0.4,
    "baseQuality": 0.96,
    "image": "https://image.tmdb.org/t/p/w500/lJ3RvIirE2C7gdBKvPRaoQ3iCo2.jpg",
    "backdrop": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Four brothers living in the fishing hamlet of Kumbalangi share a love-hate relationship with each other. Their relationship progresses when Saji, Boney and Franky decide to help Bobby stand by his love.",
    "moodSynergy": {
      "calm": "Serene backwater visuals and warm acoustic melodies provide deep, soul-healing comfort.",
      "reflective": "Tender exploration of brotherhood, mental vulnerability, and wholesome love.",
      "lonely": "The home becomes a sanctuary of belonging, welcoming everyone into warmth."
    },
    "moodTags": [
      "calm",
      "reflective",
      "lonely",
      "low"
    ],
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.amazon.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/lJ3RvIirE2C7gdBKvPRaoQ3iCo2.jpg",
    "description": "Four brothers living in the fishing hamlet of Kumbalangi share a love-hate relationship with each other. Their relationship progresses when Saji, Boney and Franky decide to help Bobby stand by his love."
  },
  {
    "id": "mov-7",
    "type": "movie",
    "title": "3 Idiots",
    "year": "2009",
    "duration": "2h 50m",
    "rating": "PG-13",
    "director": "Rajkumar Hirani",
    "genres": [
      "Comedy",
      "Drama"
    ],
    "language": "Hindi",
    "availableLanguages": [
      "Hindi",
      "English",
      "Tamil",
      "Telugu"
    ],
    "valence": 0.9,
    "energy": 0.7,
    "baseQuality": 0.97,
    "image": "https://image.tmdb.org/t/p/w500/66A9MqXOyVFCssoloscw79z8Tew.jpg",
    "backdrop": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Rascal. Joker. Dreamer. Genius... You've never met a college student quite like \"Rancho.\" From the moment he arrives at India's most prestigious university, Rancho's outlandish schemes turn the campus upside down—along with the lives of his two newfound best friends. Together, they make life miserable for \"Virus,\" the school’s uptight and heartless dean. But when Rancho catches the eye of the dean's daughter, Virus sets his sights on flunking out the \"3 idiots\" once and for all.",
    "moodSynergy": {
      "upbeat": "Inspirational laughter, iconic friendship anthem, and uplifting life perspective.",
      "stressed": "Takes the pressure off career and societal stress with profound humor and heart.",
      "lonely": "Celebrates unconditional friendship that transcends time and distance."
    },
    "moodTags": [
      "upbeat",
      "stressed",
      "lonely",
      "excited"
    ],
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.amazon.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/66A9MqXOyVFCssoloscw79z8Tew.jpg",
    "description": "Rascal. Joker. Dreamer. Genius... You've never met a college student quite like \"Rancho.\" From the moment he arrives at India's most prestigious university, Rancho's outlandish schemes turn the campus upside down—along with the lives of his two newfound best friends. Together, they make life miserable for \"Virus,\" the school’s uptight and heartless dean. But when Rancho catches the eye of the dean's daughter, Virus sets his sights on flunking out the \"3 idiots\" once and for all."
  },
  {
    "id": "mov-8",
    "type": "movie",
    "title": "96",
    "year": "2025",
    "duration": "2h 38m",
    "rating": "TV-14",
    "director": "C. Prem Kumar",
    "genres": [
      "Romance",
      "Drama",
      "Nostalgia"
    ],
    "language": "Tamil",
    "availableLanguages": [
      "Tamil",
      "Telugu",
      "English",
      "Hindi"
    ],
    "valence": 0.65,
    "energy": 0.35,
    "baseQuality": 0.95,
    "image": "https://image.tmdb.org/t/p/w500/gWKZ1iLhukvLoh8XY2N4tMvRQ2M.jpg",
    "backdrop": "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Former bomb disposal expert and his fiancée board a high-speed train. Also, a well-known physics teacher who was involved in an affair scandal, also boards the same train in order to win back his wife. At the same time, there's a bomb on the train!",
    "moodSynergy": {
      "reflective": "Govind Vasantha's soulful violin score and poetic dialogue stir sweet nostalgia.",
      "lonely": "Tender companionship celebrating quiet love that lingers across time.",
      "calm": "Slow, graceful storytelling bathed in nighttime gentle warmth."
    },
    "moodTags": [
      "reflective",
      "lonely",
      "calm",
      "low"
    ],
    "streamPlatform": "Sun NXT",
    "streamUrl": "https://www.sunnxt.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/gWKZ1iLhukvLoh8XY2N4tMvRQ2M.jpg",
    "description": "Former bomb disposal expert and his fiancée board a high-speed train. Also, a well-known physics teacher who was involved in an affair scandal, also boards the same train in order to win back his wife. At the same time, there's a bomb on the train!"
  },
  {
    "id": "ser-1",
    "type": "series",
    "title": "Ted Lasso",
    "year": "2020",
    "duration": "3 Seasons",
    "rating": "TV-MA",
    "director": "Jason Sudeikis, Bill Lawrence",
    "genres": [
      "Comedy",
      "Drama",
      "Sport"
    ],
    "language": "English",
    "availableLanguages": [
      "English",
      "Hindi"
    ],
    "valence": 0.9,
    "energy": 0.55,
    "baseQuality": 0.98,
    "image": "https://image.tmdb.org/t/p/w500/uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg",
    "backdrop": "https://images.unsplash.com/photo-1489944445391-11dd35d63ecf?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Ted Lasso, an American football coach, moves to England when he's hired to manage a soccer team—despite having no experience. With cynical players and a doubtful town, will he get them to see the Ted Lasso Way?",
    "moodSynergy": {
      "stressed": "A warm antidote to cynicism. Reduces tension through wholesome camaraderie.",
      "low": "Kind, supportive, and restorative—restores faith in people and gentle perseverance.",
      "lonely": "The clubhouse becomes an empathetic family with deep loyalty and heart."
    },
    "moodTags": [
      "stressed",
      "low",
      "lonely",
      "calm",
      "upbeat"
    ],
    "streamPlatform": "Apple TV+",
    "streamUrl": "https://tv.apple.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg",
    "description": "Ted Lasso, an American football coach, moves to England when he's hired to manage a soccer team—despite having no experience. With cynical players and a doubtful town, will he get them to see the Ted Lasso Way?"
  },
  {
    "id": "ser-2",
    "type": "series",
    "title": "Panchayat",
    "year": "2020",
    "duration": "3 Seasons",
    "rating": "TV-14",
    "director": "Deepak Kumar Mishra",
    "genres": [
      "Comedy",
      "Drama",
      "Slice of Life"
    ],
    "language": "Hindi",
    "availableLanguages": [
      "Hindi",
      "Tamil",
      "Telugu",
      "Malayalam",
      "English"
    ],
    "valence": 0.85,
    "energy": 0.45,
    "baseQuality": 0.97,
    "image": "https://image.tmdb.org/t/p/w500/xrfvAhrMdT6Uwg5fyTyQAZBYyiu.jpg",
    "backdrop": "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Panchayat is a comedy-drama, which captures the journey of an engineering graduate Abhishek, who for lack of a better job option joins as secretary of a panchayat office in a remote village of Uttar Pradesh. Stuck between crazy villagers and a difficult village lifestyle Abhishek starts his job with the sole motivation of getting out of there as soon as possible, for which he even prepares for CAT.",
    "moodSynergy": {
      "calm": "Gentle rural acoustic warmth with zero toxicity and endearing characters.",
      "stressed": "Soothing antidote to corporate hustle with grounded humor and village life.",
      "lonely": "Heartwarming community bonds that make you smile with every episode."
    },
    "moodTags": [
      "calm",
      "stressed",
      "lonely",
      "upbeat",
      "tired"
    ],
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.amazon.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xrfvAhrMdT6Uwg5fyTyQAZBYyiu.jpg",
    "description": "Panchayat is a comedy-drama, which captures the journey of an engineering graduate Abhishek, who for lack of a better job option joins as secretary of a panchayat office in a remote village of Uttar Pradesh. Stuck between crazy villagers and a difficult village lifestyle Abhishek starts his job with the sole motivation of getting out of there as soon as possible, for which he even prepares for CAT."
  },
  {
    "id": "ser-3",
    "type": "series",
    "title": "The Bear",
    "year": "2022",
    "duration": "3 Seasons",
    "rating": "TV-MA",
    "director": "Christopher Storer",
    "genres": [
      "Drama",
      "Comedy"
    ],
    "language": "English",
    "availableLanguages": [
      "English",
      "Hindi"
    ],
    "valence": 0.6,
    "energy": 0.82,
    "baseQuality": 0.96,
    "image": "https://image.tmdb.org/t/p/w500/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
    "backdrop": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Carmy, a young fine-dining chef, comes home to Chicago to run his family sandwich shop. As he fights to transform the shop and himself, he works alongside a rough-around-the-edges crew that ultimately reveal themselves as his chosen family.",
    "moodSynergy": {
      "reflective": "Captures the raw beauty of dedication, chosen family, and the pursuit of excellence.",
      "bored": "Electric, pulsating kitchen pace that commands full sensory focus."
    },
    "moodTags": [
      "reflective",
      "bored",
      "excited"
    ],
    "streamPlatform": "Disney+ Hotstar",
    "streamUrl": "https://www.hotstar.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
    "description": "Carmy, a young fine-dining chef, comes home to Chicago to run his family sandwich shop. As he fights to transform the shop and himself, he works alongside a rough-around-the-edges crew that ultimately reveal themselves as his chosen family."
  },
  {
    "id": "ser-4",
    "type": "series",
    "title": "Stranger Things",
    "year": "2016",
    "duration": "4 Seasons",
    "rating": "TV-14",
    "director": "The Duffer Brothers",
    "genres": [
      "Sci-Fi",
      "Horror",
      "Drama"
    ],
    "language": "English",
    "availableLanguages": [
      "English",
      "Hindi",
      "Tamil",
      "Telugu"
    ],
    "valence": 0.65,
    "energy": 0.85,
    "baseQuality": 0.93,
    "image": "https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
    "backdrop": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
    "moodSynergy": {
      "excited": "80s synth nostalgia, fast-paced supernatural mystery, and friendship.",
      "bored": "Gripping episode cliffhangers that pull you into irresistible binge momentum."
    },
    "moodTags": [
      "excited",
      "bored",
      "upbeat"
    ],
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
    "description": "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl."
  },
  {
    "id": "ser-5",
    "type": "series",
    "title": "Schitt's Creek",
    "year": "2015",
    "duration": "6 Seasons",
    "rating": "TV-14",
    "director": "Dan Levy, Eugene Levy",
    "genres": [
      "Comedy"
    ],
    "language": "English",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.92,
    "energy": 0.5,
    "baseQuality": 0.95,
    "image": "https://image.tmdb.org/t/p/w500/iRfSzrPS5VYWQv7KVSEg2BZZL6C.jpg",
    "backdrop": "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Formerly filthy rich video store magnate Johnny Rose, his soap star wife Moira, and their two kids, über-hipster son David and socialite daughter Alexis, suddenly find themselves broke and forced to live in Schitt's Creek, a small depressing town they once bought as a joke.",
    "moodSynergy": {
      "stressed": "Zero anxiety, pure cozy humor that warms the room without demanding emotional effort.",
      "tired": "Effortless viewing packed with memorable one-liners and wholesome character growth.",
      "lonely": "A celebration of family, community acceptance, and love that feels welcoming."
    },
    "moodTags": [
      "stressed",
      "tired",
      "lonely",
      "calm",
      "upbeat"
    ],
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/iRfSzrPS5VYWQv7KVSEg2BZZL6C.jpg",
    "description": "Formerly filthy rich video store magnate Johnny Rose, his soap star wife Moira, and their two kids, über-hipster son David and socialite daughter Alexis, suddenly find themselves broke and forced to live in Schitt's Creek, a small depressing town they once bought as a joke."
  },
  {
    "id": "ser-6",
    "type": "series",
    "title": "Suzhal: The Vortex",
    "year": "2022",
    "duration": "2 Seasons",
    "rating": "TV-MA",
    "director": "Pushkar & Gayatri",
    "genres": [
      "Mystery",
      "Crime",
      "Thriller"
    ],
    "language": "Tamil",
    "availableLanguages": [
      "Tamil",
      "Telugu",
      "Hindi",
      "Malayalam",
      "English"
    ],
    "valence": 0.5,
    "energy": 0.75,
    "baseQuality": 0.94,
    "image": "https://m.media-amazon.com/images/M/MV5BYzJlN2JkZjktOWE2OS00Mjk3LWE4MTAtMTcyMjMxNTdmMWFiXkEyXkFqcGc@._V1_.jpg",
    "backdrop": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "A minor girl goes missing in a small town in Tamilnadu and an investigation follows. A sub inspector investigating a missing girl's case in a uncovers some shocking revelations and dirty truths those threaten to shake up the cultural societal fabric.",
    "moodSynergy": {
      "reflective": "Atmospheric cinematography and layered character writing pull you into a gripping mystery.",
      "bored": "Relentless suspense and visual grandeur keep your eyes glued to the screen."
    },
    "moodTags": [
      "reflective",
      "bored",
      "excited"
    ],
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.amazon.com",
    "thumbnail": "https://m.media-amazon.com/images/M/MV5BYzJlN2JkZjktOWE2OS00Mjk3LWE4MTAtMTcyMjMxNTdmMWFiXkEyXkFqcGc@._V1_.jpg",
    "description": "A minor girl goes missing in a small town in Tamilnadu and an investigation follows. A sub inspector investigating a missing girl's case in a uncovers some shocking revelations and dirty truths those threaten to shake up the cultural societal fabric."
  },
  {
    "id": "ani-1",
    "type": "anime",
    "title": "Spirited Away",
    "year": "2024",
    "duration": "2h 05m",
    "rating": "PG",
    "director": "Hayao Miyazaki",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "language": "Japanese",
    "availableLanguages": [
      "English",
      "Hindi",
      "Japanese",
      "Tamil"
    ],
    "valence": 0.78,
    "energy": 0.4,
    "baseQuality": 0.99,
    "image": "https://image.tmdb.org/t/p/w500/8uajlTh0Gg2mTn3pu3KClBVzf5A.jpg",
    "backdrop": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "The company of the stage \"the secret of Sen and Chihiro\" gathered together in Tokyo again. The new cast is also added, and it challenges the first overseas performance at the London Colosseum in the theater and the sacred end in west end. The company that arrived in London is soon baptized. Theater is narrow compared to Japan, and audience seats are wide. The set is also rebuilt, and thted lassoerformance and the performance of the theater are changed. And the biggest problem is the difference between the wall and the way of working between English staff. From the first day of the practice, trouble attacks without permission. Training in London was the beginning of the disturbance.",
    "moodSynergy": {
      "calm": "Joe Hisaishi's legendary piano score and Studio Ghibli watercolors create a dreamlike sanctuary.",
      "reflective": "Timeless themes of resilience, growing up, memory, and quiet gratitude.",
      "low": "Gentle escapism that nourishes tired spirits with wonder and visual poetry."
    },
    "moodTags": [
      "calm",
      "reflective",
      "low",
      "tired"
    ],
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8uajlTh0Gg2mTn3pu3KClBVzf5A.jpg",
    "description": "The company of the stage \"the secret of Sen and Chihiro\" gathered together in Tokyo again. The new cast is also added, and it challenges the first overseas performance at the London Colosseum in the theater and the sacred end in west end. The company that arrived in London is soon baptized. Theater is narrow compared to Japan, and audience seats are wide. The set is also rebuilt, and the performance and the performance of the theater are changed. And the biggest problem is the difference between the wall and the way of working between English staff. From the first day of the practice, trouble attacks without permission. Training in London was the beginning of the disturbance."
  },
  {
    "id": "ani-2",
    "type": "anime",
    "title": "Demon Slayer: Kimetsu no Yaiba",
    "year": "2019",
    "duration": "4 Seasons",
    "rating": "TV-MA",
    "director": "Haruo Sotozaki",
    "genres": [
      "Anime",
      "Action",
      "Fantasy"
    ],
    "language": "Japanese",
    "availableLanguages": [
      "English",
      "Hindi",
      "Japanese",
      "Tamil",
      "Telugu"
    ],
    "valence": 0.72,
    "energy": 0.92,
    "baseQuality": 0.96,
    "image": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "backdrop": "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "moodSynergy": {
      "excited": "Ufotable's world-class visual effects, thrilling swordsmanship, and epic battle tracks.",
      "upbeat": "Tanjiro's unwavering resolve and compassion provide immense inspirational energy.",
      "bored": "Hyper-kinetic fight choreography that guarantees zero dull moments."
    },
    "moodTags": [
      "excited",
      "upbeat",
      "bored"
    ],
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "description": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost."
  },
  {
    "id": "ani-3",
    "type": "anime",
    "title": "Your Name (Kimi no Na wa)",
    "year": "2016",
    "duration": "1h 46m",
    "rating": "PG",
    "director": "Makoto Shinkai",
    "genres": [
      "Animation",
      "Drama",
      "Fantasy",
      "Romance"
    ],
    "language": "Japanese",
    "availableLanguages": [
      "English",
      "Hindi",
      "Japanese"
    ],
    "valence": 0.8,
    "energy": 0.55,
    "baseQuality": 0.98,
    "image": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Two teenagers share a magical connection upon discovering they are swapping bodies across time and space.",
    "moodSynergy": {
      "reflective": "Breathtaking visual skies and RADWIMPS soundtrack create deep emotional resonance on destiny.",
      "lonely": "Speaks directly to the universal yearning to find someone who understands you completely.",
      "calm": "Immersive celestial aesthetics transport you to a peaceful, wonder-filled universe."
    },
    "moodTags": [
      "reflective",
      "lonely",
      "calm",
      "upbeat"
    ],
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com"
  },
  {
    "id": "ani-4",
    "type": "anime",
    "title": "Haikyu!!",
    "year": "2014",
    "duration": "4 Seasons",
    "rating": "TV-14",
    "director": "Susumu Mitsunaka",
    "genres": [
      "Anime",
      "Sports",
      "Comedy"
    ],
    "language": "Japanese",
    "availableLanguages": [
      "English",
      "Japanese",
      "Hindi"
    ],
    "valence": 0.88,
    "energy": 0.88,
    "baseQuality": 0.95,
    "image": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "backdrop": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "moodSynergy": {
      "upbeat": "Pure unadulterated motivation and infectious team spirit that makes you want to conquer challenges.",
      "tired": "Inspires tired spirits with an irresistible surge of positive willpower and humor.",
      "excited": "Nail-biting match points and hyper-dynamic animation that gets your pulse racing."
    },
    "moodTags": [
      "upbeat",
      "tired",
      "excited",
      "lonely"
    ],
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "description": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined."
  },
  {
    "id": "ani-5",
    "type": "anime",
    "title": "Laid-Back Camp (Yuru Camp)",
    "year": "2020",
    "duration": "3 Seasons",
    "rating": "TV-PG",
    "director": "Yoshiaki Kyogoku",
    "genres": [
      "Anime",
      "Slice of Life",
      "Comedy"
    ],
    "language": "Japanese",
    "availableLanguages": [
      "English",
      "Japanese"
    ],
    "valence": 0.88,
    "energy": 0.2,
    "baseQuality": 0.92,
    "image": "https://image.tmdb.org/t/p/w500/5wJK1IMsWtWl1zyx7Uy4lg7rbNL.jpg",
    "backdrop": "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "This is the story of a winter day. Kagamihara Nadeshiko, a female high school student who moved from Shizuoka to Yamanashi, rode a bicycle to see Mt. Fuji, but unfortunately, the weather was cloudy and Mt. Fuji cannot be seen. Tired, Nadeshiko falls asleep on the spot and wakes up at night. This is her first time going there and she didn't know how to return.\n\nFortunately, Shima Rin, a girl who loves camping, saves her. They lit a bonfire to warm up and the sound of the blazing firewood permeates the silence of the lake.",
    "moodSynergy": {
      "stressed": "Clinically proven level of soothing calm. Acoustic guitar tunes melt stress away.",
      "tired": "Low-effort, ultra-relaxing slice-of-life anime ideal for unwinding in bed.",
      "calm": "Celebrates solitude, nature's quiet majesty, and unhurried peace."
    },
    "moodTags": [
      "stressed",
      "tired",
      "calm"
    ],
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/5wJK1IMsWtWl1zyx7Uy4lg7rbNL.jpg",
    "description": "This is the story of a winter day. Kagamihara Nadeshiko, a female high school student who moved from Shizuoka to Yamanashi, rode a bicycle to see Mt. Fuji, but unfortunately, the weather was cloudy and Mt. Fuji cannot be seen. Tired, Nadeshiko falls asleep on the spot and wakes up at night. This is her first time going there and she didn't know how to return.\n\nFortunately, Shima Rin, a girl who loves camping, saves her. They lit a bonfire to warm up and the sound of the blazing firewood permeates the silence of the lake."
  },
  {
    "id": "ani-6",
    "type": "anime",
    "title": "Violet Evergarden",
    "year": "2018",
    "duration": "1 Season",
    "rating": "TV-14",
    "director": "Taichi Ishidate",
    "genres": [
      "Drama",
      "Fantasy",
      "Slice of Life"
    ],
    "language": "Japanese",
    "availableLanguages": [
      "English",
      "Hindi",
      "Japanese"
    ],
    "valence": 0.58,
    "energy": 0.3,
    "baseQuality": 0.97,
    "image": "https://image.tmdb.org/t/p/w500/61EwFPqc0r1uJo6la49J55F8bQ8.jpg",
    "backdrop": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "The war is over, and Violet Evergarden needs a job. Scarred and emotionless, she takes a job as a letter writer to understand herself and her past.",
    "moodSynergy": {
      "low": "A moving journey through grief, recovery, and the restorative power of human words.",
      "lonely": "Every episode is a tender meditation on what it means to be truly understood.",
      "reflective": "Kyoto Animation at its peak with an orchestral soundtrack that stirs the heart."
    },
    "moodTags": [
      "low",
      "lonely",
      "reflective",
      "calm"
    ],
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/61EwFPqc0r1uJo6la49J55F8bQ8.jpg",
    "description": "The war is over, and Violet Evergarden needs a job. Scarred and emotionless, she takes a job as a letter writer to understand herself and her past."
  },
  {
    "id": "mus-1",
    "type": "music",
    "title": "Starboy",
    "artist": "The Weeknd ft. Daft Punk",
    "album": "Starboy",
    "year": "2016",
    "duration": "3:50",
    "genres": [
      "R&B",
      "Electropop"
    ],
    "language": "English",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.72,
    "energy": 0.88,
    "baseQuality": 0.94,
    "image": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Sleek, dark electro-pop anthem with Daft Punk's signature vocoder pulse and hypnotic groove.",
    "moodSynergy": {
      "upbeat": "Confident, stylish baseline that injects instant charisma and forward drive.",
      "excited": "Driving nighttime city rhythm suited for feeling focused and unstoppable.",
      "calm": "Smooth enough to loop comfortably while remaining mentally engaged."
    },
    "moodTags": [
      "upbeat",
      "excited",
      "calm"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/7MXVkk9YM50ug0w6EHafzg"
  },
  {
    "id": "mus-2",
    "type": "music",
    "title": "Until I Found You",
    "artist": "Stephen Sanchez",
    "album": "Easy on My Eyes",
    "year": "2021",
    "duration": "2:57",
    "genres": [
      "Indie Pop",
      "Retro",
      "Doo-Wop"
    ],
    "language": "English",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.82,
    "energy": 0.3,
    "baseQuality": 0.92,
    "image": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Warm, timeless 1950s-style romantic ballad with swooning reverb guitars and tender vocals.",
    "moodSynergy": {
      "calm": "Nostalgic, warm, and comforting acoustic melody that gently settles the pulse.",
      "reflective": "Stirs sweet memories and romantic contemplation.",
      "low": "Gentle warmth that feels like a cozy embrace on a quiet evening."
    },
    "moodTags": [
      "calm",
      "reflective",
      "low",
      "lonely"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/0T5iIrXA4p5G9F2rg9P2xF"
  },
  {
    "id": "mus-3",
    "type": "music",
    "title": "Kesariya",
    "artist": "Arijit Singh, Pritam",
    "album": "Brahmāstra",
    "year": "2022",
    "duration": "4:28",
    "genres": [
      "Bollywood",
      "Romantic",
      "Sufi-Pop"
    ],
    "language": "Hindi",
    "availableLanguages": [
      "Hindi",
      "Tamil",
      "Telugu",
      "Malayalam",
      "English"
    ],
    "valence": 0.85,
    "energy": 0.65,
    "baseQuality": 0.96,
    "image": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "A lush, soaring romantic anthem with traditional shehnai undertones and Arijit Singh’s soulful melody.",
    "moodSynergy": {
      "upbeat": "Uplifting romantic resonance with a melody that brings an instant smile.",
      "calm": "Soul-stirring vocals that feel comforting, warm, and restorative.",
      "reflective": "Evokes deep feeling and nostalgia with every chorus."
    },
    "moodTags": [
      "upbeat",
      "calm",
      "reflective",
      "lonely"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/6RWVlhL5yM4v3t1Vp0uQ2q"
  },
  {
    "id": "mus-4",
    "type": "music",
    "title": "Aaradhike",
    "artist": "Sooraj Santhosh, Sushin Shyam",
    "album": "Ambili",
    "year": "2019",
    "duration": "4:15",
    "genres": [
      "Indie Folk",
      "Acoustic",
      "Melody"
    ],
    "language": "Malayalam",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.38,
    "baseQuality": 0.95,
    "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "A breezy, warm acoustic journey celebrating innocence and scenic mountain wanderlust.",
    "moodSynergy": {
      "calm": "Serene acoustic guitar and gentle ukulele that feels like morning breeze in the hills.",
      "stressed": "Melts mental tension effortlessly with soothing, pure vocal harmony.",
      "upbeat": "Sweet optimism and wanderlust to brighten any quiet moment."
    },
    "moodTags": [
      "calm",
      "stressed",
      "upbeat",
      "tired"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/3vU0u1zG9x0C9d2F8x1A5B"
  },
  {
    "id": "mus-5",
    "type": "music",
    "title": "Nenjame Nenjame",
    "artist": "Anirudh Ravichander, Shakthisree Gopalan",
    "album": "Maamannan",
    "year": "2023",
    "duration": "4:45",
    "genres": [
      "Melody",
      "Soul",
      "Contemporary"
    ],
    "language": "Tamil",
    "availableLanguages": [
      "Tamil",
      "Telugu",
      "Hindi",
      "English"
    ],
    "valence": 0.68,
    "energy": 0.4,
    "baseQuality": 0.95,
    "image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "A soothing, tender ballad exploring empathy, resilience, and compassionate companionship.",
    "moodSynergy": {
      "reflective": "Deeply expressive vocal performance that honors quiet introspection.",
      "lonely": "Tender lyrics that comfort the heart like an empathetic conversation.",
      "low": "Gentle warmth that provides catharsis and solace."
    },
    "moodTags": [
      "reflective",
      "lonely",
      "low",
      "calm"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/7zQ9X2K3M4v5T6Y7U8I9O0"
  },
  {
    "id": "mus-6",
    "type": "music",
    "title": "Samajavaragamana",
    "artist": "Sid Sriram, Thaman S",
    "album": "Ala Vaikunthapurramuloo",
    "year": "2020",
    "duration": "3:43",
    "genres": [
      "Carnatic-Pop",
      "Melody"
    ],
    "language": "Telugu",
    "availableLanguages": [
      "Telugu",
      "Tamil",
      "Hindi",
      "Malayalam",
      "English"
    ],
    "valence": 0.85,
    "energy": 0.6,
    "baseQuality": 0.96,
    "image": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "A melodious fusion of classical Carnatic phrasing with modern acoustic guitars and upbeat percussion.",
    "moodSynergy": {
      "upbeat": "Infectious rhythm and Sid Sriram’s vocal flair create pure positive energy.",
      "calm": "Soulful acoustic flow that is pleasant and easy to groove with.",
      "excited": "Bright acoustic chords that lift the spirit instantly."
    },
    "moodTags": [
      "upbeat",
      "calm",
      "excited"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/5uC8x2v1N0m9L3k4J5H6G7"
  },
  {
    "id": "mus-7",
    "type": "music",
    "title": "Weightless",
    "artist": "Marconi Union",
    "album": "Weightless",
    "year": "2011",
    "duration": "8:08",
    "genres": [
      "Ambient",
      "Relaxation"
    ],
    "language": "English",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.72,
    "energy": 0.1,
    "baseQuality": 0.94,
    "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Engineered in collaboration with sound therapists, scientifically recognized to reduce heart rate and anxiety.",
    "moodSynergy": {
      "stressed": "Specifically designed to lower cortisol levels through calming harmonic frequencies.",
      "tired": "Gently transitions an overstimulated mind into restorative rest and stillness."
    },
    "moodTags": [
      "stressed",
      "tired",
      "calm"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/6kkwzB6hXLIONkEk9JciA6"
  },
  {
    "id": "mus-8",
    "type": "music",
    "title": "Yellow",
    "artist": "Coldplay",
    "album": "Parachutes",
    "year": "2000",
    "duration": "4:29",
    "genres": [
      "Alternative Rock",
      "Acoustic"
    ],
    "language": "English",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.7,
    "energy": 0.38,
    "baseQuality": 0.93,
    "image": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80",
    "backdrop": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80",
    "synopsis": "Atmospheric, soaring acoustic rock anthem celebrating unconditional devotion under starlit skies.",
    "moodSynergy": {
      "calm": "Timeless guitar warmth that feels like sunset on an open beach.",
      "reflective": "Evocative lyrics encouraging quiet gratitude and gentle reflection.",
      "low": "Reassuring and tender without being overwhelming."
    },
    "moodTags": [
      "calm",
      "reflective",
      "low",
      "tired",
      "lonely"
    ],
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com/track/3AJwUDP919kvQ9QcozQPxg"
  },
  {
    "id": "mov-hindi-1",
    "title": "3 Idiots",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Rascal. Joker. Dreamer. Genius... You've never met a college student quite like \"Rancho.\" From the moment he arrives at India's most prestigious university, Rancho's outlandish schemes turn the campus upside down—along with the lives of his two newfound best friends. Together, they make life miserable for \"Virus,\" the school’s uptight and heartless dean. But when Rancho catches the eye of the dean's daughter, Virus sets his sights on flunking out the \"3 idiots\" once and for all.",
    "synopsis": "Rascal. Joker. Dreamer. Genius... You've never met a college student quite like \"Rancho.\" From the moment he arrives at India's most prestigious university, Rancho's outlandish schemes turn the campus upside down—along with the lives of his two newfound best friends. Together, they make life miserable for \"Virus,\" the school’s uptight and heartless dean. But when Rancho catches the eye of the dean's daughter, Virus sets his sights on flunking out the \"3 idiots\" once and for all.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/66A9MqXOyVFCssoloscw79z8Tew.jpg",
    "image": "https://image.tmdb.org/t/p/w500/66A9MqXOyVFCssoloscw79z8Tew.jpg",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2009",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "ser-hindi-1",
    "title": "Scam 1992",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Panchayat is a comedy-drama, which captures the journey of an engineering graduate Abhishek, who for lack of a better job option joins as secretary of a panchayat office in a remote village of Uttar Pradesh. Stuck between crazy villagers and a difficult village lifestyle Abhishek starts his job with the sole motivation of getting out of there as soon as possible, for which he even prepares for CAT.",
    "synopsis": "Panchayat is a comedy-drama, which captures the journey of an engineering graduate Abhishek, who for lack of a better job option joins as secretary of a panchayat office in a remote village of Uttar Pradesh. Stuck between crazy villagers and a difficult village lifestyle Abhishek starts his job with the sole motivation of getting out of there as soon as possible, for which he even prepares for CAT.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xrfvAhrMdT6Uwg5fyTyQAZBYyiu.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xrfvAhrMdT6Uwg5fyTyQAZBYyiu.jpg",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2020",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "ani-hindi-1",
    "title": "Doraemon: Nobita’s New Adventure",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "",
    "description": "Doraemon: Nobita’s New Adventure is animation content in Hindi. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Doraemon: Nobita’s New Adventure is animation content in Hindi. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2015",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "mus-hindi-1",
    "title": "Gallan Goodiyaan",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Gallan Goodiyaan is melody content in Hindi. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Gallan Goodiyaan is melody content in Hindi. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2015",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "mov-tamil-1",
    "title": "Vikram Vedha",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A notorious gangster Vedha surrenders himself to encounter specialist Vikram whom he challenges every step of the way by narrating his life events in the form of riddles that needs to be solved in order to capture him.",
    "synopsis": "A notorious gangster Vedha surrenders himself to encounter specialist Vikram whom he challenges every step of the way by narrating his life events in the form of riddles that needs to be solved in order to capture him.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/ob9YxdzRu5lfKgz0PNrlL45dorf.jpg",
    "image": "https://image.tmdb.org/t/p/w500/ob9YxdzRu5lfKgz0PNrlL45dorf.jpg",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2017",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "ser-tamil-1",
    "title": "Ayali",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A minor girl goes missing in a small town in Tamilnadu and an investigation follows. A sub inspector investigating a missing girl's case in a uncovers some shocking revelations and dirty truths those threaten to shake up the cultural societal fabric.",
    "synopsis": "A minor girl goes missing in a small town in Tamilnadu and an investigation follows. A sub inspector investigating a missing girl's case in a uncovers some shocking revelations and dirty truths those threaten to shake up the cultural societal fabric.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/z6IJi7xmAMmKdbzSnwguIXLIVjN.jpg",
    "image": "https://image.tmdb.org/t/p/w500/z6IJi7xmAMmKdbzSnwguIXLIVjN.jpg",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2022",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "ani-tamil-1",
    "title": "Doraemon: Nobita’s Sky Utopia",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "",
    "description": "Doraemon: Nobita’s Sky Utopia is animation content in Tamil. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Doraemon: Nobita’s Sky Utopia is animation content in Tamil. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://m.media-amazon.com/images/M/MV5BNGU1ZGNkYzgtZTJhOC00ZjkyLTgzMWEtOTNiODMzODA3OTIwXkEyXkFqcGc@._V1_.jpg",
    "image": "https://m.media-amazon.com/images/M/MV5BNGU1ZGNkYzgtZTJhOC00ZjkyLTgzMWEtOTNiODMzODA3OTIwXkEyXkFqcGc@._V1_.jpg",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2015",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "mus-tamil-1",
    "title": "Vaathi Coming",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Vaathi Coming is melody content in Tamil. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Vaathi Coming is melody content in Tamil. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.9,
    "releaseYear": 2015,
    "year": "2015",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.87
  },
  {
    "id": "mov-eng-1",
    "title": "The Intouchables",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A true story of two men who should never have met – a quadriplegic aristocrat who was injured in a paragliding accident and a young man from the projects.",
    "synopsis": "A true story of two men who should never have met – a quadriplegic aristocrat who was injured in a paragliding accident and a young man from the projects.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/1QU7HKgsQbGpzsJbJK4pAVQV9F5.jpg",
    "image": "https://image.tmdb.org/t/p/w500/1QU7HKgsQbGpzsJbJK4pAVQV9F5.jpg",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "2011",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ser-eng-1",
    "title": "Breaking Bad",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Ted Lasso, an American football coach, moves to England when he's hired to manage a soccer team—despite having no experience. With cynical players and a doubtful town, will he get them to see the Ted Lasso Way?",
    "synopsis": "Ted Lasso, an American football coach, moves to England when he's hired to manage a soccer team—despite having no experience. With cynical players and a doubtful town, will he get them to see the Ted Lasso Way?",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg",
    "image": "https://image.tmdb.org/t/p/w500/uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "2020",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ani-eng-1",
    "title": "Fullmetal Alchemist: Brotherhood",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "",
    "description": "Disregard for alchemy’s laws ripped half of Edward Elric’s limbs from his body and left his brother Alphonse’s soul clinging to a suit of armor. To restore what was lost, the brothers seek the Philosopher’s Stone. Enemies and allies – the corrupt military, the Homunculi, and foreign alchemists – will alter the Elric brothers course, but their purpose will remain unchanged and their bond unbreakable.",
    "synopsis": "Disregard for alchemy’s laws ripped half of Edward Elric’s limbs from his body and left his brother Alphonse’s soul clinging to a suit of armor. To restore what was lost, the brothers seek the Philosopher’s Stone. Enemies and allies – the corrupt military, the Homunculi, and foreign alchemists – will alter the Elric brothers course, but their purpose will remain unchanged and their bond unbreakable.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/5ZFUEOULaVml7pQuXxhpR2SmVUw.jpg",
    "image": "https://image.tmdb.org/t/p/w500/5ZFUEOULaVml7pQuXxhpR2SmVUw.jpg",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "2009",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mus-eng-1",
    "title": "Walking on Sunshine",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Walking on Sunshine is melody content in English. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Walking on Sunshine is melody content in English. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mov-malayalam-1",
    "title": "Bangalore Days",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A fun roller coaster ride about three young people, Aju, Divya and Kuttan who are cousins, reach Bangalore to dream, discover & explore!",
    "synopsis": "A fun roller coaster ride about three young people, Aju, Divya and Kuttan who are cousins, reach Bangalore to dream, discover & explore!",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/iFMyZw1DTGvZ8hPa0eTseSFiRT1.jpg",
    "image": "https://image.tmdb.org/t/p/w500/iFMyZw1DTGvZ8hPa0eTseSFiRT1.jpg",
    "rating": 8.3,
    "releaseYear": 2019,
    "year": "2014",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ser-malayalam-1",
    "title": "Perilloor Premier League",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Malavika, who comes to the village of Perilloor to find love with her boyfriend Sreekuttan, unexpectedly ends up becoming the village Panchayat President against her will. Later, her life goes upside down along with the problems stirred by the wayward people of Perilloor Panchayath.",
    "synopsis": "Malavika, who comes to the village of Perilloor to find love with her boyfriend Sreekuttan, unexpectedly ends up becoming the village Panchayat President against her will. Later, her life goes upside down along with the problems stirred by the wayward people of Perilloor Panchayath.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/zuQRHydJ1Xojty6EHhWRMNT7ooO.jpg",
    "image": "https://image.tmdb.org/t/p/w500/zuQRHydJ1Xojty6EHhWRMNT7ooO.jpg",
    "rating": 8.3,
    "releaseYear": 2019,
    "year": "2024",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ani-malayalam-1",
    "title": "Doraemon: Nobita’s Little Star Wars",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "",
    "description": "Doraemon: Nobita’s Little Star Wars is animation content in Malayalam. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Doraemon: Nobita’s Little Star Wars is animation content in Malayalam. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.3,
    "releaseYear": 2019,
    "year": "2019",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mus-malayalam-1",
    "title": "Muthal Nee Mudivum Nee",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Aaradhike is melody content in Malayalam. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Aaradhike is melody content in Malayalam. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.3,
    "releaseYear": 2019,
    "year": "2019",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mov-tel-1",
    "title": "Pelli Choopulu",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Sathyam is in love with Savitri, a simple woman, and wishes to marry her. However, when Sathyam's mother demands a huge dowry from Savitri's father, the latter cancels the marriage.",
    "synopsis": "Sathyam is in love with Savitri, a simple woman, and wishes to marry her. However, when Sathyam's mother demands a huge dowry from Savitri's father, the latter cancels the marriage.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "1983",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "ser-tel-1",
    "title": "Modern Love Hyderabad",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A new generation of love stories, the love and fascination between the lovers, the dynamics of their relationships, their funny conversations and their conflicts.",
    "synopsis": "A new generation of love stories, the love and fascination between the lovers, the dynamics of their relationships, their funny conversations and their conflicts.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/t92IeHAebFvYzzw089lemtrqEio.jpg",
    "image": "https://image.tmdb.org/t/p/w500/t92IeHAebFvYzzw089lemtrqEio.jpg",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "2022",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "ani-tel-1",
    "title": "Doraemon: Nobita’s Treasure Island",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "",
    "director": "",
    "description": "Doraemon: Nobita’s Treasure Island is animation content in Telugu. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Doraemon: Nobita’s Treasure Island is animation content in Telugu. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "mus-tel-1",
    "title": "Yenti Yenti",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "happy"
    ],
    "moodTags": [
      "happy"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Samajavaragamana is melody content in Telugu. A bright, feel-good pick designed to keep the smile going.",
    "synopsis": "Samajavaragamana is melody content in Telugu. A bright, feel-good pick designed to keep the smile going.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.7,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.9,
    "energy": 0.72,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "mov-hindi-1-b",
    "type": "movie",
    "title": "Lagaan",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "When Heterosis - a mysterious virus that turns gay men straight sweeps through the Parisian gay scene, Jim, the six packed sovereign of the Gym Queens, goes from Pride royalty to social outcast. With only Lucien, a freshly-out twink with more heart than abs, still by his side, Jim must race to find a cure before the disease erases the community that once worshipped him.",
    "synopsis": "When Heterosis - a mysterious virus that turns gay men straight sweeps through the Parisian gay scene, Jim, the six packed sovereign of the Gym Queens, goes from Pride royalty to social outcast. With only Lucien, a freshly-out twink with more heart than abs, still by his side, Jim must race to find a cure before the disease erases the community that once worshipped him.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/nvmGrOzolKlW1z90rLudSjPm9cG.jpg",
    "image": "https://image.tmdb.org/t/p/w500/nvmGrOzolKlW1z90rLudSjPm9cG.jpg",
    "rating": 8,
    "releaseYear": 2018,
    "year": "2026",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "ser-hindi-1-b",
    "type": "series",
    "title": "Scam 1992",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A widowed fire chief tries to raise his four children with help from his father-in-law.",
    "synopsis": "A widowed fire chief tries to raise his four children with help from his father-in-law.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/vCtEwgPHBjwMgehFyGnIlaUXJx6.jpg",
    "image": "https://image.tmdb.org/t/p/w500/vCtEwgPHBjwMgehFyGnIlaUXJx6.jpg",
    "rating": 8,
    "releaseYear": 2018,
    "year": "1990",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "ani-hindi-2",
    "title": "Pokémon Horizons",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "",
    "description": "Follow Liko and Roy as they unravel the mysteries that surround them and encounter Friede, Captain Pikachu, Amethio, and others during their exciting adventures!",
    "synopsis": "Follow Liko and Roy as they unravel the mysteries that surround them and encounter Friede, Captain Pikachu, Amethio, and others during their exciting adventures!",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/amemXW39lMbNBJFRMJ5W7q9mLP2.jpg",
    "image": "https://image.tmdb.org/t/p/w500/amemXW39lMbNBJFRMJ5W7q9mLP2.jpg",
    "rating": 8,
    "releaseYear": 2018,
    "year": "2023",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "mus-hindi-2",
    "title": "Agar Tum Saath Ho",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Agar Tum Saath Ho is melody content in Hindi. A tender story that makes room for difficult feelings and gentle hope.",
    "synopsis": "Agar Tum Saath Ho is melody content in Hindi. A tender story that makes room for difficult feelings and gentle hope.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8,
    "releaseYear": 2018,
    "year": "2018",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "mov-tamil-2",
    "title": "Kadaisi Vivasayi",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Maayandi, the only farmer in a village that has abandoned farming, is charged with a petty case that leads to his imprisonment.",
    "synopsis": "Maayandi, the only farmer in a village that has abandoned farming, is charged with a petty case that leads to his imprisonment.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8TNnEojAEc8Kt6HMWgQNRPcL9J3.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8TNnEojAEc8Kt6HMWgQNRPcL9J3.jpg",
    "rating": 8,
    "releaseYear": 2018,
    "year": "2022",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "ser-tamil-1-b",
    "type": "series",
    "title": "Ayali",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Vivek, a diligent cop, takes charge of the investigation of the murder of a beautiful young girl, Velonie. The rumours about her that spring up post her death threatens to irrevocably damage Velonie's image, Vivek must wade through a web of half-truths and confusing leads to solve the case.",
    "synopsis": "Vivek, a diligent cop, takes charge of the investigation of the murder of a beautiful young girl, Velonie. The rumours about her that spring up post her death threatens to irrevocably damage Velonie's image, Vivek must wade through a web of half-truths and confusing leads to solve the case.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/2EgR5kgv4yHbJpR3GutxzbGd4rw.jpg",
    "image": "https://image.tmdb.org/t/p/w500/2EgR5kgv4yHbJpR3GutxzbGd4rw.jpg",
    "rating": 8,
    "releaseYear": 2018,
    "year": "2022",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "ani-tamil-2",
    "title": "Pokémon Indigo League",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "",
    "description": "Join Ash accompanied by his partner Pikachu, as he travels through many regions, meets new friends and faces new challenges on his quest to become a Pokémon Master.",
    "synopsis": "Join Ash accompanied by his partner Pikachu, as he travels through many regions, meets new friends and faces new challenges on his quest to become a Pokémon Master.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/lP4zwr0F7hWTbAFltfoFTc2AxRG.jpg",
    "image": "https://image.tmdb.org/t/p/w500/lP4zwr0F7hWTbAFltfoFTc2AxRG.jpg",
    "rating": 8,
    "releaseYear": 2018,
    "year": "1997",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "mus-tamil-2",
    "title": "Unakkenna Venum Sollu",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Unakkenna Venum Sollu is melody content in Tamil. A tender story that makes room for difficult feelings and gentle hope.",
    "synopsis": "Unakkenna Venum Sollu is melody content in Tamil. A tender story that makes room for difficult feelings and gentle hope.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8,
    "releaseYear": 2018,
    "year": "2018",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8799999999999999
  },
  {
    "id": "mov-eng-2",
    "title": "Little Miss Sunshine",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A family loaded with quirky, colorful characters piles into an old van and road trips to California for little Olive to compete in a beauty pageant.",
    "synopsis": "A family loaded with quirky, colorful characters piles into an old van and road trips to California for little Olive to compete in a beauty pageant.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/niNdhTpPHSgw22tK0PLjQMV640v.jpg",
    "image": "https://image.tmdb.org/t/p/w500/niNdhTpPHSgw22tK0PLjQMV640v.jpg",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "2006",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ser-eng-2",
    "title": "Schitt's Creek",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Formerly filthy rich video store magnate Johnny Rose, his soap star wife Moira, and their two kids, über-hipster son David and socialite daughter Alexis, suddenly find themselves broke and forced to live in Schitt's Creek, a small depressing town they once bought as a joke.",
    "synopsis": "Formerly filthy rich video store magnate Johnny Rose, his soap star wife Moira, and their two kids, über-hipster son David and socialite daughter Alexis, suddenly find themselves broke and forced to live in Schitt's Creek, a small depressing town they once bought as a joke.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/iRfSzrPS5VYWQv7KVSEg2BZZL6C.jpg",
    "image": "https://image.tmdb.org/t/p/w500/iRfSzrPS5VYWQv7KVSEg2BZZL6C.jpg",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "2015",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ani-eng-2",
    "title": "Cowboy Bebop",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "",
    "description": "In 2071, roughly fifty years after an accident with a hyperspace gateway made the Earth almost uninhabitable, humanity has colonized most of the rocky planets and moons of the Solar System. Amid a rising crime rate, the Inter Solar System Police (ISSP) set up a legalized contract system, in which registered bounty hunters, also referred to as \"Cowboys\", chase criminals and bring them in alive in return for a reward.",
    "synopsis": "In 2071, roughly fifty years after an accident with a hyperspace gateway made the Earth almost uninhabitable, humanity has colonized most of the rocky planets and moons of the Solar System. Amid a rising crime rate, the Inter Solar System Police (ISSP) set up a legalized contract system, in which registered bounty hunters, also referred to as \"Cowboys\", chase criminals and bring them in alive in return for a reward.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xDiXDfZwC6XYC6fxHI1jl3A3Ill.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xDiXDfZwC6XYC6fxHI1jl3A3Ill.jpg",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "1998",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mus-eng-2",
    "title": "Fix You",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Fix You is melody content in English. A tender story that makes room for difficult feelings and gentle hope.",
    "synopsis": "Fix You is melody content in English. A tender story that makes room for difficult feelings and gentle hope.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "2016",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mov-malayalam-2",
    "title": "Ustad Hotel",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "When his father refuses to support his choice of a career, an aspiring chef tries to fulfil his dream by helping his grandfather run his small eatery.",
    "synopsis": "When his father refuses to support his choice of a career, an aspiring chef tries to fulfil his dream by helping his grandfather run his small eatery.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/88QYspKRArRutF3t0Bzj0JYFlcI.jpg",
    "image": "https://image.tmdb.org/t/p/w500/88QYspKRArRutF3t0Bzj0JYFlcI.jpg",
    "rating": 8.4,
    "releaseYear": 2022,
    "year": "2012",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ser-malayalam-2",
    "title": "Masterpeace",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "When marital discord becomes everyone's business and parents get way too involved in the \"peace talks,\" family drama can become family trauma.",
    "synopsis": "When marital discord becomes everyone's business and parents get way too involved in the \"peace talks,\" family drama can become family trauma.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/hUOiNi5uFmDNOYLn2hCrgtSwNPA.jpg",
    "image": "https://image.tmdb.org/t/p/w500/hUOiNi5uFmDNOYLn2hCrgtSwNPA.jpg",
    "rating": 8.4,
    "releaseYear": 2022,
    "year": "2023",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ani-malayalam-2",
    "title": "Pokémon Journeys",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "",
    "description": "Join Ash accompanied by his partner Pikachu, as he travels through many regions, meets new friends and faces new challenges on his quest to become a Pokémon Master.",
    "synopsis": "Join Ash accompanied by his partner Pikachu, as he travels through many regions, meets new friends and faces new challenges on his quest to become a Pokémon Master.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/lP4zwr0F7hWTbAFltfoFTc2AxRG.jpg",
    "image": "https://image.tmdb.org/t/p/w500/lP4zwr0F7hWTbAFltfoFTc2AxRG.jpg",
    "rating": 8.4,
    "releaseYear": 2022,
    "year": "1997",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mus-malayalam-1-b",
    "type": "music",
    "title": "Muthal Nee Mudivum Nee",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Pavizha Mazha is melody content in Malayalam. A tender story that makes room for difficult feelings and gentle hope.",
    "synopsis": "Pavizha Mazha is melody content in Malayalam. A tender story that makes room for difficult feelings and gentle hope.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.4,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mov-tel-2",
    "title": "Jersey",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A musical biopic of the Four Seasons—the rise, the tough times and personal clashes, and the ultimate triumph of a group of friends whose music became symbolic of a generation. Far from a mere tribute concert, it gets to the heart of the relationships at the centre of the group, with a special focus on frontman Frankie Valli, the small kid with the big falsetto.",
    "synopsis": "A musical biopic of the Four Seasons—the rise, the tough times and personal clashes, and the ultimate triumph of a group of friends whose music became symbolic of a generation. Far from a mere tribute concert, it gets to the heart of the relationships at the centre of the group, with a special focus on frontman Frankie Valli, the small kid with the big falsetto.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/kz956Y83YtT6vTyg0Q40mzRe2UM.jpg",
    "image": "https://image.tmdb.org/t/p/w500/kz956Y83YtT6vTyg0Q40mzRe2UM.jpg",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "2014",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ser-tel-2",
    "title": "Masti’s",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Masti's weaves a riveting tale as six people from three contrasting worlds of various social statures mingle whilst setting off on merry misadventures and discovering love and friendship as they navigate through multiple pitfalls of work and life.",
    "synopsis": "Masti's weaves a riveting tale as six people from three contrasting worlds of various social statures mingle whilst setting off on merry misadventures and discovering love and friendship as they navigate through multiple pitfalls of work and life.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/fAa0k4YZOtUdvEX0x4XsrfEW2Es.jpg",
    "image": "https://image.tmdb.org/t/p/w500/fAa0k4YZOtUdvEX0x4XsrfEW2Es.jpg",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "2020",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ani-tel-2",
    "title": "Pokémon Horizons",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "",
    "director": "",
    "description": "Follow Liko and Roy as they unravel the mysteries that surround them and encounter Friede, Captain Pikachu, Amethio, and others during their exciting adventures!",
    "synopsis": "Follow Liko and Roy as they unravel the mysteries that surround them and encounter Friede, Captain Pikachu, Amethio, and others during their exciting adventures!",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/amemXW39lMbNBJFRMJ5W7q9mLP2.jpg",
    "image": "https://image.tmdb.org/t/p/w500/amemXW39lMbNBJFRMJ5W7q9mLP2.jpg",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "2023",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mus-tel-2",
    "title": "Inkem Inkem Inkem Kaavaale",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "sad"
    ],
    "moodTags": [
      "sad"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Inkem Inkem Inkem Kaavaale is melody content in Telugu. A tender story that makes room for difficult feelings and gentle hope.",
    "synopsis": "Inkem Inkem Inkem Kaavaale is melody content in Telugu. A tender story that makes room for difficult feelings and gentle hope.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.8,
    "releaseYear": 2016,
    "year": "2016",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.28,
    "energy": 0.3,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mov-hindi-3",
    "title": "Taare Zameen Par",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Ishaan Awasthi is an eight-year-old whose world is filled with wonders that no one else seems to appreciate. Colours, fish, dogs, and kites don't seem important to the adults, who are much more interested in things like homework, marks, and neatness. Ishaan cannot seem to get anything right in class; he is then sent to boarding school, where his life changes forever.",
    "synopsis": "Ishaan Awasthi is an eight-year-old whose world is filled with wonders that no one else seems to appreciate. Colours, fish, dogs, and kites don't seem important to the adults, who are much more interested in things like homework, marks, and neatness. Ishaan cannot seem to get anything right in class; he is then sent to boarding school, where his life changes forever.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/puHRt6Raovm5ujGCdwLWvRv4NHU.jpg",
    "image": "https://image.tmdb.org/t/p/w500/puHRt6Raovm5ujGCdwLWvRv4NHU.jpg",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2007",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ser-hindi-3",
    "title": "Kota Factory",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "In a city of coaching centers known to train India’s finest collegiate minds, an earnest but unexceptional student and his friends navigate campus life.",
    "synopsis": "In a city of coaching centers known to train India’s finest collegiate minds, an earnest but unexceptional student and his friends navigate campus life.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/fMBookmwL6HjIgIVTjQ6EMr3pCH.jpg",
    "image": "https://image.tmdb.org/t/p/w500/fMBookmwL6HjIgIVTjQ6EMr3pCH.jpg",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2019",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ani-hindi-3",
    "title": "Naruto",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "",
    "description": "Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village's leader and strongest ninja.",
    "synopsis": "Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village's leader and strongest ninja.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xppeysfvDKVx775MFuH8Z9BlpMk.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xppeysfvDKVx775MFuH8Z9BlpMk.jpg",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2002",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mus-hindi-3",
    "title": "Ilahi",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Ilahi is melody content in Hindi. A measured, soothing choice for an unhurried evening.",
    "synopsis": "Ilahi is melody content in Hindi. A measured, soothing choice for an unhurried evening.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2021",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mov-tamil-3",
    "title": "Soorarai Pottru",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Nedumaaran Rajangam \"Maara\" sets out to make the common man fly and in the process takes on the world's most capital intensive industry and several enemies who stand in his way.",
    "synopsis": "Nedumaaran Rajangam \"Maara\" sets out to make the common man fly and in the process takes on the world's most capital intensive industry and several enemies who stand in his way.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/5uimlxPCgAei8JfQUDFEUQLoyyh.jpg",
    "image": "https://image.tmdb.org/t/p/w500/5uimlxPCgAei8JfQUDFEUQLoyyh.jpg",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2020",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ser-tamil-3",
    "title": "Iru Dhuruvam",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "The series consists of hard-core police investigation stories dealing with investigation, detection and suspense.",
    "synopsis": "The series consists of hard-core police investigation stories dealing with investigation, detection and suspense.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/qPucGcNBxVMVuBY5sgdvYLHURQD.jpg",
    "image": "https://image.tmdb.org/t/p/w500/qPucGcNBxVMVuBY5sgdvYLHURQD.jpg",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2019",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "ani-tamil-3",
    "title": "Naruto Shippuden",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "",
    "description": "After 2 and a half years Naruto finally returns to his village of Konoha, and sets about putting his ambitions to work. It will not be easy though as he has amassed a few more dangerous enemies, in the likes of the shinobi organization; Akatsuki.",
    "synopsis": "After 2 and a half years Naruto finally returns to his village of Konoha, and sets about putting his ambitions to work. It will not be easy though as he has amassed a few more dangerous enemies, in the likes of the shinobi organization; Akatsuki.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/kV27j3Nz4d5z8u6mN3EJw9RiLg2.jpg",
    "image": "https://image.tmdb.org/t/p/w500/kV27j3Nz4d5z8u6mN3EJw9RiLg2.jpg",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2007",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mus-tamil-3",
    "title": "Vaseegara",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Nenjame Nenjame is melody content in Tamil. A measured, soothing choice for an unhurried evening.",
    "synopsis": "Nenjame Nenjame is melody content in Tamil. A measured, soothing choice for an unhurried evening.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.1,
    "releaseYear": 2021,
    "year": "2021",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8899999999999999
  },
  {
    "id": "mov-eng-3",
    "title": "The Secret Life of Walter Mitty",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A timid magazine photo manager who lives life vicariously through daydreams embarks on a true-life adventure when a negative goes missing.",
    "synopsis": "A timid magazine photo manager who lives life vicariously through daydreams embarks on a true-life adventure when a negative goes missing.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/iAo1hlzsPV9XpYcLQp6Ud065tGO.jpg",
    "image": "https://image.tmdb.org/t/p/w500/iAo1hlzsPV9XpYcLQp6Ud065tGO.jpg",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2013",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ser-eng-3",
    "title": "The Bear",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Carmy, a young fine-dining chef, comes home to Chicago to run his family sandwich shop. As he fights to transform the shop and himself, he works alongside a rough-around-the-edges crew that ultimately reveal themselves as his chosen family.",
    "synopsis": "Carmy, a young fine-dining chef, comes home to Chicago to run his family sandwich shop. As he fights to transform the shop and himself, he works alongside a rough-around-the-edges crew that ultimately reveal themselves as his chosen family.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
    "image": "https://image.tmdb.org/t/p/w500/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2022",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ani-eng-3",
    "title": "Spy x Family",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "",
    "description": "A spy, an assassin and a telepath come together to pose as a family, each for their own reasons, while hiding their true identities from each other.",
    "synopsis": "A spy, an assassin and a telepath come together to pose as a family, each for their own reasons, while hiding their true identities from each other.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/7NAvPYPAu7MeHwP8E9sn81PqsRh.jpg",
    "image": "https://image.tmdb.org/t/p/w500/7NAvPYPAu7MeHwP8E9sn81PqsRh.jpg",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2022",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mus-eng-3",
    "title": "Weightless",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Weightless is melody content in English. A measured, soothing choice for an unhurried evening.",
    "synopsis": "Weightless is melody content in English. A measured, soothing choice for an unhurried evening.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2019",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mov-malayalam-3",
    "title": "Kumbalangi Nights",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Four brothers living in the fishing hamlet of Kumbalangi share a love-hate relationship with each other. Their relationship progresses when Saji, Boney and Franky decide to help Bobby stand by his love.",
    "synopsis": "Four brothers living in the fishing hamlet of Kumbalangi share a love-hate relationship with each other. Their relationship progresses when Saji, Boney and Franky decide to help Bobby stand by his love.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/lJ3RvIirE2C7gdBKvPRaoQ3iCo2.jpg",
    "image": "https://image.tmdb.org/t/p/w500/lJ3RvIirE2C7gdBKvPRaoQ3iCo2.jpg",
    "rating": 8.5,
    "releaseYear": 2010,
    "year": "2019",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ser-malayalam-3",
    "title": "Maharani",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A political drama set in Bihar of 1990's, this story shows how an illiterate woman handles the state as Chief Minister. Rani Bharti's life takes an interesting turn when her husband Bheem Singh Bharti, announces her as the next chief minister of Bihar. With casteism and traditional satraps in the background, will Rani survive this turn of events?",
    "synopsis": "A political drama set in Bihar of 1990's, this story shows how an illiterate woman handles the state as Chief Minister. Rani Bharti's life takes an interesting turn when her husband Bheem Singh Bharti, announces her as the next chief minister of Bihar. With casteism and traditional satraps in the background, will Rani survive this turn of events?",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/g3ublqmXx9SH8ksY61OPkZRoN3I.jpg",
    "image": "https://image.tmdb.org/t/p/w500/g3ublqmXx9SH8ksY61OPkZRoN3I.jpg",
    "rating": 8.5,
    "releaseYear": 2010,
    "year": "2021",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ani-malayalam-3",
    "title": "Naruto",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "",
    "description": "Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village's leader and strongest ninja.",
    "synopsis": "Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village's leader and strongest ninja.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xppeysfvDKVx775MFuH8Z9BlpMk.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xppeysfvDKVx775MFuH8Z9BlpMk.jpg",
    "rating": 8.5,
    "releaseYear": 2010,
    "year": "2002",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mus-malayalam-3",
    "title": "Malare",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Malare is melody content in Malayalam. A measured, soothing choice for an unhurried evening.",
    "synopsis": "Malare is melody content in Malayalam. A measured, soothing choice for an unhurried evening.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.5,
    "releaseYear": 2010,
    "year": "2010",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mov-tel-3",
    "title": "C/O Kancharapalem",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "From a schoolboy’s crush to a middle-aged bachelor’s office romance, four love stories spanning age, religion and status unfold in a small Indian town.",
    "synopsis": "From a schoolboy’s crush to a middle-aged bachelor’s office romance, four love stories spanning age, religion and status unfold in a small Indian town.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8bgyfPih4bORxtnFCwinqVElkYg.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8bgyfPih4bORxtnFCwinqVElkYg.jpg",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2018",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ser-tel-3",
    "title": "CommitMental",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A three-year long-distance relationship between Phani and Anu takes an unexpected twist when he asks her to marry him. While their journey has many highs, lows and bittersweet experiences, will this bumpy ride bring them closer?\n\nThis the official remake of Permanent Roommates (2014), a popular YouTube series produced by The Viral Factory.",
    "synopsis": "A three-year long-distance relationship between Phani and Anu takes an unexpected twist when he asks her to marry him. While their journey has many highs, lows and bittersweet experiences, will this bumpy ride bring them closer?\n\nThis the official remake of Permanent Roommates (2014), a popular YouTube series produced by The Viral Factory.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/9m2UD6rornPatAbcmn3XOnAKAPm.jpg",
    "image": "https://image.tmdb.org/t/p/w500/9m2UD6rornPatAbcmn3XOnAKAPm.jpg",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2020",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ani-tel-3",
    "title": "Naruto",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "",
    "director": "",
    "description": "Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village's leader and strongest ninja.",
    "synopsis": "Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village's leader and strongest ninja.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xppeysfvDKVx775MFuH8Z9BlpMk.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xppeysfvDKVx775MFuH8Z9BlpMk.jpg",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2002",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mus-tel-3",
    "title": "Butta Bomma",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "calm"
    ],
    "moodTags": [
      "calm"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Butta Bomma is melody content in Telugu. A measured, soothing choice for an unhurried evening.",
    "synopsis": "Butta Bomma is melody content in Telugu. A measured, soothing choice for an unhurried evening.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 7.9,
    "releaseYear": 2019,
    "year": "2019",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.72,
    "energy": 0.25,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mov-hindi-4",
    "title": "Gully Boy",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Murad, an underdog, struggles to convey his views on social issues and life in Dharavi through rapping. His life changes drastically when he meets a local rapper, Shrikant alias MC Sher.",
    "synopsis": "Murad, an underdog, struggles to convey his views on social issues and life in Dharavi through rapping. His life changes drastically when he meets a local rapper, Shrikant alias MC Sher.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/4RE7TD5TqEXbPKyUHcn7CSeMlrJ.jpg",
    "image": "https://image.tmdb.org/t/p/w500/4RE7TD5TqEXbPKyUHcn7CSeMlrJ.jpg",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2019",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ser-hindi-4",
    "title": "Gullak",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Set in quaint by-lanes in the heart of India, Gullak is a collection of disarming and relatable tales of the Mishra family.",
    "synopsis": "Set in quaint by-lanes in the heart of India, Gullak is a collection of disarming and relatable tales of the Mishra family.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/arn3mvRYSrEqO7vaKbH8QxM8EEK.jpg",
    "image": "https://image.tmdb.org/t/p/w500/arn3mvRYSrEqO7vaKbH8QxM8EEK.jpg",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2019",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ani-hindi-4",
    "title": "One Piece",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "",
    "description": "With his straw hat and ragtag crew, young pirate Monkey D. Luffy goes on an epic voyage for treasure.",
    "synopsis": "With his straw hat and ragtag crew, young pirate Monkey D. Luffy goes on an epic voyage for treasure.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/blWCPEqDGLBuLB9u89CxP9ORQP4.jpg",
    "image": "https://image.tmdb.org/t/p/w500/blWCPEqDGLBuLB9u89CxP9ORQP4.jpg",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2023",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mus-hindi-4",
    "title": "Badtameez Dil",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Badtameez Dil is melody content in Hindi. A lively, high-momentum pick for turning energy into fun.",
    "synopsis": "Badtameez Dil is melody content in Hindi. A lively, high-momentum pick for turning energy into fun.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2024",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mov-tamil-4",
    "title": "Jigarthanda",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A budding director endeavors to research a merciless gangster for making a film on gangsterism. But his secret attempts to conduct the research fail when he gets caught for snooping.",
    "synopsis": "A budding director endeavors to research a merciless gangster for making a film on gangsterism. But his secret attempts to conduct the research fail when he gets caught for snooping.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/oDcQE70RYc78iBYgHRknl64QKTu.jpg",
    "image": "https://image.tmdb.org/t/p/w500/oDcQE70RYc78iBYgHRknl64QKTu.jpg",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2014",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ser-tamil-4",
    "title": "Queen",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "\"Shopping Queen\" is a styling documentary in which five women compete against each other on five consecutive days each week to become the woman with the best style and the best sense of fashion.",
    "synopsis": "\"Shopping Queen\" is a styling documentary in which five women compete against each other on five consecutive days each week to become the woman with the best style and the best sense of fashion.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/ucE44IzwL20BQwsCSz37vyWYtmT.jpg",
    "image": "https://image.tmdb.org/t/p/w500/ucE44IzwL20BQwsCSz37vyWYtmT.jpg",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2012",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "ani-tamil-4",
    "title": "One Piece: Wano",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "",
    "description": "One Piece: Wano is animation content in Tamil. A lively, high-momentum pick for turning energy into fun.",
    "synopsis": "One Piece: Wano is animation content in Tamil. A lively, high-momentum pick for turning energy into fun.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2024",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mus-tamil-3-b",
    "type": "music",
    "title": "Vaseegara",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Arabic Kuthu is melody content in Tamil. A lively, high-momentum pick for turning energy into fun.",
    "synopsis": "Arabic Kuthu is melody content in Tamil. A lively, high-momentum pick for turning energy into fun.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.2,
    "releaseYear": 2024,
    "year": "2024",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.8999999999999999
  },
  {
    "id": "mov-eng-4",
    "title": "The Martian",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "During a manned mission to Mars, Astronaut Mark Watney is presumed dead after a fierce storm and left behind by his crew. But Watney has survived and finds himself stranded and alone on the hostile planet. With only meager supplies, he must draw upon his ingenuity, wit and spirit to subsist and find a way to signal to Earth that he is alive.",
    "synopsis": "During a manned mission to Mars, Astronaut Mark Watney is presumed dead after a fierce storm and left behind by his crew. But Watney has survived and finds himself stranded and alone on the hostile planet. With only meager supplies, he must draw upon his ingenuity, wit and spirit to subsist and find a way to signal to Earth that he is alive.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/fASz8A0yFE3QB6LgGoOfwvFSseV.jpg",
    "image": "https://image.tmdb.org/t/p/w500/fASz8A0yFE3QB6LgGoOfwvFSseV.jpg",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2015",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ser-eng-4",
    "title": "Only Murders in the Building",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Three strangers share an obsession with true crime and suddenly find themselves wrapped up in one.",
    "synopsis": "Three strangers share an obsession with true crime and suddenly find themselves wrapped up in one.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/1yjFVQZuW8aofZ5Cgol8iImsVFp.jpg",
    "image": "https://image.tmdb.org/t/p/w500/1yjFVQZuW8aofZ5Cgol8iImsVFp.jpg",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2021",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ani-eng-4",
    "title": "Frieren: Beyond Journey's End",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "",
    "description": "After the party of heroes defeated the Demon King, they restored peace to the land and returned to lives of solitude.  Generations pass, and the elven mage Frieren comes face to face with humanity’s mortality. She takes on a new apprentice and promises to fulfill old friends’ dying wishes. Can an elven mind make peace with the nature of life and death? Frieren embarks on her quest to find out.",
    "synopsis": "After the party of heroes defeated the Demon King, they restored peace to the land and returned to lives of solitude.  Generations pass, and the elven mage Frieren comes face to face with humanity’s mortality. She takes on a new apprentice and promises to fulfill old friends’ dying wishes. Can an elven mind make peace with the nature of life and death? Frieren embarks on her quest to find out.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/dqZENchTd7lp5zht7BdlqM7RBhD.jpg",
    "image": "https://image.tmdb.org/t/p/w500/dqZENchTd7lp5zht7BdlqM7RBhD.jpg",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2023",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mus-eng-4",
    "title": "Don’t Stop Me Now",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Don’t Stop Me Now is melody content in English. A lively, high-momentum pick for turning energy into fun.",
    "synopsis": "Don’t Stop Me Now is melody content in English. A lively, high-momentum pick for turning energy into fun.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mov-malayalam-4",
    "title": "Thondimuthalum Driksakshiyum",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Prasad and Sreeja are a couple planning to set up a new life in Kasargod. On a bus journey they end up being robbed by a thief also named Prasad and this lands them up in a police station.",
    "synopsis": "Prasad and Sreeja are a couple planning to set up a new life in Kasargod. On a bus journey they end up being robbed by a thief also named Prasad and this lands them up in a police station.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/ki1EguwPuXM1t4UTDuaBqD8BLJi.jpg",
    "image": "https://image.tmdb.org/t/p/w500/ki1EguwPuXM1t4UTDuaBqD8BLJi.jpg",
    "rating": 8.6,
    "releaseYear": 2013,
    "year": "2017",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.94
  },
  {
    "id": "ser-malayalam-4",
    "title": "Jaya Jaya Jaya Jaya Hey Stories",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Jaya Jaya Jaya Jaya Hey Stories is drama content in Malayalam. A lively, high-momentum pick for turning energy into fun.",
    "synopsis": "Jaya Jaya Jaya Jaya Hey Stories is drama content in Malayalam. A lively, high-momentum pick for turning energy into fun.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.6,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.94
  },
  {
    "id": "ani-malayalam-4",
    "title": "One Piece",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "",
    "description": "With his straw hat and ragtag crew, young pirate Monkey D. Luffy goes on an epic voyage for treasure.",
    "synopsis": "With his straw hat and ragtag crew, young pirate Monkey D. Luffy goes on an epic voyage for treasure.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/blWCPEqDGLBuLB9u89CxP9ORQP4.jpg",
    "image": "https://image.tmdb.org/t/p/w500/blWCPEqDGLBuLB9u89CxP9ORQP4.jpg",
    "rating": 8.6,
    "releaseYear": 2013,
    "year": "2023",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.94
  },
  {
    "id": "mus-malayalam-4",
    "title": "Jimikki Kammal",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Jimikki Kammal is melody content in Malayalam. A lively, high-momentum pick for turning energy into fun.",
    "synopsis": "Jimikki Kammal is melody content in Malayalam. A lively, high-momentum pick for turning energy into fun.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.6,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.94
  },
  {
    "id": "mov-tel-4",
    "title": "Sita Ramam",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Afreen, a rebellious Pakistani student sets ablaze the car of an Indian in London. Angered Afreen returns to Pakistan to ask for money from her grandfather that she has to pay in a month's time as damages. However, she gets to know that he is no more and the only thing he has left for her is a letter-delivering task, written by Ram to Sita. As Afreen sets out to find Ram, there begins her journey of discovering the secret behind the 20-year-old letter.",
    "synopsis": "Afreen, a rebellious Pakistani student sets ablaze the car of an Indian in London. Angered Afreen returns to Pakistan to ask for money from her grandfather that she has to pay in a month's time as damages. However, she gets to know that he is no more and the only thing he has left for her is a letter-delivering task, written by Ram to Sita. As Afreen sets out to find Ram, there begins her journey of discovering the secret behind the 20-year-old letter.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/t1O94ZBzsQXJihtVkrsStRLyUDR.jpg",
    "image": "https://image.tmdb.org/t/p/w500/t1O94ZBzsQXJihtVkrsStRLyUDR.jpg",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ser-tel-4",
    "title": "Puli Meka",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A serial killer is targeting police officers in Hyderabad. A female cop in charge of the Special Investigation Team and a forensic expert race against time to find the culprit.",
    "synopsis": "A serial killer is targeting police officers in Hyderabad. A female cop in charge of the Special Investigation Team and a forensic expert race against time to find the culprit.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/9JWBdtWfx6S7vmCq77mDvd173ul.jpg",
    "image": "https://image.tmdb.org/t/p/w500/9JWBdtWfx6S7vmCq77mDvd173ul.jpg",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2023",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ani-tel-4",
    "title": "One Piece",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "",
    "director": "",
    "description": "With his straw hat and ragtag crew, young pirate Monkey D. Luffy goes on an epic voyage for treasure.",
    "synopsis": "With his straw hat and ragtag crew, young pirate Monkey D. Luffy goes on an epic voyage for treasure.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/blWCPEqDGLBuLB9u89CxP9ORQP4.jpg",
    "image": "https://image.tmdb.org/t/p/w500/blWCPEqDGLBuLB9u89CxP9ORQP4.jpg",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2023",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mus-tel-1-b",
    "type": "music",
    "title": "Yenti Yenti",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energetic"
    ],
    "moodTags": [
      "energetic"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Ramuloo Ramulaa is melody content in Telugu. A lively, high-momentum pick for turning energy into fun.",
    "synopsis": "Ramuloo Ramulaa is melody content in Telugu. A lively, high-momentum pick for turning energy into fun.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.82,
    "energy": 0.9,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mov-hindi-5",
    "title": "Zindagi Na Milegi Dobara",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Three friends who were inseparable in childhood decide to go on a three-week-long bachelor road trip to Spain, in order to re-establish their bond and explore thrilling adventures, before one of them gets married. What will they learn of themselves and each other during the adventure?",
    "synopsis": "Three friends who were inseparable in childhood decide to go on a three-week-long bachelor road trip to Spain, in order to re-establish their bond and explore thrilling adventures, before one of them gets married. What will they learn of themselves and each other during the adventure?",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/hKO9O715wYxjkQSEv47giCYcyO8.jpg",
    "image": "https://image.tmdb.org/t/p/w500/hKO9O715wYxjkQSEv47giCYcyO8.jpg",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "2011",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ser-hindi-5",
    "title": "Rocket Boys",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Spanning three crucial decades (1940-60s) in the history of India, the story chronicles the life of three great men responsible for launching India's space and nuclear programs respectively: Dr. Homi J. Bhabha, the architect of India's Nuclear Programme, Dr. Vikram Sarabhai, universally acknowledged as the Father of the Indian Space Programme and Dr. A.P.J. Abdul Kalam, the pioneer of modern Indian aerospace and nuclear technology. The season traces the journey of Bhabha and Sarabhai coming to terms with the challenges facing a young, independent nation and their friendship, sacrifice and determination.",
    "synopsis": "Spanning three crucial decades (1940-60s) in the history of India, the story chronicles the life of three great men responsible for launching India's space and nuclear programs respectively: Dr. Homi J. Bhabha, the architect of India's Nuclear Programme, Dr. Vikram Sarabhai, universally acknowledged as the Father of the Indian Space Programme and Dr. A.P.J. Abdul Kalam, the pioneer of modern Indian aerospace and nuclear technology. The season traces the journey of Bhabha and Sarabhai coming to terms with the challenges facing a young, independent nation and their friendship, sacrifice and determination.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/esNv5JwxVsvu6vZE7bTVeu0mLaA.jpg",
    "image": "https://image.tmdb.org/t/p/w500/esNv5JwxVsvu6vZE7bTVeu0mLaA.jpg",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "2022",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ani-hindi-5",
    "title": "Haikyu!!",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "",
    "description": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "synopsis": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "2014",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mus-hindi-5",
    "title": "Kabira",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Kabira is melody content in Hindi. A reassuring choice that helps release pressure without demanding too much.",
    "synopsis": "Kabira is melody content in Hindi. A reassuring choice that helps release pressure without demanding too much.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "2012",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mov-tamil-5",
    "title": "Raja Rani",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "As a young boy Raja turns to a life of crime after the death of his mother. Years  later Raja, now a hardened thief, uses a marriage as an escape ploy but shortly after he is caught.",
    "synopsis": "As a young boy Raja turns to a life of crime after the death of his mother. Years  later Raja, now a hardened thief, uses a marriage as an escape ploy but shortly after he is caught.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/56k4rVgfku7s87yXshtAqKOtbyk.jpg",
    "image": "https://image.tmdb.org/t/p/w500/56k4rVgfku7s87yXshtAqKOtbyk.jpg",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "1973",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ser-tamil-5",
    "title": "Auto Shankar",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Based on horrifying true incidents that happened between 1985 - 1995 in Chennai, still remembered as 'Once upon a time in Madras'.",
    "synopsis": "Based on horrifying true incidents that happened between 1985 - 1995 in Chennai, still remembered as 'Once upon a time in Madras'.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/p8QH55ZOAMhV5uyct5fFntoBtba.jpg",
    "image": "https://image.tmdb.org/t/p/w500/p8QH55ZOAMhV5uyct5fFntoBtba.jpg",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "2019",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "ani-tamil-5",
    "title": "Haikyu!!",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "",
    "description": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "synopsis": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "2014",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mus-tamil-5",
    "title": "Enjoy Enjaami",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Enjoy Enjaami is melody content in Tamil. A reassuring choice that helps release pressure without demanding too much.",
    "synopsis": "Enjoy Enjaami is melody content in Tamil. A reassuring choice that helps release pressure without demanding too much.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.3,
    "releaseYear": 2012,
    "year": "2012",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9099999999999999
  },
  {
    "id": "mov-eng-5",
    "title": "About Time",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "The night after another unsatisfactory New Year's party, Tim's father reveals to him that the men in their family have the ability to travel through time. They can't change history, but they can change what happens and has happened in their own lives. Thus begins the start of a lesson in learning to appreciate life itself as it is, as it comes, and most importantly, the people living alongside us.",
    "synopsis": "The night after another unsatisfactory New Year's party, Tim's father reveals to him that the men in their family have the ability to travel through time. They can't change history, but they can change what happens and has happened in their own lives. Thus begins the start of a lesson in learning to appreciate life itself as it is, as it comes, and most importantly, the people living alongside us.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/ls6zswrOZVhCXQBh96DlbnLBajM.jpg",
    "image": "https://image.tmdb.org/t/p/w500/ls6zswrOZVhCXQBh96DlbnLBajM.jpg",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2013",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ser-eng-5",
    "title": "The Good Place",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Eleanor Shellstrop, an ordinary woman who, through an extraordinary string of events, enters the afterlife where she comes to realize that she hasn't been a very good person. With the help of her wise afterlife mentor, she's determined to shed her old way of living and discover the awesome (or at least the pretty good) person within.",
    "synopsis": "Eleanor Shellstrop, an ordinary woman who, through an extraordinary string of events, enters the afterlife where she comes to realize that she hasn't been a very good person. With the help of her wise afterlife mentor, she's determined to shed her old way of living and discover the awesome (or at least the pretty good) person within.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/qIhsuhoIYR5yTnDta0IL4senbeN.jpg",
    "image": "https://image.tmdb.org/t/p/w500/qIhsuhoIYR5yTnDta0IL4senbeN.jpg",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2016",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ani-eng-5",
    "title": "Mob Psycho 100",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "",
    "description": "Shigeo Kageyama, a.k.a. \"Mob,\" is a boy who has trouble expressing himself, but who happens to be a powerful esper. Mob is determined to live a normal life and keeps his ESP suppressed, but when his emotions surge to a level of 100%, something terrible happens to him! As he's surrounded by false espers, evil spirits, and mysterious organizations, what will Mob think? What choices will he make?",
    "synopsis": "Shigeo Kageyama, a.k.a. \"Mob,\" is a boy who has trouble expressing himself, but who happens to be a powerful esper. Mob is determined to live a normal life and keeps his ESP suppressed, but when his emotions surge to a level of 100%, something terrible happens to him! As he's surrounded by false espers, evil spirits, and mysterious organizations, what will Mob think? What choices will he make?",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/vR7hwaGQ0ySRoq1WobiNRaPs4WO.jpg",
    "image": "https://image.tmdb.org/t/p/w500/vR7hwaGQ0ySRoq1WobiNRaPs4WO.jpg",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2016",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mus-eng-3-b",
    "type": "music",
    "title": "Clocks",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Viva La Vida is melody content in English. A reassuring choice that helps release pressure without demanding too much.",
    "synopsis": "Viva La Vida is melody content in English. A reassuring choice that helps release pressure without demanding too much.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2010",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mov-malayalam-5",
    "title": "Minnal Murali",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A tailor gains special powers after being struck by lightning but must take down an unexpected foe if he is to become the superhero his hometown in Kerala needs.",
    "synopsis": "A tailor gains special powers after being struck by lightning but must take down an unexpected foe if he is to become the superhero his hometown in Kerala needs.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/efetKFDyptrRpoHBb103Tg3Auw5.jpg",
    "image": "https://image.tmdb.org/t/p/w500/efetKFDyptrRpoHBb103Tg3Auw5.jpg",
    "rating": 8.7,
    "releaseYear": 2016,
    "year": "2021",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.95
  },
  {
    "id": "ser-malayalam-5",
    "title": "Kerala Crime Files",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A sex worker's mysterious and gruesome murder in a suburban lodge called \"Grand Tourist Home\" baffles the police as the only lead they have is a fake address.",
    "synopsis": "A sex worker's mysterious and gruesome murder in a suburban lodge called \"Grand Tourist Home\" baffles the police as the only lead they have is a fake address.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/eM2gQTFRoMAaJ3AjGiB10LZU8n6.jpg",
    "image": "https://image.tmdb.org/t/p/w500/eM2gQTFRoMAaJ3AjGiB10LZU8n6.jpg",
    "rating": 8.7,
    "releaseYear": 2016,
    "year": "2023",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.95
  },
  {
    "id": "ani-malayalam-5",
    "title": "Haikyu!!",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "",
    "description": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "synopsis": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "rating": 8.7,
    "releaseYear": 2016,
    "year": "2014",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.95
  },
  {
    "id": "mus-malayalam-5",
    "title": "Onakka Munthiri",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Onakka Munthiri is melody content in Malayalam. A reassuring choice that helps release pressure without demanding too much.",
    "synopsis": "Onakka Munthiri is melody content in Malayalam. A reassuring choice that helps release pressure without demanding too much.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.7,
    "releaseYear": 2016,
    "year": "2016",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.95
  },
  {
    "id": "mov-tel-5",
    "title": "Ala Vaikunthapurramuloo",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "After growing up enduring criticism from his father, a young man finds his world shaken upon learning he was switched at birth with a millionaire's son.",
    "synopsis": "After growing up enduring criticism from his father, a young man finds his world shaken upon learning he was switched at birth with a millionaire's son.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/2rzORJaegE2bbKNVkQXbZCeV0BP.jpg",
    "image": "https://image.tmdb.org/t/p/w500/2rzORJaegE2bbKNVkQXbZCeV0BP.jpg",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2020",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ser-tel-5",
    "title": "Save the Tigers",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Revolves around three frustrated husbands who meet by chance and how their rants over their marital problems set off a series of crazy events.",
    "synopsis": "Revolves around three frustrated husbands who meet by chance and how their rants over their marital problems set off a series of crazy events.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/5uyNd8UjItEU2M5W0YKULaxzWFm.jpg",
    "image": "https://image.tmdb.org/t/p/w500/5uyNd8UjItEU2M5W0YKULaxzWFm.jpg",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2023",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ani-tel-5",
    "title": "Haikyu!!",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "",
    "director": "",
    "description": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "synopsis": "Inspired by a small-statured pro volleyball player, Hinata creates a volleyball team in his last year of middle school. Unfortunately the team is matched up against the \"King of the Court\" Tobio Kageyama’s team in their first tournament and inevitably lose. After the crushing defeat, Hinata vows to surpass Kageyama After entering high school, Hinata joins the volleyball team only to find that Tobio has also joined.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8WEr48swcqe89Zsy5sdrGCASlIg.jpg",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2014",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mus-tel-5",
    "title": "Neeli Neeli Aakasam",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "stressed"
    ],
    "moodTags": [
      "stressed"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Neeli Neeli Aakasam is melody content in Telugu. A reassuring choice that helps release pressure without demanding too much.",
    "synopsis": "Neeli Neeli Aakasam is melody content in Telugu. A reassuring choice that helps release pressure without demanding too much.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.1,
    "releaseYear": 2010,
    "year": "2010",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.62,
    "energy": 0.2,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mov-hindi-6",
    "title": "Kapoor & Sons",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Returning home to visit their ill grandfather, two estranged brothers must confront their unresolved rivalry while their parents’ marriage frays.",
    "synopsis": "Returning home to visit their ill grandfather, two estranged brothers must confront their unresolved rivalry while their parents’ marriage frays.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/oPdcOInH8TqR5udDTDPiDuLSN90.jpg",
    "image": "https://image.tmdb.org/t/p/w500/oPdcOInH8TqR5udDTDPiDuLSN90.jpg",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "2016",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ser-hindi-6",
    "title": "Made in Heaven",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "The story of two wedding planners in Delhi, where tradition jostles with modern aspirations against the backdrop of big fat Indian weddings revealing many secrets and lies.",
    "synopsis": "The story of two wedding planners in Delhi, where tradition jostles with modern aspirations against the backdrop of big fat Indian weddings revealing many secrets and lies.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/leBOnbO2aLyfhMEdgO9tMlwcCY.jpg",
    "image": "https://image.tmdb.org/t/p/w500/leBOnbO2aLyfhMEdgO9tMlwcCY.jpg",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "2019",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ani-hindi-6",
    "title": "My Hero Academia",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "",
    "description": "Izuku has dreamt of being a hero all his life—a lofty goal for anyone, but especially challenging for a kid with no superpowers. That’s right, in a world where eighty percent of the population has some kind of super-powered \"quirk,\" Izuku was unlucky enough to be born completely normal. But that’s not enough to stop him from enrolling in one of the world’s most prestigious hero academies.",
    "synopsis": "Izuku has dreamt of being a hero all his life—a lofty goal for anyone, but especially challenging for a kid with no superpowers. That’s right, in a world where eighty percent of the population has some kind of super-powered \"quirk,\" Izuku was unlucky enough to be born completely normal. But that’s not enough to stop him from enrolling in one of the world’s most prestigious hero academies.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/phuYuzqWW9ru8EA3HVjE9W2Rr3M.jpg",
    "image": "https://image.tmdb.org/t/p/w500/phuYuzqWW9ru8EA3HVjE9W2Rr3M.jpg",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "2016",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mus-hindi-6",
    "title": "Phir Le Aya Dil",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Phir Le Aya Dil is melody content in Hindi. A serene experience for protecting a quiet, peaceful headspace.",
    "synopsis": "Phir Le Aya Dil is melody content in Hindi. A serene experience for protecting a quiet, peaceful headspace.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "2015",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mov-tamil-6",
    "title": "Pariyerum Perumal",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A law student from a lower caste begins a friendship with his classmate, a girl who belongs to a higher caste, and the men in her family start giving him trouble over this.",
    "synopsis": "A law student from a lower caste begins a friendship with his classmate, a girl who belongs to a higher caste, and the men in her family start giving him trouble over this.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/78YoIO3gzkZPC1jotfDmolNDmgT.jpg",
    "image": "https://image.tmdb.org/t/p/w500/78YoIO3gzkZPC1jotfDmolNDmgT.jpg",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "2018",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ser-tamil-6",
    "title": "November Story",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A celebrated crime novelist suffering from Alzheimer's is found at a murder scene with no memory of what happened. Now, it is up to his daughter to save him.",
    "synopsis": "A celebrated crime novelist suffering from Alzheimer's is found at a murder scene with no memory of what happened. Now, it is up to his daughter to save him.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/l93GSW1EO7qO6bPUp5qHCDkfyOT.jpg",
    "image": "https://image.tmdb.org/t/p/w500/l93GSW1EO7qO6bPUp5qHCDkfyOT.jpg",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "2021",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "ani-tamil-6",
    "title": "Your Name",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "",
    "description": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "synopsis": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "1992",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mus-tamil-6",
    "title": "Munbe Vaa",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Munbe Vaa is melody content in Tamil. A serene experience for protecting a quiet, peaceful headspace.",
    "synopsis": "Munbe Vaa is melody content in Tamil. A serene experience for protecting a quiet, peaceful headspace.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.4,
    "releaseYear": 2015,
    "year": "2015",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9199999999999999
  },
  {
    "id": "mov-eng-6",
    "title": "The Pursuit of Happyness",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A struggling salesman takes custody of his son as he's poised to begin a life-changing professional career.",
    "synopsis": "A struggling salesman takes custody of his son as he's poised to begin a life-changing professional career.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/lBYOKAMcxIvuk9s9hMuecB9dPBV.jpg",
    "image": "https://image.tmdb.org/t/p/w500/lBYOKAMcxIvuk9s9hMuecB9dPBV.jpg",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "2006",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.94
  },
  {
    "id": "ser-eng-6",
    "title": "The Queen's Gambit",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "In a 1950s orphanage, a young girl reveals an astonishing talent for chess and begins an unlikely journey to stardom while grappling with addiction.",
    "synopsis": "In a 1950s orphanage, a young girl reveals an astonishing talent for chess and begins an unlikely journey to stardom while grappling with addiction.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/zU0htwkhNvBQdVSIKB9s6hgVeFK.jpg",
    "image": "https://image.tmdb.org/t/p/w500/zU0htwkhNvBQdVSIKB9s6hgVeFK.jpg",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "2020",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.94
  },
  {
    "id": "ani-eng-6",
    "title": "Attack on Titan",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "",
    "description": "100 years ago, the last remnants of humanity were forced to retreat behind the towering walls of a fortified city to escape the massive, man-eating Titans that roamed the land outside their fortress. Only the members of the Scouting Legion dared to stray beyond the safety of the walls – but even those brave warriors seldom returned alive. Those within the city clung to the illusion of a peaceful existence until the day that dream was shattered, and their slim chance at survival was reduced to one horrifying choice: kill – or be devoured!",
    "synopsis": "100 years ago, the last remnants of humanity were forced to retreat behind the towering walls of a fortified city to escape the massive, man-eating Titans that roamed the land outside their fortress. Only the members of the Scouting Legion dared to stray beyond the safety of the walls – but even those brave warriors seldom returned alive. Those within the city clung to the illusion of a peaceful existence until the day that dream was shattered, and their slim chance at survival was reduced to one horrifying choice: kill – or be devoured!",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    "image": "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.94
  },
  {
    "id": "mus-eng-6",
    "title": "The Night We Met",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "The Night We Met is melody content in English. A serene experience for protecting a quiet, peaceful headspace.",
    "synopsis": "The Night We Met is melody content in English. A serene experience for protecting a quiet, peaceful headspace.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.94
  },
  {
    "id": "mov-malayalam-6",
    "title": "Premam",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Three stages in George's life, and three girls he encounters in each stage.",
    "synopsis": "Three stages in George's life, and three girls he encounters in each stage.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/wfMgsfDrtouYOM6MbrkHtU96Xij.jpg",
    "image": "https://image.tmdb.org/t/p/w500/wfMgsfDrtouYOM6MbrkHtU96Xij.jpg",
    "rating": 8.8,
    "releaseYear": 2019,
    "year": "2015",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.96
  },
  {
    "id": "ser-malayalam-6",
    "title": "1000 Babies",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Enter a cradle of mysteries where a man with a dark past manipulates multiple lives through a series of cryptic letters and deadly games.",
    "synopsis": "Enter a cradle of mysteries where a man with a dark past manipulates multiple lives through a series of cryptic letters and deadly games.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/j9EdxlAReZ27m29kTP0cqaQOeoe.jpg",
    "image": "https://image.tmdb.org/t/p/w500/j9EdxlAReZ27m29kTP0cqaQOeoe.jpg",
    "rating": 8.8,
    "releaseYear": 2019,
    "year": "2024",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.96
  },
  {
    "id": "ani-malayalam-6",
    "title": "My Hero Academia",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "",
    "description": "Izuku has dreamt of being a hero all his life—a lofty goal for anyone, but especially challenging for a kid with no superpowers. That’s right, in a world where eighty percent of the population has some kind of super-powered \"quirk,\" Izuku was unlucky enough to be born completely normal. But that’s not enough to stop him from enrolling in one of the world’s most prestigious hero academies.",
    "synopsis": "Izuku has dreamt of being a hero all his life—a lofty goal for anyone, but especially challenging for a kid with no superpowers. That’s right, in a world where eighty percent of the population has some kind of super-powered \"quirk,\" Izuku was unlucky enough to be born completely normal. But that’s not enough to stop him from enrolling in one of the world’s most prestigious hero academies.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/phuYuzqWW9ru8EA3HVjE9W2Rr3M.jpg",
    "image": "https://image.tmdb.org/t/p/w500/phuYuzqWW9ru8EA3HVjE9W2Rr3M.jpg",
    "rating": 8.8,
    "releaseYear": 2019,
    "year": "2016",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.96
  },
  {
    "id": "mus-malayalam-6",
    "title": "Uyiril Thodum",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Uyiril Thodum is melody content in Malayalam. A serene experience for protecting a quiet, peaceful headspace.",
    "synopsis": "Uyiril Thodum is melody content in Malayalam. A serene experience for protecting a quiet, peaceful headspace.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.8,
    "releaseYear": 2019,
    "year": "2019",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.96
  },
  {
    "id": "mov-tel-6",
    "title": "Mahanati",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Mahanati depicts the life and career of one of Telugu cinema's greatest and most iconic starlets, the first Indian female super star, Savitri.",
    "synopsis": "Mahanati depicts the life and career of one of Telugu cinema's greatest and most iconic starlets, the first Indian female super star, Savitri.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/5hwtlwoLdSpkoeusT0sf8qW5VFB.jpg",
    "image": "https://image.tmdb.org/t/p/w500/5hwtlwoLdSpkoeusT0sf8qW5VFB.jpg",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "2018",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ser-tel-6",
    "title": "9 Hours",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Three prisoners on run try to rob three banks. They are well-prepared and know how to run away with the booty. Is someone handling them from behind the screens?",
    "synopsis": "Three prisoners on run try to rob three banks. They are well-prepared and know how to run away with the booty. Is someone handling them from behind the screens?",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/4lqTfrlQWakAHbPbF5c84pl07Us.jpg",
    "image": "https://image.tmdb.org/t/p/w500/4lqTfrlQWakAHbPbF5c84pl07Us.jpg",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "2022",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ani-tel-6",
    "title": "Your Name",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "",
    "director": "",
    "description": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "synopsis": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "1992",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mus-tel-6",
    "title": "Vachindamma",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "peaceful"
    ],
    "moodTags": [
      "peaceful"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Vachindamma is melody content in Telugu. A serene experience for protecting a quiet, peaceful headspace.",
    "synopsis": "Vachindamma is melody content in Telugu. A serene experience for protecting a quiet, peaceful headspace.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.2,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.8,
    "energy": 0.18,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mov-hindi-7",
    "title": "Tamasha",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Meeting while on vacation, Ved and Tara sense a connection but vow to keep their real identities a secret. Years later, their paths cross again.",
    "synopsis": "Meeting while on vacation, Ved and Tara sense a connection but vow to keep their real identities a secret. Years later, their paths cross again.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8Ktf15qGVFYQ6CdBtBgCDM96UMC.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8Ktf15qGVFYQ6CdBtBgCDM96UMC.jpg",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "2015",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ser-hindi-7",
    "title": "Aspirants",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Aspirants is a story of 3 friends - Abhilash, SK, and Guri. The story takes place in the past and the present where the past captures the struggle and the drama behind the making of UPSC CSE aspirants in Old Rajinder Nagar of Delhi, while the present talks about the aftermath. It is the story of three UPSC aspirants journey.",
    "synopsis": "Aspirants is a story of 3 friends - Abhilash, SK, and Guri. The story takes place in the past and the present where the past captures the struggle and the drama behind the making of UPSC CSE aspirants in Old Rajinder Nagar of Delhi, while the present talks about the aftermath. It is the story of three UPSC aspirants journey.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/lG8wK40jH4EX6dbVFI1fzw2E96N.jpg",
    "image": "https://image.tmdb.org/t/p/w500/lG8wK40jH4EX6dbVFI1fzw2E96N.jpg",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "2021",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ani-hindi-7",
    "title": "Your Name",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "",
    "description": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "synopsis": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "1992",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mus-hindi-7",
    "title": "Kun Faya Kun",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Kun Faya Kun is melody content in Hindi. A beautifully reflective choice for sitting with nostalgia.",
    "synopsis": "Kun Faya Kun is melody content in Hindi. A beautifully reflective choice for sitting with nostalgia.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "2018",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mov-tamil-7",
    "title": "Kaithi",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Dilli, a convicted criminal, is out on parole to meet his daughter. However, a drug bust sets him off on a mission to save the life of police officers.",
    "synopsis": "Dilli, a convicted criminal, is out on parole to meet his daughter. However, a drug bust sets him off on a mission to save the life of police officers.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/hOF9CgPsy9aLr5GJEBESC8MEXFy.jpg",
    "image": "https://image.tmdb.org/t/p/w500/hOF9CgPsy9aLr5GJEBESC8MEXFy.jpg",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "2019",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ser-tamil-7",
    "title": "Fingertip",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "The anthology series showcases how a single social media post, instigated by negative emotions, can change one's life forever.",
    "synopsis": "The anthology series showcases how a single social media post, instigated by negative emotions, can change one's life forever.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/59gW9zlmso1wNBJOynFGnwetsxW.jpg",
    "image": "https://image.tmdb.org/t/p/w500/59gW9zlmso1wNBJOynFGnwetsxW.jpg",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "2019",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "ani-tamil-7",
    "title": "Weathering with You",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "",
    "description": "Weathering with You is animation content in Tamil. A beautifully reflective choice for sitting with nostalgia.",
    "synopsis": "Weathering with You is animation content in Tamil. A beautifully reflective choice for sitting with nostalgia.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "2018",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mus-tamil-7",
    "title": "Maruvaarthai",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Maruvaarthai is melody content in Tamil. A beautifully reflective choice for sitting with nostalgia.",
    "synopsis": "Maruvaarthai is melody content in Tamil. A beautifully reflective choice for sitting with nostalgia.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.5,
    "releaseYear": 2018,
    "year": "2018",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.9299999999999999
  },
  {
    "id": "mov-eng-7",
    "title": "Chef",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "When Chef Carl Casper suddenly quits his job at a prominent Los Angeles restaurant after refusing to compromise his creative integrity for its controlling owner, he is left to figure out what's next. Finding himself in Miami, he teams up with his ex-wife, his friend and his son to launch a food truck. Taking to the road, Chef Carl goes back to his roots to reignite his passion for the kitchen -- and zest for life and love.",
    "synopsis": "When Chef Carl Casper suddenly quits his job at a prominent Los Angeles restaurant after refusing to compromise his creative integrity for its controlling owner, he is left to figure out what's next. Finding himself in Miami, he teams up with his ex-wife, his friend and his son to launch a food truck. Taking to the road, Chef Carl goes back to his roots to reignite his passion for the kitchen -- and zest for life and love.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/hyp8EXDmO4dSC8V6Q5jU7gD1kcg.jpg",
    "image": "https://image.tmdb.org/t/p/w500/hyp8EXDmO4dSC8V6Q5jU7gD1kcg.jpg",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2014",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.95
  },
  {
    "id": "ser-eng-7",
    "title": "Anne with an E",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A coming-of-age story about an outsider who, against all odds and numerous challenges, fights for love and acceptance and for her place in the world. The series centers on a young orphaned girl in the late 1890s, who, after an abusive childhood spent in orphanages and the homes of strangers, is mistakenly sent to live with an elderly woman and her aging brother. Over time, 13-year-old Anne will transform their lives and eventually the small town in which they live with her unique spirit, fierce intellect and brilliant imagination.",
    "synopsis": "A coming-of-age story about an outsider who, against all odds and numerous challenges, fights for love and acceptance and for her place in the world. The series centers on a young orphaned girl in the late 1890s, who, after an abusive childhood spent in orphanages and the homes of strangers, is mistakenly sent to live with an elderly woman and her aging brother. Over time, 13-year-old Anne will transform their lives and eventually the small town in which they live with her unique spirit, fierce intellect and brilliant imagination.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/6P6tXhjT5tK3qOXzxF9OMLlG7iz.jpg",
    "image": "https://image.tmdb.org/t/p/w500/6P6tXhjT5tK3qOXzxF9OMLlG7iz.jpg",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2017",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.95
  },
  {
    "id": "ani-eng-7",
    "title": "One Punch Man",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "",
    "description": "Saitama is a hero who only became a hero for fun. After three years of “special” training, though, he’s become so strong that he’s practically invincible. In fact, he’s too strong—even his mightiest opponents are taken out with a single punch, and it turns out that being devastatingly powerful is actually kind of a bore. With his passion for being a hero lost along with his hair, yet still faced with new enemies every day, how much longer can he keep it going?",
    "synopsis": "Saitama is a hero who only became a hero for fun. After three years of “special” training, though, he’s become so strong that he’s practically invincible. In fact, he’s too strong—even his mightiest opponents are taken out with a single punch, and it turns out that being devastatingly powerful is actually kind of a bore. With his passion for being a hero lost along with his hair, yet still faced with new enemies every day, how much longer can he keep it going?",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/dT10AxJIXVvRwFAew4tt2RhzJrD.jpg",
    "image": "https://image.tmdb.org/t/p/w500/dT10AxJIXVvRwFAew4tt2RhzJrD.jpg",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2015",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.95
  },
  {
    "id": "mus-eng-7",
    "title": "A Sky Full of Stars",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "A Sky Full of Stars is melody content in English. A beautifully reflective choice for sitting with nostalgia.",
    "synopsis": "A Sky Full of Stars is melody content in English. A beautifully reflective choice for sitting with nostalgia.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2016",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.95
  },
  {
    "id": "mov-malayalam-7",
    "title": "Home",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Peter Parker is unmasked and no longer able to separate his normal life from the high-stakes of being a super-hero. When he asks for help from Doctor Strange the stakes become even more dangerous, forcing him to discover what it truly means to be Spider-Man.",
    "synopsis": "Peter Parker is unmasked and no longer able to separate his normal life from the high-stakes of being a super-hero. When he asks for help from Doctor Strange the stakes become even more dangerous, forcing him to discover what it truly means to be Spider-Man.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
    "image": "https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
    "rating": 8.9,
    "releaseYear": 2022,
    "year": "2021",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.82
  },
  {
    "id": "ser-malayalam-7",
    "title": "The Village",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "The Village is a BBC television drama created and written by Peter Moffat. Consisting of two six-episode series—the project intended as a 42-hour televised epic—the first series covers 1914 to 1920; the second continued the story into the 1920s. However, it was not commissioned for a third series. An epic drama charting the turbulent times experienced by one English village throughout the 20th century; births, deaths, political events and rebellions are among the events that occur during the time.\n\nBert Middleton lives across the entire 100-year period, and his story from boyhood to old age forms the crux of the story, seen via flashbacks as Bert is interviewed in the present day by a documentarian working on a project about the second eldest man in the United Kingdom and his village.",
    "synopsis": "The Village is a BBC television drama created and written by Peter Moffat. Consisting of two six-episode series—the project intended as a 42-hour televised epic—the first series covers 1914 to 1920; the second continued the story into the 1920s. However, it was not commissioned for a third series. An epic drama charting the turbulent times experienced by one English village throughout the 20th century; births, deaths, political events and rebellions are among the events that occur during the time.\n\nBert Middleton lives across the entire 100-year period, and his story from boyhood to old age forms the crux of the story, seen via flashbacks as Bert is interviewed in the present day by a documentarian working on a project about the second eldest man in the United Kingdom and his village.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/ojTX0B5o5yI2mKkLyyTxaKoPvWL.jpg",
    "image": "https://image.tmdb.org/t/p/w500/ojTX0B5o5yI2mKkLyyTxaKoPvWL.jpg",
    "rating": 8.9,
    "releaseYear": 2022,
    "year": "2013",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.82
  },
  {
    "id": "ani-malayalam-7",
    "title": "Your Name",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "",
    "description": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "synopsis": "Name Your Adventure is an American reality series that aired on Saturday mornings during NBC's TNBC line-up. Hosted by Mario Lopez, Jordan Brady, and Tatyana Ali, the series ran from September 1992 to September 1995.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.9,
    "releaseYear": 2022,
    "year": "1992",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.82
  },
  {
    "id": "mus-malayalam-7",
    "title": "Cherathukal",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Cherathukal is melody content in Malayalam. A beautifully reflective choice for sitting with nostalgia.",
    "synopsis": "Cherathukal is melody content in Malayalam. A beautifully reflective choice for sitting with nostalgia.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.9,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.82
  },
  {
    "id": "mov-tel-7",
    "title": "Agent Sai Srinivasa Athreya",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Agent Sai Srinivasa Athreya is a brilliant, underrated detective from Nellore who runs an agency called FBI which sees no business. He gets more than what he asked for when a case happens to fall right into his lap out of nowhere.",
    "synopsis": "Agent Sai Srinivasa Athreya is a brilliant, underrated detective from Nellore who runs an agency called FBI which sees no business. He gets more than what he asked for when a case happens to fall right into his lap out of nowhere.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/jMVfhhWfHLawVp3kd55KBy3VBsW.jpg",
    "image": "https://image.tmdb.org/t/p/w500/jMVfhhWfHLawVp3kd55KBy3VBsW.jpg",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2019",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.94
  },
  {
    "id": "ser-tel-7",
    "title": "Dhootha",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Journalist Sagar's life turns thrilling as he unravels dark secrets behind newspaper clippings predicting tragedies. He becomes a murder suspect, racing against time to clear his name and solve the enigma and faces dangerous twists. Suspense builds in this roller-coaster ride.",
    "synopsis": "Journalist Sagar's life turns thrilling as he unravels dark secrets behind newspaper clippings predicting tragedies. He becomes a murder suspect, racing against time to clear his name and solve the enigma and faces dangerous twists. Suspense builds in this roller-coaster ride.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/jMegWqCj8z58na8RG8ytlPJ7gGm.jpg",
    "image": "https://image.tmdb.org/t/p/w500/jMegWqCj8z58na8RG8ytlPJ7gGm.jpg",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2023",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.94
  },
  {
    "id": "ani-tel-7",
    "title": "Weathering with You",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "",
    "director": "",
    "description": "Weathering with You is animation content in Telugu. A beautifully reflective choice for sitting with nostalgia.",
    "synopsis": "Weathering with You is animation content in Telugu. A beautifully reflective choice for sitting with nostalgia.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2016",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.94
  },
  {
    "id": "mus-tel-7",
    "title": "Oh Sita Hey Rama",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "melancholic"
    ],
    "moodTags": [
      "melancholic"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Oh Sita Hey Rama is melody content in Telugu. A beautifully reflective choice for sitting with nostalgia.",
    "synopsis": "Oh Sita Hey Rama is melody content in Telugu. A beautifully reflective choice for sitting with nostalgia.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.3,
    "releaseYear": 2016,
    "year": "2016",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.42,
    "energy": 0.32,
    "baseQuality": 0.94
  },
  {
    "id": "mov-hindi-8",
    "title": "Dangal",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Dangal is an extraordinary true story based on the life of Mahavir Singh and his two daughters, Geeta and Babita Phogat. The film traces the inspirational journey of a father who trains his daughters to become world class wrestlers.",
    "synopsis": "Dangal is an extraordinary true story based on the life of Mahavir Singh and his two daughters, Geeta and Babita Phogat. The film traces the inspirational journey of a father who trains his daughters to become world class wrestlers.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/cJRPOLEexI7qp2DKtFfCh7YaaUG.jpg",
    "image": "https://image.tmdb.org/t/p/w500/cJRPOLEexI7qp2DKtFfCh7YaaUG.jpg",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2016",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "ser-hindi-8",
    "title": "Permanent Roommates",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A couple, who were in a long distance relationship for 3 years, face the prospect of getting married.",
    "synopsis": "A couple, who were in a long distance relationship for 3 years, face the prospect of getting married.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/ftSOeY2zUidSh5q3uhmpbgwDqvd.jpg",
    "image": "https://image.tmdb.org/t/p/w500/ftSOeY2zUidSh5q3uhmpbgwDqvd.jpg",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2014",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "ani-hindi-8",
    "title": "Spirited Away",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "",
    "description": "The company of the stage \"the secret of Sen and Chihiro\" gathered together in Tokyo again. The new cast is also added, and it challenges the first overseas performance at the London Colosseum in the theater and the sacred end in west end. The company that arrived in London is soon baptized. Theater is narrow compared to Japan, and audience seats are wide. The set is also rebuilt, and the performance and the performance of the theater are changed. And the biggest problem is the difference between the wall and the way of working between English staff. From the first day of the practice, trouble attacks without permission. Training in London was the beginning of the disturbance.",
    "synopsis": "The company of the stage \"the secret of Sen and Chihiro\" gathered together in Tokyo again. The new cast is also added, and it challenges the first overseas performance at the London Colosseum in the theater and the sacred end in west end. The company that arrived in London is soon baptized. Theater is narrow compared to Japan, and audience seats are wide. The set is also rebuilt, and the performance and the performance of the theater are changed. And the biggest problem is the difference between the wall and the way of working between English staff. From the first day of the practice, trouble attacks without permission. Training in London was the beginning of the disturbance.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8uajlTh0Gg2mTn3pu3KClBVzf5A.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8uajlTh0Gg2mTn3pu3KClBVzf5A.jpg",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2024",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "mus-hindi-8",
    "title": "Zinda",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Zinda is melody content in Hindi. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Zinda is melody content in Hindi. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2021",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "mov-tamil-8",
    "title": "Oh My Kadavule",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Arjun is conveniently married to his best friend Anu and their marriage turns out to be a nightmare since he is not really in love with her. When things get tough Arjun gets a second chance in life that could change his path and perspective altogether.",
    "synopsis": "Arjun is conveniently married to his best friend Anu and their marriage turns out to be a nightmare since he is not really in love with her. When things get tough Arjun gets a second chance in life that could change his path and perspective altogether.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/wuQwtFEm4DlzK3EnZ5VWefVXZvG.jpg",
    "image": "https://image.tmdb.org/t/p/w500/wuQwtFEm4DlzK3EnZ5VWefVXZvG.jpg",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2020",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "ser-tamil-8",
    "title": "Paper Rocket",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Paper Rocket is drama content in Tamil. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Paper Rocket is drama content in Tamil. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/7rXoG3lKijD2Jn7aYNQJ3kXsdvb.jpg",
    "image": "https://image.tmdb.org/t/p/w500/7rXoG3lKijD2Jn7aYNQJ3kXsdvb.jpg",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2014",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "ani-tamil-8",
    "title": "Suzume",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "",
    "description": "Suzume is animation content in Tamil. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Suzume is animation content in Tamil. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2021",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "mus-tamil-8",
    "title": "Megham Karukatha",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Megham Karukatha is melody content in Tamil. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Megham Karukatha is melody content in Tamil. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.6,
    "releaseYear": 2021,
    "year": "2021",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.94
  },
  {
    "id": "mov-eng-8",
    "title": "Paddington 2",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Paddington, now happily settled with the Browns, picks up a series of odd jobs to buy the perfect present for his Aunt Lucy, but it is stolen.",
    "synopsis": "Paddington, now happily settled with the Browns, picks up a series of odd jobs to buy the perfect present for his Aunt Lucy, but it is stolen.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
    "image": "https://image.tmdb.org/t/p/w500/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2017",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.96
  },
  {
    "id": "ser-eng-8",
    "title": "Brooklyn Nine-Nine",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "A single-camera ensemble comedy following the lives of an eclectic group of detectives in a New York precinct, including one slacker who is forced to shape up when he gets a new boss.",
    "synopsis": "A single-camera ensemble comedy following the lives of an eclectic group of detectives in a New York precinct, including one slacker who is forced to shape up when he gets a new boss.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/mpjlDzVjp7oyHUe2LaF9ltKe6f1.jpg",
    "image": "https://image.tmdb.org/t/p/w500/mpjlDzVjp7oyHUe2LaF9ltKe6f1.jpg",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2013",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.96
  },
  {
    "id": "ani-eng-8",
    "title": "Violet Evergarden",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "",
    "description": "The war is over, and Violet Evergarden needs a job. Scarred and emotionless, she takes a job as a letter writer to understand herself and her past.",
    "synopsis": "The war is over, and Violet Evergarden needs a job. Scarred and emotionless, she takes a job as a letter writer to understand herself and her past.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/61EwFPqc0r1uJo6la49J55F8bQ8.jpg",
    "image": "https://image.tmdb.org/t/p/w500/61EwFPqc0r1uJo6la49J55F8bQ8.jpg",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2018",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.96
  },
  {
    "id": "mus-eng-8",
    "title": "Titanium",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Titanium is melody content in English. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Titanium is melody content in English. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2019",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.96
  },
  {
    "id": "mov-malayalam-8",
    "title": "Jaya Jaya Jaya Jaya Hey",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Jayabharathi who was denied every simple joy in life while growing up just because she is a girl/woman is married to Rajesh, a male chauvinist, short-tempered and selfish person. On suffering domestic violence, she doesn't get any support. She then decides to fight back!",
    "synopsis": "Jayabharathi who was denied every simple joy in life while growing up just because she is a girl/woman is married to Rajesh, a male chauvinist, short-tempered and selfish person. On suffering domestic violence, she doesn't get any support. She then decides to fight back!",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/lAc6mHHJxmiAbkxrF0TipvRRZW7.jpg",
    "image": "https://image.tmdb.org/t/p/w500/lAc6mHHJxmiAbkxrF0TipvRRZW7.jpg",
    "rating": 9,
    "releaseYear": 2010,
    "year": "2022",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.83
  },
  {
    "id": "ser-malayalam-8",
    "title": "Oru Kattil Oru Muri",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Oru Kattil Oru Muri is drama content in Malayalam. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Oru Kattil Oru Muri is drama content in Malayalam. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 9,
    "releaseYear": 2010,
    "year": "2010",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.83
  },
  {
    "id": "ani-malayalam-8",
    "title": "Spirited Away",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "",
    "description": "The company of the stage \"the secret of Sen and Chihiro\" gathered together in Tokyo again. The new cast is also added, and it challenges the first overseas performance at the London Colosseum in the theater and the sacred end in west end. The company that arrived in London is soon baptized. Theater is narrow compared to Japan, and audience seats are wide. The set is also rebuilt, and the performance and the performance of the theater are changed. And the biggest problem is the difference between the wall and the way of working between English staff. From the first day of the practice, trouble attacks without permission. Training in London was the beginning of the disturbance.",
    "synopsis": "The company of the stage \"the secret of Sen and Chihiro\" gathered together in Tokyo again. The new cast is also added, and it challenges the first overseas performance at the London Colosseum in the theater and the sacred end in west end. The company that arrived in London is soon baptized. Theater is narrow compared to Japan, and audience seats are wide. The set is also rebuilt, and the performance and the performance of the theater are changed. And the biggest problem is the difference between the wall and the way of working between English staff. From the first day of the practice, trouble attacks without permission. Training in London was the beginning of the disturbance.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/8uajlTh0Gg2mTn3pu3KClBVzf5A.jpg",
    "image": "https://image.tmdb.org/t/p/w500/8uajlTh0Gg2mTn3pu3KClBVzf5A.jpg",
    "rating": 9,
    "releaseYear": 2010,
    "year": "2024",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.83
  },
  {
    "id": "mus-malayalam-8",
    "title": "Parudeesa",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Parudeesa is melody content in Malayalam. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Parudeesa is melody content in Malayalam. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 9,
    "releaseYear": 2010,
    "year": "2010",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.83
  },
  {
    "id": "mov-tel-8",
    "title": "RRR",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A fictional history of two legendary revolutionaries' journey away from home before they began fighting for their country in the 1920s.",
    "synopsis": "A fictional history of two legendary revolutionaries' journey away from home before they began fighting for their country in the 1920s.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/u0XUBNQWlOvrh0Gd97ARGpIkL0.jpg",
    "image": "https://image.tmdb.org/t/p/w500/u0XUBNQWlOvrh0Gd97ARGpIkL0.jpg",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2022",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.95
  },
  {
    "id": "ser-tel-8",
    "title": "Loser",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "With their old hideout and bosses wiped out, the surviving Dusters make a secret agreement with the Ranger Force to engage in the weekly Sunday Showdown - one where they will always be defeated. Tired of this charade, Fighter D finally steps up to make a change once and for all!",
    "synopsis": "With their old hideout and bosses wiped out, the surviving Dusters make a secret agreement with the Ranger Force to engage in the weekly Sunday Showdown - one where they will always be defeated. Tired of this charade, Fighter D finally steps up to make a change once and for all!",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/1xLqRhNM41Xv0UZRZsHBhsnB1lx.jpg",
    "image": "https://image.tmdb.org/t/p/w500/1xLqRhNM41Xv0UZRZsHBhsnB1lx.jpg",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2024",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.95
  },
  {
    "id": "ani-tel-8",
    "title": "Jujutsu Kaisen",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "",
    "director": "",
    "description": "Yuji Itadori is a boy with tremendous physical strength, though he lives a completely ordinary high school life. One day, to save a classmate who has been attacked by curses, he eats the finger of Ryomen Sukuna, taking the curse into his own soul. From then on, he shares one body with Ryomen Sukuna. Guided by the most powerful of sorcerers, Satoru Gojo, Itadori is admitted to Tokyo Jujutsu High School, an organization that fights the curses... and thus begins the heroic tale of a boy who became a curse to exorcise a curse, a life from which he could never turn back.",
    "synopsis": "Yuji Itadori is a boy with tremendous physical strength, though he lives a completely ordinary high school life. One day, to save a classmate who has been attacked by curses, he eats the finger of Ryomen Sukuna, taking the curse into his own soul. From then on, he shares one body with Ryomen Sukuna. Guided by the most powerful of sorcerers, Satoru Gojo, Itadori is admitted to Tokyo Jujutsu High School, an organization that fights the curses... and thus begins the heroic tale of a boy who became a curse to exorcise a curse, a life from which he could never turn back.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/6qQzMJG27XOJsyAEEIisoJB45j2.jpg",
    "image": "https://image.tmdb.org/t/p/w500/6qQzMJG27XOJsyAEEIisoJB45j2.jpg",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2020",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.95
  },
  {
    "id": "mus-tel-8",
    "title": "Maate Vinadhuga",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "energized"
    ],
    "moodTags": [
      "energized"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Maate Vinadhuga is melody content in Telugu. A propulsive favorite for channeling momentum into celebration.",
    "synopsis": "Maate Vinadhuga is melody content in Telugu. A propulsive favorite for channeling momentum into celebration.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.4,
    "releaseYear": 2019,
    "year": "2019",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.88,
    "energy": 0.96,
    "baseQuality": 0.95
  },
  {
    "id": "mov-hindi-9",
    "title": "Yeh Jawaani Hai Deewani",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "On a trekking trip, an introverted Naina falls for a charming ex-classmate, whose thirst for adventure drives them apart. Years later, their paths cross again.",
    "synopsis": "On a trekking trip, an introverted Naina falls for a charming ex-classmate, whose thirst for adventure drives them apart. Years later, their paths cross again.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/em39H81XLCDgXsI7V4IcBZseEO6.jpg",
    "image": "https://image.tmdb.org/t/p/w500/em39H81XLCDgXsI7V4IcBZseEO6.jpg",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2013",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "ser-hindi-9",
    "title": "TVF Tripling",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Divorced, jobless, hopeless. Three siblings plan a road trip together. Chandan, Chanchal & Chitvan. Together they start a hilarious journey, to find themselves and their relations.",
    "synopsis": "Divorced, jobless, hopeless. Three siblings plan a road trip together. Chandan, Chanchal & Chitvan. Together they start a hilarious journey, to find themselves and their relations.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/nnW7gEhZB3CcJkRgWgoQTfPDaIO.jpg",
    "image": "https://image.tmdb.org/t/p/w500/nnW7gEhZB3CcJkRgWgoQTfPDaIO.jpg",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2016",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "ani-hindi-9",
    "title": "A Silent Voice",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "",
    "description": "Their grief echoes through the corridors of memory, a haunting reminder of the fragility of life. Yet, amidst the sorrow, there is a profound strength that emerges, a resilience born from love and the enduring bonds that can never truly be severed. These families come together, sharing stories and memories, finding solace in the understanding and support of one another. Through their unity, they transform their pain into a beacon of hope, ensuring that their children's legacies live on, shining brightly in the hearts of all who hear their tales.",
    "synopsis": "Their grief echoes through the corridors of memory, a haunting reminder of the fragility of life. Yet, amidst the sorrow, there is a profound strength that emerges, a resilience born from love and the enduring bonds that can never truly be severed. These families come together, sharing stories and memories, finding solace in the understanding and support of one another. Through their unity, they transform their pain into a beacon of hope, ensuring that their children's legacies live on, shining brightly in the hearts of all who hear their tales.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2025",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "mus-hindi-9",
    "title": "Love You Zindagi",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Love You Zindagi is melody content in Hindi. A grounding selection with enough warmth to settle a busy mind.",
    "synopsis": "Love You Zindagi is melody content in Hindi. A grounding selection with enough warmth to settle a busy mind.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2024",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "mov-tamil-9",
    "title": "Pannaiyarum Padminiyum",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A kind and respected village landlord acquires a vintage Premier Padmini car from his friend and cherishes it more than anything else. Over time, the entire village grows attached to the car, forming an emotional bond with it. His wife, however, refuses to ride in it until he learns to drive, so he decides to surprise her with a ride on their wedding anniversary. But before he can fulfill his promise, the car is taken away due to unforeseen circumstances. Will they ever get it back? A deeply emotional tale of love, nostalgia, and the heartfelt connection between an elderly couple and their cherished car.",
    "synopsis": "A kind and respected village landlord acquires a vintage Premier Padmini car from his friend and cherishes it more than anything else. Over time, the entire village grows attached to the car, forming an emotional bond with it. His wife, however, refuses to ride in it until he learns to drive, so he decides to surprise her with a ride on their wedding anniversary. But before he can fulfill his promise, the car is taken away due to unforeseen circumstances. Will they ever get it back? A deeply emotional tale of love, nostalgia, and the heartfelt connection between an elderly couple and their cherished car.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/ttmmm9CwXX137XcdSZV1X8VLIQO.jpg",
    "image": "https://image.tmdb.org/t/p/w500/ttmmm9CwXX137XcdSZV1X8VLIQO.jpg",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2014",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "ser-tamil-9",
    "title": "Time Enna Boss",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Bala - an average IT guy, is forced to host 4 random time travellers who land up in his new house until they find their way back. But will they ever leave?",
    "synopsis": "Bala - an average IT guy, is forced to host 4 random time travellers who land up in his new house until they find their way back. But will they ever leave?",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/3LabFHWsP0Ofh619ssiosEhGJOB.jpg",
    "image": "https://image.tmdb.org/t/p/w500/3LabFHWsP0Ofh619ssiosEhGJOB.jpg",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2020",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "ani-tamil-9",
    "title": "Jujutsu Kaisen",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "",
    "description": "Yuji Itadori is a boy with tremendous physical strength, though he lives a completely ordinary high school life. One day, to save a classmate who has been attacked by curses, he eats the finger of Ryomen Sukuna, taking the curse into his own soul. From then on, he shares one body with Ryomen Sukuna. Guided by the most powerful of sorcerers, Satoru Gojo, Itadori is admitted to Tokyo Jujutsu High School, an organization that fights the curses... and thus begins the heroic tale of a boy who became a curse to exorcise a curse, a life from which he could never turn back.",
    "synopsis": "Yuji Itadori is a boy with tremendous physical strength, though he lives a completely ordinary high school life. One day, to save a classmate who has been attacked by curses, he eats the finger of Ryomen Sukuna, taking the curse into his own soul. From then on, he shares one body with Ryomen Sukuna. Guided by the most powerful of sorcerers, Satoru Gojo, Itadori is admitted to Tokyo Jujutsu High School, an organization that fights the curses... and thus begins the heroic tale of a boy who became a curse to exorcise a curse, a life from which he could never turn back.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/6qQzMJG27XOJsyAEEIisoJB45j2.jpg",
    "image": "https://image.tmdb.org/t/p/w500/6qQzMJG27XOJsyAEEIisoJB45j2.jpg",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2020",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "mus-tamil-9",
    "title": "Chellamma",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Chellamma is melody content in Tamil. A grounding selection with enough warmth to settle a busy mind.",
    "synopsis": "Chellamma is melody content in Tamil. A grounding selection with enough warmth to settle a busy mind.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.7,
    "releaseYear": 2024,
    "year": "2024",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.95
  },
  {
    "id": "mov-eng-9",
    "title": "Sing Street",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A boy growing up in Dublin during the 1980s escapes his strained family life by starting a band to impress the mysterious girl he likes.",
    "synopsis": "A boy growing up in Dublin during the 1980s escapes his strained family life by starting a band to impress the mysterious girl he likes.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/sUWpVlrvzU2SJbnVZqIeKulPKwk.jpg",
    "image": "https://image.tmdb.org/t/p/w500/sUWpVlrvzU2SJbnVZqIeKulPKwk.jpg",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2016",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.82
  },
  {
    "id": "ser-eng-9",
    "title": "Heartstopper",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Teens Charlie and Nick discover their unlikely friendship might be something more as they navigate school and young love.",
    "synopsis": "Teens Charlie and Nick discover their unlikely friendship might be something more as they navigate school and young love.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/dQc0QbDiHjGmWxTfKtBgYtS4bj5.jpg",
    "image": "https://image.tmdb.org/t/p/w500/dQc0QbDiHjGmWxTfKtBgYtS4bj5.jpg",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.82
  },
  {
    "id": "ani-eng-9",
    "title": "Kiki's Delivery Service",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "",
    "description": "Kiki's Delivery Service is animation content in English. A grounding selection with enough warmth to settle a busy mind.",
    "synopsis": "Kiki's Delivery Service is animation content in English. A grounding selection with enough warmth to settle a busy mind.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://upload.wikimedia.org/wikipedia/en/0/07/Kiki%27s_Delivery_Service_%28Movie%29.jpg",
    "image": "https://upload.wikimedia.org/wikipedia/en/0/07/Kiki%27s_Delivery_Service_%28Movie%29.jpg",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2001",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.82
  },
  {
    "id": "mus-eng-9",
    "title": "Here Comes the Sun",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Here Comes the Sun is melody content in English. A grounding selection with enough warmth to settle a busy mind.",
    "synopsis": "Here Comes the Sun is melody content in English. A grounding selection with enough warmth to settle a busy mind.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.82
  },
  {
    "id": "mov-malayalam-9",
    "title": "Sudani from Nigeria",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "When a soccer club manager brings one of his injured foreign players home to recuperate, they form an unlikely bond despite their cultural differences.",
    "synopsis": "When a soccer club manager brings one of his injured foreign players home to recuperate, they form an unlikely bond despite their cultural differences.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/53yLPoLX8c9nAGLfmnNdF01zrNc.jpg",
    "image": "https://image.tmdb.org/t/p/w500/53yLPoLX8c9nAGLfmnNdF01zrNc.jpg",
    "rating": 9.1,
    "releaseYear": 2013,
    "year": "2018",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.84
  },
  {
    "id": "ser-malayalam-9",
    "title": "Love Under Construction",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Vinod is ready to build his dream house. But is he ready to face the hurdles in his path?",
    "synopsis": "Vinod is ready to build his dream house. But is he ready to face the hurdles in his path?",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/z7MIw0qDpN038SYQiuvrL11QS7W.jpg",
    "image": "https://image.tmdb.org/t/p/w500/z7MIw0qDpN038SYQiuvrL11QS7W.jpg",
    "rating": 9.1,
    "releaseYear": 2013,
    "year": "2025",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.84
  },
  {
    "id": "ani-malayalam-9",
    "title": "Suzume",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "",
    "description": "Suzume is animation content in Malayalam. A grounding selection with enough warmth to settle a busy mind.",
    "synopsis": "Suzume is animation content in Malayalam. A grounding selection with enough warmth to settle a busy mind.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 9.1,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.84
  },
  {
    "id": "mus-malayalam-9",
    "title": "Kudukku",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Kudukku is melody content in Malayalam. A grounding selection with enough warmth to settle a busy mind.",
    "synopsis": "Kudukku is melody content in Malayalam. A grounding selection with enough warmth to settle a busy mind.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 9.1,
    "releaseYear": 2013,
    "year": "2013",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.84
  },
  {
    "id": "mov-tel-9",
    "title": "Fidaa",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Two young people embark on a winding and rocky path to love after meeting at a wedding.",
    "synopsis": "Two young people embark on a winding and rocky path to love after meeting at a wedding.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/cvpwHdJuUzm544lvleBIAxGdzBB.jpg",
    "image": "https://image.tmdb.org/t/p/w500/cvpwHdJuUzm544lvleBIAxGdzBB.jpg",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2017",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.96
  },
  {
    "id": "ser-tel-9",
    "title": "Kumari Srimathi",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Srimathi is a 30 year old unmarried woman, with a dead end job, a dysfunctional family and a goal to win back her ancestral house. For that, she needs to raise a lot of money in a short period of time. Seeing a business oppurtunity, she decides to start a bar in her village. This is the journey of Srimathi, battling various societal and moral obstacles along the way.",
    "synopsis": "Srimathi is a 30 year old unmarried woman, with a dead end job, a dysfunctional family and a goal to win back her ancestral house. For that, she needs to raise a lot of money in a short period of time. Seeing a business oppurtunity, she decides to start a bar in her village. This is the journey of Srimathi, battling various societal and moral obstacles along the way.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/2008kVjRqNpzeY9dsM9bEuoZ0o5.jpg",
    "image": "https://image.tmdb.org/t/p/w500/2008kVjRqNpzeY9dsM9bEuoZ0o5.jpg",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2023",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.96
  },
  {
    "id": "ani-tel-9",
    "title": "My Hero Academia",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "",
    "director": "",
    "description": "Izuku has dreamt of being a hero all his life—a lofty goal for anyone, but especially challenging for a kid with no superpowers. That’s right, in a world where eighty percent of the population has some kind of super-powered \"quirk,\" Izuku was unlucky enough to be born completely normal. But that’s not enough to stop him from enrolling in one of the world’s most prestigious hero academies.",
    "synopsis": "Izuku has dreamt of being a hero all his life—a lofty goal for anyone, but especially challenging for a kid with no superpowers. That’s right, in a world where eighty percent of the population has some kind of super-powered \"quirk,\" Izuku was unlucky enough to be born completely normal. But that’s not enough to stop him from enrolling in one of the world’s most prestigious hero academies.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/phuYuzqWW9ru8EA3HVjE9W2Rr3M.jpg",
    "image": "https://image.tmdb.org/t/p/w500/phuYuzqWW9ru8EA3HVjE9W2Rr3M.jpg",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2016",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.96
  },
  {
    "id": "mus-tel-9",
    "title": "Mind Block",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "anxious"
    ],
    "moodTags": [
      "anxious"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Mind Block is melody content in Telugu. A grounding selection with enough warmth to settle a busy mind.",
    "synopsis": "Mind Block is melody content in Telugu. A grounding selection with enough warmth to settle a busy mind.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.5,
    "releaseYear": 2022,
    "year": "2022",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.58,
    "energy": 0.22,
    "baseQuality": 0.96
  },
  {
    "id": "mov-hindi-10",
    "title": "Karwaan",
    "type": "movie",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Avinash, a dejected soul stuck in a dead-end job shares a strange relationship with his father. He holds him responsible for crushing his dreams. However, he is left pondering upon this longstanding hatred when he hears of his father’s untimely demise.",
    "synopsis": "Avinash, a dejected soul stuck in a dead-end job shares a strange relationship with his father. He holds him responsible for crushing his dreams. However, he is left pondering upon this longstanding hatred when he hears of his father’s untimely demise.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/dS0ZFlqGbGGksSUdqk7niL7rywc.jpg",
    "image": "https://image.tmdb.org/t/p/w500/dS0ZFlqGbGGksSUdqk7niL7rywc.jpg",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2018",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "ser-hindi-10",
    "title": "Yeh Meri Family",
    "type": "series",
    "language": "Hindi",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Set in the summer of 1998 it is a story about conflicting emotions towards family members from the eyes of a twelve year old.",
    "synopsis": "Set in the summer of 1998 it is a story about conflicting emotions towards family members from the eyes of a twelve year old.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/7F33yqUYIzmFQwDibEjPoJxxTXg.jpg",
    "image": "https://image.tmdb.org/t/p/w500/7F33yqUYIzmFQwDibEjPoJxxTXg.jpg",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2018",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "ani-hindi-10",
    "title": "Demon Slayer",
    "type": "anime",
    "language": "Hindi",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "",
    "description": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "synopsis": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2019",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "mus-hindi-10",
    "title": "Iktara",
    "type": "music",
    "language": "Hindi",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "Arijit Singh",
    "director": "",
    "description": "Iktara is melody content in Hindi. An easygoing selection for a comfortable, restorative pause.",
    "synopsis": "Iktara is melody content in Hindi. An easygoing selection for a comfortable, restorative pause.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2012",
    "availableLanguages": [
      "Hindi",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "mov-tamil-10",
    "title": "Jana Nayagan",
    "type": "movie",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "A clash of ideologies. One stands for the people, the other feeds on control. Their paths collided once before. Years later, a child’s silent fear ignites the past, drawing a former police officer into a battle far bigger than personal revenge.",
    "synopsis": "A clash of ideologies. One stands for the people, the other feeds on control. Their paths collided once before. Years later, a child’s silent fear ignites the past, drawing a former police officer into a battle far bigger than personal revenge.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/jt8pfSIdi47YpFMMWVRr8w5u2S0.jpg",
    "image": "https://image.tmdb.org/t/p/w500/jt8pfSIdi47YpFMMWVRr8w5u2S0.jpg",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2026",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "ser-tamil-10",
    "title": "Story of Things",
    "type": "series",
    "language": "Tamil",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "An anthology of five stories that follow characters who experience supernatural occurrences through material objects around them.",
    "synopsis": "An anthology of five stories that follow characters who experience supernatural occurrences through material objects around them.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/rSaj5DGkflhz0HjT0kHbzMC0Zz9.jpg",
    "image": "https://image.tmdb.org/t/p/w500/rSaj5DGkflhz0HjT0kHbzMC0Zz9.jpg",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2023",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "ani-tamil-10",
    "title": "Demon Slayer: Mugen Train",
    "type": "anime",
    "language": "Tamil",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "",
    "description": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "synopsis": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2019",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "mus-tamil-10",
    "title": "Katchi Sera",
    "type": "music",
    "language": "Tamil",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "Anirudh Ravichander",
    "director": "",
    "description": "Katchi Sera is melody content in Tamil. An easygoing selection for a comfortable, restorative pause.",
    "synopsis": "Katchi Sera is melody content in Tamil. An easygoing selection for a comfortable, restorative pause.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.8,
    "releaseYear": 2012,
    "year": "2012",
    "availableLanguages": [
      "Tamil",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.96
  },
  {
    "id": "mov-eng-10",
    "title": "The Grand Budapest Hotel",
    "type": "movie",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "The Grand Budapest Hotel tells of a legendary concierge at a famous European hotel between the wars and his friendship with a young employee who becomes his trusted protégé. The story involves the theft and recovery of a priceless Renaissance painting, the battle for an enormous family fortune and the slow and then sudden upheavals that transformed Europe during the first half of the 20th century.",
    "synopsis": "The Grand Budapest Hotel tells of a legendary concierge at a famous European hotel between the wars and his friendship with a young employee who becomes his trusted protégé. The story involves the theft and recovery of a priceless Renaissance painting, the battle for an enormous family fortune and the slow and then sudden upheavals that transformed Europe during the first half of the 20th century.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg",
    "image": "https://image.tmdb.org/t/p/w500/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "2014",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.83
  },
  {
    "id": "ser-eng-10",
    "title": "Our Planet",
    "type": "series",
    "language": "English",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Experience our planet's natural beauty and examine how climate change impacts all living creatures in this ambitious documentary of spectacular scope.",
    "synopsis": "Experience our planet's natural beauty and examine how climate change impacts all living creatures in this ambitious documentary of spectacular scope.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/wRSnArnQBmeUYb5GWDU595bGsBr.jpg",
    "image": "https://image.tmdb.org/t/p/w500/wRSnArnQBmeUYb5GWDU595bGsBr.jpg",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "2019",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.83
  },
  {
    "id": "ani-eng-10",
    "title": "My Neighbor Totoro",
    "type": "anime",
    "language": "English",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "",
    "description": "Two sisters move to the country with their father in order to be closer to their hospitalized mother, and discover the surrounding trees are inhabited by Totoros, magical spirits of the forest. When the youngest runs away from home, the older sister seeks help from the spirits to find her.",
    "synopsis": "Two sisters move to the country with their father in order to be closer to their hospitalized mother, and discover the surrounding trees are inhabited by Totoros, magical spirits of the forest. When the youngest runs away from home, the older sister seeks help from the spirits to find her.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/rtGDOeG9LzoerkDGZF9dnVeLppL.jpg",
    "image": "https://image.tmdb.org/t/p/w500/rtGDOeG9LzoerkDGZF9dnVeLppL.jpg",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "1988",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.83
  },
  {
    "id": "mus-eng-10",
    "title": "Bloom",
    "type": "music",
    "language": "English",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "Coldplay",
    "director": "",
    "description": "Bloom is melody content in English. An easygoing selection for a comfortable, restorative pause.",
    "synopsis": "Bloom is melody content in English. An easygoing selection for a comfortable, restorative pause.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "2010",
    "availableLanguages": [
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.83
  },
  {
    "id": "mov-malayalam-10",
    "title": "Android Kunjappan Version 5.25",
    "type": "movie",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Bhaskara, a conservative villager, hates the idea of his son relocating to Russia for a job. However, when his son brings a robot to care for him, he develops an unlikely bond with the machine.",
    "synopsis": "Bhaskara, a conservative villager, hates the idea of his son relocating to Russia for a job. However, when his son brings a robot to care for him, he develops an unlikely bond with the machine.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/hoWaxpwu8X0FwYETxGLQeAinix7.jpg",
    "image": "https://image.tmdb.org/t/p/w500/hoWaxpwu8X0FwYETxGLQeAinix7.jpg",
    "rating": 9.2,
    "releaseYear": 2016,
    "year": "2019",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.85
  },
  {
    "id": "ser-malayalam-10",
    "title": "Manorathangal",
    "type": "series",
    "language": "Malayalam",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Eight legendary filmmakers collaborate with 9 superstars, breathing life into the timeless stories of author M.T. Vasudevan Nair. Based in Kerala, these stories explore the nuances of human nature.",
    "synopsis": "Eight legendary filmmakers collaborate with 9 superstars, breathing life into the timeless stories of author M.T. Vasudevan Nair. Based in Kerala, these stories explore the nuances of human nature.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/z7IzYTN5oUFX42D8N7D3QEy5eEa.jpg",
    "image": "https://image.tmdb.org/t/p/w500/z7IzYTN5oUFX42D8N7D3QEy5eEa.jpg",
    "rating": 9.2,
    "releaseYear": 2016,
    "year": "2024",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.85
  },
  {
    "id": "ani-malayalam-10",
    "title": "Demon Slayer",
    "type": "anime",
    "language": "Malayalam",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "",
    "description": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "synopsis": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "rating": 9.2,
    "releaseYear": 2016,
    "year": "2019",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.85
  },
  {
    "id": "mus-malayalam-10",
    "title": "Puthiyoru Lokam",
    "type": "music",
    "language": "Malayalam",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "Sushin Shyam",
    "director": "",
    "description": "Puthiyoru Lokam is melody content in Malayalam. An easygoing selection for a comfortable, restorative pause.",
    "synopsis": "Puthiyoru Lokam is melody content in Malayalam. An easygoing selection for a comfortable, restorative pause.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 9.2,
    "releaseYear": 2016,
    "year": "2016",
    "availableLanguages": [
      "Malayalam",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.85
  },
  {
    "id": "mov-tel-10",
    "title": "Oh Baby",
    "type": "movie",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Romance"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Film Collective",
    "description": "Part romantic comedy, part love story, set in the city of Los Angeles.",
    "synopsis": "Part romantic comedy, part love story, set in the city of Los Angeles.",
    "streamPlatform": "Prime Video",
    "streamUrl": "https://www.primevideo.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/cL8Uc8Ub6U6WcMAz9U12n7XQ2Ed.jpg",
    "image": "https://image.tmdb.org/t/p/w500/cL8Uc8Ub6U6WcMAz9U12n7XQ2Ed.jpg",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "2008",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.82
  },
  {
    "id": "ser-tel-10",
    "title": "Aha Naa Pellanta",
    "type": "series",
    "language": "Telugu",
    "genres": [
      "Drama",
      "Comedy",
      "Slice of Life"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "MoodMate Series Studio",
    "description": "Seenu, a young man who is desperate for marriage, lands at a suitable match with great difficulty. While he's relieved about tying the knot at last, comes the twist, when the bride elopes with her boyfriend.",
    "synopsis": "Seenu, a young man who is desperate for marriage, lands at a suitable match with great difficulty. While he's relieved about tying the knot at last, comes the twist, when the bride elopes with her boyfriend.",
    "streamPlatform": "Netflix",
    "streamUrl": "https://www.netflix.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/i40AOdcV2wQHfzIfcHR2pX1mLOb.jpg",
    "image": "https://image.tmdb.org/t/p/w500/i40AOdcV2wQHfzIfcHR2pX1mLOb.jpg",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "2022",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.82
  },
  {
    "id": "ani-tel-10",
    "title": "Demon Slayer",
    "type": "anime",
    "language": "Telugu",
    "genres": [
      "Animation",
      "Adventure",
      "Fantasy"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "",
    "director": "",
    "description": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "synopsis": "After a demon attack leaves his family slain and his sister cursed, Tanjiro embarks upon a perilous journey to find a cure and avenge those he's lost.",
    "streamPlatform": "Crunchyroll",
    "streamUrl": "https://www.crunchyroll.com",
    "thumbnail": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "image": "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "2019",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.82
  },
  {
    "id": "mus-tel-10",
    "title": "Naatu Naatu",
    "type": "music",
    "language": "Telugu",
    "genres": [
      "Melody",
      "Pop",
      "Contemporary"
    ],
    "mood": [
      "relaxed"
    ],
    "moodTags": [
      "relaxed"
    ],
    "artist": "Sid Sriram",
    "director": "",
    "description": "Naatu Naatu is melody content in Telugu. An easygoing selection for a comfortable, restorative pause.",
    "synopsis": "Naatu Naatu is melody content in Telugu. An easygoing selection for a comfortable, restorative pause.",
    "streamPlatform": "Spotify",
    "streamUrl": "https://open.spotify.com",
    "thumbnail": "https://via.placeholder.com/300x450",
    "image": "https://via.placeholder.com/300x450",
    "rating": 8.6,
    "releaseYear": 2010,
    "year": "2010",
    "availableLanguages": [
      "Telugu",
      "English"
    ],
    "valence": 0.78,
    "energy": 0.2,
    "baseQuality": 0.82
  }
];

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
function scoreCatalog(items, moodProfile, options = {}) {
  return items.map((item) => {
    const scoreData = calculateMatchScore(item, moodProfile, options);
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
  }).sort((first, second) => second.sortRank - first.sortRank || (second.rawScore ?? 0) - (first.rawScore ?? 0) || first.title.localeCompare(second.title));
}

function diversifyForYou(rankedItems, moodProfile) {
  const preferredType = moodProfile.contentPreference;
  const preferredLanguage = moodProfile.languagePreference;
  const scoreSorted = (items) => [...items].sort((a, b) => b.sortRank - a.sortRank || a.title.localeCompare(b.title));

  // ── Slot A (4 slots): items matching BOTH the user's preferred language AND preferred content type ──
  // "langMatch" is satisfied when the item's primary language equals the preference,
  // OR when the preference language appears in availableLanguages.
  // If no language preference was expressed, every item qualifies as a language match.
  // If no (or 'all') content-type preference was expressed, every item qualifies as a type match.
  const langMatch = (item) => {
    if (!preferredLanguage) return true;
    return item.language === preferredLanguage || (item.availableLanguages?.includes(preferredLanguage) ?? false);
  };
  const typeMatch = (item) => {
    if (!preferredType || preferredType === 'all') return true;
    return item.type === preferredType;
  };

  // Collect anchor candidates sorted by mood score descending; take up to 4.
  const anchorPool = scoreSorted(rankedItems.filter((item) => langMatch(item) && typeMatch(item)));
  const anchorItems = anchorPool.slice(0, 4);
  const anchorIds = new Set(anchorItems.map((item) => item.id));

  // ── Slot B (remaining slots): best mood-score items not already in Slot A ──
  // No language or type restriction — pure affective ranking determines order.
  // Deduplicate by title across languages: if multiple language versions of the same title
  // score highly, only the single highest-scoring version is selected, ensuring diverse content.
  const seenTitles = new Set(anchorItems.map((item) => (item.title || '').trim().toLowerCase()));
  const fillPool = scoreSorted(rankedItems.filter((item) => !anchorIds.has(item.id)));
  const fillItems = [];
  const neededFillCount = 8 - anchorItems.length;

  for (const item of fillPool) {
    const normTitle = (item.title || '').trim().toLowerCase();
    if (!seenTitles.has(normTitle)) {
      seenTitles.add(normTitle);
      fillItems.push(item);
      if (fillItems.length >= neededFillCount) break;
    }
  }

  return [...anchorItems, ...fillItems];
}

/**
 * One ranking path for every tab.
 * - 'for-you': Uses special 4+4 language enforcement (4 matching preferred language + type, 4 diverse best-mood).
 * - Other tabs ('all', 'movie', 'series', 'anime', 'music'): Sorted by mood profile relevance with no language restriction.
 */
export function getRecommendationsByMood(moodId = null, formatFilter = 'for-you', moodProfile = null) {
  if (!moodProfile?.assessmentStatus && formatFilter === 'for-you') return [];

  const pool = ['movie', 'series', 'anime', 'music'].includes(formatFilter)
    ? mediaCatalog.filter((item) => item.type === formatFilter)
    : mediaCatalog;

  if (formatFilter === 'for-you') {
    const rankedItems = scoreCatalog(pool, moodProfile, { includeLanguage: true });
    return diversifyForYou(rankedItems, moodProfile);
  }

  // All other tabs: sort purely by 6-factor mood relevance with no language restriction
  return scoreCatalog(pool, moodProfile, { includeLanguage: false });
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
