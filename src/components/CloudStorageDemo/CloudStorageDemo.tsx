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

type FileTarget = "file1" | "file2" | "folder" | "sync" | null;

export default function CloudStorageDemo(): JSX.Element {
  const reduced = useReducedMotion();
  const file1Ref = useRef<HTMLDivElement | null>(null);
  const file2Ref = useRef<HTMLDivElement | null>(null);
  const folderRef = useRef<HTMLDivElement | null>(null);
  const syncRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [active, setActive] = useState<{
    file1: boolean;
    file2: boolean;
    folder: boolean;
    sync: boolean;
  }>({
    file1: false,
    file2: false,
    folder: false,
    sync: false,
  });

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorTarget, setCursorTarget] = useState<FileTarget>(null);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    if (reduced) return;

    const moveToElement = (target: FileTarget, ref: React.RefObject<HTMLDivElement>, delay: number) => {
      const id = setTimeout(() => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          setCursorTarget(target);
        }
      }, delay);
      timers.current.push(id);
    };

    const click = (target: FileTarget, delay: number) => {
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
      setActive({ file1: false, file2: false, folder: false, sync: false });
      setCursorTarget(null);

      // Click file1 (select document)
      moveToElement("file1", file1Ref, 600);
      click("file1", 800);
      const unclick1 = setTimeout(() => setActive((s) => ({ ...s, file1: false })), 1600);
      timers.current.push(unclick1);

      // Click folder (open folder)
      moveToElement("folder", folderRef, 2100);
      click("folder", 2300);
      const unclick2 = setTimeout(() => setActive((s) => ({ ...s, folder: false })), 3100);
      timers.current.push(unclick2);

      // Click file2 (upload file)
      moveToElement("file2", file2Ref, 3600);
      click("file2", 3800);
      const unclick3 = setTimeout(() => setActive((s) => ({ ...s, file2: false })), 4600);
      timers.current.push(unclick3);

      // Click sync (sync files)
      moveToElement("sync", syncRef, 5100);
      click("sync", 5300);
      const unclick4 = setTimeout(() => setActive((s) => ({ ...s, sync: false })), 6100);
      timers.current.push(unclick4);

      // Reset and loop
      const resetId = setTimeout(() => {
        setCursorTarget(null);
        setCursorPos({ x: 0, y: 0 });
      }, 6800);
      timers.current.push(resetId);

      const loopId = setTimeout(sequence, 8200);
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
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />

        {/* Top bar with traffic lights */}
        <div className="relative z-10 flex items-center justify-between mb-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
          <div className="text-xs text-white/30 font-semibold tracking-widest">STORAGE</div>
        </div>

        {/* Content area - file list */}
        <div className="relative z-10 rounded-lg bg-gradient-to-br from-slate-900/50 to-slate-950/50 p-6 flex flex-col gap-4 min-h-56">
          {/* File 1 */}
          <motion.div
            ref={file1Ref}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
              active.file1
                ? "bg-amber-500/20 border-amber-400/50 shadow-[0_0_16px_rgba(217,119,6,0.3)]"
                : "bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.08]"
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center bg-amber-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-amber-300">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">project-spec.pdf</p>
              <p className="text-xs text-white/40">2.4 MB</p>
            </div>
            {active.file1 && <motion.div className="absolute inset-0 rounded-lg bg-amber-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
          </motion.div>

          {/* File 2 */}
          <motion.div
            ref={file2Ref}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
              active.file2
                ? "bg-purple-500/20 border-purple-400/50 shadow-[0_0_16px_rgba(147,51,234,0.3)]"
                : "bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.08]"
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center bg-purple-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-purple-300">
                <circle cx="12" cy="13" r="10" />
                <polyline points="12 9 12 13 15 15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">design-assets.zip</p>
              <p className="text-xs text-white/40">18.7 MB</p>
            </div>
            {active.file2 && <motion.div className="absolute inset-0 rounded-lg bg-purple-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
          </motion.div>

          {/* Folder */}
          <motion.div
            ref={folderRef}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
              active.folder
                ? "bg-blue-500/20 border-blue-400/50 shadow-[0_0_16px_rgba(59,130,246,0.3)]"
                : "bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.08]"
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center bg-blue-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-300">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">shared-files</p>
              <p className="text-xs text-white/40">15 items</p>
            </div>
            {active.folder && <motion.div className="absolute inset-0 rounded-lg bg-blue-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
          </motion.div>

          {/* Sync indicator */}
          <motion.div
            ref={syncRef}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
              active.sync
                ? "bg-emerald-500/20 border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.3)]"
                : "bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.08]"
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center bg-emerald-500/20">
              <motion.svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5 text-emerald-300"
                animate={{ rotate: active.sync ? 180 : 0 }}
                transition={{ duration: 0.6 }}
              >
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64M3.51 15A9 9 0 0 0 18.36 18.36" />
              </motion.svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">Synced</p>
              <p className="text-xs text-white/40">All devices</p>
            </div>
            {active.sync && <motion.div className="absolute inset-0 rounded-lg bg-emerald-400" initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} />}
          </motion.div>
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
