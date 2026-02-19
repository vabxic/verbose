import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

type IconTarget = "mask" | "shield" | "incognito" | null;

export default function StayAnonymousDemo(): JSX.Element {
  const reduced = useReducedMotion();
  const maskBtnRef = useRef<HTMLButtonElement | null>(null);
  const shieldBtnRef = useRef<HTMLButtonElement | null>(null);
  const incognitoBtnRef = useRef<HTMLButtonElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [active, setActive] = useState<{ mask: boolean; shield: boolean; incognito: boolean }>({
    mask: false,
    shield: false,
    incognito: false,
  });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorTarget, setCursorTarget] = useState<IconTarget>(null);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    if (reduced) return;

    const moveToButton = (target: IconTarget, ref: React.RefObject<HTMLButtonElement>, delay: number) => {
      const id = setTimeout(() => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          setCursorTarget(target);
        }
      }, delay);
      timers.current.push(id);
    };

    const click = (target: IconTarget, delay: number) => {
      const id = setTimeout(() => {
        setIsClicking(true);
        const clickId = setTimeout(() => {
          setIsClicking(false);
          setActive((s) => (target ? { ...s, [target]: true } : s));
        }, 150);
        timers.current.push(clickId);
      }, delay);
      timers.current.push(id);
    };

    const sequence = () => {
      setActive({ mask: false, shield: false, incognito: false });
      setCursorTarget(null);

      // Click mask (hide identity)
      moveToButton("mask", maskBtnRef, 600);
      click("mask", 800);
      const unclick1 = setTimeout(() => setActive((s) => ({ ...s, mask: false })), 1600);
      timers.current.push(unclick1);

      // Click shield (privacy protection)
      moveToButton("shield", shieldBtnRef, 2100);
      click("shield", 2300);
      const unclick2 = setTimeout(() => setActive((s) => ({ ...s, shield: false })), 3200);
      timers.current.push(unclick2);

      // Click incognito (browsing mode)
      moveToButton("incognito", incognitoBtnRef, 3700);
      click("incognito", 3900);
      const unclick3 = setTimeout(() => setActive((s) => ({ ...s, incognito: false })), 4900);
      timers.current.push(unclick3);

      // Final mask click
      moveToButton("mask", maskBtnRef, 5500);
      click("mask", 5700);
      const unclick4 = setTimeout(() => setActive((s) => ({ ...s, mask: false })), 6400);
      timers.current.push(unclick4);

      // Reset and loop
      const resetId = setTimeout(() => {
        setCursorTarget(null);
        setCursorPos({ x: 0, y: 0 });
      }, 7100);
      timers.current.push(resetId);

      const loopId = setTimeout(sequence, 8500);
      timers.current.push(loopId);
    };

    sequence();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="w-full max-w-sm">
      <div className="relative rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.12] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden" aria-hidden>
        {/* Decorative top-right glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

        {/* Top bar with traffic lights */}
        <div className="relative z-10 flex items-center justify-between mb-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
          <div className="text-xs text-white/30 font-semibold tracking-widest">PRIVATE</div>
        </div>

        {/* Content area */}
        <div className="relative z-10 rounded-lg bg-gradient-to-br from-slate-900/50 to-slate-950/50 p-4 sm:p-6 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-56 overflow-hidden">
          {/* Icons grid (responsive) */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center w-full">
            {/* Mask icon - hide identity */}
            <motion.button
              ref={maskBtnRef}
              aria-label="Hide identity"
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                active.mask ? "bg-purple-500/20 border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]" : "bg-white/[0.04] border-white/[0.1]"
              }`}
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#ffffff" className={`w-6 h-6 sm:w-8 sm:h-8 transition-colors duration-200 ${active.mask ? "opacity-100" : "opacity-80"}`}>
                <g>
                  <path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 11h2m16.5 0H19m0 0V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5m14 0H5" />
                  <circle cx="7" cy="17" r="3" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  <circle cx="17" cy="17" r="3" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  <path stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 16h4" />
                </g>
              </svg>
              {active.mask && <motion.div className="absolute inset-0 rounded-xl bg-purple-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
            </motion.button>

            {/* Lock & Shield icon - encryption */}
            <motion.button
              ref={shieldBtnRef}
              aria-label="Encryption"
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                active.shield ? "bg-emerald-500/20 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-white/[0.04] border-white/[0.1]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200 ${active.shield ? "text-emerald-300" : "text-white/70"}`}>
                {/* Lock padlock icon */}
                <rect x="5" y="11" width="14" height="8" rx="2" />
                <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                <circle cx="12" cy="15" r="1.5" fill="currentColor" />
              </svg>
              {active.shield && <motion.div className="absolute inset-0 rounded-xl bg-emerald-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
            </motion.button>

            {/* Eye slash icon - private mode */}
            <motion.button
              ref={incognitoBtnRef}
              aria-label="Private mode"
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                active.incognito ? "bg-cyan-500/20 border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]" : "bg-white/[0.04] border-white/[0.1]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200 ${active.incognito ? "text-cyan-300" : "text-white/70"}`}>
                {/* Eye with slash */}
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </svg>
              {active.incognito && <motion.div className="absolute inset-0 rounded-xl bg-cyan-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
            </motion.button>
          </div>

          {/* Caption */}
          <div className="text-xs text-white/40 font-medium tracking-wide">Anonymity • Encrypted • Private</div>
        </div>

        {/* Animated pointer cursor */}
        {!reduced && cursorTarget && (
          <motion.div
            className="pointer-events-none fixed z-50"
            animate={{
              x: cursorPos.x - 8,
              y: cursorPos.y - 8,
            }}
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
          >
            <motion.div
              className="w-4 h-4"
              animate={{
                scale: isClicking ? 0.8 : 1,
              }}
              transition={{ duration: 0.1 }}
            >
              {/* Cursor pointer */}
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white drop-shadow-lg" fill="currentColor">
                <path d="M2.4 2.4L8 16.8l3.6-8.4 8.4-3.6-20.4 0ZM11 11l5 5" stroke="white" strokeWidth="1" fill="none" />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
