// ── wave-x7b ── For Parents & Guardians: twin of Dopps Class parents.html, rewritten for Bedrock (Earth science).
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { allTasks, chapters, realmChapterLabel, realms, ranks, requiredTasks, SIDE_QUESTS_PER_TERM, XP_PER_DAY, XP_PER_SIDE_QUEST, XP_PER_TASK } from "@/data/site";
import { arcadeGames } from "@/data/arcade";
import { Eyebrow, PageHead, SectionHeading } from "@/components/ui";
import { ArtIcon } from "@/components/art-icon";

export const metadata: Metadata = {
  title: "Parents & Guardians",
  description: "What Bedrock is, how XP, mining ranks and realms work, how to help your student at home, and how student data is handled.",
};

// ORION: fill this in. How parents and guardians should reach Mr. Dopp (school email, phone, Schoology message, office hours…).
// While it is null the page shows a clearly marked placeholder instead. Nothing personal is made up here.
const CONTACT: { label: string; value: string; href?: string }[] | null = null;

const requiredCount = realms.reduce((n, r) => n + requiredTasks(r).length, 0);
const bonusCount = allTasks.length - requiredCount;
const classroomGames = arcadeGames.filter((g) => g.section === "classroom").length;

const features = [
  { icon: "📖", title: `${chapters.length} chapters`, text: "Every chapter is written on the site in plain language, with real data, Idaho examples, key words and a Think Like a Scientist challenge." },
  { icon: "🗺️", title: `${realms.length} realms`, text: "The chapters are grouped into nine themed units called realms. Clearing every task in a realm earns its badge and the next mining rank." },
  { icon: "🎮", title: `${arcadeGames.length} games`, text: `Arcade games, partner games and ${classroomGames} whole-class projector games like Bedrock Jeopardy, Earth Escape Room and Myth Busters. No downloads.` },
  { icon: "⛏️", title: "Progress tracker", text: "Students see their XP, rank, badges and every task on their My Quest page, from any device." },
];

const help = [
  { icon: "💬", title: "Ask what realm they're on", text: "\"What are you digging into right now?\" is a great opener. Ask them to explain one idea from their current chapter. If they can teach it, they've learned it." },
  { icon: "🎮", title: "Play a game together", text: "Every arcade game and the vocabulary games are open to anyone, no account needed. Try Myth Busters or Would You Rather on the Arcade page together." },
  { icon: "🔭", title: "Do a side quest together", text: `Students complete ${SIDE_QUESTS_PER_TERM} real-world side quests each term: start a rock collection, track the Moon for a month, test your soil, or find where your tap water comes from. These are great family projects.` },
  { icon: "🫨", title: "Make a family disaster plan", text: "Idaho has real earthquakes (the 1983 Borah Peak quake was magnitude 6.9), wildfires and floods. The Family Disaster Plan and Quake Ready activities walk your family through a plan and a go-bag." },
];

const faqs: [string, string][] = [
  ["Does my student need an account or give personal information?",
    "Chapters, games and vocabulary tools need no account. The quest tracker uses a simple Bedrock login: a first name and last initial, the class period, and a 4-digit PIN the student picks. No email address, phone number or other sensitive information is collected."],
  ["Can my student use the site at home?",
    "Yes. It works in any browser on a phone, tablet, laptop or Chromebook, and it can be installed like an app (look for the Install button on the home page). Progress is saved online, so it follows the student from device to device."],
  ["Why is Earth science taught like a game?",
    "Students remember more when practice is low-stakes and fun. Realms, ranks and badges give students clear goals and a reason to come back, while the reading, quizzes and unit tests cover the same material as a traditional course."],
  ["How do XP and ranks relate to grades?",
    "Grades are set by Mr. Dopp and follow school policy. XP, ranks and the Hall of Champions are there to motivate. Quizzes and unit tests are graded by the site, and the teacher sees the results on the teacher dashboard. Ask Mr. Dopp how assignments are weighted."],
  ["Is the content age-appropriate?",
    "Yes. Bedrock is written for high school Earth science (grades 9–10): minerals and rocks, plate tectonics, earthquakes and volcanoes, oceans, weather and climate, fossils and Earth's history, resources and energy, and astronomy. Topics like climate change and natural hazards are covered with evidence and without scare tactics."],
  ["My student is worried about earthquakes or climate change. What can I do?",
    "That's a common reaction when the science lands. Talk about what your family can control: a disaster plan, a go-bag, and the everyday choices in the Footprint Quest and Home Energy Budget. Knowing what to do is the best cure for worry. You can also reach out to Mr. Dopp or your school counselor."],
  ["I have a concern about something on the site. Who do I contact?",
    "Please contact Mr. Dopp (see the contact box above). The site is built and maintained by the teacher and is updated often, so parent feedback is welcome. There is also a Suggest an Improvement page anyone can use."],
];

