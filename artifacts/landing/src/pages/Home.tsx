import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { Coins, Dices, Flame, Snowflake, Users, type LucideIcon } from "lucide-react";
import { APP_STORE_LIVE, APP_STORE_URL } from "@/lib/stores";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";
import gameplayVideo from "../assets/media/gameplay.mp4";
import gameplayPoster from "../assets/media/gameplay-poster.webp";
import boardShot from "../assets/media/board.webp";
import cardActionsShot from "../assets/media/card-actions.webp";
import duelShot from "../assets/media/duel.webp";
import opponentsShot from "../assets/media/opponents.webp";
import lobbyShot from "../assets/media/lobby.webp";
import appStoreBadge from "../assets/app-store-badge.svg";
import googlePlayBadge from "../assets/google-play-badge.svg";

type Suit = "♦" | "♥" | "♠" | "♣";

const SCREENS = [
  { src: boardShot, title: "Summon your Court", text: "Kings, Queens and Jacks fight for you." },
  { src: cardActionsShot, title: "Fill the Mine", text: "Turn Diamonds into energy for every spell." },
  { src: duelShot, title: "Duel rival mages", text: "Blocks become duels. One more card can swing it." },
  { src: opponentsShot, title: "Battle AI mages", text: "Four rivals, each with their own style." },
  { src: lobbyShot, title: "Play with friends", text: "Create a match and share the code." },
];

// Effects mirror the Rules page (src/pages/Rules.tsx).
const SUITS: { suit: Suit; name: string; role: string; text: string }[] = [
  { suit: "♦", name: "Diamonds", role: "Energy", text: "Free to play. Feed the Mine to power every spell." },
  { suit: "♥", name: "Hearts", role: "Healing", text: "Heal any mage, or shield a Royal." },
  { suit: "♠", name: "Spades", role: "Power", text: "Power up a Royal, or pull a card back from the Abyss." },
  { suit: "♣", name: "Clubs", role: "Damage", text: "Strike a mage, or weaken an enemy Royal." },
];

// Same names, blurbs and colours as artifacts/mobile/constants/botPersonas.ts.
const RIVALS: { name: string; text: string; color: string; Icon: LucideIcon }[] = [
  { name: "Emberlord", text: "Relentless attacker. Races you down.", color: "#E5484D", Icon: Flame },
  { name: "Frostweaver", text: "Defensive tactician. Destroys your board and grinds you out.", color: "#4C9EE8", Icon: Snowflake },
  { name: "Gildspinner", text: "Unpredictable hoarder. Plays the long game.", color: "#C89B3C", Icon: Coins },
  { name: "Fatecaller", text: "A random mage each match. Rematches reshuffle.", color: "#B67AD0", Icon: Dices },
];

const isRed = (suit: Suit) => suit === "♦" || suit === "♥";

function PlayingCard({ suit, rank = "A", className }: { suit: Suit; rank?: string; className?: string }) {
  const color = isRed(suit) ? "text-[#b3261e]" : "text-[#1b1820]";
  return (
    <div
      className={cn(
        "relative aspect-[5/7] rounded-xl bg-[#f4ecd8] border border-[#c9b27a] shadow-[0_12px_30px_-8px_rgba(0,0,0,0.7)] select-none",
        color,
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute top-[6%] left-[9%] flex flex-col items-center leading-none font-serif font-bold">
        <span className="text-[1em]">{rank}</span>
        <span className="text-[0.9em]">{suit}</span>
      </div>
      <div className="absolute bottom-[6%] right-[9%] flex flex-col items-center leading-none font-serif font-bold rotate-180">
        <span className="text-[1em]">{rank}</span>
        <span className="text-[0.9em]">{suit}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center text-[2.6em]">{suit}</div>
    </div>
  );
}

function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-[2.4rem] bg-[#0b0a10] p-[7px] ring-1 ring-primary/40 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[2rem] aspect-[1320/2868] bg-black">{children}</div>
    </div>
  );
}

function GameplayVideo() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);

  // Autoplay only when the visitor allows motion; otherwise show the poster
  // with controls so they can start it themselves.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    if (reduceMotion) video.pause();
    else video.play().catch(() => {});
  }, [reduceMotion]);

  return (
    <video
      ref={ref}
      className="absolute inset-0 w-full h-full object-cover"
      src={gameplayVideo}
      poster={gameplayPoster}
      width={600}
      height={1300}
      muted
      loop
      playsInline
      preload={reduceMotion ? "none" : "auto"}
      controls={!!reduceMotion}
      aria-label="Gameplay: summoning Royals, attacking and a duel against the AI mage Emberlord"
    />
  );
}

