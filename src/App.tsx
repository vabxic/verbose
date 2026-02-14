import { Button, Header, Text } from "@jamsr-ui/react";
import FloatingLines from "./components/FloatingLines";
import { Logo } from "./components/Logo";
import DecryptedText from "./components/DecryptedText";
import GooeyNav from "./components/GooeyNav";

function App() {
  return (
    <div>
      <div className="w-full lg:h-[700px] md:h-[520px] h-[420px] z-0 relative">
      <div className="relative z-10 pointer-events-auto">
        <Header>
        <Logo />
        <div className="ml-auto">
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
              <Button className="w-full sm:w-auto mx-auto bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold rounded-full px-6 py-2 shadow-lg">Get Started</Button>
            </div>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}

export default App;

