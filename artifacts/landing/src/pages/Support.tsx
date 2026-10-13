import { Link } from "wouter";
import { CONTACT_EMAIL } from "@/lib/contact";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Contact us",
    body: (
      <p>
        Questions, problems or ideas? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Tell us your device (iPhone
        or Android), what you did, and what happened.
      </p>
    ),
  },
  {
    title: "Signing in",
    body: (
      <p>
        You can sign in with Apple, Google or email. If a sign-in email does not arrive, check
        your spam folder.
      </p>
    ),
  },
  {
    title: "Playing a match",
    body: (
      <ul>
        <li>
          <strong>Play vs AI:</strong> in the lobby, tap <strong>Play vs AI</strong> and pick
          an opponent.
        </li>
        <li>
          <strong>Play with friends:</strong> tap <strong>Create</strong> and share the invite
          code, or tap <strong>Join</strong> and enter a friend&rsquo;s code.
        </li>
      </ul>
    ),
  },
  {
    title: "Delete your account",
    body: (
      <p>
        In the lobby, tap the settings icon, then <strong>Delete account</strong>. This
        deletes your account and game history and cannot be undone. You can also ask us by
        email. See the <Link href="/privacy">Privacy Policy</Link> for details.
      </p>
    ),
  },
];

export default function Support() {
  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <div className="noise-bg" />

      <main className="relative z-10 w-full max-w-3xl px-6 py-16 md:py-24">
        <Link href="/" className="font-serif text-sm tracking-[0.2em] uppercase text-primary/70 hover:text-primary">
          &larr; Mage Card Game
        </Link>

        <h1 className="font-serif text-4xl md:text-5xl tracking-wider text-gradient-gold uppercase mt-8 mb-12">
          Support
        </h1>

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
