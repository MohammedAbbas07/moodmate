import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Send, ArrowLeft, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { analyzeSentiment, generateAdaptiveReply } from '../utils/sentimentEngine';
import { useMood } from '../context/MoodContext';

const CONVERSATION_QUESTIONS = [
  {
    stage: 'Daily State',
    question: "How has your day been treating you overall so far?",
    quickChips: ["Pretty peaceful & calm", "Exhausting and long", "Really exciting & productive", "A bit stressful and tense"]
  },
  {
    stage: 'Mental Focus',
    question: "What's occupying your headspace right now—work pressure, deep thoughts, or ready to unwind?",
    quickChips: ["Overthinking & mental chatter", "Work deadlines and pressure", "Relaxing with zero stress", "Looking for creative inspiration"]
  },
  {
    stage: 'Energy Level',
    question: "How would you describe your physical and mental energy level right now?",
    quickChips: ["High energy, ready for action", "Low battery, need gentle rest", "Steady and comfortable", "Restless & craving novelty"]
  },
  {
    stage: 'Emotional Need',
    question: "What does your mind need most from entertainment today?",
    quickChips: ["Pure comfort & relief", "Deep reflection & meaning", "High-octane excitement", "Lighthearted fun & laughter"]
  },
  {
    stage: 'Atmosphere & Vibe',
    question: "What kind of atmosphere or vibe feels right for this moment?",
    quickChips: ["Cozy solo sanctuary", "Uplifting feel-good warmth", "Intense & gripping mystery", "Nostalgic & poetic"]
  },
  {
    stage: 'Format Preference',
    question: "Which multimedia format are you leaning towards right now?",
    quickChips: ["A great movie to immerse in", "A binge-worthy series", "An engaging anime", "Soothing/uplifting music"]
  },
  {
    stage: 'Pacing & Tone',
    question: "What pacing or narrative tone fits your current attention span?",
    quickChips: ["Slow-paced & meditative", "Fast-moving & energetic", "Easygoing & low effort", "Thought-provoking & deep"]
  },
  {
    stage: 'Language Preference',
    question: "Which language would you prefer to explore content in today?",
    quickChips: ["English", "Hindi", "Tamil", "Telugu", "Malayalam"]
  }
];

export default function Chat() {
  const navigate = useNavigate();
  const { updateMoodProfile } = useMood();
  const messagesEndRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationFinished, setConversationFinished] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [messages, setMessages] = useState([
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

  const idRef = useRef(10);

  // Auto-scroll to bottom of message list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (textToSend = input) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isTyping || conversationFinished) return;

    idRef.current += 1;
    // 1. Append User Message
    const userMsg = {
      id: idRef.current,
      sender: 'user',
      text: trimmed
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
      // 3. Final Step: Run Sentiment & Affective Engine
      setTimeout(() => {
        const sentimentResult = analyzeSentiment(nextMessages);
        updateMoodProfile(sentimentResult);

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
      }, 900);
    }
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setInput('');
    setIsTyping(false);
    setConversationFinished(false);
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

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      {/* TRANSITION 1: Chat -> Mood Analysis Loading Overlay */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#05060a]/80 backdrop-blur-sm transition-opacity duration-500 ${
          isAnalyzing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Loader2 size={46} className="animate-spin text-purple-400" />
        <p className="mt-5 text-sm font-medium text-white/70 tracking-wide">Analyzing your mood...</p>
      </div>

      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[15%] left-[25%] h-[550px] w-[550px] rounded-full bg-purple-600/10 blur-[170px]" />
        <div className="absolute bottom-[20%] right-[20%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[170px]" />
      </div>

      <Navbar />

      {/* Main Expansive Chat Interface Container */}
      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 flex-1 flex flex-col">
        
        {/* Chat Window Frame */}
        <div className="flex-1 flex flex-col rounded-3xl border border-white/[0.09] bg-[#07080c]/90 shadow-2xl backdrop-blur-2xl overflow-hidden min-h-[75vh] md:min-h-[82vh]">
          
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
          <div className="border-t border-white/[0.08] bg-[#05060a]/90 p-4 sm:p-5">
            {!conversationFinished ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isTyping}
                  placeholder="Type your response or select a quick option above..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-5 pr-14 text-sm text-white placeholder-white/25 outline-none transition focus:border-purple-500/50 focus:bg-white/[0.06] disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30 transition hover:bg-purple-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
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
