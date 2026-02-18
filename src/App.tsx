import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useSpring, animated } from "@react-spring/web";
import styled from 'styled-components';
const Threads = lazy(() => import("./components/Threads"));
const SplashCursor = lazy(() => import("./components/SplashCursor"));
import { Logo } from "./components/Logo";
import DecryptedText from "./components/DecryptedText";
import SpringSidebar from "./components/SpringSidebar";
import Loader from "./components/loader";
import SocialLink from "./components/SocialLink";
const LoginPage = lazy(() => import("./components/LoginPage"));
const HomePage = lazy(() => import("./components/HomePage"));
import ProfileAvatar from "./components/ProfileAvatar";
import { useAuth } from "./providers/auth";

const LANDING_SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "features", label: "Features" },
  { id: "anonymous", label: "Anonymous" },
  { id: "start", label: "Get Started" },
];

const StyledButton = styled.button`
  -webkit-tap-highlight-color: transparent;
  -webkit-appearance: button;
  background-color: #000;
  background-image: none;
  color: #fff;
  cursor: pointer;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
  font-size: 100%;
  font-weight: 900;
  line-height: 1.5;
  margin: 0;
  -webkit-mask-image: -webkit-radial-gradient(#000, #fff);
  padding: 0;
  text-transform: uppercase;
  border: 0 solid;
  box-sizing: border-box;
  border-radius: 99rem;
  border-width: 2px;
  overflow: hidden;
  padding: 0.8rem 3rem;
  position: relative;
  transition: transform 0.2s ease;

  &:disabled {
    cursor: default;
  }

  &:-moz-focusring {
    outline: auto;
  }

  svg {
    display: block;
    vertical-align: middle;
  }

  [hidden] {
    display: none;
  }

  span {
    mix-blend-mode: difference;
  }

  &:after,
  &:before {
    background: linear-gradient(
      90deg,
      #fff 25%,
      transparent 0,
      transparent 50%,
      #fff 0,
      #fff 75%,
      transparent 0
    );
    content: "";
    inset: 0;
    position: absolute;
    transform: translateY(var(--progress, 100%));
    transition: transform 0.2s ease;
  }

  &:after {
    --progress: -100%;
    background: linear-gradient(
      90deg,
      transparent 0,
      transparent 25%,
      #fff 0,
      #fff 50%,
      transparent 0,
      transparent 75%,
      #fff 0
    );
    z-index: -1;
  }

  &:hover:after,
  &:hover:before {
    --progress: 0;
  }
`;

/* Rotating SVG icon with scroll-based parallax offset */
function FloatingIcon({
  children,
  top,
  left,
  right,
  size = 48,
  speed = 0.3,
  rotationDuration = 12000,
  opacity = 0.07,
  reverse = false,
}: {
  children: React.ReactNode;
  top: string;
  left?: string;
  right?: string;
  size?: number;
  speed?: number;
  rotationDuration?: number;
  opacity?: number;
  reverse?: boolean;
}) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const container = document.querySelector('.landing-scroll-container');
    if (!container) return;
    const onScroll = () => setScrollY(container.scrollTop);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const spring = useSpring({
    from: { rotate: 0 },
    to: { rotate: reverse ? -360 : 360 },
    loop: true,
    config: { duration: rotationDuration },
  });

  const parallaxY = scrollY * speed;

  return (
    <animated.div
      style={{
        position: 'absolute',
        top,
        left,
        right,
        width: size,
        height: size,
        opacity,
        pointerEvents: 'none' as const,
        zIndex: 15,
        transform: spring.rotate.to(
          (r: number) => `translateY(${parallaxY}px) rotate(${r}deg)`
        ),
        color: '#ffffff',
      }}
    >
      {children}
    </animated.div>
  );
}

/* Phone / Audio call SVG icon */
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/* Video call SVG icon */
const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

/* Microphone SVG icon */
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

/* Headphones SVG icon */
const HeadphonesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

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

/* Slide-in from right section wrapper */
function SlideInRightSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const spring = useSpring({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateX(0px)" : "translateX(100px)",
    config: { tension: 80, friction: 26 },
  });

  return (
    <animated.div ref={ref} style={spring} className={className}>
      {children}
    </animated.div>
  );
}

