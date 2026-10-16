import { moodModel } from './moodModel';
import { createMoodProfile } from './moodProfile';

const NEGATION_PATTERN = /\b(?:not|never|don't|dont|didn't|didnt|wasn't|wasnt|isn't|isnt|aren't|arent|can't|cant|couldn't|couldnt|hardly|barely)\b(?:\s+\w+){0,3}\s*$/;
const REQUEST_PATTERN = /\b(?:want|would like|looking for|give me|show me|find me|recommend|prefer|craving|something|watch|listen|need)\b/;

// Intensity-softening qualifiers: when one of these appears within a short window
// BEFORE an emotion term, the term's valence and energy contributions are reduced
// to SOFTENING_MULTIPLIER of their normal strength rather than applied at full weight.
// This handles hedged expressions like "not completely sad", "kind of tired",
// "a bit anxious", "somewhat stressed", "not too high not too low", "sort of happy", etc.
// Hard negation (NEGATION_PATTERN) still takes priority and fully suppresses/flips.
const SOFTENING_PATTERN = /\b(?:not\s+(?:completely|totally|entirely|fully|quite|very|super|really|that|too)|kind\s+of|sort\s+of|somewhat|a\s+bit|a\s+little|slightly|rather|fairly|pretty\s+(?:much)?|almost|borderline|mildly|vaguely|barely|partially|half(?:way)?|in\s+between|in\s+the\s+middle|not\s+too\s+(?:much|bad|great|good|low|high))\b/;
// Fraction of the original valence/energy/weight applied when a softener is detected.
const SOFTENING_MULTIPLIER = 0.45;

// Each phrase contributes once per answer. This prevents token scanning from
// inflating a single phrase merely because it occurs in the same sentence.
//
// IMPORTANT: These terms ONLY score valence/energy for answers tagged questionType='state'.
// Answers tagged questionType='preference' (Q5 Atmosphere, Q6 Format, Q7 Pacing, Q8 Language)
// are excluded from EMOTION_TERMS scoring — words like "peaceful" or "calm" that describe
// desired content style must never shift the computed emotional state.
const EMOTION_TERMS = [
  // ── Exhaustion / Fatigue ─────────────────────────────────────────────────
  { phrase: 'exhausted',       mood: 'tired',   valence: -0.25, energy: 0.12, weight: 1.4  },
  { phrase: 'no energy',       mood: 'tired',   valence: -0.20, energy: 0.08, weight: 1.5  },
  { phrase: 'low energy',      mood: 'tired',   valence: -0.15, energy: 0.12, weight: 1.3  },
  { phrase: 'low-energy',      mood: 'tired',   valence: -0.15, energy: 0.12, weight: 1.3  },
  { phrase: 'drained',         mood: 'tired',   valence: -0.25, energy: 0.15, weight: 1.3  },
  { phrase: 'tired',           mood: 'tired',   valence: -0.18, energy: 0.20, weight: 1.1  },
  { phrase: 'low battery',     mood: 'tired',   valence: -0.12, energy: 0.16, weight: 1.2  },
  // FIX — Bug A: "burnt out" / "burned out" were absent from EMOTION_TERMS.
  // They appeared only in moodModel.js keywords (used for Landing demo, not scoring).
  // Adding here with strong tired/exhaustion weights.
  { phrase: 'burnt out',       mood: 'tired',   valence: -0.30, energy: 0.10, weight: 1.45 },
  { phrase: 'burned out',      mood: 'tired',   valence: -0.30, energy: 0.10, weight: 1.45 },
  { phrase: 'burn out',        mood: 'tired',   valence: -0.28, energy: 0.12, weight: 1.35 },
  // FIX — Bug B: sleep-deprivation phrases produced zero signal because "sleep" was not in
  // EMOTION_TERMS and the negation parser had nothing to catch on.
  { phrase: "didn't sleep",    mood: 'tired',   valence: -0.28, energy: 0.10, weight: 1.4  },
  { phrase: "didn't sleep properly", mood: 'tired', valence: -0.28, energy: 0.10, weight: 1.45 },
  { phrase: "didn t sleep",    mood: 'tired',   valence: -0.28, energy: 0.10, weight: 1.4  },
  { phrase: "cant sleep",      mood: 'tired',   valence: -0.22, energy: 0.30, weight: 1.3  },
  { phrase: "can't sleep",     mood: 'tired',   valence: -0.22, energy: 0.30, weight: 1.3  },
  { phrase: 'no sleep',        mood: 'tired',   valence: -0.25, energy: 0.12, weight: 1.35 },
  { phrase: 'sleep deprived',  mood: 'tired',   valence: -0.25, energy: 0.10, weight: 1.4  },
  { phrase: 'sleep deprived',  mood: 'tired',   valence: -0.25, energy: 0.10, weight: 1.4  },
  { phrase: 'couldnt sleep',   mood: 'tired',   valence: -0.22, energy: 0.12, weight: 1.3  },
  { phrase: "couldn't sleep",  mood: 'tired',   valence: -0.22, energy: 0.12, weight: 1.3  },
  { phrase: 'insomnia',        mood: 'tired',   valence: -0.22, energy: 0.20, weight: 1.3  },
  // ── Stress / Anxiety ─────────────────────────────────────────────────────
  { phrase: 'stressed',        mood: 'stressed', valence: -0.42, energy: 0.72, weight: 1.25 },
  { phrase: 'under pressure',  mood: 'stressed', valence: -0.42, energy: 0.72, weight: 1.3  },
  { phrase: 'pressure',        mood: 'stressed', valence: -0.32, energy: 0.68, weight: 1.0  },
  { phrase: 'overwhelmed',     mood: 'stressed', valence: -0.45, energy: 0.76, weight: 1.35 },
  { phrase: 'anxious',         mood: 'stressed', valence: -0.40, energy: 0.72, weight: 1.2  },
  // ── Low / Melancholic ────────────────────────────────────────────────────
  { phrase: 'sad',             mood: 'low',     valence: -0.48, energy: 0.32, weight: 1.25 },
  { phrase: 'feeling down',    mood: 'low',     valence: -0.48, energy: 0.30, weight: 1.35 },
  { phrase: 'down',            mood: 'low',     valence: -0.35, energy: 0.34, weight: 1.0  },
  { phrase: 'lonely',          mood: 'lonely',  valence: -0.40, energy: 0.35, weight: 1.25 },
  // ── Positive — high valence, low activation (calm/happy) ─────────────────
  // These only score for state questions. They correctly represent a user who
  // says "I feel really calm today" (Q1/Q2/Q3), not one who says
  // "I'd like something calm" (Q5/Q7).
  { phrase: 'happy',           mood: 'upbeat',  valence:  0.48, energy: 0.00, weight: 1.15 },
  { phrase: 'good',            mood: 'upbeat',  valence:  0.30, energy: 0.58, weight: 0.8  },
  { phrase: 'great',           mood: 'upbeat',  valence:  0.50, energy: 0.70, weight: 1.0  },
  { phrase: 'productive',      mood: 'upbeat',  valence:  0.36, energy: 0.72, weight: 0.9  },
  { phrase: 'excited',         mood: 'excited', valence:  0.45, energy: 0.90, weight: 1.2  },
  { phrase: 'high energy',     mood: 'excited', valence:  0.20, energy: 0.90, weight: 1.2  },
  { phrase: 'energized',       mood: 'excited', valence:  0.32, energy: 0.85, weight: 1.1  },
  { phrase: 'energetic',       mood: 'excited', valence:  0.60, energy: 0.85, weight: 1.2  },
  { phrase: 'energetically',   mood: 'excited', valence:  0.60, energy: 0.85, weight: 1.2  },
  { phrase: 'calm',            mood: 'calm',    valence:  0.22, energy: 0.28, weight: 1.0  },
  { phrase: 'peaceful',        mood: 'calm',    valence:  0.30, energy: 0.24, weight: 1.1  },
  { phrase: 'relaxed',         mood: 'calm',    valence:  0.22, energy: 0.30, weight: 1.0  },
  { phrase: 'overthinking',    mood: 'reflective', valence: -0.08, energy: 0.56, weight: 1.0 },
  { phrase: 'deep thoughts',   mood: 'reflective', valence:  0.00, energy: 0.42, weight: 1.0 },
  { phrase: 'bored',           mood: 'bored',   valence: -0.18, energy: 0.50, weight: 1.0  },
  { phrase: 'restless',        mood: 'bored',   valence: -0.12, energy: 0.62, weight: 1.0  },
];

const NEED_AND_INTENT_TERMS = [
  { phrase: 'take my mind off', need: 'Escape & Distraction',      intent: 'distraction', weight: 1.5  },
  { phrase: 'escape',           need: 'Escape & Distraction',      intent: 'distraction', weight: 1.25 },
  { phrase: 'cheer me up',      need: 'Uplift & Encouragement',    intent: 'uplift',      weight: 1.5  },
  { phrase: 'cheers me up',     need: 'Uplift & Encouragement',    intent: 'uplift',      weight: 1.5  },
  { phrase: 'feel better',      need: 'Uplift & Encouragement',    intent: 'uplift',      weight: 1.2  },
  { phrase: 'uplifting',        need: 'Uplift & Encouragement',    intent: 'uplift',      weight: 1.15 },
  { phrase: 'funny',            need: 'Uplift & Encouragement',    intent: 'uplift',      weight: 1.1  },
  { phrase: 'comforting',       need: 'Comfort & Reassurance',     intent: 'comfort',     weight: 1.4  },
  { phrase: 'comfort',          need: 'Comfort & Reassurance',     intent: 'comfort',     weight: 1.1  },
  { phrase: 'relax',            need: 'Relaxation',                intent: 'relaxation',  weight: 1.25 },
  { phrase: 'relaxing',         need: 'Relaxation',                intent: 'relaxation',  weight: 1.25 },
  { phrase: 'unwind',           need: 'Relaxation',                intent: 'relaxation',  weight: 1.25 },
  { phrase: 'exciting',         need: 'Stimulation & Excitement',  intent: 'stimulation', weight: 1.25 },
  { phrase: 'thrilling',        need: 'Stimulation & Excitement',  intent: 'stimulation', weight: 1.2  },
  { phrase: 'entertaining',     need: 'Entertainment',             intent: 'entertainment',weight: 0.9 },
  { phrase: 'explore',          need: 'Discovery & Exploration',   intent: 'exploration', weight: 1.0  },
  { phrase: 'discover',         need: 'Discovery & Exploration',   intent: 'exploration', weight: 1.0  },
];

const FORMAT_TERMS = [
  { phrase: 'movie',      value: 'movie'  }, { phrase: 'film',      value: 'movie'  },
  { phrase: 'cinema',     value: 'movie'  }, { phrase: 'series',    value: 'series' },
  { phrase: 'show',       value: 'series' }, { phrase: 'binge',     value: 'series' },
  { phrase: 'anime',      value: 'anime'  }, { phrase: 'manga',     value: 'anime'  },
  { phrase: 'animation',  value: 'anime'  }, { phrase: 'music',     value: 'music'  },
  { phrase: 'playlist',   value: 'music'  }, { phrase: 'song',      value: 'music'  },
  { phrase: 'songs',      value: 'music'  },
];

const GENRE_TERMS = [
  { phrase: 'romantic',         value: 'Romance',         weight: 1.5 },
  { phrase: 'romance',          value: 'Romance',         weight: 1.5 },
  { phrase: 'love story',       value: 'Romance',         weight: 1.5 },
  { phrase: 'funny',            value: 'Comedy',          weight: 1.2 },
  { phrase: 'comedy',           value: 'Comedy',          weight: 1.3 },
  { phrase: 'action-packed',    value: 'Action',          weight: 1.5 },
  { phrase: 'action movie',     value: 'Action',          weight: 1.4 },
  { phrase: 'action film',      value: 'Action',          weight: 1.4 },
  { phrase: 'mystery',          value: 'Mystery',         weight: 1.1 },
  { phrase: 'thriller',         value: 'Thriller',        weight: 1.1 },
  { phrase: 'horror',           value: 'Horror',          weight: 1.2 },
  { phrase: 'fantasy',          value: 'Fantasy',         weight: 1.0 },
  { phrase: 'sci-fi',           value: 'Science Fiction', weight: 1.2 },
  { phrase: 'science fiction',  value: 'Science Fiction', weight: 1.2 },
  { phrase: 'documentary',      value: 'Documentary',     weight: 1.2 },
  { phrase: 'drama',            value: 'Drama',           weight: 0.9 },
];

const LANGUAGE_TERMS = [
  { phrase: 'english',   value: 'English'   },
  { phrase: 'hindi',     value: 'Hindi'     },
  { phrase: 'tamil',     value: 'Tamil'     },
  { phrase: 'telugu',    value: 'Telugu'    },
  { phrase: 'malayalam', value: 'Malayalam' },
  { phrase: 'kannada',   value: 'Kannada'   },
];

function phraseRegex(phrase) {
  return new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+')}(?=\\s|$)`, 'g');
}

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findTerms(text, terms) {
  return terms.flatMap((term) => {
    const re = phraseRegex(term.phrase);
    const matches = [];
    let m;
    // Collect ALL occurrences of this phrase in the answer.
    // We then prefer a softened match (hedged context) over the first bare match,
    // so that "sad but not completely sad" triggers softening rather than scoring
    // the first unhedged "sad" at full strength.
    while ((m = re.exec(text)) !== null) {
      matches.push({ ...term, index: m.index + m[1].length });
    }
    if (matches.length === 0) return [];
    // If any occurrence has a softening qualifier in the preceding window, return that one.
    const softenedMatch = matches.find((match) => SOFTENING_PATTERN.test(text.slice(Math.max(0, match.index - 35), match.index)));
    return [softenedMatch ?? matches[0]];
  });
}

function isNegated(text, index) { return NEGATION_PATTERN.test(text.slice(Math.max(0, index - 32), index)); }
// isSoftened: true when a hedging qualifier (SOFTENING_PATTERN) appears in the
// 35-char window immediately BEFORE the matched emotion term.
// Only called after isNegated() returns false — hard negation takes priority.
function isSoftened(text, index) { return SOFTENING_PATTERN.test(text.slice(Math.max(0, index - 35), index)); }
function isRequested(text, index) {
  const requestMatch = REQUEST_PATTERN.exec(text);
  return requestMatch && index >= requestMatch.index;
}
function addScore(scores, key, value) { scores[key] = (scores[key] || 0) + value; }
function strongestValue(scores, minimum = 0) { const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]); return entries[0]?.[1] > minimum ? entries[0][0] : null; }
function strongestUniqueValue(scores) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[1] > 0 && entries[0][1] !== entries[1]?.[1] ? entries[0][0] : null;
}
function clamp(value, lower, upper) { return Math.min(upper, Math.max(lower, value)); }