const links = [
  { href: "/", icon: "🌍", title: "Student home page", text: "The world map, chapters and arcade" },
  { href: "/chapters/", icon: "📖", title: `All ${chapters.length} chapters`, text: "Read any chapter, no login needed" },
  { href: "/arcade/", icon: "🎮", title: "Arcade", text: "Try the games yourself" },
  { href: "/quest/", icon: "⛏️", title: "My Quest", text: "How the progress tracker works" },
  { href: "/print-quest/", icon: "🖨", title: "Printable Quest Sheet", text: `All ${allTasks.length} tasks on paper` },
  { href: "/realms/4/", icon: "🌋", title: "Realm 4: The Deep", text: "Earthquakes and volcanoes, with Idaho's hazards" },
];

export default function Parents() {
  return (
    <>
      <PageHead eyebrow="For parents & guardians" title={<>Welcome to <span className="text-gradient">Bedrock</span></>}
        sub="What your student is learning in Mr. Dopp's Earth science class, how the course works, and how you can help at home."
        art={{ slug: "hero-earth", fallback: "🌍" }}>
        <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
          <span className="text-3xl">👨‍🏫</span><span><b className="block">Mr. Dopp</b><span className="text-sm text-muted">Earth Science teacher</span></span>
        </div>
      </PageHead>

      <div className="mx-auto max-w-7xl space-y-24 px-6 pt-12">
        <section>
          <SectionHeading eyebrow="About the course" title="What is Bedrock?"
            sub={`Bedrock is a trimester of high school Earth science built like a survival game. Students "land" on a raw planet and work through ${chapters.length} chapters in ${realms.length} realms: reading, vocabulary practice, games, quizzes and a unit test at the end of each realm.`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="block-panel p-5"><div className="text-3xl">{f.icon}</div><h3 className="mt-2 text-lg font-extrabold">{f.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p></div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="How it works" title="XP, mining ranks and realms" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="block-panel p-5">
              <Eyebrow>XP</Eyebrow>
              <ul className="space-y-2 text-sm leading-relaxed">
                <li><b>{XP_PER_TASK} XP</b> for each task: reading a chapter, passing its quiz (80%+), its Think Like a Scientist challenge, and each realm&apos;s unit test (70%+).</li>
                <li><b>{XP_PER_DAY} XP</b> for every day the student logs in.</li>
                <li><b>{XP_PER_SIDE_QUEST} XP</b> for each side quest Mr. Dopp approves ({SIDE_QUESTS_PER_TERM} per term).</li>
                <li>Bonus XP from live class games (+5 per right answer).</li>
              </ul>
            </div>
            <div className="block-panel p-5">
              <Eyebrow>Realms & badges</Eyebrow>
              <p className="text-sm leading-relaxed">Each realm has a task list ({requiredCount} required tasks in all, plus {bonusCount} bonus Classwork tasks). When every required task in a realm is done, the student earns that realm&apos;s badge. Once earned, a badge is never taken away.</p>
            </div>
            <div className="block-panel p-5">
              <Eyebrow>Mining ranks</Eyebrow>
              <p className="text-sm leading-relaxed">Every realm cleared moves the student up one rank: {ranks.map((r) => r.name).join(" → ")}. Clearing all nine realms makes them a <b>Diamond</b>.</p>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Course content" title="The nine realms" sub="The course builds from how scientists think and what Earth is made of, down into the planet, out across the oceans and sky, back through time, and finally out to the stars." />
          <div className="space-y-3">
            {realms.map((r) => (
              <details key={r.n} className="accent-card group rounded-2xl p-4" style={{ "--accent": r.color } as CSSProperties}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <ArtIcon slug={`realm-${r.n}`} fallback={r.icon} size={44} />
                  <span className="min-w-0 flex-1"><b className="block font-display text-lg">Realm {r.n}: {r.name}</b><span className="text-xs text-muted">Chapters {realmChapterLabel(r)} · {r.badge}</span></span>
                  <span className="text-muted transition group-open:rotate-90">▶</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{r.tagline}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {chapters.filter((c) => c.realm === r.n).map((c) => <li key={c.id} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold">Ch {c.label}: {c.title}</li>)}
                </ul>
              </details>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="At home" title="How can I help my student?" sub="Science sticks best when it comes up at the dinner table too. A few easy ways to keep it going:" />
          <div className="grid gap-4 sm:grid-cols-2">
            {help.map((h) => (
              <div key={h.title} className="block-panel flex gap-4 p-5"><span className="text-3xl">{h.icon}</span><div><h3 className="font-extrabold">{h.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted">{h.text}</p></div></div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="block-panel p-6" id="contact">
            <Eyebrow>Contact</Eyebrow>
            <h2 className="font-display text-2xl font-extrabold">Reach Mr. Dopp</h2>
            {CONTACT ? (
              <ul className="mt-3 space-y-1.5">{CONTACT.map((c) => <li key={c.label}><b>{c.label}:</b> {c.href ? <a className="underline" href={c.href}>{c.value}</a> : c.value}</li>)}</ul>
            ) : (
              <div className="mt-3 rounded-xl border-2 border-dashed border-amber/60 bg-amber/10 p-4 text-sm" data-testid="contact-placeholder">
                <b className="text-amber">Contact details coming soon.</b> Mr. Dopp will add the best way to reach him here.
                For now, please use your school&apos;s usual way of contacting teachers.
              </div>
            )}
            <p className="mt-3 text-sm text-muted">Have an idea for the site? Anyone can use <Link href="/suggest/" className="underline">Suggest an Improvement</Link>.</p>
          </div>
          <div className="block-panel p-6">
            <Eyebrow>Privacy & data</Eyebrow>
            <h2 className="font-display text-2xl font-extrabold">What we store</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              <li>The whole site is public. Any parent can read every chapter and play every game without an account.</li>
              <li>The quest tracker uses a Bedrock login: first name and last initial, class period, and a 4-digit PIN the student chooses (stored only as a scrambled hash). It is saved in a secure US-based cloud database (Supabase), not on the device.</li>
              <li>No email, phone number, address or other sensitive information is collected.</li>
              <li>Public boards like the Hall of Champions show only &quot;First L.&quot; names.</li>
              <li>Quiz answer keys are kept in the database and are never shown on the site.</li>
            </ul>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Questions" title="Parents ask us" />
          <div className="space-y-2">
            {faqs.map(([q, a]) => (
              <details key={q} className="block-panel group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">{q}<span className="text-xl text-muted transition group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Explore the site" title="Jump right in" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="accent-card flex items-center gap-4 rounded-2xl p-4" style={{ "--accent": "#f6c453" } as CSSProperties}>
                <span className="text-3xl">{l.icon}</span><span><b className="block">{l.title}</b><span className="text-sm text-muted">{l.text}</span></span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
