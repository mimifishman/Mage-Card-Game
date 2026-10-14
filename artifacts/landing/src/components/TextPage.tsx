import { Link } from "wouter";
import { SiteFooter } from "@/components/SiteFooter";

export type TextSection = { id?: string; title: string; body: React.ReactNode };

// Shared, readable typography for the long-text pages (Privacy, Support, Rules):
// a clean sans body at full brightness on a slightly lighter panel.
const bodyClass = [
  "font-sans text-[1.0625rem] md:text-lg leading-8 text-foreground space-y-4",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_li>ul]:mt-2",
  "[&_li::marker]:text-primary",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-white",
  "[&_strong]:text-white [&_strong]:font-semibold",
  "[&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-white [&_h3]:pt-4",
  "[&_table]:w-full [&_table]:text-base [&_table]:border-collapse",
  "[&_th]:text-left [&_th]:font-semibold [&_th]:text-primary [&_th]:border-b [&_th]:border-primary/40 [&_th]:py-2 [&_th]:pr-3",
  "[&_td]:border-b [&_td]:border-white/10 [&_td]:py-2 [&_td]:pr-3",
  "[&_.example]:border-l-4 [&_.example]:border-primary/60 [&_.example]:bg-white/5 [&_.example]:rounded-r-md [&_.example]:py-2 [&_.example]:pl-4 [&_.example]:pr-3 [&_.example]:text-base",
].join(" ");

export function TextPage({
  title,
  intro,
  sections,
  nav = false,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  sections: TextSection[];
  nav?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col items-center">
      <main className="relative z-10 w-full max-w-3xl px-4 sm:px-6 py-12 md:py-20">
        <Link
          href="/"
          className="font-sans text-sm font-semibold tracking-[0.15em] uppercase text-primary hover:text-white"
        >
          &larr; Mage Card Game
        </Link>

        <h1 className="font-display text-4xl md:text-5xl tracking-wide text-gradient-gold mt-6 mb-4">
          {title}
        </h1>
        {intro && <div className="font-sans text-base text-foreground/80 mb-8">{intro}</div>}

        {nav && (
          <nav aria-label="Sections" className="mb-8 flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id ?? s.title}
                href={`#${s.id}`}
                className="font-sans text-sm text-foreground px-3 py-1.5 rounded-full border border-primary/30 bg-white/5 hover:bg-primary/20 hover:text-white"
              >
                {s.title}
              </a>
            ))}
          </nav>
        )}

        <div className="rounded-xl border border-primary/20 bg-card/90 shadow-xl px-5 py-8 sm:px-8 md:px-10 md:py-10 space-y-10">
          {sections.map((s) => (
            <section key={s.id ?? s.title} id={s.id} className="scroll-mt-8">
              <h2 className="font-serif text-2xl md:text-[1.7rem] font-semibold text-primary mb-3">{s.title}</h2>
              <div className={bodyClass}>{s.body}</div>
            </section>
          ))}
        </div>

        {children && (
          <div className="mt-10 font-sans text-lg text-foreground [&_a]:text-primary [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-white">
            {children}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
