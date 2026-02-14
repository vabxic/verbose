import { useState, useEffect, lazy, Suspense } from "react";
import { Button, Header, Text } from "@jamsr-ui/react";
const FloatingLines = lazy(() => import("./components/FloatingLines"));
import { Logo } from "./components/Logo";
import DecryptedText from "./components/DecryptedText";
import GooeyNav from "./components/GooeyNav";
const LoginPage = lazy(() => import("./components/LoginPage"));
const HomePage = lazy(() => import("./components/HomePage"));
import { useAuth } from "./providers/auth";

function App() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // Reset showLogin when user becomes authenticated
  useEffect(() => {
    if (user) {
      setShowLogin(false);
    }
  }, [user]);

  // Show loading state
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

  // Show login page when user clicks Get Started
  if (showLogin && !user) {
    return (
      <Suspense fallback={null}>
        <LoginPage onBack={() => setShowLogin(false)} />
      </Suspense>
    );
  }

  // Show homepage if authenticated
  if (user) {
    return (
      <Suspense fallback={null}>
        <HomePage />
      </Suspense>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <div>
      <div className="w-full min-h-screen z-0 relative">
      <div className="relative z-10 pointer-events-auto">
        <Header>
        <Logo />
        <div className="ml-auto flex items-center gap-4">
          <GooeyNav
            items={[
              { label: "Home", href: "#" },
              { label: "Docs", href: "#" },
              { label: "Contact", href: "#" },
            ]}
          />
        </div>
        </Header>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <Suspense fallback={null}>
        <FloatingLines
          enabledWaves={["top", "middle", "bottom"]}
          lineCount={5}
          lineDistance={5}
          bendRadius={5}
          bendStrength={-0.5}
          interactive={true}
          parallax={true}
          mixBlendMode="screen"
        />
        </Suspense>
      </div>

      <div className="absolute top-0 left-0 flex items-center justify-center flex-col w-full h-full z-1 pointer-events-none text-center">

        <div className="pointer-events-auto flex flex-col items-center px-4 sm:px-6">
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
          <div className="flex items-center justify-center mt-8 w-full max-w-2xl mx-auto">
            <div className="w-full sm:w-auto mx-auto">
              <Button 
                onClick={() => setShowLogin(true)}
                className="w-full sm:w-auto mx-auto bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold rounded-full px-6 py-2 shadow-lg"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}

export default App;

