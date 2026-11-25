import React, { useRef, useState } from 'react';
import { Heart, Shield } from 'lucide-react';
import Navbar from './Navbar';

export default function CrisisSupport({ onBack }) {
  const helplinesRef = useRef(null);
  const [highlighted, setHighlighted] = useState(false);

  const handleNeedHelp = () => {
    helplinesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlighted(true);
    setTimeout(() => setHighlighted(false), 2500);
  };

  return (
    <div className="relative min-h-screen bg-[#030308] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[15%] left-[25%] h-[550px] w-[550px] rounded-full bg-purple-600/15 blur-[170px]" />
        <div className="absolute bottom-[20%] right-[20%] h-[500px] w-[500px] rounded-full bg-indigo-600/12 blur-[170px]" />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 flex-1 flex flex-col justify-center">
        <div className="rounded-3xl border border-purple-500/30 bg-[#05060a]/90 p-8 sm:p-10 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
            <Heart size={28} className="text-purple-400" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            You do not have to face this alone
          </h1>

          <p className="mt-3 text-xs sm:text-sm font-medium text-rose-300/90 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 max-w-lg mx-auto">
            If you feel unsafe right now, call 112 or go to the nearest hospital.
          </p>

          <p className="mt-4 text-sm sm:text-base leading-relaxed text-white/70 max-w-lg mx-auto">
            It sounds like things are really difficult right now. You do not have to carry this by yourself, and talking to someone now can help you find your footing.
          </p>

          <div
            ref={helplinesRef}
            className={`mt-8 rounded-2xl border transition-all duration-300 p-6 text-left space-y-4 ${
              highlighted
                ? 'border-purple-400 bg-purple-500/10 shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/50'
                : 'border-white/[0.08] bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-2">
              <Shield size={14} className="text-purple-400" />
              <span>Support Helplines</span>
            </div>

            <div className="border-t border-white/[0.06] pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-white">Tele-MANAS</div>
                <div className="text-xs text-white/50">Toll-free 24/7 mental health helpline</div>
              </div>
              <a
                href="tel:14416"
                className="inline-flex items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 px-4 py-2.5 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/25 hover:border-purple-500/50 cursor-pointer"
              >
                14416 (free, 24 hours)
              </a>
            </div>

            <div className="border-t border-white/[0.06] pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-white">KIRAN</div>
                <div className="text-xs text-white/50">Mental health rehabilitation helpline</div>
              </div>
              <a
                href="tel:18005990019"
                className="inline-flex items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 px-4 py-2.5 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/25 hover:border-purple-500/50 cursor-pointer"
              >
                1800-599-0019
              </a>
            </div>

            <div className="border-t border-white/[0.06] pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-white">Emergency Services</div>
                <div className="text-xs text-white/50">National emergency response number</div>
              </div>
              <a
                href="tel:112"
                className="inline-flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25 hover:border-rose-500/50 cursor-pointer"
              >
                112
              </a>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleNeedHelp}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:bg-purple-600 hover:shadow-purple-500/50 cursor-pointer"
            >
              <span>I need help now</span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white cursor-pointer"
            >
              <span>I'm safe right now, continue</span>
            </button>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>
    </div>
  );
}
