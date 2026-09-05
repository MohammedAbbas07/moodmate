import { moodModel } from './moodModel';

// The completed-assessment contract shared by chat, context, and consumers.
// `genrePreference` is intentionally profile data only; the current chat remains
// an eight-question flow and does not collect it as an additional question.
export const MOOD_PROFILE_FIELDS = [
  'mood',
  'valence',
  'energy',
  'emotionalNeed',
  'contentPreference',
  'genrePreference',
  'userIntent',
  'languagePreference',
  'confidence',
];

const LEGACY_DEFAULT_SIGNATURE = {
  moodId: 'calm',
  confidence: 85,
  preferredFormat: 'all',
};

function isLegacyDefaultProfile(profile) {
  return (
    profile?.moodId === LEGACY_DEFAULT_SIGNATURE.moodId &&
    profile?.confidence === LEGACY_DEFAULT_SIGNATURE.confidence &&
    profile?.preferredFormat === LEGACY_DEFAULT_SIGNATURE.preferredFormat &&
    !profile?.analyzedAt &&
    !profile?.completedAt
  );
}

function normalizeGenrePreference(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

/**
 * Converts current and legacy profile payloads to the one MoodMate contract.
 * A missing profile is represented by null, never by a default mood.
 */
export function createMoodProfile(profile) {
  if (!profile || profile.assessmentStatus === 'unassessed' || isLegacyDefaultProfile(profile)) {
    return null;
  }

  const moodId = profile.mood || profile.moodId;
  const matchedMood = moodModel.moods.find((mood) => mood.id === moodId);
  if (!matchedMood) return null;

  const contentPreference = profile.contentPreference ?? profile.preferredFormat ?? 'all';
  const languagePreference = profile.languagePreference ?? profile.preferredLanguage ?? null;
  const confidence = Number.isFinite(profile.confidence) ? profile.confidence : 0;

  return {
    // Canonical Phase 1A fields.
    mood: matchedMood.id,
    valence: Number.isFinite(profile.valence) ? profile.valence : matchedMood.valence,
    energy: Number.isFinite(profile.energy) ? profile.energy : matchedMood.energy,
    emotionalNeed: profile.emotionalNeed ?? matchedMood.emotionalNeed,
    contentPreference,
    genrePreference: normalizeGenrePreference(profile.genrePreference),
    userIntent: profile.userIntent ?? null,
    languagePreference,
    confidence,

    // Assessment metadata and presentation data retained for existing routes.
    assessmentStatus: 'complete',
    analyzedAt: profile.analyzedAt || profile.completedAt || new Date().toISOString(),
    extractedSignals: Array.isArray(profile.extractedSignals) ? profile.extractedSignals : [],
    rawScores: profile.rawScores || {},
    moodName: profile.moodName || matchedMood.name,
    shortName: profile.shortName || matchedMood.shortName,
    primaryColor: profile.primaryColor || matchedMood.primaryColor,
    badgeClass: profile.badgeClass || matchedMood.badgeClass,
    description: profile.description || matchedMood.description,
    suggestedMediaStyle: profile.suggestedMediaStyle || matchedMood.suggestedMediaStyle,

    // Temporary compatibility aliases for unchanged recommendation/detail code.
    // All new state producers and consumers use the canonical fields above.
    moodId: matchedMood.id,
    preferredFormat: contentPreference,
    preferredLanguage: languagePreference || 'English',
  };
}

export function hasCompletedMoodProfile(profile) {
  return profile?.assessmentStatus === 'complete';
}
