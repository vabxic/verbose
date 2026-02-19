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

type IconTarget = "chat" | "voice" | "video" | null;

export default function BuiltForEverythingDemo(): JSX.Element {
  const reduced = useReducedMotion();
  const chatBtnRef = useRef<HTMLButtonElement | null>(null);
  const voiceBtnRef = useRef<HTMLButtonElement | null>(null);
  const videoBtnRef = useRef<HTMLButtonElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [active, setActive] = useState<{ chat: boolean; voice: boolean; video: boolean }>({
    chat: false,
    voice: false,
    video: false,
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
      // Reset
      setActive({ chat: false, voice: false, video: false });
      setCursorTarget(null);

      // Move and click chat
      moveToButton("chat", chatBtnRef, 600);
      click("chat", 800);
      const unclick1 = setTimeout(() => setActive((s) => ({ ...s, chat: false })), 1600);
      timers.current.push(unclick1);

      // Move and click voice
      moveToButton("voice", voiceBtnRef, 2000);
      click("voice", 2300);
      const unclick2 = setTimeout(() => setActive((s) => ({ ...s, voice: false })), 3400);
      timers.current.push(unclick2);

      // Move and click video
      moveToButton("video", videoBtnRef, 3900);
      click("video", 4200);
      const unclick3 = setTimeout(() => setActive((s) => ({ ...s, video: false })), 5100);
      timers.current.push(unclick3);

      // Final chat click
      moveToButton("chat", chatBtnRef, 5700);
      click("chat", 5900);
      const unclick4 = setTimeout(() => setActive((s) => ({ ...s, chat: false })), 6600);
      timers.current.push(unclick4);

      // Reset and loop
      const resetId = setTimeout(() => {
        setCursorTarget(null);
        setCursorPos({ x: 0, y: 0 });
      }, 7200);
      timers.current.push(resetId);

      const loopId = setTimeout(sequence, 9000);
      timers.current.push(loopId);
    };

    sequence();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="w-full max-w-sm">
      <div className="relative rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.12] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden" aria-hidden>
        {/* Decorative top-left glow */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />

        {/* Top bar with traffic lights */}
        <div className="relative z-10 flex items-center justify-between mb-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
          <div className="text-xs text-white/30 font-semibold tracking-widest">MESSENGER</div>
        </div>

        {/* Content area */}
        <div className="relative z-10 rounded-lg bg-gradient-to-br from-slate-900/50 to-slate-950/50 p-4 sm:p-6 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-56 overflow-hidden">
          {/* Icons grid (responsive) */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center w-full">
            {/* Chat icon */}
            <motion.button
              ref={chatBtnRef}
              aria-label="Chat"
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                active.chat ? "bg-blue-500/20 border-blue-400/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]" : "bg-white/[0.04] border-white/[0.1]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200 ${active.chat ? "text-blue-300" : "text-white/70"}`}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {active.chat && <motion.div className="absolute inset-0 rounded-xl bg-blue-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
            </motion.button>

            {/* Voice icon */}
            <motion.button
              ref={voiceBtnRef}
              aria-label="Voice"
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                active.voice ? "bg-emerald-500/20 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-white/[0.04] border-white/[0.1]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200 ${active.voice ? "text-emerald-300" : "text-white/70"}`}>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
              {active.voice && <motion.div className="absolute inset-0 rounded-xl bg-emerald-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
            </motion.button>

            {/* Video icon */}
            <motion.button
              ref={videoBtnRef}
              aria-label="Video"
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                active.video ? "bg-sky-500/20 border-sky-400/50 shadow-[0_0_20px_rgba(14,165,233,0.3)]" : "bg-white/[0.04] border-white/[0.1]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200 ${active.video ? "text-sky-300" : "text-white/70"}`}>
                <rect x="2" y="5" width="15" height="14" rx="2" ry="2" />
                <polygon points="23 7 16 12 23 17 23 7" fill="currentColor" />
              </svg>
              {active.video && <motion.div className="absolute inset-0 rounded-xl bg-sky-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
            </motion.button>
          </div>

          {/* Caption */}
          <div className="text-xs text-white/40 font-medium tracking-wide">Text • Voice • Video </div>
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
