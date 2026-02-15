import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useSpring, animated } from "@react-spring/web";
import { Button, Text } from "@jamsr-ui/react";
const Threads = lazy(() => import("./components/Threads"));
const SplashCursor = lazy(() => import("./components/SplashCursor"));
import { Logo } from "./components/Logo";
import DecryptedText from "./components/DecryptedText";
import SpringSidebar from "./components/SpringSidebar";
const LoginPage = lazy(() => import("./components/LoginPage"));
const HomePage = lazy(() => import("./components/HomePage"));
import { useAuth } from "./providers/auth";

const LANDING_SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "features", label: "Features" },
  { id: "anonymous", label: "Anonymous" },
  { id: "start", label: "Get Started" },
  { id: "contact", label: "Contact" },
];

/* Fade-in section wrapper with react-spring */
function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const spring = useSpring({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(40px)",
    config: { tension: 180, friction: 22 },
  });

  return (
    <animated.div ref={ref} style={spring} className={className}>
      {children}
    </animated.div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) setShowLogin(false);
  }, [user]);

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (showLogin && !user) {
    return (
      <Suspense fallback={null}>
        <LoginPage onBack={() => setShowLogin(false)} />
      </Suspense>
    );
  }

  if (user) {
    return (
      <Suspense fallback={null}>
        <HomePage />
      </Suspense>
    );
  }

  // ── Landing page with spring scroll + sidebar ──
  return (
    <div className="w-full min-h-screen relative overflow-hidden" style={{ background: '#000000' }}>
      {/* Background animation: SplashCursor (fluid dynamics) and Threads (animated lines) */}
      <div className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none w-full h-screen">
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5}}>
          <Suspense fallback={null}>
            <SplashCursor />
          </Suspense>
        </div>
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10}}>
          <Suspense fallback={null}>
            <Threads
              amplitude={2.2}
              distance={0.1}
              enableMouseInteraction={false}
              color={[1,1,1]}
            />
          </Suspense>
        </div>
      </div>

      {/* Floating logo top-left */}
      <div className="fixed top-6 left-8 z-40 pointer-events-none">
        <Logo />
      </div>

      {/* Spring sidebar on right */}
      <SpringSidebar sections={LANDING_SECTIONS} scrollRef={scrollRef} />

      {/* Scrollable sections */}
      <div ref={scrollRef} className="landing-scroll-container">
        {/* ── Hero ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
            <Text as="h1" variant="h1">
              <DecryptedText
                text="Talk more, with verbose"
                speed={50}
                maxIterations={12}
                sequential
                revealDirection="start"
                animateOn="view"
                parentClassName="hero-title"
                className="hero-char"
                encryptedClassName="hero-encrypted"
              />
            </Text>
            <p style={{ marginTop: "1.5rem", color: "rgba(255,255,255,0.45)", fontSize: "1.1rem" }}>
              The next-gen communication platform — sleek, fast, and private.
            </p>
          </FadeSection>
        </section>

        {/* ── Features ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
            <div className="landing-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2>
              <DecryptedText
                text="Built for Everything"
                speed={50}
                maxIterations={12}
                sequential
                revealDirection="start"
                animateOn="view"
                parentClassName="section-title"
                className="section-char"
                encryptedClassName="section-encrypted"
              />
            </h2>
            <p>
              Text, voice, and video — all in one place. Crystal-clear calls,
              instant messaging, and seamless file sharing with end-to-end encryption.
            </p>
          </FadeSection>
        </section>

        {/* ── Anonymous ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
            <div className="landing-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2>
              <DecryptedText
                text="Stay Anonymous"
                speed={50}
                maxIterations={12}
                sequential
                revealDirection="start"
                animateOn="view"
                parentClassName="section-title"
                className="section-char"
                encryptedClassName="section-encrypted"
              />
            </h2>
            <p>
              Chat and connect without revealing your identity. Your privacy is our priority.
              Enjoy complete anonymity while engaging with the Verbose community.
            </p>
          </FadeSection>
        </section>

        {/* ── Get Started ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
            <div className="landing-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </div>
            <h2>
              <DecryptedText
                text="Ready to Dive In?"
                speed={50}
                maxIterations={12}
                sequential
                revealDirection="start"
                animateOn="view"
                parentClassName="section-title"
                className="section-char"
                encryptedClassName="section-encrypted"
              />
            </h2>
            <p>
              Join thousands of users who are already talking more with Verbose.
            </p>
            <div className="flex items-center justify-center mt-6">
              <Button
                onClick={() => setShowLogin(true)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold rounded-full px-8 py-3 shadow-lg text-base"
              >
                Get Started
              </Button>
            </div>
          </FadeSection>
        </section>

        {/* ── Contact Us ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
            <div className="landing-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2>
              <DecryptedText
                text="Get in Touch"
                speed={50}
                maxIterations={12}
                sequential
                revealDirection="start"
                animateOn="view"
                parentClassName="section-title"
                className="section-char"
                encryptedClassName="section-encrypted"
              />
            </h2>
            <p>
              Have questions or feedback? We'd love to hear from you.
              Connect with our team and help shape the future of Verbose.
            </p>
          </FadeSection>
        </section>
      </div>
    </div>
  );
}

export default App;

