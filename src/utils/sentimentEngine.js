import { moodModel } from './moodModel';
import { createMoodProfile } from './moodProfile';

const NEGATION_PATTERN = /\b(?:not|never|don't|dont|didn't|didnt|wasn't|wasnt|isn't|isnt|aren't|arent|can't|cant|couldn't|couldnt|hardly|barely)\b(?:\s+\w+){0,3}\s*$/;
const REQUEST_PATTERN = /\b(?:want|would like|looking for|give me|show me|find me|recommend|prefer|craving|something|watch|listen|need)\b/;

// Each phrase contributes once per answer. This prevents token scanning from
// inflating a single phrase merely because it occurs in the same sentence.
const EMOTION_TERMS = [
  { phrase: 'exhausted', mood: 'tired', valence: -0.25, energy: 0.12, weight: 1.4 }, { phrase: 'no energy', mood: 'tired', valence: -0.2, energy: 0.08, weight: 1.5 },
  { phrase: 'low energy', mood: 'tired', valence: -0.15, energy: 0.12, weight: 1.3 }, { phrase: 'low-energy', mood: 'tired', valence: -0.15, energy: 0.12, weight: 1.3 },
  { phrase: 'drained', mood: 'tired', valence: -0.25, energy: 0.15, weight: 1.3 }, { phrase: 'tired', mood: 'tired', valence: -0.18, energy: 0.2, weight: 1.1 },
  { phrase: 'low battery', mood: 'tired', valence: -0.12, energy: 0.16, weight: 1.2 }, { phrase: 'stressed', mood: 'stressed', valence: -0.42, energy: 0.72, weight: 1.25 },
  { phrase: 'under pressure', mood: 'stressed', valence: -0.42, energy: 0.72, weight: 1.3 }, { phrase: 'pressure', mood: 'stressed', valence: -0.32, energy: 0.68, weight: 1.0 },
  { phrase: 'overwhelmed', mood: 'stressed', valence: -0.45, energy: 0.76, weight: 1.35 }, { phrase: 'anxious', mood: 'stressed', valence: -0.4, energy: 0.72, weight: 1.2 },
  { phrase: 'sad', mood: 'low', valence: -0.48, energy: 0.32, weight: 1.25 }, { phrase: 'feeling down', mood: 'low', valence: -0.48, energy: 0.3, weight: 1.35 },
  { phrase: 'down', mood: 'low', valence: -0.35, energy: 0.34, weight: 1.0 }, { phrase: 'lonely', mood: 'lonely', valence: -0.4, energy: 0.35, weight: 1.25 },
  // Positive words describe valence unless they explicitly signal activation.
  // This keeps calm happiness low-arousal while excited and energetic remain high-arousal.
  // Calm, peaceful, and relaxed already contribute low energy with positive valence.
  { phrase: 'happy', mood: 'upbeat', valence: 0.48, energy: 0, weight: 1.15 }, { phrase: 'good', mood: 'upbeat', valence: 0.3, energy: 0.58, weight: 0.8 },
  { phrase: 'great', mood: 'upbeat', valence: 0.5, energy: 0.7, weight: 1.0 }, { phrase: 'productive', mood: 'upbeat', valence: 0.36, energy: 0.72, weight: 0.9 },
  { phrase: 'excited', mood: 'excited', valence: 0.45, energy: 0.9, weight: 1.2 }, { phrase: 'high energy', mood: 'excited', valence: 0.2, energy: 0.9, weight: 1.2 },
  { phrase: 'energized', mood: 'excited', valence: 0.32, energy: 0.85, weight: 1.1 }, { phrase: 'calm', mood: 'calm', valence: 0.22, energy: 0.28, weight: 1.0 },
  { phrase: 'peaceful', mood: 'calm', valence: 0.3, energy: 0.24, weight: 1.1 }, { phrase: 'relaxed', mood: 'calm', valence: 0.22, energy: 0.3, weight: 1.0 },
  { phrase: 'overthinking', mood: 'reflective', valence: -0.08, energy: 0.56, weight: 1.0 }, { phrase: 'deep thoughts', mood: 'reflective', valence: 0, energy: 0.42, weight: 1.0 },
  { phrase: 'bored', mood: 'bored', valence: -0.18, energy: 0.5, weight: 1.0 }, { phrase: 'restless', mood: 'bored', valence: -0.12, energy: 0.62, weight: 1.0 },
];

const NEED_AND_INTENT_TERMS = [
  { phrase: 'take my mind off', need: 'Escape & Distraction', intent: 'distraction', weight: 1.5 }, { phrase: 'escape', need: 'Escape & Distraction', intent: 'distraction', weight: 1.25 },
  { phrase: 'cheer me up', need: 'Uplift & Encouragement', intent: 'uplift', weight: 1.5 }, { phrase: 'cheers me up', need: 'Uplift & Encouragement', intent: 'uplift', weight: 1.5 }, { phrase: 'feel better', need: 'Uplift & Encouragement', intent: 'uplift', weight: 1.2 },
  { phrase: 'uplifting', need: 'Uplift & Encouragement', intent: 'uplift', weight: 1.15 }, { phrase: 'funny', need: 'Uplift & Encouragement', intent: 'uplift', weight: 1.1 }, { phrase: 'comforting', need: 'Comfort & Reassurance', intent: 'comfort', weight: 1.4 },
  { phrase: 'comfort', need: 'Comfort & Reassurance', intent: 'comfort', weight: 1.1 }, { phrase: 'relax', need: 'Relaxation', intent: 'relaxation', weight: 1.25 }, { phrase: 'relaxing', need: 'Relaxation', intent: 'relaxation', weight: 1.25 },
  { phrase: 'unwind', need: 'Relaxation', intent: 'relaxation', weight: 1.25 }, { phrase: 'exciting', need: 'Stimulation & Excitement', intent: 'stimulation', weight: 1.25 },
  { phrase: 'thrilling', need: 'Stimulation & Excitement', intent: 'stimulation', weight: 1.2 }, { phrase: 'entertaining', need: 'Entertainment', intent: 'entertainment', weight: 0.9 },
  { phrase: 'explore', need: 'Discovery & Exploration', intent: 'exploration', weight: 1.0 }, { phrase: 'discover', need: 'Discovery & Exploration', intent: 'exploration', weight: 1.0 },
];

const FORMAT_TERMS = [
  { phrase: 'movie', value: 'movie' }, { phrase: 'film', value: 'movie' }, { phrase: 'cinema', value: 'movie' }, { phrase: 'series', value: 'series' },
  { phrase: 'show', value: 'series' }, { phrase: 'binge', value: 'series' }, { phrase: 'anime', value: 'anime' }, { phrase: 'manga', value: 'anime' },
  { phrase: 'animation', value: 'anime' }, { phrase: 'music', value: 'music' }, { phrase: 'playlist', value: 'music' }, { phrase: 'song', value: 'music' }, { phrase: 'songs', value: 'music' },
];

const GENRE_TERMS = [
  { phrase: 'romantic', value: 'Romance', weight: 1.5 }, { phrase: 'romance', value: 'Romance', weight: 1.5 }, { phrase: 'love story', value: 'Romance', weight: 1.5 },
  { phrase: 'funny', value: 'Comedy', weight: 1.2 }, { phrase: 'comedy', value: 'Comedy', weight: 1.3 }, { phrase: 'action-packed', value: 'Action', weight: 1.5 },
  { phrase: 'action movie', value: 'Action', weight: 1.4 }, { phrase: 'action film', value: 'Action', weight: 1.4 }, { phrase: 'mystery', value: 'Mystery', weight: 1.1 },
  { phrase: 'thriller', value: 'Thriller', weight: 1.1 }, { phrase: 'horror', value: 'Horror', weight: 1.2 }, { phrase: 'fantasy', value: 'Fantasy', weight: 1.0 },
  { phrase: 'sci-fi', value: 'Science Fiction', weight: 1.2 }, { phrase: 'science fiction', value: 'Science Fiction', weight: 1.2 }, { phrase: 'documentary', value: 'Documentary', weight: 1.2 }, { phrase: 'drama', value: 'Drama', weight: 0.9 },
];

const LANGUAGE_TERMS = [
  { phrase: 'english', value: 'English' }, { phrase: 'hindi', value: 'Hindi' }, { phrase: 'tamil', value: 'Tamil' }, { phrase: 'telugu', value: 'Telugu' }, { phrase: 'malayalam', value: 'Malayalam' }, { phrase: 'kannada', value: 'Kannada' },
];

function phraseRegex(phrase) {
  return new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&').replace(/\\ /g, '\\s+')}(?=\\s|$)`, 'g');
}

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findTerms(text, terms) {
  return terms.flatMap((term) => {
    const match = phraseRegex(term.phrase).exec(text);
    return match ? [{ ...term, index: match.index + match[1].length }] : [];
  });
}

function isNegated(text, index) { return NEGATION_PATTERN.test(text.slice(Math.max(0, index - 32), index)); }
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

/** Deterministic extraction that keeps current emotion separate from desired content. */
export function analyzeSentiment(messages) {
  const answers = messages.filter((message) => message.sender === 'user').map((message) => normalize(message.text)).filter(Boolean);
  const moodScores = Object.fromEntries(moodModel.moods.map((mood) => [mood.id, 0]));
  const intentScores = {}; const needScores = {}; const formatScores = {}; const genreScores = {}; const languageScores = {};
  const signals = [];
  let valenceTotal = 0; let valenceWeight = 0; let energyTotal = 0; let energyWeight = 0; let positiveEvidence = 0; let negativeEvidence = 0; let evidenceCount = 0;

  answers.forEach((answer) => {
    findTerms(answer, EMOTION_TERMS).forEach((term) => {
      const negated = isNegated(answer, term.index);
      if (isRequested(answer, term.index)) return;
      if (negated) {
        if (term.valence > 0) { addScore(moodScores, 'low', term.weight); valenceTotal -= Math.abs(term.valence) * term.weight; valenceWeight += term.weight; negativeEvidence += term.weight; signals.push(`not ${term.phrase}`); evidenceCount += 1; }
        return;
      }
      addScore(moodScores, term.mood, term.weight);
      valenceTotal += term.valence * term.weight; valenceWeight += term.weight; energyTotal += term.energy * term.weight; energyWeight += term.weight;
      if (term.valence > 0) positiveEvidence += term.weight;
      if (term.valence < 0) negativeEvidence += term.weight;
      signals.push(term.phrase); evidenceCount += 1;
    });
    findTerms(answer, NEED_AND_INTENT_TERMS).forEach((term) => { addScore(needScores, term.need, term.weight); addScore(intentScores, term.intent, term.weight); signals.push(term.phrase); evidenceCount += 1; });
    findTerms(answer, FORMAT_TERMS).forEach((term) => { addScore(formatScores, term.value, 1); evidenceCount += 1; });
    findTerms(answer, GENRE_TERMS).forEach((term) => { addScore(genreScores, term.value, term.weight); signals.push(term.phrase); evidenceCount += 1; });
    findTerms(answer, LANGUAGE_TERMS).forEach((term) => { const explicit = /\b(?:prefer|want|in|language)\b/.test(answer) || answer === term.phrase; addScore(languageScores, term.value, explicit ? 2 : 1); evidenceCount += 1; });
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
    confidence: Math.round(clamp(35 + evidenceCount * 7 + (answers.length >= 8 ? 8 : 0) + (isMixed ? 3 : 0), 35, 92)),
    extractedSignals: [...new Set(signals)].slice(0, 8), rawScores: { moods: moodScores, needs: needScores, intents: intentScores, genres: genreScores, languages: languageScores }, analyzedAt: new Date().toISOString(), ...moodDetails,
  });
}

/** Generate brief, non-clinical acknowledgements while keeping the chat moving. */
export function generateAdaptiveReply(userInput, questionIndex) {
  const text = normalize(userInput);
  if (/\b(tired|exhausted|drained|sleepy|low battery)\b/.test(text)) return 'I hear you. We can keep the next choices easy and low-effort.';
  if (/\b(stress|pressure|overwhelm|deadline|hectic|tense)\b/.test(text)) return "That sounds like a demanding day. Let's keep moving toward something that fits this moment.";
  if (/\b(sad|low|lonely|down|heavy)\b/.test(text)) return 'Thanks for sharing that. We will keep the next choices gentle and focused on what you want right now.';
  if (/\b(hindi|tamil|telugu|malayalam|english)\b/.test(text)) return 'Got it. I will keep that language preference in mind.';
  const acknowledgements = ['Understood. That gives me useful context about your day.', 'That makes sense. Let’s use that to guide the next choice.', 'Got it. I am noting your current energy level.', 'Noted. We will keep your preference in mind.', 'That helps shape the kind of experience you want.', 'Great, I have noted that format preference.', 'Understood. Pacing matters for a comfortable experience.', 'Captured. I have what I need to put your profile together.'];
  return acknowledgements[questionIndex % acknowledgements.length];
}

export default { analyzeSentiment, generateAdaptiveReply };
