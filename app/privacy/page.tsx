import Link from "next/link";
import { PRIVACY_POLICY_VERSION } from "../privacy-policy";

export default function PrivacyPolicyPage() {
  return (
    <main className="privacy-page">
      <article className="privacy-panel ink-panel">
        <header>
          <span>Reader notice // {PRIVACY_POLICY_VERSION}</span>
          <h1>Kokoroe Privacy Policy</h1>
          <p>A plain-language summary for the current development build.</p>
        </header>

        <section>
          <h2>What Kokoroe keeps</h2>
          <p>
            Kokoroe stores account credentials as salted password hashes, your display identity, joined worlds,
            selected avatars, room memberships, messages, and active sessions. Passwords are never stored as plain text.
          </p>
        </section>

        <section>
          <h2>Optional AI bubble styling</h2>
          <p>
            AI styling is off by default. If you opt in at login, an eligible room may send your new line plus a bounded,
            pseudonymized conversation window to OpenRouter. The service may use up to eight recent room messages, or the
            separately disclosed compacted context mode, only to choose an allow-listed bubble presentation. Kokoroe does
            not authorize rewriting your words or generating art through this choice.
          </p>
        </section>

        <section>
          <h2>Your control</h2>
          <p>
            You can use Kokoroe without AI styling. Change the AI-style switch in chat at any time or log out to clear the
            session-scoped choice. A future production policy must add operator contact details, retention periods, hosted
            storage locations, deletion procedures, and jurisdiction-specific rights before public launch.
          </p>
        </section>

        <footer>
          <Link href="/">Return to Kokoroe</Link>
        </footer>
      </article>
    </main>
  );
}
