import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * ScrollDownIndicator — bottom-right floating scroll hint.
 *
 * Props:
 *   targetId  – if provided, clicking scrolls the element with that id fully
 *               into view (scrollIntoView block:"start"). Falls back to a
 *               smooth 80 vh scroll when omitted.
 */
export default function ScrollDownIndicator({ targetId }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkScrollable = () => {
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

      const hasOverflow = scrollHeight - clientHeight > 60;
      const isAtTop = scrollTop < 40;

      setIsVisible(hasOverflow && isAtTop);
    };

    checkScrollable();
    const timer = setTimeout(checkScrollable, 300);

    window.addEventListener('scroll', checkScrollable, { passive: true });
    window.addEventListener('resize', checkScrollable, { passive: true });

    const observer = new MutationObserver(checkScrollable);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', checkScrollable);
      window.removeEventListener('resize', checkScrollable);
      observer.disconnect();
    };
  }, []);

  const scrollToContent = () => {
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    // Fallback: scroll 80 % of viewport height
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  };

  return (
    <div
      aria-hidden="true"
      className={`fixed bottom-6 right-6 z-40 pointer-events-none transition-all duration-500 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={scrollToContent}
        className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5
          border border-purple-500/40 bg-[#0a0b12]/85 backdrop-blur-md
          text-purple-300 text-xs font-medium
          shadow-[0_0_18px_3px_rgba(168,85,247,0.35)]
          hover:shadow-[0_0_24px_6px_rgba(168,85,247,0.55)]
          hover:border-purple-400/60 hover:text-purple-200
          transition-all duration-200 focus:outline-none cursor-pointer
          ${isVisible ? 'animate-bounce' : ''}`}
        title="Scroll to explore"
        aria-label="Scroll down"
      >
        <span className="hidden sm:inline tracking-wide">Scroll to explore</span>
        <ChevronDown size={16} className="text-purple-400 shrink-0" />
      </button>
    </div>
  );
}
