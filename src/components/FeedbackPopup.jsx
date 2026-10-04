import { useState, useEffect } from 'react';
import { X, Send, Frown, Meh, Smile, SmilePlus, ThumbsUp, CheckCircle } from 'lucide-react';

const SESSION_KEY = 'moodmate_feedback_dismissed';
const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * Rating options — Lucide outline icons with professional text labels.
 * No emoji characters; no numbers. Consistent muted style, purple on select.
 */
const RATINGS = [
  { rating: 1, Icon: Frown,     label: 'Very Bad' },
  { rating: 2, Icon: Frown,     label: 'Bad',      dim: true },
  { rating: 3, Icon: Meh,       label: 'Okay' },
  { rating: 4, Icon: Smile,     label: 'Good' },
  { rating: 5, Icon: SmilePlus, label: 'Very Good' },
];

export default function FeedbackPopup() {
  const [visible, setVisible]           = useState(false);
  const [entered, setEntered]           = useState(false);
  const [selectedRating, setSelected]   = useState(null);
  const [message, setMessage]           = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);

  // Show after 15 s if not already dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setEntered(false);
    setTimeout(() => setVisible(false), 400);
    sessionStorage.setItem(SESSION_KEY, '1');
  };

  const handleSubmit = async () => {
    if (!selectedRating) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('moodmate_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${BACKEND_URL}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mood_rating: selectedRating,
          message: message.trim() || null,
        }),
      });
    } catch (_) {
      // Silently ignore — feedback is non-critical
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(dismiss, 1800);
    }
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes feedbackPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.35), 0 25px 50px -12px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 0 7px rgba(168,85,247,0),  0 25px 50px -12px rgba(0,0,0,0.7); }
        }
        .feedback-glow { animation: feedbackPulse 2.8s ease-in-out infinite; }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share your feedback"
        className={`
          fixed bottom-6 right-6 z-[9999]
          w-[calc(100vw-48px)] max-w-sm
          rounded-3xl border border-white/[0.11]
          bg-[#0c0d18]/92 backdrop-blur-2xl
          p-6 text-white
          feedback-glow
          transition-all duration-400
          ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
        `}
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Close feedback"
          className="absolute right-4 top-4 rounded-full p-1.5 text-white/35 hover:bg-white/[0.08] hover:text-white/80 transition"
        >
          <X size={15} />
        </button>

        {submitted ? (
          /* ── Thank-you state ── */
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/15 border border-purple-500/30">
              <CheckCircle size={26} className="text-purple-400" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-bold text-white">Thank you!</p>
            <p className="text-xs text-white/45">Your feedback helps us improve MoodMate.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-5 pr-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                Quick Feedback
              </p>
              <h3 className="mt-1 text-sm font-semibold text-white/90 leading-snug">
                How would you rate your MoodMate experience?
              </h3>
            </div>

            {/* Icon rating row */}
            <div className="mb-5 flex items-end justify-between gap-1">
              {RATINGS.map(({ rating, Icon, label }) => {
                const isSelected = selectedRating === rating;
                return (
                  <button
                    key={rating}
                    aria-label={label}
                    aria-pressed={isSelected}
                    title={label}
                    onClick={() => setSelected(rating)}
                    className={`
                      group flex flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5
                      transition-all duration-150 focus:outline-none
                      ${isSelected
                        ? 'bg-purple-500/20 ring-1 ring-purple-400/50 scale-[1.08]'
                        : 'hover:bg-white/[0.05] hover:scale-[1.04]'}
                    `}
                  >
                    <Icon
                      size={22}
                      strokeWidth={1.6}
                      className={`transition-colors duration-150 ${
                        isSelected
                          ? 'text-purple-400'
                          : 'text-white/35 group-hover:text-white/65'
                      }`}
                    />
                    <span
                      className={`text-[9px] font-medium leading-none transition-colors duration-150 ${
                        isSelected ? 'text-purple-300' : 'text-white/30 group-hover:text-white/55'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional text input */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more (optional)"
              maxLength={2000}
              rows={2}
              className="
                mb-4 w-full resize-none rounded-xl border border-white/[0.09]
                bg-white/[0.03] px-3 py-2 text-xs text-white
                placeholder-white/20 outline-none transition
                focus:border-purple-500/45 focus:bg-white/[0.06]
              "
            />

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={!selectedRating || submitting}
                className={`
                  flex flex-1 items-center justify-center gap-1.5
                  rounded-full py-2.5 text-xs font-semibold
                  transition-all duration-150
                  ${selectedRating && !submitting
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-500/25 hover:brightness-110 active:scale-95 cursor-pointer'
                    : 'bg-white/[0.05] text-white/25 cursor-not-allowed'}
                `}
              >
                <Send size={12} />
                {submitting ? 'Sending…' : 'Send Feedback'}
              </button>

              <button
                onClick={dismiss}
                className="rounded-full border border-white/[0.09] bg-transparent px-4 py-2.5 text-xs font-medium text-white/40 hover:bg-white/[0.04] hover:text-white/70 transition cursor-pointer"
              >
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
