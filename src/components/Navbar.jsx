import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Heart, Menu, X, MessageSquare, Compass, LogIn, LogOut } from 'lucide-react';
import { useMood } from '../context/MoodContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { moodProfile, savedItems, user, logoutUser } = useMood();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Clear the local session and return signed-in users to the landing page.
  const handleLogout = () => {
    logoutUser();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-[#05060a]/80 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        
        {/* Brand Logo */}
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 transition-all duration-300 group-hover:scale-105 group-hover:bg-purple-500/25">
            <Sparkles size={18} className="text-purple-400" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Mood<span className="text-purple-400">Mate</span>
          </span>
        </Link>

        {/* Center Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 shadow-inner backdrop-blur-md">
          <Link
            to="/"
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              isActive('/')
                ? 'bg-purple-500/20 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Explore
          </Link>
          <Link
            to="/chat"
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              isActive('/chat')
                ? 'bg-purple-500/20 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <MessageSquare size={13} className="text-purple-400" />
            AI Chatbot
          </Link>
          <Link
            to="/mood-analysis"
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              isActive('/mood-analysis')
                ? 'bg-purple-500/20 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Mood Profile
          </Link>
          <Link
            to="/recommendations"
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              isActive('/recommendations')
                ? 'bg-purple-500/20 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Compass size={13} className="text-purple-400" />
            Discover
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          
          {/* Active Mood Badge Indicator */}
          {moodProfile && (
            <Link
              to="/mood-analysis"
              title="View your current mood analysis"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300 transition-all hover:bg-purple-500/20 hover:border-purple-500/40"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span>{moodProfile.shortName}</span>
            </Link>
          )}

          {/* Saved Items Counter Button */}
          <Link
            to="/recommendations"
            title="Saved in your Watchlist"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <Heart size={16} className={savedItems.length > 0 ? 'text-pink-400 fill-pink-400/20' : ''} />
            {savedItems.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white shadow-md">
                {savedItems.length}
              </span>
            )}
          </Link>

          {/* Primary CTA / Sign In */}
          <button
            onClick={() => navigate('/login')}
            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <LogIn size={14} className="text-purple-400" />
            <span>{user?.isGuest ? 'Sign In' : user?.name || 'Account'}</span>
          </button>

          {user && !user.isGuest && (
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <LogOut size={14} />
              <span>Log out</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 md:hidden hover:text-white"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/[0.08] bg-[#05060a]/95 px-6 py-5 md:hidden"
          >
            <div className="flex flex-col gap-3">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium ${
                  isActive('/') ? 'bg-purple-500/20 text-white' : 'text-white/70'
                }`}
              >
                <span>Home / Overview</span>
              </Link>
              <Link
                to="/chat"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium ${
                  isActive('/chat') ? 'bg-purple-500/20 text-white' : 'text-white/70'
                }`}
              >
                <span>Conversational AI</span>
                <Sparkles size={16} className="text-purple-400" />
              </Link>
              <Link
                to="/mood-analysis"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium ${
                  isActive('/mood-analysis') ? 'bg-purple-500/20 text-white' : 'text-white/70'
                }`}
              >
                <span>Mood Analysis</span>
                {moodProfile && (
                  <span className="text-xs text-purple-300 font-normal">({moodProfile.shortName})</span>
                )}
              </Link>
              <Link
                to="/recommendations"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium ${
                  isActive('/recommendations') ? 'bg-purple-500/20 text-white' : 'text-white/70'
                }`}
              >
                <span>Personalized Recommendations</span>
                <Compass size={16} className="text-purple-400" />
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-500/20"
              >
                <LogIn size={16} />
                <span>{user?.isGuest ? 'Sign In' : 'Account Profile'}</span>
              </Link>
              {user && !user.isGuest && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
