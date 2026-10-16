import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Coins, Dices, Flame, Play, Snowflake, Users, X, ZoomIn, type LucideIcon } from "lucide-react";
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
        "relative rounded-[2.5rem] p-[9px] bg-gradient-to-b from-[#76708a] via-[#3d3849] to-[#5d576d] ring-2 ring-primary/80 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9),0_0_45px_-12px_rgba(212,175,55,0.45)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[2rem] aspect-[1320/2868] bg-black ring-1 ring-black">{children}</div>
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

function ScreenGallery() {
  const reduceMotion = useReducedMotion();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [open, setOpen] = useState<number | null>(null);

  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(updateEdges, []);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const step = (dir: 1 | -1) => setOpen((i) => (i === null ? i : (i + dir + SCREENS.length) % SCREENS.length));
  const current = open === null ? null : SCREENS[open];

  const arrowClass =
    "hidden sm:flex absolute top-[38%] -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full border border-primary/50 bg-background/90 text-primary shadow-lg transition hover:bg-primary hover:text-primary-foreground disabled:opacity-0 disabled:pointer-events-none";

  return (
    <div className="relative max-w-6xl mx-auto">
      <button type="button" aria-label="Previous screens" className={cn(arrowClass, "left-2")} onClick={() => scrollByPage(-1)} disabled={edges.start}>
        <ChevronLeft className="w-6 h-6" aria-hidden="true" />
      </button>
      <button type="button" aria-label="More screens" className={cn(arrowClass, "right-2")} onClick={() => scrollByPage(1)} disabled={edges.end}>
        <ChevronRight className="w-6 h-6" aria-hidden="true" />
      </button>

      <motion.ul
        ref={scroller}
        onScroll={updateEdges}
        initial={reduceMotion ? false : { opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7 }}
        className="flex gap-6 lg:gap-8 overflow-x-auto snap-x snap-mandatory scroll-px-4 sm:scroll-px-16 px-4 sm:px-16 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SCREENS.map((s, i) => (
          <li key={s.title} className="snap-start shrink-0 w-[70vw] max-w-[330px] sm:w-[320px] lg:w-[340px]">
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group block w-full rounded-[2.75rem] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              aria-label={`${s.title}: view full size`}
            >
              <div className="rounded-[2.75rem] p-4 sm:p-5 border border-primary/45 bg-[radial-gradient(ellipse_at_50%_0%,#5b4694_0%,#30245a_50%,#1e1734_100%)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] transition-colors group-hover:border-primary">
              <PhoneFrame className="transition-transform duration-300 group-hover:-translate-y-2">
                <img
                  src={s.src}
                  alt={`${s.title}: ${s.text}`}
                  width={960}
                  height={2086}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-sm font-semibold text-primary-foreground bg-primary opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <ZoomIn className="w-4 h-4" aria-hidden="true" /> Zoom
                </span>
              </PhoneFrame>
              </div>
            </button>
            <h3 className="mt-5 font-serif font-semibold text-xl md:text-2xl text-primary text-center">{s.title}</h3>
            <p className="mt-1 font-sans text-base md:text-lg text-foreground text-center leading-snug">{s.text}</p>
          </li>
        ))}
      </motion.ul>
      <p className="mt-4 px-4 text-center font-sans text-base text-foreground/85">
        <span className="sm:hidden">Swipe for more. </span>Tap a screen to see it full size.
      </p>

      <DialogPrimitive.Root open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[#140f1e]/95 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-[61] flex flex-col items-center justify-center gap-4 p-4 outline-none"
            onClick={(e) => e.target === e.currentTarget && setOpen(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") step(1);
              if (e.key === "ArrowLeft") step(-1);
            }}
          >
            {current && (
              <>
                <DialogPrimitive.Title className="sr-only">{current.title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">{current.text}</DialogPrimitive.Description>
                <img
                  src={current.src}
                  alt={`${current.title}: ${current.text}`}
                  width={960}
                  height={2086}
                  className="max-h-[calc(100dvh-8.5rem)] w-auto max-w-full rounded-[2.2rem] border-[8px] border-[#4f495e] ring-2 ring-primary/80 shadow-[0_0_60px_-10px_rgba(212,175,55,0.4)]"
                />
                <div className="flex items-center gap-4">
                  <button type="button" aria-label="Previous screen" onClick={() => step(-1)} className="w-12 h-12 flex items-center justify-center rounded-full border border-primary/50 bg-background text-primary hover:bg-primary hover:text-primary-foreground">
                    <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                  </button>
                  <div className="text-center min-w-[12rem]">
                    <p className="font-serif font-semibold text-xl text-primary">{current.title}</p>
                    <p className="font-sans text-base text-white">{(open ?? 0) + 1} / {SCREENS.length}</p>
                  </div>
                  <button type="button" aria-label="Next screen" onClick={() => step(1)} className="w-12 h-12 flex items-center justify-center rounded-full border border-primary/50 bg-background text-primary hover:bg-primary hover:text-primary-foreground">
                    <ChevronRight className="w-6 h-6" aria-hidden="true" />
                  </button>
                </div>
                <DialogPrimitive.Close className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-background/90 border border-primary/50 text-white hover:bg-primary hover:text-primary-foreground" aria-label="Close">
                  <X className="w-6 h-6" aria-hidden="true" />
                </DialogPrimitive.Close>
              </>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

// Narrated walkthrough of a full game vs Emberlord (files in public/media).
const HOW_TO_PLAY = {
  video: `${import.meta.env.BASE_URL}media/mage-how-to-play.mp4`,
  poster: `${import.meta.env.BASE_URL}media/mage-how-to-play-poster.jpg`,
  captions: `${import.meta.env.BASE_URL}media/mage-how-to-play.en.vtt`,
};

// Start times match the caption file.
const CHAPTERS: { t: number; label: string }[] = [
  { t: 0, label: "Sign in and the Arena" },
  { t: 14, label: "Pick an AI opponent" },
  { t: 25, label: "Diamonds and the Mine" },
  { t: 31, label: "Summon your Royals" },
  { t: 44, label: "Spades make Royals stronger" },
  { t: 60, label: "Attack and your first duel" },
  { t: 125, label: "Clubs hurt, Hearts heal" },
  { t: 199, label: "Block and win a duel" },
  { t: 238, label: "Victory" },
];

const clock = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

function HowToPlayVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [started, setStarted] = useState(false);

  const jump = (t: number) => {
    const video = ref.current;
    if (!video) return;
    video.currentTime = t;
    video.play().catch(() => {});
    video.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-10 lg:gap-14 items-center">
      <PhoneFrame className="mx-auto w-full max-w-[min(360px,calc((80vh_-_18px)*0.4609_+_18px))]">
        <video
          ref={ref}
          className="absolute inset-0 w-full h-full object-cover bg-black"
          poster={HOW_TO_PLAY.poster}
          controls
          playsInline
          preload="metadata"
          width={590}
          height={1280}
          aria-label="How to play Mage Card Game: a narrated full game against the AI mage Emberlord"
          onPlay={() => setStarted(true)}
        >
          <source src={HOW_TO_PLAY.video} type="video/mp4" />
          <track kind="captions" srcLang="en" label="English" src={HOW_TO_PLAY.captions} />
        </video>
        {!started && (
          <button
            type="button"
            onClick={() => ref.current?.play().catch(() => {})}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 text-white transition hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            aria-label="Play the how to play video"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_rgba(212,175,55,0.55)]">
              <Play className="h-9 w-9 translate-x-0.5 fill-current" aria-hidden="true" />
            </span>
            <span className="rounded-full bg-black/70 px-4 py-1.5 font-sans text-base font-semibold">Watch · 4:29</span>
          </button>
        )}
      </PhoneFrame>

      <div>
        <h3 className="font-serif font-bold text-2xl text-white mb-2">Jump to a part</h3>
        <p className="font-sans text-base md:text-lg text-foreground mb-5">
          The video has sound and English captions. Tap a part to start there.
        </p>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
          {CHAPTERS.map((c) => (
            <li key={c.t}>
              <button
                type="button"
                onClick={() => jump(c.t)}
                className="w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-card/80 px-4 py-3 text-left font-sans text-base text-foreground transition hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="shrink-0 w-12 font-semibold tabular-nums text-primary">{clock(c.t)}</span>
                <span>{c.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <Link
          href="/rules"
          className="mt-6 inline-flex items-center justify-center rounded-full border border-primary/60 px-7 py-3 font-sans text-lg font-semibold text-foreground transition hover:bg-primary/15 hover:text-white"
          data-testid="link-video-rules"
        >
          Read the full rules
        </Link>
      </div>
    </div>
  );
}

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
      <section className="relative w-full py-20 md:py-28 z-10 bg-gradient-to-b from-[#1d1530] via-[#181226] to-[#1d1530] border-y border-primary/30">
        <div className="px-4 sm:px-6">
          <SectionHeading
            title="See it in action"
            sub="Real screens from the app. Build your Court, power it with Diamonds, and duel your way to the throne."
          />
        </div>
        <ScreenGallery />
      </section>

      {/* How to play video */}
      <section id="how-to-play" className="relative w-full py-20 md:py-28 px-4 sm:px-6 z-10 scroll-mt-4">
        <SectionHeading
          title="How to play"
          sub="Watch a full game against Emberlord, explained step by step. Learn the cards, the Mine, Royals and duels in under five minutes."
        />
        <HowToPlayVideo />
      </section>

      {/* Suits */}
      <section className="relative w-full py-20 md:py-28 px-4 sm:px-6 z-10 overflow-x-clip">
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
