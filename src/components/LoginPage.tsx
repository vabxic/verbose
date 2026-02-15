import React, { useState, useMemo, Suspense, lazy, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useAuth } from '../providers/auth';
import { Logo } from './Logo';
import './LoginPage.css';

const Threads = lazy(() => import('./Threads'));
const SplashCursor = lazy(() => import('./SplashCursor'));

/* Rotating SVG icon with scroll-based parallax offset */
function FloatingIcon({
  children,
  top,
  left,
  right,
  size = 48,
  speed = 0.3,
  rotationDuration = 12000,
  opacity = 0.75,
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
    const container = document.querySelector('.login-page');
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

type AuthMode = 'signin' | 'signup' | 'anonymous' | 'forgot';

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
  general?: string;
}

interface LoginPageProps {
  onBack?: () => void;
  hideGuestTab?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onBack, hideGuestTab }) => {
  const { signIn, signUp, signInGoogle, signInGitHub, signInAsAnonymous, resetPassword, loading } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (mode === 'signin') {
      if (!username) {
        newErrors.username = 'Username is required';
      } else if (username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      }

      if (!password) {
        newErrors.password = 'Password is required';
      }
    }

    if (mode === 'signup') {
      if (!email) {
        newErrors.email = 'Email is required';
      } else if (!validateEmail(email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!password) {
        newErrors.password = 'Password is required';
      } else {
        const passwordError = validatePassword(password);
        if (passwordError) {
          newErrors.password = passwordError;
        }
      }

      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      if (!username) {
        newErrors.username = 'Username is required';
      } else if (username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        newErrors.username = 'Username can only contain letters, numbers, and underscores';
      }
    }

    if (mode === 'forgot') {
      if (!email) {
        newErrors.email = 'Email is required';
      } else if (!validateEmail(email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await signIn(username, password);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await signUp(email, password, username);
      setSuccessMessage('Account created! Please check your email to verify your account.');
      // Reset form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setUsername('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrors({});
    try {
      await signInGoogle();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google';
      setErrors({ general: errorMessage });
      setIsSubmitting(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setIsSubmitting(true);
    setErrors({});
    try {
      await signInGitHub();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with GitHub';
      setErrors({ general: errorMessage });
      setIsSubmitting(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsSubmitting(true);
    setErrors({});
    try {
      await signInAsAnonymous();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to continue as guest';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await resetPassword(email);
      setSuccessMessage('Password reset email sent! Check your inbox.');
      setEmail('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setErrors({});
    setSuccessMessage('');
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  // Memoize the background animation so it doesn't remount on every input change
  const background = useMemo(
    () => (
      isMobile
        ? null
        : (
            <>
              <Suspense fallback={null}>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, pointerEvents: 'none' }}>
                  <SplashCursor />
                </div>
              </Suspense>
              <Suspense fallback={null}>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none' }}>
                  <Threads />
                </div>
              </Suspense>
            </>
          )
    ),
    [isMobile]
  );

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-loading">
          <div className="login-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Background animation */}
      <div className="login-background">{background}</div>

      {/* Rotating parallax floating icons */}
      <FloatingIcon top="10%" left="8%" size={48} speed={-0.15} rotationDuration={14000} opacity={0.4}>
        <PhoneIcon />
      </FloatingIcon>
      <FloatingIcon top="20%" right="10%" size={38} speed={-0.25} rotationDuration={10000} opacity={0.35} reverse>
        <VideoIcon />
      </FloatingIcon>
      <FloatingIcon top="70%" left="5%" size={34} speed={-0.2} rotationDuration={18000} opacity={0.35}>
        <MicIcon />
      </FloatingIcon>
      <FloatingIcon top="75%" right="8%" size={42} speed={-0.3} rotationDuration={12000} opacity={0.4} reverse>
        <HeadphonesIcon />
      </FloatingIcon>

      {/* Login container */}
      <div className="login-container">
        <div className="login-card">
          {/* Back button */}
          {onBack && (
            <button className="login-back-btn" onClick={onBack}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}

          {/* Logo */}
          <div className="login-logo">
            <Logo />
          </div>

          {/* Tab navigation */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => switchMode('signin')}
            >
              Sign In
            </button>
            <button
              className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
            {!hideGuestTab && (
              <button
                className={`login-tab ${mode === 'anonymous' ? 'active' : ''}`}
                onClick={() => switchMode('anonymous')}
              >
                Guest
              </button>
            )}
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="login-success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {successMessage}
            </div>
          )}

          {/* Error message */}
          {errors.general && (
            <div className="login-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {errors.general}
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="login-form">
              <div className="form-group">
                <label htmlFor="signin-username">Username</label>
                <input
                  type="text"
                  id="signin-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className={errors.username ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.username && <span className="field-error">{errors.username}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={errors.password ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.password && <span className="field-error">{errors.password}</span>}
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="login-divider">
                <span>or continue with</span>
              </div>

              <div className="oauth-buttons">
                <button
                  type="button"
                  className="oauth-btn google"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                >
                  <svg viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  className="oauth-btn github"
                  onClick={handleGitHubSignIn}
                  disabled={isSubmitting}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                </button>
              </div>

              <p className="login-switch">
                Don't have an account?{' '}
                <button type="button" onClick={() => switchMode('signup')}>
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="login-form">
              <div className="form-group">
                <label htmlFor="signup-email">Email *</label>
                <input
                  type="email"
                  id="signup-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={errors.email ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="signup-username">Username *</label>
                <input
                  type="text"
                  id="signup-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className={errors.username ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.username && <span className="field-error">{errors.username}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="signup-password">Password *</label>
                <input
                  type="password"
                  id="signup-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className={errors.password ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.password && <span className="field-error">{errors.password}</span>}
                <span className="field-hint">
                  Min 8 chars, with uppercase, lowercase, and number
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="signup-confirm">Confirm Password *</label>
                <input
                  type="password"
                  id="signup-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className={errors.confirmPassword ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>

              <p className="login-switch">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Anonymous / Guest Mode */}
          {mode === 'anonymous' && (
            <div className="login-form anonymous-section">
              <div className="anonymous-info">
                <div className="anonymous-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3>Continue as Guest</h3>
                <p>
                  Try out Verbose without creating an account. Your data will be temporary
                  and some features may be limited.
                </p>
                <ul className="anonymous-features">
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Quick access without registration
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Explore basic features
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Data not saved permanently
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Limited feature access
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="login-submit-btn anonymous-btn"
                onClick={handleAnonymousSignIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Continuing...' : 'Continue as Guest'}
              </button>

              <p className="login-switch">
                Want full access?{' '}
                <button type="button" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </p>
            </div>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="login-form">
              <div className="forgot-password-info">
                <div className="forgot-password-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3>Reset Your Password</h3>
                <p>Enter your email address and we'll send you a link to reset your password.</p>
              </div>

              <div className="form-group">
                <label htmlFor="forgot-email">Email</label>
                <input
                  type="email"
                  id="forgot-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={errors.email ? 'error' : ''}
                  disabled={isSubmitting}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>

              <p className="login-switch">
                Remember your password?{' '}
                <button type="button" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