function describeMood(mood, isMixed) {
  if (isMixed) return { moodName: 'Mixed & Conflicted', shortName: 'Mixed', description: 'Your responses contain both pleasant and difficult feelings, so we will keep the recommendations balanced and flexible.', suggestedMediaStyle: 'Balanced choices that can support either reflection, comfort, or a change of pace.' };
  const modelMood = moodModel.moods.find((entry) => entry.id === mood);
  return modelMood ? { moodName: modelMood.name, shortName: modelMood.shortName, description: modelMood.description, suggestedMediaStyle: modelMood.suggestedMediaStyle } : {};
}

/**
 * Deterministic extraction that keeps current emotion separate from desired content.
 *
 * FIX SUMMARY (2026-10-15):
 * - Each user message now carries a `questionType` field: 'state' or 'preference'.
 *   'state'      → Q1 Daily State, Q2 Mental Focus, Q3 Energy Level, Q4 Emotional Need.
 *   'preference' → Q5 Atmosphere/Vibe, Q6 Format, Q7 Pacing/Tone, Q8 Language.
 *
 * - EMOTION_TERMS valence/energy scoring is SUPPRESSED for preference answers.
 *   Words like "peaceful" or "calm" describing desired content no longer shift the
 *   user's computed emotional state. They still propagate to NEED_AND_INTENT_TERMS
 *   and GENRE_TERMS (content filtering), which is correct.
 *
 * - The 1.5× recency multiplier now ONLY applies to state answers.
 *   Preference answers use a flat 1.0× multiplier for format/genre/language extraction.
 *   (Previously the multiplier amplified preference words 1.5× more than genuine
 *   early-session state words, causing a single Q5 "peaceful" to outscore Q3 "exhausted".)
 *
 * - Added missing EMOTION_TERMS: "burnt out", "burned out", "burn out",
 *   "didn't sleep", "didn't sleep properly", "can't sleep", "no sleep",
 *   "sleep deprived", "couldn't sleep", "insomnia".
 *
 * FIX SUMMARY (2026-10-16):
 * - Added intensity-softening logic via SOFTENING_PATTERN + SOFTENING_MULTIPLIER.
 *   When a hedging qualifier ("not completely", "kind of", "a bit", "somewhat",
 *   "not too", "sort of", "slightly", "in between", etc.) appears within 35 chars
 *   BEFORE an emotion term, the term's valence/energy/weight contribution is reduced
 *   to 45% of its normal strength rather than applied at full weight.
 *   Hard negation (NEGATION_PATTERN) still takes priority and fully suppresses the term.
 *   This fixes "I am sad but not completely sad, kind of in between" which previously
 *   scored at full -0.48 valence (→ Low & Melancholic) instead of a softened neutral state.
 */
