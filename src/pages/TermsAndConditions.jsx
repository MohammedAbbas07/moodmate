import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import CinematicBackground from '../components/CinematicBackground';
import Navbar from '../components/Navbar';

const SECTIONS = [
  {
    title: '1. What MoodMate Actually Is',
    body: "Hey, just so you know — MoodMate is a student capstone project we built for academic purposes. It's not a startup, it's not making money, and nobody's paying for anything. Everything you see here — the AI chat, the recommendations, the watchlist — is a demo we built to show what's possible. Cool, right?",
  },
  {
    title: "2. We Don't Own Netflix (Shocking, We Know)",
    body: 'When you click "Watch on Netflix" or any other streaming platform, we\'re just sending you there. We don\'t host any movies, series, or music ourselves. Those titles belong to their creators and the platforms that carry them. If something\'s not available where you live, that\'s on them — not us.',
  },
  {
    title: '3. Your Mood Data Stays With You',
    body: "When you chat with our AI and tell it you're feeling anxious or pumped up, we use that info to pick what to recommend — and that's it. We don't sell it, share it, or use it for anything else. It lives in your session (and your account if you've created one) purely so we can give you better picks.",
  },
  {
    title: '4. This Is Not a Therapist',
    body: "Seriously — MoodMate is for picking movies, not diagnosing mental health. Our mood detection is a fun, simplified system based on what you type. If something's genuinely wrong, please talk to a real professional. We're just here to help you find something good to watch on a Sunday night.",
  },
  {
    title: '5. Your Account',
    body: "If you sign up, your password is hashed (we never see it in plain text — Bcrypt takes care of that). Your account is yours. Don't share your login. Since this is an academic project, we might reset things occasionally during updates — so don't rely on it to store anything critical.",
  },
  {
    title: "6. Our Recommendations Aren't Perfect",
    body: "We do our best with a 6-factor algorithm, but honestly — taste is personal. Sometimes the system will suggest something that doesn't land for you, and that's okay. Our catalog is also curated by hand and isn't live-synced to what's actually on Netflix right now, so availability might vary.",
  },
  {
    title: '7. The Stuff We Made',
    body: "The code, the UI, the algorithm, the design — all ours. The movie titles, platform logos, and brand names we reference? Those belong to their respective owners. We're just students building something cool, not trying to steal anyone's IP.",
  },
  {
    title: '8. If Something Breaks',
    body: "We put a lot of care into this, but it's a student project — bugs happen. If a link doesn't work, a recommendation is weird, or the site acts up, we apologize in advance. We're not liable for anything that goes wrong. Think of it like a beta you're helping us test.",
  },
  {
    title: '9. We Might Update This',
    body: "As the project evolves, these terms might change too. We'll try to keep things sensible, but since there's no legal obligation here, we might update this page quietly. If you're using MoodMate, just assume the latest version of this page applies.",
  },
  {
    title: '10. Questions?',
    body: "If anything here seems off or you have a genuine concern, reach out through our academic institution. We're a small team of students who genuinely care about this project — feedback is always welcome.",
  },
];

export default function TermsAndConditions() {
  return (
    <div className="relative min-h-screen bg-[#05060a] text-white selection:bg-purple-500/30 selection:text-white">
      <CinematicBackground />
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">

        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-300 backdrop-blur-md">
            <FileText size={14} className="text-purple-400" />
            <span>Terms &amp; Conditions</span>
          </div>
        </div>

        <section className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white mb-4">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-white/40">Last updated: September 2026 &middot; Academic Capstone Project</p>
          <p className="mt-4 text-base text-white/55 max-w-2xl mx-auto leading-relaxed">
            Nothing scary here — just a quick rundown of what MoodMate is, what we do with your data,
            and how this whole thing works. Grab a snack.
          </p>
        </section>

        <div className="space-y-4 mb-14">
          {SECTIONS.map((section) => (
            <div key={section.title} className="rounded-2xl border border-white/[0.08] bg-[#0a0b12]/80 p-6 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-white mb-3">{section.title}</h2>
              <p className="text-sm text-white/55 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/" className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-4">
            Back to Home
          </Link>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate Affective Discovery Platform
      </footer>
    </div>
  );
}
