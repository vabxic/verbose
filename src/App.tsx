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

        {/* Contact section removed per request */}

        {/* ── Footer ── */}
        <footer className="landing-footer">
          <div className="landing-footer-top">
            <div className="footer-cta">
              <h2 className="footer-heading">
                Lets create<br />
                <span className="footer-heading-muted">incredible work together.</span>
              </h2>
            </div>

            <div className="footer-top-right">
              <div className="footer-pill">Vaibhav Singh &nbsp;•••</div>
            </div>
          </div>

          <div className="landing-footer-mid">
            <div className="footer-email-block">
              <span className="footer-label">Email</span>
              <a href="mailto:vaibhavsingh4805@gmail.com" className="footer-email">vaibhavsingh4805@gmail.com</a>
            </div>
            <div className="footer-socials-block">
              <span className="footer-label">Socials</span>
              <div className="footer-social-icons">
                <a href="https://www.linkedin.com/in/vaibhav-singh-1969a1368/" aria-label="LinkedIn" className="footer-social-btn" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0zM8 8h4.8v2.2h.1c.7-1.3 2.4-2.2 4-2.2 4.3 0 5 2.8 5 6.5V24h-5v-7.5c0-1.8 0-4.1-2.5-4.1S12 15 12 16.5V24H8z"/></svg>
                </a>
                <a href="https://www.instagram.com/vabxic" aria-label="Instagram" className="footer-social-btn" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zM12 7.25a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5zm0 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5zM17.5 6.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
                </a>
                <a href="https://github.com/vabxic" aria-label="GitHub" className="footer-social-btn" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2.2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.7 1.6.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z"/></svg>
                </a>
                <a href="#" aria-label="X / Twitter" className="footer-social-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1h3.7l-8.1 9.3L24 23h-7.5l-5.8-7.6L4.6 23H.8l8.7-9.9L0 1h7.7l5.3 6.9L18.9 1zM17.6 20.8h2L6.5 3.2H4.4l13.2 17.6z"/></svg>
                </a>
              </div>
            </div>
          </div>

          <hr className="footer-divider" />

          <div className="landing-footer-nav">
            <nav className="footer-links">
              <a href="#">Home</a>
              <a href="#">Projects</a>
              <a href="#">About</a>
              <a href="#">Contact</a>
            </nav>
          </div>

          <hr className="footer-divider" />

          <div className="landing-footer-bottom">
            <span className="footer-location">Based in <strong>Gwalior, Madhya Pradesh, India</strong></span>
            <span className="footer-copyright">&copy; 2026 Vaibhav Singh</span>
          </div>

          <div className="footer-big-name">Vaibhav Singh</div>
        </footer>
      </div>
    </div>
  );
}

export default App;

