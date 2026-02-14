import { Button, Header, Text } from "@jamsr-ui/react";
import Orb from "./components/Orb";
import { Logo } from "./components/Logo";
import DecryptedText from "./components/DecryptedText";
import GooeyNav from "./components/GooeyNav";

function App() {
  return (
    <div>
      <div className="w-full h-[700px] z-0 relative">
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

      <Orb
        hoverIntensity={2}
        rotateOnHover={true}
        hue={0}
        forceHoverState={false}
      />

      <div className="absolute top-0 left-0 flex items-center justify-center flex-col w-full h-full z-1 pointer-events-none text-center">

        <div className="pointer-events-auto flex flex-col items-center">
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
          <div className="flex items-center gap-4 mt-8">
            <Button>Get Started</Button>
            <Button variant="outlined">Learn More</Button>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}

export default App;

