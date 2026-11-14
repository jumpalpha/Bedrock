import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { AskBox } from "./ask-box";

// ── wave-live ── Ask Mr. Dopp: anonymous questions; the teacher answers in the dashboard (twin of Dopps Class ask.html)
export const metadata: Metadata = { title: "Ask Mr. Dopp", description: "Ask an Earth science question anonymously. Mr. Dopp may answer it in class or post the answer for everyone." };

export default function AskPage() {
  return (
    <>
      <PageHead eyebrow="Anonymous" title="Ask Mr. Dopp" art={{ slug: "ask-dopp", fallback: "🙋" }}
        sub="Got an Earth science question you don't want to ask out loud? Ask it here. Mr. Dopp may answer it in class or post the answer below for everyone.">
        <div className="mt-5 inline-flex rounded-full border border-emerald/45 bg-emerald/10 px-4 py-2 text-sm font-extrabold text-emerald">🔒 100% anonymous: your name is never saved with your question</div>
      </PageHead>
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <AskBox />
        <div className="mt-6 rounded-2xl border border-crimson/40 bg-crimson/5 p-4 text-sm leading-relaxed" role="note">
          <b className="text-crimson">Need help now?</b> This box is anonymous, so Mr. Dopp <b>can&apos;t reply to you</b> or know who needs help.
          If you or someone you know is hurting, unsafe, or thinking about suicide, talk to a trusted adult or a school counselor today,
          or call or text <a className="font-extrabold text-crimson underline" href="tel:988">988</a> (Suicide &amp; Crisis Lifeline, 24/7). In an emergency, call <a className="font-extrabold text-crimson underline" href="tel:911">911</a>.
        </div>
      </div>
    </>
  );
}
