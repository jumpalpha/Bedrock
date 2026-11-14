// ── wave-twinA ── Hazard PSA Challenge: twin of Dopps Class psa_challenge.html (group PSA video project).
import type { Metadata } from "next";
import Link from "next/link";
import { Box, Callout, Card, Chips, Closing, PROJECT_CSS, ProjectHero, Rules, Toc, Two } from "@/components/twinA/project-page";
import { PrintButton } from "@/components/twinA/print-button";
import { PsaReflection, PsaSubmit } from "./psa-forms";
import { HAZARDS, RUBRIC } from "./psa-data";

export const metadata: Metadata = {
  title: "Hazard PSA Challenge",
  description: "Group project: make a 60–120 second public service announcement about a natural hazard, with real agency facts, one class period to film and one week to edit.",
};

/** Optional extras for Orion: a Google Form for uploading the MP4 itself, and a playlist of past class PSAs. Empty = hidden. */
const UPLOAD_FORM_URL = "";
const PAST_PSAS_URL = "";

const toc: [string, string][] = [["what", "What's a PSA?"], ["group", "Group"], ["concept", "Concept"], ["script", "Script"], ["location", "Location"], ["ready", "Ready?"],
  ["film", "Filming Day"], ["ai", "Audio & AI"], ["edit", "Editing"], ["submit", "Submit"], ["grade", "Grading"], ["festival", "Festival"]];

const Past = () => PAST_PSAS_URL ? (
  <p className="no-print mt-5"><a className="btn-block btn-grass" href={PAST_PSAS_URL} target="_blank" rel="noopener noreferrer">▶ Watch past class PSAs</a></p>
) : null;