const FLOATERS: { suit: Suit; rank: string; pos: string; rotate: number; delay: number }[] = [
  { suit: "♥", rank: "Q", pos: "-left-10 sm:-left-20 top-[8%]", rotate: -14, delay: 0 },
  { suit: "♠", rank: "K", pos: "-right-10 sm:-right-20 top-[22%]", rotate: 12, delay: 0.8 },
  { suit: "♦", rank: "7", pos: "-left-8 sm:-left-16 bottom-[14%]", rotate: 10, delay: 1.6 },
  { suit: "♣", rank: "J", pos: "-right-8 sm:-right-16 bottom-[4%]", rotate: -8, delay: 2.4 },
];

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="max-w-3xl mx-auto text-center mb-12 md:mb-14">
      <h2 className="font-serif font-bold text-3xl md:text-5xl text-gradient-gold mb-4">{title}</h2>
      {sub && <p className="font-sans text-lg md:text-xl text-foreground leading-relaxed">{sub}</p>}
    </div>
  );
}

export default function Home() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <div className="noise-bg" />

      {/* Hero */}
      <section className="relative w-full px-4 sm:px-6 pt-14 md:pt-20 pb-20 md:pb-28 z-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[10%] left-[5%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full bg-secondary/25 blur-[110px]" />
          <div className="absolute bottom-[5%] right-[5%] w-[40vw] h-[40vw] max-w-[520px] max-h-[520px] rounded-full bg-primary/15 blur-[100px]" />
        </div>

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-14 lg:gap-10 items-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <h1 className="font-display font-bold text-5xl sm:text-6xl xl:text-7xl leading-[1.05] tracking-wide text-gradient-gold mb-6">
              Mage Card Game
            </h1>
            <p className="font-sans text-xl md:text-2xl font-semibold text-foreground mb-4">
              Summon Royals. Fill the Mine. Duel rival mages.
            </p>
            <p className="font-sans text-lg md:text-xl text-foreground/90 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              A dark fantasy card battle you play with a normal deck of cards and a lot of
              magic. Face your friends online, or take on four cunning AI mages.
            </p>

            <ul className="flex flex-wrap justify-center lg:justify-start gap-2 mb-9 font-sans text-base font-medium text-foreground">
              {["2–4 players", "Online multiplayer", "Solo vs AI"].map((tag) => (
                <li key={tag} className="px-4 py-1.5 rounded-full border border-primary/35 bg-white/5">
                  {tag}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <a
                href="#download"
                className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3.5 font-sans text-lg font-semibold text-primary-foreground shadow-[0_0_30px_rgba(212,175,55,0.35)] transition hover:brightness-110 active:brightness-95"
                data-testid="link-hero-download"
              >
                Get the app
              </a>
              <Link
                href="/rules"
                className="inline-flex items-center justify-center rounded-full border border-primary/60 px-8 py-3.5 font-sans text-lg font-semibold text-foreground transition hover:bg-primary/15 hover:text-white"
                data-testid="link-hero-rules"
              >
                How to play
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 40, rotate: 3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="relative mx-auto w-[min(68vw,290px)]"
          >
            {FLOATERS.map((f) => (
              <motion.div
                key={f.suit}
                className={cn("absolute z-20 w-14 sm:w-[4.5rem] text-[1rem] sm:text-[1.15rem]", f.pos)}
                style={{ rotate: f.rotate }}
                animate={reduceMotion ? undefined : { y: [0, -14, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: f.delay }}
              >
                <PlayingCard suit={f.suit} rank={f.rank} />
              </motion.div>
            ))}
            <div className="absolute -inset-6 rounded-[3rem] bg-secondary/30 blur-3xl" aria-hidden="true" />
            <PhoneFrame className="relative z-10">
              <GameplayVideo />
            </PhoneFrame>
          </motion.div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="relative w-full py-20 md:py-28 z-10 bg-black/20 border-y border-primary/15">
        <div className="px-4 sm:px-6">
          <SectionHeading
            title="See it in action"
            sub="Real screens from the app. Build your Court, power it with Diamonds, and duel your way to the throne."
          />
        </div>

        <div className="max-w-6xl mx-auto">
          <ul className="flex lg:grid lg:grid-cols-5 gap-5 lg:gap-6 overflow-x-auto lg:overflow-visible snap-x snap-mandatory px-4 sm:px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SCREENS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={reduceMotion ? false : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="snap-center shrink-0 w-[62vw] max-w-[250px] sm:w-[220px] lg:w-auto lg:max-w-none"
              >
                <PhoneFrame className="transition-transform duration-300 hover:-translate-y-2">
                  <img
                    src={s.src}
                    alt={`${s.title}: ${s.text}`}
                    width={640}
                    height={1391}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </PhoneFrame>
                <h3 className="mt-5 font-serif font-semibold text-xl text-primary text-center">{s.title}</h3>
                <p className="mt-1 font-sans text-base text-foreground text-center leading-snug">{s.text}</p>
              </motion.li>
            ))}
          </ul>
          <p className="lg:hidden mt-2 text-center font-sans text-base text-foreground/80" aria-hidden="true">
            Swipe to see more &rarr;
          </p>
        </div>
      </section>

      {/* Suits */}
      <section className="relative w-full py-20 md:py-28 px-4 sm:px-6 z-10">
        <SectionHeading
          title="Four suits of magic"
          sub="Every card is a spell. What it does depends on its suit."
        />

        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {SUITS.map((s, i) => (
            <motion.div
              key={s.suit}
              initial={reduceMotion ? false : { opacity: 0, y: 60, rotate: (i - 1.5) * 12 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ type: "spring", stiffness: 120, damping: 14, delay: i * 0.12 }}
              className="group flex flex-col items-center text-center rounded-2xl border border-primary/25 bg-card/80 px-3 py-6 sm:px-5"
            >
              <motion.div
                whileHover={reduceMotion ? undefined : { y: -10, rotate: i % 2 ? 6 : -6, scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="w-24 sm:w-28 text-[1.1rem] sm:text-[1.3rem] mb-5"
              >
                <PlayingCard suit={s.suit} />
              </motion.div>
              <h3 className="font-serif font-bold text-xl md:text-2xl text-white">
                <span className={isRed(s.suit) ? "text-[#ff6b5e]" : "text-primary"}>{s.suit}</span> {s.name}
              </h3>
              <p className="mt-1 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-primary">{s.role}</p>
              <p className="mt-3 font-sans text-base text-foreground leading-snug">{s.text}</p>
            </motion.div>
          ))}
        </div>

        <p className="max-w-2xl mx-auto mt-10 text-center font-sans text-lg text-foreground">
          And two <strong className="text-white">Jokers</strong> lurk in the deck: destroy any Royal,
          or blast a mage for 10 damage.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/rules"
            className="inline-flex items-center justify-center rounded-full border border-primary/60 px-8 py-3.5 font-sans text-lg font-semibold text-foreground transition hover:bg-primary/15 hover:text-white"
            data-testid="link-rules"
          >
            Read the full rules
          </Link>
        </div>
      </section>

      {/* Rivals */}
      <section className="relative w-full py-20 md:py-28 px-4 sm:px-6 z-10 bg-black/20 border-y border-primary/15">
        <SectionHeading title="Choose your rival" sub="Play solo against four AI mages. Each one fights differently." />

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {RIVALS.map(({ name, text, color, Icon }, i) => (
            <motion.div
              key={name}
              initial={reduceMotion ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={reduceMotion ? undefined : { y: -6 }}
              className="flex items-start gap-4 sm:flex-col sm:items-center sm:text-center rounded-2xl border bg-card/80 p-5 sm:p-6"
              style={{ borderColor: `${color}66`, boxShadow: `0 0 30px -12px ${color}` }}
            >
              <div
                className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${color}26`, color }}
              >
                <Icon className="w-7 h-7" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl md:text-2xl" style={{ color }}>
                  {name}
                </h3>
                <p className="mt-1 sm:mt-2 font-sans text-base text-foreground leading-snug">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto mt-10 flex items-center justify-center gap-3 text-center font-sans text-lg text-foreground">
          <Users className="hidden sm:block w-6 h-6 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Rather face real mages? <strong className="text-white">Create</strong> a match, share
            the code, and up to 4 players can join.
          </p>
        </div>
      </section>

      {/* Download */}
      <section id="download" className="relative w-full py-20 md:py-28 px-4 sm:px-6 z-10 scroll-mt-4">
        <SectionHeading title="Enter the Arena" sub="Bind the grimoire to your device and take your seat at the table." />

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-card/80 border border-primary/30 rounded-2xl p-8 md:p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-6">
            <div className="flex flex-col items-center text-center">
              <h3 className="font-serif font-bold text-2xl text-white mb-2">iPhone</h3>
              {APP_STORE_LIVE ? (
                <>
                  <p className="font-sans text-lg text-foreground mb-6">The seal is broken. Claim it now.</p>
                  <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-opacity hover:opacity-80 active:opacity-60"
                    data-testid="link-app-store"
                  >
                    <img src={appStoreBadge} alt="Download on the App Store" width={162} height={48} className="h-12 w-auto" />
                  </a>
                </>
              ) : (
                <>
                  <p className="font-sans text-lg text-foreground mb-6">Awaiting the gatekeepers' blessing.</p>
                  <img src={appStoreBadge} alt="" aria-hidden="true" width={162} height={48} className="h-12 w-auto opacity-50 grayscale" />
                  <span className="mt-4 font-sans font-semibold tracking-[0.12em] text-base uppercase text-primary" data-testid="text-app-store-soon">
                    Coming soon
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col items-center text-center">
              <h3 className="font-serif font-bold text-2xl text-white mb-2">Android</h3>
              <p className="font-sans text-lg text-foreground mb-6">The ritual is still being prepared.</p>
              <img src={googlePlayBadge} alt="" aria-hidden="true" width={162} height={48} className="h-12 w-auto opacity-50 grayscale" />
              <span className="mt-4 font-sans font-semibold tracking-[0.12em] text-base uppercase text-[#c9a2f0]" data-testid="text-google-play-soon">
                Coming soon
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      <SiteFooter />
    </div>
  );
}