export function analyzeSentiment(messages) {
  const userMessages = messages.filter((message) => message.sender === 'user');
  const moodScores = Object.fromEntries(moodModel.moods.map((mood) => [mood.id, 0]));
  const intentScores = {}; const needScores = {}; const formatScores = {}; const genreScores = {}; const languageScores = {};
  const signals = [];
  let valenceTotal = 0; let valenceWeight = 0; let energyTotal = 0; let energyWeight = 0;
  let positiveEvidence = 0; let negativeEvidence = 0; let evidenceCount = 0;

  userMessages.forEach((message, index) => {
    const answer = normalize(message.text);
    if (!answer) return;

    // Determine whether this answer describes the user's emotional state or a content preference.
    // Fall back to 'state' for any message that does not carry a questionType (legacy/restart flows).
    const isPreference = message.questionType === 'preference';

    // FIX: Recency multiplier is meaningful for STATE answers — a user who
    // was stressed in Q1 but recovered by Q3 should have Q3 win.
    // It is NOT applied to preference answers (Q5-Q8) which never scored state anyway.
    const recencyMultiplier = (!isPreference && index >= 4) ? 1.5 : 1.0;

    // ── EMOTION TERMS ─────────────────────────────────────────────────────
    // Only apply to state answers. Preference answers skip this block entirely.
    // This is the core fix for the "melody like peaceful" contamination bug.
    if (!isPreference) {
      findTerms(answer, EMOTION_TERMS).forEach((term) => {
        if (isRequested(answer, term.index)) return;
        // ── PRIORITY ORDER: softening beats negation ──────────────────────
        // "not completely sad" / "not too tired" are hedges, not hard negations.
        // NEGATION_PATTERN matches "not" + up to 3 words, so it would fire on
        // "not completely <term>" and silently drop the term. We check isSoftened
        // first; when a softening qualifier is found we skip isNegated entirely
        // and apply the term at SOFTENING_MULTIPLIER (≈45%) weight instead.
        const softened = isSoftened(answer, term.index);
        if (!softened) {
          // Only reach the hard-negation check when no softener precedes the term.
          if (isNegated(answer, term.index)) {
            if (term.valence > 0) { addScore(moodScores, 'low', term.weight * recencyMultiplier); valenceTotal -= Math.abs(term.valence) * term.weight * recencyMultiplier; valenceWeight += term.weight * recencyMultiplier; negativeEvidence += term.weight * recencyMultiplier; signals.push(`not ${term.phrase}`); evidenceCount += 1; }
            return;
          }
        }
        // Apply at full weight or softened weight depending on the flag.
        const softeningFactor = softened ? SOFTENING_MULTIPLIER : 1.0;
        const effectiveWeight = term.weight * recencyMultiplier * softeningFactor;
        addScore(moodScores, term.mood, effectiveWeight);
        valenceTotal += term.valence * effectiveWeight; valenceWeight += effectiveWeight;
        energyTotal += term.energy * effectiveWeight; energyWeight += effectiveWeight;
        if (term.valence > 0) positiveEvidence += effectiveWeight;
        if (term.valence < 0) negativeEvidence += effectiveWeight;
        // Tag softened signals with ~ so they appear distinctly in extractedSignals
        signals.push(softened ? `~${term.phrase}` : term.phrase); evidenceCount += 1;
      });
    }

    // ── NEED & INTENT TERMS ───────────────────────────────────────────────
    // These apply to all answers — "comfort", "escape", "unwind" are valid signals
    // whether expressed in state or preference answers.
    findTerms(answer, NEED_AND_INTENT_TERMS).forEach((term) => {
      const effectiveWeight = term.weight * recencyMultiplier;
      addScore(needScores, term.need, effectiveWeight);
      addScore(intentScores, term.intent, effectiveWeight);
      signals.push(term.phrase); evidenceCount += 1;
    });

    // ── FORMAT / GENRE / LANGUAGE ─────────────────────────────────────────
    // These apply to all answers. Preference answers legitimately set these.
    findTerms(answer, FORMAT_TERMS).forEach((term) => { addScore(formatScores, term.value, 1 * recencyMultiplier); evidenceCount += 1; });
    findTerms(answer, GENRE_TERMS).forEach((term) => { const effectiveWeight = term.weight * recencyMultiplier; addScore(genreScores, term.value, effectiveWeight); signals.push(term.phrase); evidenceCount += 1; });
    findTerms(answer, LANGUAGE_TERMS).forEach((term) => { const explicit = /\b(?:prefer|want|in|language)\b/.test(answer) || answer === term.phrase; addScore(languageScores, term.value, (explicit ? 2 : 1) * recencyMultiplier); evidenceCount += 1; });
  });

  const isMixed = positiveEvidence > 0 && negativeEvidence > 0 && Math.abs(positiveEvidence - negativeEvidence) <= Math.max(0.75, Math.min(positiveEvidence, negativeEvidence));
  let mood = strongestValue(moodScores);
  if (isMixed || !mood) mood = 'reflective';
  const valence = valenceWeight ? clamp(0.5 + (valenceTotal / valenceWeight) * 0.5, 0.05, 0.95) : 0.5;
  const energy = energyWeight ? clamp(energyTotal / energyWeight, 0.05, 0.95) : 0.5;
  const moodDetails = describeMood(mood, isMixed);

  return createMoodProfile({
    mood, valence, energy,
    emotionalNeed: strongestValue(needScores), userIntent: strongestValue(intentScores), contentPreference: strongestValue(formatScores) || 'all',
    genrePreference: Object.entries(genreScores).filter(([, score]) => score >= 1).sort((a, b) => b[1] - a[1]).map(([genre]) => genre),
    languagePreference: strongestUniqueValue(languageScores),
    confidence: Math.round(clamp(35 + evidenceCount * 7 + (userMessages.length >= 8 ? 8 : 0) + (isMixed ? 3 : 0), 35, 92)),
    extractedSignals: [...new Set(signals)].slice(0, 8), rawScores: { moods: moodScores, needs: needScores, intents: intentScores, genres: genreScores, languages: languageScores }, analyzedAt: new Date().toISOString(), ...moodDetails,
  });
}

