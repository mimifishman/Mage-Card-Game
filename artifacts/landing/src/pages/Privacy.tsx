import { Link } from "wouter";

const CONTACT_EMAIL = "ioedu.org@gmail.com";
const LAST_UPDATED = "October 8, 2026";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Who we are",
    body: (
      <p>
        Mage Card Game (&ldquo;the game&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a
        multiplayer card game for iOS, Android and the web. This policy explains what
        information the game collects, why, and the choices you have. Questions can be sent
        to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    ),
  },
  {
    title: "Information we collect",
    body: (
      <>
        <p>We only collect what the game needs to work:</p>
        <ul>
          <li>
            <strong>Account details.</strong> When you sign in with email, Google or Apple,
            our sign-in provider receives your email address and, if you share it, your
            name. Apple lets you hide your real email address.
          </li>
          <li>
            <strong>Player profile.</strong> We store an internal player ID, the sign-in
            provider&rsquo;s user ID, the display name shown to other players, and the date
            your account was created.
          </li>
          <li>
            <strong>Game data.</strong> Matches you create or join, invite codes, the cards
            and moves played, match results, and timestamps. We keep a log of game actions
            so matches can be resumed and so we can fix bugs and improve the AI opponent.
          </li>
          <li>
            <strong>Technical logs.</strong> Our servers record basic request information
            (such as the time, the requested page and the response status) to keep the
            service running and secure.
          </li>
        </ul>
        <p>
          We do not collect your location, contacts, photos, or payment details, and we do
          not use advertising or tracking tools.
        </p>
      </>
    ),
  },
  {
    title: "How we use it",
    body: (
      <ul>
        <li>To sign you in and keep your account secure.</li>
        <li>To run matches, show your display name to the players you play with, and record results.</li>
        <li>To find and fix problems and to improve gameplay and the AI opponent.</li>
        <li>To reply when you contact us.</li>
      </ul>
    ),
  },
  {
    title: "Google and Apple sign-in",
    body: (
      <p>
        If you choose Google or Apple sign-in, we receive only your basic profile: your
        email address, your name and a unique account ID. We use this only to sign you in
        and to set your display name. Our use of information received from Google APIs
        adheres to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
    ),
  },
  {
    title: "Who we share it with",
    body: (
      <>
        <p>We do not sell or rent your information. We share it only with services that help us run the game:</p>
        <ul>
          <li><strong>Clerk</strong> &mdash; account sign-in and session management.</li>
          <li><strong>Google</strong> and <strong>Apple</strong> &mdash; only if you choose to sign in with them.</li>
          <li><strong>Replit</strong> &mdash; hosting for our servers and database.</li>
        </ul>
        <p>
          Other players in a match can see your display name and your moves in that match.
          We may also disclose information if the law requires it.
        </p>
      </>
    ),
  },
  {
    title: "How long we keep it",
    body: (
      <p>
        We keep your account and game history while your account exists. When you delete
        your account, we delete your profile and remove your personal details from game
        records within 30 days, except where the law requires us to keep something longer.
      </p>
    ),
  },
  {
    title: "Your choices and rights",
    body: (
      <p>
        You can ask to see, correct or delete your information, or delete your account, by
        emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You can also
        remove the game&rsquo;s access from your Google or Apple account settings at any
        time.
      </p>
    ),
  },
  {
    title: "Children",
    body: (
      <p>
        The game is not directed at children under 13, and we do not knowingly collect
        information from them. If you believe a child has given us information, contact us
        and we will delete it.
      </p>
    ),
  },
  {
    title: "Security",
    body: (
      <p>
        Information is sent over encrypted connections (HTTPS). Passwords are handled by our
        sign-in provider and are never stored on our servers.
      </p>
    ),
  },
  {
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we will update this page and the date at the top. For
        significant changes we will let players know in the game.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <div className="noise-bg" />

      <main className="relative z-10 w-full max-w-3xl px-6 py-16 md:py-24">
        <Link href="/" className="font-serif text-sm tracking-[0.2em] uppercase text-primary/70 hover:text-primary">
          &larr; Mage Card Game
        </Link>

        <h1 className="font-serif text-4xl md:text-5xl tracking-wider text-gradient-gold uppercase mt-8 mb-4">
          Privacy Policy
        </h1>
        <p className="font-sans text-foreground/60 mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="font-serif text-2xl text-primary mb-3">{s.title}</h2>
              <div className="font-sans text-lg leading-relaxed text-foreground/85 space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_a]:text-secondary [&_a]:underline [&_strong]:text-foreground [&_strong]:font-semibold">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="w-full py-8 text-center text-foreground/40 font-serif text-sm border-t border-white/5 z-10 mt-auto">
        <p>Mage Card Game &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
