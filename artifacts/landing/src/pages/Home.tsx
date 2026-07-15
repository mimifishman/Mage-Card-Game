import { motion, useScroll, useTransform } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import iconPath from "../../../mobile/assets/images/icon.png";
import appStoreBadge from "../assets/app-store-badge.svg";
import googlePlayBadge from "../assets/google-play-badge.svg";

export default function Home() {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <div className="noise-bg" />

      {/* Hero Section */}
      <section className="relative w-full min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-16 px-6 z-10 overflow-hidden">
        <motion.div 
          className="absolute inset-0 z-0 opacity-20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 2 }}
        >
          <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-secondary/30 blur-[100px] mix-blend-screen" />
          <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] rounded-full bg-primary/20 blur-[80px] mix-blend-screen" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl"
        >
          <motion.div 
            className="w-32 h-32 md:w-48 md:h-48 rounded-3xl overflow-hidden mb-8 border-2 border-primary/40 violet-glow"
            whileHover={{ scale: 1.05, borderColor: "rgba(212, 175, 55, 0.8)" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <img src={iconPath} alt="Mage Card Game Icon" className="w-full h-full object-cover" />
          </motion.div>
          
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-wider text-gradient-gold mb-6 uppercase">
            Mage Card Game
          </h1>
          
          <p className="font-sans text-xl md:text-2xl text-foreground/80 max-w-2xl leading-relaxed">
            Unseal the grimoire. Command the royals. Stand alone.
            <br/>A dark fantasy multiplayer card game.
          </p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-16 animate-bounce text-primary/50"
          >
            <span className="block text-sm tracking-[0.3em] uppercase mb-2 font-serif">Scroll to descend</span>
            <div className="w-[1px] h-12 bg-gradient-to-b from-primary/50 to-transparent mx-auto" />
          </motion.div>
        </motion.div>
      </section>

      {/* How to Play Section */}
      <section className="relative w-full py-24 px-6 z-10 bg-background/50 backdrop-blur-md border-y border-primary/10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <h2 className="font-serif text-3xl md:text-4xl text-primary">The Arcane Arts</h2>
            <div className="w-12 h-[1px] bg-secondary" />
            <ul className="space-y-6 font-sans text-lg md:text-xl text-foreground/90">
              <li className="flex items-start">
                <span className="text-secondary mr-4 font-serif text-2xl">I.</span>
                <span><strong className="text-primary font-normal font-serif tracking-wide">Draw from the Abyss:</strong> Gather standard playing cards infused with dark magic.</span>
              </li>
              <li className="flex items-start">
                <span className="text-secondary mr-4 font-serif text-2xl">II.</span>
                <span><strong className="text-primary font-normal font-serif tracking-wide">Deploy the Court:</strong> Command Kings, Queens, and Jacks as your loyal warriors.</span>
              </li>
              <li className="flex items-start">
                <span className="text-secondary mr-4 font-serif text-2xl">III.</span>
                <span><strong className="text-primary font-normal font-serif tracking-wide">Unleash Destruction:</strong> Attack rival mages with numeric cards and suit-based spells.</span>
              </li>
              <li className="flex items-start">
                <span className="text-secondary mr-4 font-serif text-2xl">IV.</span>
                <span><strong className="text-primary font-normal font-serif tracking-wide">Claim Supremacy:</strong> Survive the onslaught. The last mage breathing takes all.</span>
              </li>
            </ul>
          </motion.div>

          <motion.div 
            style={{ y: y1 }}
            className="relative h-[500px] flex items-center justify-center perspective-[1000px]"
          >
            {/* CSS Mockup of Game Board */}
            <div className="relative w-full max-w-sm aspect-[3/4] bg-card border border-primary/20 rounded-xl shadow-2xl p-6 flex flex-col justify-between transform rotate-y-[-10deg] rotate-x-[5deg] gold-glow">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <div className="flex gap-2">
                  <div className="w-12 h-16 rounded border border-white/10 bg-black/50" />
                  <div className="w-12 h-16 rounded border border-white/10 bg-black/50" />
                  <div className="w-12 h-16 rounded border border-primary/40 bg-black/80 flex items-center justify-center text-primary font-serif">K</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-serif text-destructive">20</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Life</div>
                </div>
              </div>
              
              <div className="flex-1 flex items-center justify-center opacity-30">
                <div className="w-32 h-32 rounded-full border border-secondary/30 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border border-secondary/50 flex items-center justify-center animate-spin-slow">
                    <div className="w-16 h-16 rounded-full bg-secondary/20 blur-md" />
                  </div>
                </div>
              </div>

              <div className="flex gap-[-10px] justify-center relative z-10 pt-4 border-t border-white/5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className="w-16 h-24 bg-[#e2d8c3] rounded border border-[#bfae8a] shadow-lg transform transition-transform hover:-translate-y-4 hover:z-20 flex flex-col items-center justify-center text-black"
                    style={{ transform: `translateX(${(i-3)*10}px) rotate(${(i-3)*5}deg)` }}
                  >
                    <span className={`text-xl font-bold ${i % 2 === 0 ? 'text-red-700' : 'text-black'}`}>
                      {i === 1 ? 'A' : i === 5 ? 'J' : 7 + i}
                    </span>
                    <span className={`text-2xl ${i % 2 === 0 ? 'text-red-700' : 'text-black'}`}>
                      {i % 2 === 0 ? '♥' : '♠'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="absolute -right-8 -bottom-8 w-48 h-64 bg-card border border-secondary/30 rounded-xl shadow-2xl p-4 flex flex-col transform rotate-y-[15deg] rotate-x-[10deg] rotate-[-5deg] violet-glow z-20 hidden md:flex">
              <div className="text-center font-serif text-secondary mb-2 border-b border-secondary/20 pb-2">Spell Stack</div>
              <div className="flex-1 space-y-2 pt-2">
                 <div className="bg-black/60 p-2 rounded text-xs border border-white/5 text-foreground/70"><span className="text-primary">Player 1</span> played 8♠</div>
                 <div className="bg-black/60 p-2 rounded text-xs border border-white/5 text-foreground/70"><span className="text-destructive">Player 2</span> blocked with Q♥</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Get the App Section */}
      <section className="relative w-full py-32 px-6 z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl text-gradient-gold mb-4">Enter the Arena</h2>
          <p className="font-sans text-xl text-foreground/70">The grimoire requires a vessel. Prepare your device.</p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Step 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card/50 backdrop-blur border border-primary/20 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <div className="w-12 h-12 rounded-full border border-primary flex items-center justify-center font-serif text-2xl text-primary mb-6">1</div>
            <h3 className="font-serif text-2xl text-foreground mb-4">Install Expo Go</h3>
            <p className="font-sans text-foreground/60 mb-8">The arcane engine required to run the game.</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center">
              <a 
                href="https://apps.apple.com/app/expo-go/id982107779" 
                target="_blank" 
                rel="noreferrer"
                className="transition-opacity hover:opacity-80 active:opacity-60"
                data-testid="link-app-store"
              >
                <img src={appStoreBadge} alt="Download on the App Store" width={162} height={48} className="h-12 w-auto" />
              </a>
              <a 
                href="https://play.google.com/store/apps/details?id=host.exp.exponent" 
                target="_blank" 
                rel="noreferrer"
                className="transition-opacity hover:opacity-80 active:opacity-60"
                data-testid="link-google-play"
              >
                <img src={googlePlayBadge} alt="Get it on Google Play" width={162} height={48} className="h-12 w-auto" />
              </a>
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-card/50 backdrop-blur border border-secondary/30 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary to-transparent opacity-50" />
            <div className="w-12 h-12 rounded-full border border-secondary flex items-center justify-center font-serif text-2xl text-secondary mb-6">2</div>
            <h3 className="font-serif text-2xl text-foreground mb-4">Scan & Play</h3>
            <p className="font-sans text-foreground/60 mb-8">Open Expo Go and scan this seal, or tap below if on mobile.</p>
            
            <div className="bg-[#f0f0f0] p-4 rounded-xl mb-6 violet-glow transform transition-transform hover:scale-105">
              <QRCodeSVG 
                value="https://mage-card-game.replit.app/mobile/" 
                size={160}
                bgColor="#f0f0f0"
                fgColor="#1a1a1a"
                level="H"
              />
            </div>
            
            <a 
              href="https://mage-card-game.replit.app/mobile/"
              className="text-secondary hover:text-secondary-foreground font-serif tracking-widest text-sm uppercase transition-colors border-b border-secondary/30 hover:border-secondary pb-1"
              data-testid="link-direct-open"
            >
              Tap to open game directly
            </a>
          </motion.div>
        </div>
      </section>

      <footer className="w-full py-8 text-center text-foreground/40 font-serif text-sm border-t border-white/5 z-10 mt-auto">
        <p>Mage Card Game &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
