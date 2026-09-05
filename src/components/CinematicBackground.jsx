import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

// 12 art-directed floating poster elements — varied sizes, depths, and positions.
// Arranged across four visual zones: top-left arc, top-right arc, bottom-left arc, bottom-right arc.
// Depth 1 = foreground (most visible), Depth 3 = background (most transparent).
const POSTERS = [
  // ── TOP LEFT ARC ──────────────────────────────
  {
    title: 'Spider-Verse',
    type: 'MOVIE',
    image: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=400&q=70',
    position: 'left-[2%] top-[10%] w-[130px] lg:w-[170px] rotate-[-9deg]',
    depth: 1, delay: 0.1
  },
  {
    title: 'Walter Mitty',
    type: 'MOVIE',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=70',
    position: 'left-[13%] top-[4%] w-[110px] lg:w-[145px] rotate-[5deg]',
    depth: 3, delay: 0.6
  },
  {
    title: 'Starboy',
    type: 'MUSIC',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=70',
    position: 'left-[24%] top-[10%] w-[115px] lg:w-[150px] rotate-[-4deg]',
    depth: 2, delay: 0.4
  },

  // ── TOP RIGHT ARC ─────────────────────────────
  {
    title: 'Your Name',
    type: 'ANIME',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=70',
    position: 'right-[24%] top-[5%] w-[115px] lg:w-[148px] rotate-[6deg]',
    depth: 3, delay: 0.8
  },
  {
    title: 'Stranger Things',
    type: 'SERIES',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=70',
    position: 'right-[13%] top-[8%] w-[125px] lg:w-[162px] rotate-[-7deg]',
    depth: 2, delay: 0.35
  },
  {
    title: 'Demon Slayer',
    type: 'ANIME',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=70',
    position: 'right-[2%] top-[22%] w-[120px] lg:w-[158px] rotate-[10deg]',
    depth: 1, delay: 0.25
  },

  // ── BOTTOM LEFT ARC ───────────────────────────
  {
    title: 'Spirited Away',
    type: 'ANIME',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=70',
    position: 'left-[2%] bottom-[22%] w-[125px] lg:w-[160px] rotate-[7deg]',
    depth: 2, delay: 0.55
  },
  {
    title: 'Inception',
    type: 'MOVIE',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=70',
    position: 'left-[14%] bottom-[10%] w-[110px] lg:w-[148px] rotate-[-5deg]',
    depth: 3, delay: 0.9
  },
  {
    title: 'Ted Lasso',
    type: 'SERIES',
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=70',
    position: 'left-[25%] bottom-[4%] w-[130px] lg:w-[168px] rotate-[-8deg]',
    depth: 1, delay: 0.75
  },

  // ── BOTTOM RIGHT ARC ──────────────────────────
  {
    title: 'Haikyu',
    type: 'ANIME',
    image: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=400&q=70',
    position: 'right-[25%] bottom-[5%] w-[115px] lg:w-[150px] rotate-[4deg]',
    depth: 3, delay: 0.45
  },
  {
    title: 'The Bear',
    type: 'SERIES',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=70',
    position: 'right-[13%] bottom-[8%] w-[128px] lg:w-[166px] rotate-[-9deg]',
    depth: 2, delay: 0.65
  },
  {
    title: 'Coldplay',
    type: 'MUSIC',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=70',
    position: 'right-[2%] bottom-[20%] w-[118px] lg:w-[155px] rotate-[8deg]',
    depth: 1, delay: 0.15
  }
];

// Opacity by depth: foreground = more visible, background = subtle
const DEPTH_OPACITY = { 1: 0.72, 2: 0.50, 3: 0.33 };
// Float amplitude by depth: foreground drifts more
const DEPTH_FLOAT = { 1: 8, 2: 5, 3: 3 };
// Float speed by depth: foreground slightly slower for parallax feel
const DEPTH_SPEED = { 1: 4.8, 2: 5.8, 3: 7.0 };

export default function CinematicBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 40, damping: 28 });
  const smoothY = useSpring(mouseY, { stiffness: 40, damping: 28 });

  const bgX = useTransform(smoothX, [-700, 700], [-20, 20]);
  const bgY = useTransform(smoothY, [-700, 700], [-15, 15]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Base dark fill */}
      <div className="absolute inset-0 bg-[#05060a]" />

      {/* Ambient lighting — three offset spheres */}
      <div className="absolute top-[8%] left-[18%] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-purple-600/8 blur-[170px]" />
      <div className="absolute top-[38%] right-[8%] h-[500px] w-[500px] rounded-full bg-indigo-600/8 blur-[160px]" />
      <div className="absolute bottom-[-5%] left-[40%] h-[500px] w-[650px] -translate-x-1/2 rounded-full bg-fuchsia-600/5 blur-[150px]" />

      {/* Subtle micro grid */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Desktop parallax poster wall — hidden on mobile */}
      <motion.div
        style={{ x: bgX, y: bgY }}
        className="absolute inset-[-40px] hidden md:block"
      >
        {POSTERS.map((poster, i) => {
          const amp = DEPTH_FLOAT[poster.depth];
          const speed = DEPTH_SPEED[poster.depth];
          const opacity = DEPTH_OPACITY[poster.depth];

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{
                opacity,
                scale: 1,
                y: [0, -amp, 0],
              }}
              transition={{
                opacity: { duration: 1.4, delay: poster.delay },
                scale:   { duration: 1.4, delay: poster.delay },
                y: {
                  duration: speed,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: poster.delay,
                },
              }}
              className={`absolute aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.02] shadow-2xl shadow-black/70 ${poster.position}`}
            >
              <img
                src={poster.image}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {/* Subtle darkening overlay */}
              <div className="absolute inset-0 bg-black/25" />
              {/* Bottom gradient for label */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* Label */}
              <div className="absolute bottom-2.5 left-3 right-3">
                <span className="text-[8px] font-bold tracking-widest text-purple-300/60 uppercase">
                  {poster.type}
                </span>
                <p className="mt-0.5 text-[10px] font-semibold text-white/85 truncate">
                  {poster.title}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Center content readability vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,6,10,0.35)_42%,rgba(5,6,10,0.92)_100%)]" />
      {/* Additional center safe zone blur */}
      <div className="absolute left-1/2 top-1/2 h-[580px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#05060a]/70 blur-[100px]" />
    </div>
  );
}
