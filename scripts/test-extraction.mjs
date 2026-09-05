import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { analyzeSentiment } = await server.ssrLoadModule('/src/utils/sentimentEngine.js');
const profileFor = (text) => analyzeSentiment([{ sender: 'user', text }]);

try {
  const mixed = profileFor("I'm half happy and half sad about college.");
  assert.equal(mixed.shortName, 'Mixed');
  assert.ok(mixed.valence > 0.35 && mixed.valence < 0.65);

  const negated = profileFor("I'm not happy today.");
  assert.notEqual(negated.mood, 'upbeat');
  assert.ok(negated.valence < 0.5);

  const negative = profileFor("My day wasn't that good.");
  assert.ok(negative.valence < 0.5);

  assert.equal(profileFor("I'm under college pressure.").mood, 'stressed');
  assert.ok(profileFor("I'm exhausted and have no energy.").energy < 0.25);

  const uplift = profileFor("I'm feeling really down, but I want something that cheers me up.");
  assert.equal(uplift.mood, 'low');
  assert.equal(uplift.userIntent, 'uplift');
  assert.equal(uplift.emotionalNeed, 'Uplift & Encouragement');

  const sadFunny = profileFor("I'm sad, but I want something funny.");
  assert.equal(sadFunny.mood, 'low');
  assert.deepEqual(sadFunny.genrePreference, ['Comedy']);
  assert.equal(sadFunny.userIntent, 'uplift');

  const genre = profileFor('I want a romantic movie.');
  assert.equal(genre.contentPreference, 'movie');
  assert.deepEqual(genre.genrePreference, ['Romance']);

  const languageGenre = profileFor('I want a Tamil romantic movie.');
  assert.equal(languageGenre.contentPreference, 'movie');
  assert.deepEqual(languageGenre.genrePreference, ['Romance']);
  assert.equal(languageGenre.languagePreference, 'Tamil');

  const relax = profileFor('I just want something relaxing.');
  assert.equal(relax.userIntent, 'relaxation');
  assert.equal(relax.emotionalNeed, 'Relaxation');

  const exciting = profileFor('Give me something exciting.');
  assert.notEqual(exciting.mood, 'excited');
  assert.equal(exciting.userIntent, 'stimulation');
  assert.equal(exciting.emotionalNeed, 'Stimulation & Excitement');

  console.log('Extraction behavior tests passed (10 cases).');
} finally {
  await server.close();
}