function App() {
  const { user, session, loading, isAnonymous } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSplashCursor, setShowSplashCursor] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Handle Get Started button - if session exists, don't show login
  const handleGetStarted = () => {
    if (user || session) {
      // User already logged in, the render logic will show HomePage
      return;
    }
    setShowLogin(true);
  };

  // Check for room join code in URL and auto-open login if not authenticated
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    
    // If there's a join code and user is not logged in, show login
    if (joinCode && !user && !loading) {
      setShowLogin(true);
    }
  }, [user, loading]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      setShowSplashCursor(window.innerWidth > 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-black">
        <Loader />
      </div>
    );
  }

  if (showLogin && !user) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-black">
        <Suspense fallback={null}>
          <LoginPage onBack={() => setShowLogin(false)} />
        </Suspense>
      </div>
    );
  }

  // If user is logged in (has session), go straight to Home.
  // This prevents showing the landing/login page on every reload.
  if (user) {
    return (
      <Suspense fallback={null}>
        <HomePage />
      </Suspense>
    );
  }

  // ── Landing page with spring scroll + sidebar ──
  return (
    <div className="w-full min-h-screen relative" style={{ background: '#000000', overflow: 'hidden' }}>
      {/* Background animation: SplashCursor (fluid dynamics) and Threads (animated lines) */}
      <div className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none w-full h-screen">
        {!isMobile && (
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5}}>
            <Suspense fallback={null}>
              {showSplashCursor && <SplashCursor />}
            </Suspense>
          </div>
        )}
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10}}>
          <Suspense fallback={null}>
            <Threads />
          </Suspense>
        </div>
      </div>

      {/* Floating logo top-left */}
      <div className="fixed top-6 left-8 z-40 pointer-events-none">
        <Logo />
      </div>

      {/* Profile avatar top-right - show only for logged-in non-guest users */}
      {user && !isAnonymous && (
        <div className="fixed top-6 right-8 z-40" style={{ pointerEvents: 'auto' }}>
          <ProfileAvatar />
        </div>
      )}

      {/* ── Rotating parallax floating icons ── */}
      <FloatingIcon top="12%" left="8%" size={56} speed={-0.15} rotationDuration={14000} opacity={0.75}>
        <PhoneIcon />
      </FloatingIcon>
      <FloatingIcon top="25%" right="12%" size={44} speed={-0.25} rotationDuration={10000} opacity={0.75} reverse>
        <VideoIcon />
      </FloatingIcon>
      <FloatingIcon top="48%" left="5%" size={38} speed={-0.2} rotationDuration={18000} opacity={0.75}>
        <MicIcon />
      </FloatingIcon>
      <FloatingIcon top="60%" right="7%" size={50} speed={-0.3} rotationDuration={12000} opacity={0.75} reverse>
        <HeadphonesIcon />
      </FloatingIcon>
      <FloatingIcon top="78%" left="15%" size={42} speed={-0.18} rotationDuration={16000} opacity={0.75} reverse>
        <VideoIcon />
      </FloatingIcon>
      <FloatingIcon top="85%" right="18%" size={36} speed={-0.22} rotationDuration={20000} opacity={0.75}>
        <PhoneIcon />
      </FloatingIcon>

      {/* Spring sidebar on right */}
      <SpringSidebar sections={LANDING_SECTIONS} scrollRef={scrollRef} />

      {/* Scrollable sections */}
      <div ref={scrollRef} className="landing-scroll-container">
        {/* ── Hero ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
              <div className="flex items-center justify-center mt-6">
                <StyledButton onClick={handleGetStarted}>
                  <span>Get Started</span>
                </StyledButton>
              </div>
          </FadeSection>
        </section>

        {/* ── Features ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
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
            <div className="landing-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </FadeSection>
        </section>

        {/* ── Anonymous ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
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
            <div className="landing-section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </FadeSection>
        </section>

        {/* ── Get Started (Cloud Storage) ── */}
        <section className="landing-section">
          <FadeSection className="landing-section-content">
            <h2>
              <DecryptedText
                text="User-based Cloud Storage"
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
            <p className="mt-2">
              Your files, your control — secure, private storage synced across devices.
            </p>
            <div className="landing-section-icon">
              <svg height="64px" width="64px" viewBox="0 0 58.21 58.21" fill="#ffffff" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve">
                <g>
                  <g>
                    <path d="M48.077,25.553c0.021-0.304,0.03-0.604,0.03-0.897c0-8.459-6.882-15.341-15.34-15.341 c-6.084,0-11.598,3.611-14.032,9.174c-0.029,0.042-0.123,0.106-0.161,0.117c-3.776,0.395-7.116,2.797-8.713,6.266 c-0.046,0.088-0.227,0.236-0.316,0.263C3.925,26.369,0,31.231,0,36.96c0,6.692,5.341,11.935,12.159,11.935h34.448 c6.397,0,11.603-5.307,11.603-11.83C58.21,31.164,53.783,26.278,48.077,25.553z M46.607,45.894H12.159 C7.023,45.894,3,41.97,3,36.959c0-4.308,2.956-7.966,7.187-8.895c1.001-0.219,1.964-0.996,2.397-1.935 c1.158-2.515,3.573-4.255,6.302-4.54c1.089-0.113,2.151-0.883,2.585-1.873c1.97-4.497,6.403-7.402,11.297-7.402 c6.805,0,12.34,5.536,12.34,12.341c0,0.378-0.021,0.773-0.064,1.176c-0.102,0.951-0.169,1.579,0.334,2.137 c0.284,0.316,0.699,0.501,1.124,0.501c0.028-0.014,0.108-0.004,0.162-0.01c4.718,0.031,8.547,3.878,8.547,8.603 C55.21,41.85,51.27,45.894,46.607,45.894z" />
                  </g>
                </g>
              </svg>
            </div>
          </FadeSection>
        </section>

        {/* Contact section removed per request */}

        {/* ── Footer ── */}
        <SlideInRightSection>
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
                <SocialLink
                  href="https://www.linkedin.com/in/vaibhav-singh-1969a1368/"
                  label="LinkedIn"
                  description="Connect & Network"
                  icon={<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0zM8 8h4.8v2.2h.1c.7-1.3 2.4-2.2 4-2.2 4.3 0 5 2.8 5 6.5V24h-5v-7.5c0-1.8 0-4.1-2.5-4.1S12 15 12 16.5V24H8z"/></svg>}
                />
                <SocialLink
                  href="https://www.instagram.com/vabxic"
                  label="Instagram"
                  description="Follow Story"
                  icon={<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zM12 7.25a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5zm0 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5zM17.5 6.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>}
                />
                <SocialLink
                  href="https://github.com/vabxic"
                  label="GitHub"
                  description="View Code"
                  icon={<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2.2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.7 1.6.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z"/></svg>}
                />
                <SocialLink
                  href="#"
                  label="Twitter / X"
                  description="Latest Updates"
                  icon={<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1h3.7l-8.1 9.3L24 23h-7.5l-5.8-7.6L4.6 23H.8l8.7-9.9L0 1h7.7l5.3 6.9L18.9 1zM17.6 20.8h2L6.5 3.2H4.4l13.2 17.6z"/></svg>}
                />
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
        </SlideInRightSection>
      </div>
    </div>
  );
}

export default App;

