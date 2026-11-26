import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Send, ArrowLeft, RefreshCw, ShieldCheck, Loader2, Check } from 'lucide-react';
import Navbar from '../components/Navbar';
import CrisisSupport from '../components/CrisisSupport';
import { analyzeSentiment, generateAdaptiveReply } from '../utils/sentimentEngine';
import { useMood } from '../context/MoodContext';

const CRISIS_PHRASES = [
  'suicide',
  'kill myself',
  'end my life',
  'want to die',
  'hurt myself',
  'self harm',
  'no point in living',
  'want to disappear',
  'dont want to live',
  'cant go on',
  'better off dead',
  'end it all',
  'no reason to live',
  'wish i was dead',
  'wish i were dead',
  'not worth living',
  'dont see the point',
  'life is pointless',
  'kill me',
  'want to end it',
];

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\w\s]|_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CONVERSATION_QUESTIONS = [
  {
    // Q1 — captures emotional/physical condition TODAY
    type: 'state',
    stage: 'Daily State',
    question: "How has your day been treating you overall so far?",
    quickChips: ["Pretty peaceful & calm", "Exhausting and long", "Really exciting & productive", "A bit stressful and tense"]
  },
  {
    // Q2 — captures current mental load and stress
    type: 'state',
    stage: 'Mental Focus',
    question: "What's occupying your headspace right now—work pressure, deep thoughts, or ready to unwind?",
    quickChips: ["Overthinking & mental chatter", "Work deadlines and pressure", "Relaxing with zero stress", "Looking for creative inspiration"]
  },
  {
    // Q3 — captures physical energy and fatigue
    type: 'state',
    stage: 'Energy Level',
    question: "How would you describe your physical and mental energy level right now?",
    quickChips: ["High energy, ready for action", "Low battery, need gentle rest", "Steady and comfortable", "Restless & craving novelty"]
  },
  {
    // Q4 — borderline: what the user NEEDS from content; interpreted as need/intent, not raw state
    type: 'state',
    stage: 'Emotional Need',
    question: "What does your mind need most from entertainment today?",
    quickChips: ["Pure comfort & relief", "Deep reflection & meaning", "High-octane excitement", "Lighthearted fun & laughter"]
  },
  {
    // Q5 — describes desired CONTENT atmosphere, NOT the user's own emotional state
    type: 'preference',
    stage: 'Atmosphere & Vibe',
    question: "What kind of atmosphere or vibe feels right for this moment?",
    quickChips: ["Cozy solo sanctuary", "Uplifting feel-good warmth", "Intense & gripping mystery", "Nostalgic & poetic"]
  },
  {
    // Q6 — pure format/platform preference
    type: 'preference',
    stage: 'Format Preference',
    question: "Which multimedia format are you leaning towards right now?",
    quickChips: ["A great movie to immerse in", "A binge-worthy series", "An engaging anime", "Soothing/uplifting music"]
  },
  {
    // Q7 — describes desired content pacing, NOT the user's energy level
    type: 'preference',
    stage: 'Pacing & Tone',
    question: "What pacing or narrative tone fits your current attention span?",
    quickChips: ["Slow-paced & meditative", "Fast-moving & energetic", "Easygoing & low effort", "Thought-provoking & deep"]
  },
  {
    // Q8 — pure language/region preference
    type: 'preference',
    stage: 'Language Preference',
    question: "Which language would you prefer to explore content in today?",
    quickChips: ["English", "Hindi", "Tamil", "Telugu", "Malayalam"]
  }
];

const SESSION_CHAT_KEY = 'moodmate_chat_session';

function loadSavedChatSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_CHAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.messages) &&
      parsed.messages.length > 0 &&
      typeof parsed.currentStep === 'number' &&
      typeof parsed.conversationFinished === 'boolean'
    ) {
      return {
        messages: parsed.messages,
        currentStep: parsed.currentStep,
        conversationFinished: parsed.conversationFinished,
      };
    }
  } catch (_) {}
  return null;
}

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateMoodProfile } = useMood();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [initialSession] = useState(() => {
    if (location.state?.fresh) {
      try {
        sessionStorage.removeItem('moodmate_chat_session');
      } catch (_) {}
      return null;
    }
    return loadSavedChatSession();
  });

  const [currentStep, setCurrentStep] = useState(() => initialSession?.currentStep ?? 0);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationFinished, setConversationFinished] = useState(() => initialSession?.conversationFinished ?? false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCrisisSupport, setShowCrisisSupport] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestNoticeVisible, setGuestNoticeVisible] = useState(false);

  const [messages, setMessages] = useState(() => initialSession?.messages ?? [
    {
      id: 1,
      sender: 'ai',
      text: "Hello! I'm MoodMate. Let's take a quick moment to understand how you're feeling so we can discover the right entertainment for you."
    },
    {
      id: 2,
      sender: 'ai',
      text: CONVERSATION_QUESTIONS[0].question
    }
  ]);

  const idRef = useRef(
    initialSession?.messages
      ? Math.max(...initialSession.messages.map((m) => (typeof m.id === 'number' ? m.id : 0)), 10)
      : 10
  );

  // Save current chat state to sessionStorage whenever messages, currentStep, or conversationFinished change
  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_CHAT_KEY,
        JSON.stringify({ messages, currentStep, conversationFinished })
      );
    } catch (_) {}
  }, [messages, currentStep, conversationFinished]);

  // Check for guest user on mount and show timed notice if no token
  useEffect(() => {
    try {
      const token = localStorage.getItem('moodmate_token');
      if (!token) {
        setIsGuest(true);
        setGuestNoticeVisible(true);
        const timer = setTimeout(() => {
          setGuestNoticeVisible(false);
        }, 6000);
        return () => clearTimeout(timer);
      }
    } catch (_) {}
  }, []);

  // Auto-scroll to bottom of message list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on initial page load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Return focus to input after each bot reply finishes rendering
  useEffect(() => {
    if (!isTyping && !conversationFinished) {
      inputRef.current?.focus();
    }
  }, [isTyping, conversationFinished]);

  const handleSendMessage = (textToSend = input) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isTyping || conversationFinished) return;

    const normalizedMessage = normalizeText(trimmed);
    if (CRISIS_PHRASES.some((phrase) => normalizedMessage.includes(normalizeText(phrase)))) {
      console.warn('crisis path');
      setIsTyping(false);
      setShowCrisisSupport(true);
      setInput('');
      return;
    }

    inputRef.current?.focus();

    idRef.current += 1;
    // 1. Append User Message — stamp with the current question's type so the
    //    sentiment engine knows whether this answer describes state or preference.
    const userMsg = {
      id: idRef.current,
      sender: 'user',
      text: trimmed,
      questionType: CONVERSATION_QUESTIONS[currentStep]?.type ?? 'state',
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    // 2. Compute Next AI step or finish
    if (currentStep < CONVERSATION_QUESTIONS.length - 1) {
      const nextStepIndex = currentStep + 1;
      
      setTimeout(() => {
        // Adaptive acknowledgment based on what the user wrote
        const ackReply = generateAdaptiveReply(trimmed, currentStep);
        const nextQ = CONVERSATION_QUESTIONS[nextStepIndex].question;

        idRef.current += 2;
        setMessages((prev) => [
          ...prev,
          {
            id: idRef.current - 1,
            sender: 'ai',
            text: ackReply
          },
          {
            id: idRef.current,
            sender: 'ai',
            text: nextQ
          }
        ]);

        setCurrentStep(nextStepIndex);
        setIsTyping(false);
      }, 700);

    } else {
      // 3. Final Step: Try LLM engine, fall back to keyword engine
      const userMessages = nextMessages.filter((m) => m.sender === 'user');
      const stateAnswers = userMessages.slice(0, 4).map((m) => m.text.trim());
      const preferenceAnswers = userMessages.slice(4, 8).map((m) => m.text.trim());

      let crisisDetected = CRISIS_PHRASES.some((phrase) => {
        const normPhrase = normalizeText(phrase);
        return stateAnswers.some((ans) => normalizeText(ans).includes(normPhrase));
      });

      const runFinish = (profile) => {
        updateMoodProfile(profile);

        idRef.current += 2;
        setMessages((prev) => [
          ...prev,
          {
            id: idRef.current - 1,
            sender: 'ai',
            text: "Thank you for sharing your thoughts. I have mapped your emotional valence, arousal, and linguistic preferences."
          },
          {
            id: idRef.current,
            sender: 'ai',
            text: "Synthesizing your tailored multimedia suite..."
          }
        ]);

        setIsTyping(false);
        setConversationFinished(true);

        setTimeout(() => {
          setIsAnalyzing(true);
          setTimeout(() => {
            navigate('/mood-analysis');
          }, 800);
        }, 1200);
      };

      setTimeout(async () => {
        let usedLlm = false;

        try {
          const token = localStorage.getItem('moodmate_token');
          const headers = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);

          const response = await fetch('http://localhost:8000/api/mood/analyze', {
            method: 'POST',
            headers,
            body: JSON.stringify({ state_answers: stateAnswers, preference_answers: preferenceAnswers }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data?.result?.crisis === true) {
              crisisDetected = true;
            }

            if (!crisisDetected && data.result !== null && data.result !== undefined && data.result.crisis === false) {
              const r = data.result;

              let keywordProfile = {};
              try {
                keywordProfile = analyzeSentiment(nextMessages) || {};
              } catch {
                keywordProfile = {};
              }

              // Map LLM result fields to createMoodProfile input shape
              const llmProfile = {
                mood: r.mood,
                valence: r.valence,
                energy: r.energy,
                emotionalNeed: r.emotional_need,
                // headline becomes the description shown on the Mood Profile page
                description: r.headline,
                // report stored in suggestedMediaStyle for profile compatibility
                suggestedMediaStyle: r.report,
                contentPreference: keywordProfile.contentPreference !== undefined ? keywordProfile.contentPreference : 'all',
                genrePreference: keywordProfile.genrePreference !== undefined ? keywordProfile.genrePreference : [],
                userIntent: keywordProfile.userIntent !== undefined ? keywordProfile.userIntent : null,
                languagePreference: keywordProfile.languagePreference !== undefined ? keywordProfile.languagePreference : null,
                confidence: 85,
                engineUsed: 'llm',
                analyzedAt: new Date().toISOString(),
                extractedSignals: [],
              };
              runFinish(llmProfile);
              usedLlm = true;
            } else if (!crisisDetected) {
              console.warn('LLM: result null, status', response.status);
            }
          } else {
            console.warn('LLM: non-200 status', response.status);
          }
        } catch (err) {
          console.warn('LLM: request failed', err.name);
        }

        if (crisisDetected) {
          console.warn('crisis path');
          setIsTyping(false);
          setShowCrisisSupport(true);
          return;
        }

        if (!usedLlm) {
          runFinish({ ...analyzeSentiment(nextMessages), engineUsed: 'keyword' });
        }
      }, 900);
    }
  };

  const handleRestart = () => {
    try {
      sessionStorage.removeItem(SESSION_CHAT_KEY);
    } catch (_) {}
    setCurrentStep(0);
    setInput('');
    setIsTyping(false);
    setConversationFinished(false);
    setShowCrisisSupport(false);
    inputRef.current?.focus();
    idRef.current = 10;
    setMessages([
      {
        id: 1,
        sender: 'ai',
        text: "Hello! Let's start fresh. How are you feeling at this moment?"
      },
      {
        id: 2,
        sender: 'ai',
        text: CONVERSATION_QUESTIONS[0].question
      }
    ]);
  };

  const progressPercent = conversationFinished
    ? 100
    : Math.round(((currentStep + 1) / CONVERSATION_QUESTIONS.length) * 100);

  if (showCrisisSupport) {
    return <CrisisSupport onBack={handleRestart} />;
  }

  return (
    <div className="relative min-h-screen bg-[#030308] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      {/* TRANSITION 1: Chat -> Mood Analysis Loading Overlay */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#030308]/80 backdrop-blur-sm transition-opacity duration-500 ${
          isAnalyzing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Loader2 size={46} className="animate-spin text-purple-400" />
        <p className="mt-5 text-sm font-medium text-white/70 tracking-wide">Analyzing your mood...</p>
      </div>

      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[15%] left-[25%] h-[550px] w-[550px] rounded-full bg-purple-600/15 blur-[170px]" />
        <div className="absolute bottom-[20%] right-[20%] h-[500px] w-[500px] rounded-full bg-indigo-600/12 blur-[170px]" />
      </div>

      <Navbar />

      {isGuest && (
        <div
          className={`fixed top-20 right-4 z-40 pointer-events-none transition-opacity duration-700 rounded-xl border-2 border-emerald-400/50 bg-emerald-500/15 px-5 py-3.5 text-base font-semibold text-emerald-300 shadow-lg backdrop-blur-md ${
            guestNoticeVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Check size={16} className="inline mr-2" />
          Guest mode: your chat is kept for this browser session only.
        </div>
      )}

      {/* Main Expansive Chat Interface Container */}
      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 flex-1 flex flex-col">
        
        {/* Chat Window Frame */}
        <div className="relative flex-1 flex flex-col rounded-3xl border border-purple-500/30 bg-[#05060a]/90 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl overflow-hidden min-h-[75vh] md:min-h-[82vh]">
          {/* Chat Window Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 hover:border-white/20 hover:text-white transition"
              >
                <ArrowLeft size={15} />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    MoodMate Assistant
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
                  </h2>
                  <p className="text-[11px] text-white/40">
                    Stage {currentStep + 1} of {CONVERSATION_QUESTIONS.length}: {CONVERSATION_QUESTIONS[currentStep]?.stage || 'Synthesis'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRestart}
                title="Restart conversation"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/60 hover:bg-white/[0.08] hover:text-white transition"
              >
                <RefreshCw size={12} />
                <span className="hidden sm:inline">Restart</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/[0.04] h-1">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500"
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 space-y-4">
            {messages.map((msg) => {
              const isAi = msg.sender === 'ai';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="flex items-start gap-3 max-w-[88%] sm:max-w-[78%]">
                    {isAi && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 mt-1">
                        <Sparkles size={14} />
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                        isAi
                          ? 'border border-white/[0.08] bg-white/[0.04] text-white/85 shadow-lg backdrop-blur-md rounded-tl-sm'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/20 rounded-tr-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Live Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  <Sparkles size={14} />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {!conversationFinished && CONVERSATION_QUESTIONS[currentStep]?.quickChips && (
            <div className="px-6 py-2.5 border-t border-white/[0.05] bg-black/20">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300/60 shrink-0">
                  Quick response:
                </span>
                {CONVERSATION_QUESTIONS[currentStep].quickChips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(chip)}
                    disabled={isTyping}
                    className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/75 hover:border-purple-500/40 hover:bg-purple-500/15 hover:text-white transition-all disabled:opacity-40"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="border-t border-purple-500/20 bg-[#030308]/90 p-4 sm:p-5">
            {!conversationFinished ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  autoCapitalize="sentences"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isTyping}
                  placeholder="Type your response or select a quick option above..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-5 pr-14 text-sm text-white placeholder-white/25 outline-none transition focus:border-purple-500/50 focus:bg-white/[0.06] disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/40 transition hover:bg-purple-600 hover:shadow-purple-500/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-purple-300 font-medium animate-pulse">
                <Sparkles size={14} />
                <span>Decoding emotional state and redirecting to Mood Profile...</span>
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/35 px-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-purple-400" />
                Private Affective Check-In (8 Stages)
              </span>
              <span>Press Enter ↵ to send</span>
            </div>
          </div>

        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>
    </div>
  );
}
