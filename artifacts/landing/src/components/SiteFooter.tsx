import { Link } from "wouter";

// One footer for every landing page: readable Inter, full brightness.
export function SiteFooter() {
  return (
    <footer className="w-full py-8 text-center font-sans text-sm text-foreground/75 border-t border-white/10 z-10 mt-auto space-y-3">
      <p className="space-x-6 text-base text-foreground">
        <Link href="/rules" className="hover:text-primary underline-offset-4 hover:underline">How to play</Link>
        <Link href="/support" className="hover:text-primary underline-offset-4 hover:underline">Support</Link>
        <Link href="/privacy" className="hover:text-primary underline-offset-4 hover:underline">Privacy Policy</Link>
      </p>
      <p>Mage Card Game &copy; {new Date().getFullYear()}</p>
    </footer>
  );
}
