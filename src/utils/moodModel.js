// MoodMate Emotional & Affective Model
// Based on Russell's Circumplex Model of Affect (Valence & Energy/Arousal)

export const moodModel = {
  moods: [
    {
      id: 'calm',
      name: 'Calm & Peaceful',
      shortName: 'Calm',
      valence: 0.75,
      energy: 0.30,
      primaryColor: '#a78bfa',
      badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      description: 'You seem to be in a calm, settled, and relaxed headspace. You are looking for something comfortable and gentle that does not demand high cognitive effort.',
      emotionalNeed: 'Comfort & Relaxation',
      suggestedMediaStyle: 'Peaceful acoustic music, gentle character dramas, and soothing animation.',
      keywords: ['calm', 'peaceful', 'quiet', 'relaxed', 'chilled', 'serene', 'cozy', 'fine', 'settled', 'comfortable', 'easy']
    },
    {
      id: 'reflective',
      name: 'Reflective & Thoughtful',
      shortName: 'Reflective',
      valence: 0.60,
      energy: 0.40,
      primaryColor: '#818cf8',
      badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
      description: 'You are in a thoughtful, contemplative mood. You would appreciate deep narratives, philosophical themes, or evocative soundtracks that resonate with your inner thoughts.',
      emotionalNeed: 'Meaning & Insight',
      suggestedMediaStyle: 'Atmospheric cinema, mystery series, deep instrumental music, and philosophical anime.',
      keywords: ['thinking', 'reflecting', 'thoughtful', 'memories', 'deep thoughts', 'pondering', 'nostalgic', 'philosophy', 'wondering', 'mind']
    },
    {
      id: 'upbeat',
      name: 'Upbeat & Joyful',
      shortName: 'Joyful',
      valence: 0.90,
      energy: 0.80,
      primaryColor: '#f472b6',
      badgeClass: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
      description: 'You are feeling vibrant, positive, and full of good energy! Something lively, colorful, and entertaining will keep your spirits high.',
      emotionalNeed: 'Celebration & Fun',
      suggestedMediaStyle: 'High-tempo pop/dance music, uplifting comedies, colorful animated adventures, and feel-good series.',
      keywords: ['happy', 'great', 'good', 'joyful', 'cheerful', 'fun', 'excited', 'positive', 'fantastic', 'amazing', 'wonderful', 'blessed', 'smile']
    },
    {
      id: 'stressed',
      name: 'Overwhelmed & Stressed',
      shortName: 'Stressed',
      valence: 0.35,
      energy: 0.75,
      primaryColor: '#fb7185',
      badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      description: 'Things feel busy, pressurized, or tense right now. You need grounding entertainment that eases tension and allows your mind to decompress.',
      emotionalNeed: 'Decompression & Relief',
      suggestedMediaStyle: 'Low-stakes comedy, ambient lo-fi music, heartwarming comfort shows, and gentle slice-of-life anime.',
      keywords: ['stressed', 'stress', 'overwhelmed', 'pressure', 'anxious', 'hectic', 'tense', 'overthinking', 'busy', 'deadline', 'panic', 'work']
    },
    {
      id: 'tired',
      name: 'Tired & Drained',
      shortName: 'Tired',
      valence: 0.45,
      energy: 0.15,
      primaryColor: '#94a3b8',
      badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
      description: 'Your mental battery is running low. You do not have the bandwidth for convoluted plots or high-intensity sound. You need restorative, easy-going comfort.',
      emotionalNeed: 'Restoration & Ease',
      suggestedMediaStyle: 'Slow-tempo relaxing playlists, cozy comfort TV, nostalgic animated classics, and lighthearted films.',
      keywords: ['tired', 'exhausted', 'drained', 'sleepy', 'fatigued', 'worn out', 'low energy', 'burned out', 'burnt out', 'sleep', 'rest']
    },
    {
      id: 'low',
      name: 'Low & Melancholic',
      shortName: 'Low',
      valence: 0.25,
      energy: 0.30,
      primaryColor: '#60a5fa',
      badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      description: 'It sounds like things are feeling a bit heavy right now. We will keep everything gentle, empathetic, and warm without being forced or falsely cheerful.',
      emotionalNeed: 'Warmth & Catharsis',
      suggestedMediaStyle: 'Empathetic indie music, comforting films about human connection, and gentle uplifting series.',
      keywords: ['sad', 'down', 'low', 'lonely', 'heavy', 'gloomy', 'hurt', 'unhappy', 'blue', 'crying', 'heartbroken', 'tough']
    },
    {
      id: 'excited',
      name: 'Excited & Adventurous',
      shortName: 'Excited',
      valence: 0.88,
      energy: 0.92,
      primaryColor: '#fbbf24',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      description: 'You are craving adrenaline, excitement, and discovery! High-stakes adventures and energetic rhythms match your pulse.',
      emotionalNeed: 'Thrill & Exploration',
      suggestedMediaStyle: 'Action blockbusters, epic fantasy series, hype anime battles, and dynamic anthems.',
      keywords: ['excited', 'hyped', 'adventure', 'thrilled', 'energetic', 'pumped', 'eager', 'ready', 'thrill', 'epic', 'action']
    },
    {
      id: 'bored',
      name: 'Bored & Restless',
      shortName: 'Restless',
      valence: 0.40,
      energy: 0.50,
      primaryColor: '#34d399',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      description: 'You are feeling under-stimulated and in need of something genuinely captivating to break the monotony of the day.',
      emotionalNeed: 'Novelty & Engagement',
      suggestedMediaStyle: 'Fast-paced thrillers, unpredictable plot-twist series, gripping anime mysteries, and fresh genre-bending music.',
      keywords: ['bored', 'boring', 'nothing to do', 'restless', 'uninspired', 'stuck', 'same old', 'dull', 'monotonous', 'pass time']
    },
    {
      id: 'lonely',
      name: 'Seeking Connection',
      shortName: 'Lonely',
      valence: 0.35,
      energy: 0.35,
      primaryColor: '#c084fc',
      badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      description: 'You are craving warmth, camaraderie, and relatable human emotion. Stories with rich ensemble casts and heartfelt music will make you feel right at home.',
      emotionalNeed: 'Connection & Belonging',
      suggestedMediaStyle: 'Ensemble comfort comedies, heartfelt character dramas, warm acoustic tracks, and anime centered on friendship.',
      keywords: ['lonely', 'alone', 'isolated', 'miss friends', 'need company', 'miss someone', 'empty', 'nobody', 'friends']
    }
  ]
};

export default moodModel;