export default function HazardPsa() {
  return (
    <>
      <style>{PROJECT_CSS}</style>
      <ProjectHero badge="GROUP PROJECT · SIDE QUEST" title="Hazard PSA Challenge"
        tagline={["A Serious Hazard.", "A Ridiculous Delivery.", "Or Anything In Between!"]}
        motto="One class period to film. One week to edit. Everyone participates. Everyone appears. Nobody gets left out.">
        <Past />
      </ProjectHero>
      <div className="mx-auto max-w-[860px] px-4 pb-16">
        <Toc items={toc} />

        <Card id="what" n={1} accent="#f25c45" title="What's a PSA?">
          <p>A <b>Public Service Announcement</b> is a short video that tells people something important for their safety, and tries to get them to <b>do</b> something about it. Yours is about a <b>natural hazard</b>: what causes it, why it matters here, and the one thing people should do.</p>
          <p>Your PSA can be serious, emotional, inspiring, hilarious, absurd or completely ridiculous. Two musts: <b>people have to understand your message</b>, and <b>your safety facts have to be real</b> (from an agency like USGS, the National Weather Service, Ready.gov or FEMA).</p>
          <Two>
            <Box title="😐 Serious version">A quiet mini-documentary about the 1983 Borah Peak earthquake: the fault scarp, what happened in Challis, and the three words that keep you safe: Drop, Cover, and Hold On.</Box>
            <Box title="🦖 Ridiculous version">A nature show where a narrator whispers about the rare &ldquo;Doorway Stander&rdquo; who keeps getting bonked by falling stuff, until a classmate teaches it Drop, Cover, and Hold On.</Box>
          </Two>
          <p className="!mt-2.5"><b>Topic ideas:</b></p>
          <Chips items={HAZARDS.map((h) => (h === "Our own hazard idea" ? "Your own hazard idea" : h))} />
        </Card>

        <Card id="group" n={2} accent="#a78bfa" title="Form Your Group: Nobody Left Behind">
          <p>Everyone is in a production group. Mr. Dopp sets the group size and approves every group.</p>
          <ul><li>Pick a <b>group name</b> and a <b>production leader</b>.</li><li>Give every member a role. You can have more than one.</li></ul>
          <Chips items={["Director", "Producer", "Scriptwriter", "Science fact-checker", "Actor", "Cinematographer", "Audio specialist", "Editor", "Props manager", "Production coordinator"]} />
          <Callout>🎥 EVERY member must appear on camera with their real face clearly visible. Voice-only, an AI-generated face, or working only behind the camera does <u>not</u> count.</Callout>
        </Card>

        <Card id="concept" n={3} accent="#38bdf8" title="Build Your Concept">
          <p>Before you write anything, your group decides:</p>
          <ol>
            <li><b>Title</b> of your PSA</li>
            <li><b>Hazard</b>: which one, and what Earth process causes it?</li>
            <li><b>Target audience</b>: who needs to hear this?</li>
            <li><b>Central message</b>: one sentence</li>
            <li><b>Your source</b>: the agency page your safety facts come from</li>
            <li><b>Audience reaction</b>: laugh? think? pack a go-bag?</li>
            <li><b>Creative style</b></li>
            <li><b>Story synopsis</b>: what happens, start to finish</li>
            <li><b>Closing message / call to action</b>: what should viewers do?</li>
          </ol>
          <Chips items={["Serious drama", "Comedy", "Satire", "Musical", "Mock documentary", "Fake commercial", "Disaster-movie parody", "Nature show", "News report", "Inspirational", "Completely ridiculous"]} />
          <p>💡 Stuck? AI is allowed for brainstorming. Ask it for 10 wild ideas on your hazard, then make one your own, and check every fact against your source.</p>
        </Card>

        <Card id="script" n={4} accent="#34d399" title="Script & Storyboard">
          <p>Target length: <b>60–120 seconds</b> (unless Mr. Dopp says otherwise). Your plan must include:</p>
          <ul>
            <li>A clear <b>beginning, middle and ending</b></li>
            <li>A written script or detailed scene outline, with dialogue and narration</li>
            <li><b>At least 6 planned shots or scenes</b>, each with an estimated length</li>
            <li>Who plays which character</li>
            <li>Camera angles and movement (close-up, wide, pan, slow-mo…)</li>
            <li>Audio and music plan</li>
            <li>Props and costumes list</li>
            <li>At least one <b>Earth science fact</b> on screen, with your source in the credits</li>
          </ul>
          <p><b>Storyboard:</b> one box per shot: a quick sketch (stick figures are fine), a photo, or an AI-generated image, plus one line describing what happens.</p>
        </Card>

        <Card id="location" n={5} accent="#f25c45" title="Filming Location Plan (Required)">
          <p>Write down exactly where you&apos;ll film:</p>
          <ul><li>Primary location, plus every other location</li><li>Which scenes happen where</li><li>How many minutes you&apos;ll spend at each spot</li><li>Props and equipment you&apos;ll need there</li></ul>
          <p><b>Mr. Dopp must approve your locations before you film.</b></p>
          <Rules title="⚠ Nonnegotiable Rules">
            <ul className="ml-5 list-disc">
              <li><b>DO NOT LEAVE SCHOOL PROPERTY.</b></li>
              <li><b>NO VEHICLE DRIVING.</b></li>
              <li>No dangerous stunts: no real fire, smoke, water hazards, climbing, or &ldquo;falling&rdquo; furniture.</li>
              <li>No realistic weapons.</li>
              <li>No filming in restricted areas.</li>
              <li><b>No fake real alerts:</b> don&apos;t copy real emergency alert tones, and make it obvious your video is a PSA, not a real emergency.</li>
              <li>No recording students or staff who aren&apos;t in your group without their permission.</li>
              <li>Follow all school policies and teacher instructions.</li>
            </ul>
          </Rules>
        </Card>

        <Card id="ready" n={6} accent="#f6c453" title="Ready to Film? Checklist">
          <p>Before filming day, your group must have <b>all</b> of this done and shown to Mr. Dopp. You should know exactly what you&apos;re shooting before you walk out the door.</p>
          <ul className="pj-check">
            <li>Group &amp; roles set</li><li>Hazard chosen</li><li>Source checked</li><li>Script written</li><li>Storyboard (6+ shots)</li><li>Cast assigned</li>
            <li>Props list</li><li>Equipment list</li><li>Audio plan</li><li>Location plan</li><li>Filming schedule</li><li><b>Mr. Dopp&apos;s approval</b></li>
          </ul>
          <p className="no-print !mt-2.5"><PrintButton label="Print these instructions" /></p>
        </Card>

        <Card id="film" n={7} accent="#a78bfa" title="Filming Day: ONE Class Period">
          <p>You get <b>one class period</b> to shoot everything. There is no extra class time for filming. Times below are a guide; Mr. Dopp will adjust them to the period.</p>
          <table className="pj-table pj-sched"><tbody>
            <tr><td>First 5 min</td><td>Grab equipment, set up at your location</td></tr>
            <tr><td>Next 35 min</td><td>Film your planned shots</td></tr>
            <tr><td>Next 10 min</td><td>Retakes, extra footage, and any missing cameos</td></tr>
            <tr><td>Last few min</td><td>Clean up, return equipment, check in with Mr. Dopp</td></tr>
          </tbody></table>
          <ul className="!mt-2.5">
            <li>Bring your shot list and check off each shot: <b>Not filmed → Filmed → Retake needed</b>.</li>
            <li>Shoot extra takes and alternate angles whenever you can. Editors love options.</li>
            <li>Double-check that <b>every group member&apos;s face</b> is on camera before you leave.</li>
            <li>All props, equipment and filming areas cleaned up before the bell.</li>
          </ul>
        </Card>

        <Card id="ai" n={8} accent="#38bdf8" title="Audio & AI">
          <p><b>Audio is strongly encouraged.</b> Think dialogue, narration, background music, an original song, sound effects (rumbles, wind, thunder), dramatic transitions, AI voiceovers or comedic sound design. Keep dialogue clear and levels balanced. Add captions if speech is hard to hear.</p>
          <p><b>AI IS ENCOURAGED!</b> Use it for brainstorming, scripts, storyboards, music, narration, graphics, effects and editing.</p>
          <ul>
            <li>Keep a list of which AI tools you used and what you used them for. You&apos;ll turn it in.</li>
            <li>AI can get science wrong. Every safety fact in your video must match your agency source.</li>
            <li>AI helps your creativity; it doesn&apos;t replace your group&apos;s work. Real faces are still required.</li>
            <li>Respect copyright, privacy and school rules. <b>Never upload someone&apos;s face or voice to an AI tool without their permission.</b></li>
          </ul>
        </Card>

        <Card id="edit" n={9} accent="#34d399" title="Editing Week: Outside of Class">
          <p>After filming you have about <b>one week</b> to finish. <b>No class time is used for editing.</b> Mr. Dopp will give you the exact deadline.</p>
          <p>Editing can include cutting and arranging clips, music and sound effects, narration, titles and credits (with your source), captions, color correction, transitions, AI effects and balancing the audio.</p>
          <p><b>You do not need to buy anything.</b> Free options include Clipchamp (Chromebooks &amp; Windows), Canva for Education, iMovie (Apple), CapCut&apos;s free version, or your phone&apos;s built-in editor.</p>
        </Card>

        <Card id="submit" n={10} accent="#f25c45" title="Submitting Your Video">
          <Callout>ONE person per group turns in the video. Upload from the device that has the finished video on it.</Callout>
          <ol className="!mt-2.5">
            <li><b>Export your video as an MP4.</b> A CapCut, iMovie or Clipchamp <i>project</i> is not a video. Use Export / Save Video first.</li>
            <li>Name the file: <span className="break-all rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[13px]">PSA_GroupName_VideoTitle.mp4</span></li>
            <li>Put it where Mr. Dopp can watch it: your <b>school Google Drive</b>, shared with Mr. Dopp, or a YouTube link if your school allows it.{UPLOAD_FORM_URL && <> Or upload the MP4 with the <a href={UPLOAD_FORM_URL} target="_blank" rel="noopener noreferrer">class upload form</a>.</>}</li>
            <li>Log in (top right), then fill in the form below: title, group name, hazard, the link, the roster and your source.</li>
            <li>Check that the link opens <b>without asking for permission</b> from a classmate&apos;s account before you turn it in.</li>
          </ol>
          <p className="text-sm text-muted">Link not working? Re-share the file as &ldquo;anyone at school with the link can view,&rdquo; or re-export at 1080p (not 4K) if it&apos;s too big to upload.</p>
          <div className="mt-3"><PsaSubmit /></div>
          <p className="!mt-4"><b>Each person also answers</b> (everyone, not just the uploader): <i>&ldquo;What did you contribute to this project, and what did you learn?&rdquo;</i></p>
          <div className="mt-2"><PsaReflection /></div>
        </Card>

        <Card id="grade" n={11} accent="#f6c453" title="Grading: 100 Points">
          <table className="pj-table">
            <thead><tr><th>Category</th><th className="pts">Points</th></tr></thead>
            <tbody>
              {RUBRIC.map(([k, t, p]) => <tr key={k}><td>{t}</td><td className="pts">{p}</td></tr>)}
              <tr className="total"><td>Total</td><td className="pts">100</td></tr>
            </tbody>
          </table>
          <p className="!mt-2 text-sm text-muted">Everyone is expected to pitch in. Mr. Dopp may adjust an individual&apos;s grade based on their actual contribution. A PSA with a wrong safety fact (like &ldquo;stand in a doorway&rdquo;) loses message points.</p>
        </Card>

        <Card id="festival" n={12} accent="#a78bfa" title="🎬 The Bedrock PSA Film Festival">
          <p>We&apos;ll watch the finished PSAs together in class. Students may vote anonymously for awards; you can&apos;t vote for your own group. Awards are just for fun and don&apos;t affect grades.</p>
          <Chips items={["🏆 Best Overall PSA", "😂 Funniest", "🤪 Most Ridiculous", "🎭 Best Acting", "🎥 Best Cinematography", "🎵 Best Audio / Original Song", "🤖 Best Use of AI", "🔬 Best Science", "💥 Most Powerful Message", "🌀 Best Plot Twist", "👏 Audience Choice"]} />
        </Card>

        <Closing>One class period to film. One week to edit.<br />Everyone participates. Everyone appears. Nobody gets left out.</Closing>
        <div className="text-center"><Past /></div>
        <p className="no-print mt-6 text-center text-sm"><Link href="/quake-ready/" className="font-extrabold text-gold underline">🌎 Quake Ready</Link> · <Link href="/disaster-plan/" className="font-extrabold text-gold underline">🏠 Family Disaster Plan</Link> · <Link href="/teacher/" className="font-extrabold text-gold underline">📝 Teacher: score PSAs</Link> · <Link href="/side-quests/" className="font-extrabold text-gold underline">← Side Quests</Link></p>
      </div>
    </>
  );
}
