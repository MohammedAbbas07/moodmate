import { Link } from 'react-router-dom';
import { Sparkles, CheckCircle2, Star, Users } from 'lucide-react';
import CinematicBackground from '../components/CinematicBackground';
import Navbar from '../components/Navbar';

const FEATURES = [
  'AI Mood Analysis via Chat',
  '6-Factor Recommendation Scoring',
  'Real Auth & Persistent Watchlist',
  'Multi-Platform Redirects (8 platforms)',
  '8 Language Support',
  'User Feedback Loop',
];

const TEAM = [
  {
    name: 'Mohammed Abbas Z',
    role: 'Full-Stack Developer',
    areas: ['Frontend Architecture & UI/UX Design', 'Database Design & Optimization'],
    accent: 'purple',
  },
  {
    name: 'Aadhiz Ahamed',
    role: 'Backend Systems Developer',
    areas: ['Authentication System', 'Database Integration', 'API Security & Validation'],
    accent: 'indigo',
  },
];

export default function AboutUs() {
  return (
    <div className="relative min-h-screen bg-[#05060a] text-white selection:bg-purple-500/30 selection:text-white">
      <CinematicBackground />
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8 space-y-20">

        {/* ── SECTION 1: Value Proposition ── */}
        <section className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-300 backdrop-blur-md mb-8">
            <Sparkles size={13} className="text-purple-400" />
            <span>About MoodMate</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight mb-6">
            Entertainment that feels<br />
            <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              exactly right.
            </span>
          </h1>

          <p className="text-lg text-white/60 leading-relaxed max-w-2xl mx-auto">
            MoodMate is a mood-aware entertainment companion built for anyone who&apos;s ever opened Netflix
            and closed it five minutes later, still not knowing what to watch. We solve decision fatigue
            by matching movies, series, anime, and music to how you actually feel &mdash; not what&apos;s trending.
          </p>
        </section>

        {/* ── SECTION 2: Brand Story ── */}
        <section>
          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-purple-950/40 via-[#0a0b12]/80 to-indigo-950/30 p-10 backdrop-blur-xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex-shrink-0 mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-500/30">
                <Sparkles size={18} className="text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Why MoodMate?</h2>
            </div>
            <p className="text-white/60 leading-relaxed text-base">
              MoodMate started as a capstone idea born from a simple frustration: existing platforms
              recommend based on what you&apos;ve watched before, never on how you&apos;re feeling right now.
              We built MoodMate to close that gap &mdash; using conversational AI to understand your
              emotional state and translate it into content that truly fits your moment, grounded in
              real psychological research{' '}
              <span className="text-purple-300 font-medium">(Russell&apos;s Circumplex Model of Affect)</span>.
            </p>
          </div>
        </section>

        {/* ── SECTION 3: Trust Elements ── */}
        <section>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-purple-400 mb-3">
              <Star size={13} />
              <span>Built on Real Research</span>
            </div>
            <p className="text-white/60 leading-relaxed max-w-2xl mx-auto text-base">
              MoodMate&apos;s recommendations are powered by a research-backed{' '}
              <span className="text-white font-semibold">6-factor algorithm</span> &mdash; combining mood
              compatibility, energy alignment, emotional need, content preference, user intent, and content
              quality. Every suggestion is intentional, never random.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {FEATURES.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 backdrop-blur-sm"
              >
                <CheckCircle2 size={15} className="text-purple-400 flex-shrink-0" />
                <span className="text-sm text-white/75 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 4: Built By ── */}
        <section>
          <div className="border-t border-white/[0.08] pt-14">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/35 mb-2">
                <Users size={13} />
                <span>Product Built By</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {TEAM.map((member) => (
                <div
                  key={member.name}
                  className="rounded-3xl border border-white/[0.08] bg-[#0a0b12]/80 p-7 backdrop-blur-xl"
                >
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-4 ${
                    member.accent === 'purple'
                      ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                      : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                  }`}>
                    {member.role}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{member.name}</h3>
                  <ul className="space-y-1.5">
                    {member.areas.map((area) => (
                      <li key={area} className="flex items-start gap-2 text-sm text-white/50">
                        <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${
                          member.accent === 'purple' ? 'bg-purple-400' : 'bg-indigo-400'
                        }`} />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Back link */}
        <div className="text-center pb-4">
          <Link
            to="/"
            className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-4"
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>
    </div>
  );
}
