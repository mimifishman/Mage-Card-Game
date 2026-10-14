import { Link } from "wouter";
import { TextPage, type TextSection } from "@/components/TextPage";
import { CONTACT_EMAIL } from "@/lib/contact";

const sections: TextSection[] = [
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
          <strong>New to the game?</strong> Read <Link href="/rules">How to play</Link>.
        </li>
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
    <TextPage title="Support" sections={sections} />
  );
}
