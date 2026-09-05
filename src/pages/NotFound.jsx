import { Link } from 'react-router-dom';
import { Sparkles, Home } from 'lucide-react';
import Navbar from '../components/Navbar';
import CinematicBackground from '../components/CinematicBackground';


export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col justify-between selection:bg-purple-500/30 selection:text-white">
      <CinematicBackground />
      <Navbar />

      <main className="relative z-10 mx-auto flex flex-1 w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/15 text-purple-400 shadow-xl shadow-purple-950/40">
          <Sparkles size={28} />
        </div>

        <h1 className="mt-6 text-6xl font-extrabold tracking-tight text-white sm:text-7xl">
          404
        </h1>

        <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
          Page Not Found
        </h2>

        <p className="mt-3 text-sm text-white/50 leading-relaxed">
          The page or mood state you are looking for has drifted into another emotional dimension.
        </p>

        <div className="mt-8 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-semibold text-black shadow-lg hover:scale-105 active:scale-95 transition"
          >
            <Home size={14} />
            <span>Return to Home</span>
          </Link>

          <Link
            to="/chat"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition"
          >
            <Sparkles size={14} className="text-purple-400" />
            <span>Start Chat</span>
          </Link>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate · Affective Discovery Platform
      </footer>
    </div>
  );
}
