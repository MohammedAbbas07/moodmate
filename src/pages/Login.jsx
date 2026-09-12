import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft, Heart, Film, Headphones, UserCheck, Shield, Loader2 } from 'lucide-react';
import { useMood } from '../context/MoodContext';


function getNicknameFromProfile(email, responseData) {
  // 1. Check response data from backend API
  if (responseData?.nickname) return responseData.nickname;
  if (responseData?.name && !responseData.name.includes('@')) return responseData.name;
  if (responseData?.user?.nickname) return responseData.user.nickname;
  if (responseData?.user?.name && !responseData.user.name.includes('@')) return responseData.user.name;

  // 2. Check localStorage saved user
  try {
    const saved = localStorage.getItem('newMoodMate_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.nickname) return parsed.nickname;
      if (parsed?.name && parsed.name !== 'Guest Explorer' && !parsed.name.includes('@')) {
        return parsed.name;
      }
    }
  } catch {}

  // 3. Check custom profile storage
  try {
    const profile = localStorage.getItem('moodmate_user_profile');
    if (profile) {
      const parsed = JSON.parse(profile);
      if (parsed?.nickname) return parsed.nickname;
      if (parsed?.name && !parsed.name.includes('@')) return parsed.name;
    }
  } catch {}

  // 4. Handle specific user email cases or extract clean name (never full email)
  if (email) {
    const lower = email.toLowerCase();
    if (lower.includes('amazeabbas')) {
      return 'Md Abbas';
    }
    const prefix = email.split('@')[0];
    const cleaned = prefix.replace(/[._\-\d]+/g, ' ').trim();
    if (cleaned) {
      return cleaned
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    return prefix;
  }

  return 'Explorer';
}

export default function Login() {
  const navigate = useNavigate();
  const { loginUser } = useMood();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [loginNickname, setLoginNickname] = useState('Guest');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email && !password) {
      setError('Please provide both email and password to proceed.');
      return;
    }

    if (!email) {
      setError('Please enter your email address to continue.');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password to continue.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      let endpoint;
      if (isSignUp) {
        // Call the signup API to create a new MoodMate account.
        endpoint = 'http://localhost:8000/api/auth/signup';
      } else {
        // Call the login API to authenticate an existing MoodMate account.
        endpoint = 'http://localhost:8000/api/auth/login';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(
          isSignUp && response.status === 400
            ? data.detail || 'Unable to create account'
            : response.status === 401
              ? 'Invalid email or password'
              : data.detail || 'Authentication failed'
        );
        return;
      }

      localStorage.setItem('moodmate_token', data.token);
      localStorage.setItem('moodmate_user_id', String(data.user_id));
      const nickname = getNicknameFromProfile(email, data);
      loginUser({ name: nickname, email, nickname, isGuest: false });
      setLoginNickname(nickname);
      setTransitioning(true);
      setTimeout(() => navigate('/welcome'), 1500);
    } catch {
      setError('Unable to connect to MoodMate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('moodmate_is_guest', 'true');
    loginUser({ name: 'Guest Explorer', isGuest: true });
    setLoginNickname('Guest');
    setTransitioning(true);
    setTimeout(() => navigate('/welcome'), 1500);
  };

  return (
    <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col justify-between overflow-hidden">

      {/* Transition overlay — shown while navigating to Welcome */}
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#05060a]/50 backdrop-blur-md transition-opacity duration-500 ${
          transitioning ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Loader2 size={56} className="animate-spin text-purple-400" />
        <h1 className="mt-8 px-6 text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-center text-white leading-tight max-w-4xl">
          Logging in as{' '}
          <span className="text-gradient-cinematic">{loginNickname}</span>
        </h1>
      </div>

      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[20%] left-[10%] h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[160px]" />
        <div className="absolute bottom-[10%] right-[10%] h-[550px] w-[550px] rounded-full bg-indigo-600/10 blur-[170px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 mx-auto w-full max-w-7xl px-6 py-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-white/50 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          <span>Back to Overview</span>
        </Link>

        <Link to="/" className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          <span className="text-lg font-bold tracking-tight text-white">
            Mood<span className="text-purple-400">Mate</span>
          </span>
        </Link>
      </header>

      {/* Main Split Grid */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          
          {/* Left Column: Vision & Mood Preview */}
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-xs font-medium text-purple-300">
              <Sparkles size={12} />
              <span>Personalized Discovery</span>
            </div>

            <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-white leading-tight">
              Entertainment tuned to your <span className="text-gradient-cinematic">state of mind.</span>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-white/55">
              Your preferences shift with your emotions. Tell MoodMate how you're feeling and discover stories and soundtracks that align perfectly with the moment.
            </p>

            {/* Mood Badges */}
            <div className="mt-8 flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70">
                <Heart size={13} className="text-pink-400" />
                <span>Calm & Peaceful</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70">
                <Film size={13} className="text-purple-400" />
                <span>Reflective</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70">
                <Headphones size={13} className="text-indigo-400" />
                <span>Decompressing</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70">
                <Sparkles size={13} className="text-amber-400" />
                <span>Adventurous</span>
              </div>
            </div>

            {/* Feature Note */}
            <div className="mt-12 flex items-start gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <Shield size={20} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-white">Private & Ephemeral by Design</h4>
                <p className="mt-1 text-xs text-white/45 leading-relaxed">
                  Your emotional check-ins are processed directly to curate media recommendations and stored locally in your browser.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Glass Login Card */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-white/[0.09] bg-[#0a0b12]/90 p-8 sm:p-10 backdrop-blur-2xl shadow-2xl">
              
              {/* Form Heading */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                  {isSignUp ? 'New Account' : 'Welcome Back'}
                </span>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {isSignUp ? 'Create your profile' : 'Sign in to MoodMate'}
                </h2>
                <p className="mt-2 text-xs text-white/50">
                  Save favorite playlists, movie watchlists, and view your emotional history.
                </p>
              </div>

              {/* Form Inputs */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/70">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-purple-500/50 focus:bg-white/[0.05]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-white/70">Password</label>
                    {!isSignUp && (
                      <span className="text-[11px] text-purple-400/80 hover:text-purple-300 cursor-pointer">
                        Forgot?
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••••"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-purple-500/50 focus:bg-white/[0.05]"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:bg-purple-600 active:scale-98"
                >
                  <span>{isLoading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In with Email'}</span>
                  {!isLoading && <ArrowRight size={15} />}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]" />
                </div>
                <span className="relative bg-[#0a0b12] px-3 text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  or jump straight in
                </span>
              </div>

              {/* Guest One-Click Button */}
              <button
                type="button"
                onClick={handleGuestLogin}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.12] bg-white/[0.04] py-3.5 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                <UserCheck size={16} className="text-purple-400" />
                <span>Continue as Guest</span>
              </button>

              {/* Toggle Switch */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-white/40 hover:text-white transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up free"}
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer minimal */}
      <footer className="relative z-10 py-6 text-center text-[11px] text-white/25">
        MoodMate · Affective Multimedia Discovery Engine
      </footer>
    </div>
  );
}