/** Generate brief, non-clinical acknowledgements while keeping the chat moving. */
export function generateAdaptiveReply(userInput, questionIndex) {
  const text = normalize(userInput);
  if (/\b(tired|exhausted|drained|sleepy|low battery|burnt out|burned out|burn out)\b/.test(text)) return 'I hear you. We can keep the next choices easy and low-effort.';
  if (/\b(didn.t sleep|can.t sleep|no sleep|sleep deprived|insomnia)\b/.test(text)) return 'I hear you — rest is everything. We will keep things gentle from here.';
  if (/\b(stress|pressure|overwhelm|deadline|hectic|tense)\b/.test(text)) return "That sounds like a demanding day. Let's keep moving toward something that fits this moment.";
  if (/\b(sad|low|lonely|down|heavy)\b/.test(text)) return 'Thanks for sharing that. We will keep the next choices gentle and focused on what you want right now.';
  if (/\b(hindi|tamil|telugu|malayalam|english)\b/.test(text)) return 'Got it. I will keep that language preference in mind.';
  const acknowledgements = ['Understood. That gives me useful context about your day.', "That makes sense. Let's use that to guide the next choice.", 'Got it. I am noting your current energy level.', 'Noted. We will keep your preference in mind.', 'That helps shape the kind of experience you want.', 'Great, I have noted that format preference.', 'Understood. Pacing matters for a comfortable experience.', 'Captured. I have what I need to put your profile together.'];
  return acknowledgements[questionIndex % acknowledgements.length];
}

export default { analyzeSentiment, generateAdaptiveReply };
