import { Music, Film } from 'lucide-react';

export default function MediaFallback({ title, type }) {
  const isMusic = type === 'music';
  const Icon = isMusic ? Music : Film;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#05060a] via-purple-600/20 to-indigo-700/30 p-6 text-center select-none">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-300 shadow-lg shadow-purple-950/50 backdrop-blur-md">
        <Icon size={28} className={isMusic ? 'text-pink-400' : 'text-purple-300'} />
      </div>
      {title && (
        <span className="mt-3.5 line-clamp-2 px-2 text-xs font-semibold leading-snug text-white/80">
          {title}
        </span>
      )}
    </div>
  );
}
