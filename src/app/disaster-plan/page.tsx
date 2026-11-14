// ── wave-twinA ── Family Disaster Plan: twin of Dopps Class family_quest.html ("Roots & Branches", a 4-day family take-home project).
// Nothing is saved online on purpose: the plan card holds addresses and phone numbers, so it stays on paper at home.
import type { Metadata } from "next";
import Link from "next/link";
import { Box, Callout, Card, Chips, Closing, PROJECT_CSS, ProjectHero, Toc, Two } from "@/components/twinA/project-page";
import { PrintOnly } from "@/components/twinA/print-only";
import { ApartmentMap, MainMap, RanchMap } from "./maps";

export const metadata: Metadata = {
  title: "Family Disaster Plan",
  description: "A 4-day family project: map your home's exits and safety gear, research your Idaho hazards, fill in a family emergency plan and go-bag checklist, and interview a relative about a disaster they lived through.",
};

const CSS = `
.dp-scroll { overflow-x:auto; border:1px solid var(--color-line); border-radius:12px; background:#fffef6; -webkit-overflow-scrolling:touch; }
.dp-scroll svg { display:block; width:100%; min-width:620px; height:auto; }
.dp-plan { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin-top:8px; color:#1c2419; }
.dp-plan .pc { border:1.5px solid #1c2419; border-radius:8px; padding:6px 8px; background:#fff; font-size:12.5px; min-width:0; display:flex; flex-direction:column; gap:3px; }
.dp-plan .pc b { font-size:11.5px; letter-spacing:.4px; text-transform:uppercase; color:#047857; }
.dp-plan .pc span { color:#5c6754; border-bottom:1px solid rgba(28,36,25,.35); padding:7px 0 1px; font-size:11.5px; }
.dp-plan .bag { grid-column:1/-1; }
.dp-plan .bag ul { list-style:none !important; margin:2px 0 0 !important; columns:4; column-gap:12px; }
.dp-plan .bag li { font-size:11.5px; margin:1px 0; color:#1c2419; }
.dp-plan .bag li::before { content:'☐ '; font-weight:800; color:#047857; }
.dp-plan .bag li::marker { content:''; }
@media (max-width:640px) {
  .dp-plan { grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; }
  .dp-plan .pc { padding:4px 6px; } .dp-plan .bag ul { columns:2; }
}
@media print {
  .dp-scroll svg { min-width:0; }
  .dp-figure { break-inside:avoid; }
  body.print-plan header, body.print-plan footer, body.print-plan .pj-toc, body.print-plan .pj-hero, body.print-plan .pj-closing,
  body.print-plan main section:not(#plan) { display:none !important; }
  body.print-plan #plan { border:none; padding:0; }
  body.print-plan #plan .plan-intro { display:none; }
  .dp-plan { grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
  .dp-plan .pc { padding:8px 10px; } .dp-plan .pc span { padding-top:12px; } .dp-plan .bag ul { columns:4; }
}`;

const toc: [string, string][] = [["idea", "Big Idea"], ["days", "4-Day Plan"], ["map", "Map My Home"], ["example", "Examples"], ["research", "Hazard Research"],
  ["plan", "Printable Plan Card"], ["story", "Disaster Story"], ["reflect", "Reflection"], ["grade", "Grading"], ["hard", "If This Is Hard"]];

const box = (title: string, lines: string[], span = 1) => (
  <div className="pc" style={span > 1 ? { gridColumn: `span ${span}` } : undefined}><b>{title}</b>{lines.map((l, i) => <span key={i}>{l}</span>)}</div>
);
const BAG = ["Water: 1 gallon per person per day", "Food that won't spoil, several days", "Manual can opener", "Flashlight", "Battery or hand-crank radio", "Extra batteries",
  "First-aid kit", "Whistle", "Dust masks", "Phone charger + backup battery", "Medicines + glasses", "Copies of important papers", "Cash",
  "Warm layers + sturdy shoes", "Blanket or sleeping bag", "Wrench or pliers (utilities)", "Local map", "Wipes, garbage bags, ties", "Pet food + leash", "N95 masks (wildfire smoke)"];

export default function DisasterPlan() {
  return (
    <>
      <style>{PROJECT_CSS + CSS}</style>
      <ProjectHero badge="FAMILY PROJECT · SIDE QUEST" title="Family Disaster Plan"
        tagline={["Map Your Home.", "Make Your Plan.", "You Can't Pick the Hazard!"]}
        motto="Chapters 10, 14, 21 · 4 class days · 100 points · Every home is different, and every plan starts somewhere." />
      <div className="mx-auto max-w-[860px] px-4 pb-16">
        <Toc items={toc} />

        <Card id="idea" n={1} accent="#f25c45" title="The Big Idea: You Can't Pick the Hazard">
          <p>Idaho shakes, burns, floods and freezes. The state sits in the <b>Intermountain Seismic Belt</b>, where the 1983 Borah Peak earthquake (magnitude 6.9) hit. Summers bring <b>wildfire smoke</b>, spring snowmelt brings <b>floods</b>, and winter storms close roads. You can&apos;t choose which one comes, or when.</p>
          <p>In this quest you will <b>map</b> your home&apos;s ways out and safety gear, <b>research</b> the hazards where you live and fill in a family plan, <b>collect</b> one family disaster story, and <b>reflect</b> on what you can and can&apos;t control.</p>
          <Two>
            <Box title="🎯 You will…">
              <ul><li>Draw a safety map of your home</li><li>Research your hazards and fill in a family plan card</li><li>Interview a relative about a disaster</li><li>Pick one step to get more ready</li></ul>
            </Box>
            <Box title="🧭 Day 1 warm-up">
              <ol><li>Which natural hazard is most likely where you live?</li><li>If an earthquake hit at 2 a.m., where would your family meet?</li><li>Do you know one family phone number without your phone?</li></ol>
            </Box>
          </Two>
        </Card>

        <Card id="days" n={2} accent="#a78bfa" title="The 4-Day Plan">
          <p>Each day has one main job. Homework sets up the next day.</p>
          <table className="pj-table pj-sched">
            <thead><tr><th>Day</th><th>In class</th><th>Homework</th></tr></thead>
            <tbody>
              <tr><td>Day 1<br />Map It</td><td>Warm-up, look at the examples, learn the legend, start a <b>rough draft</b> map of your home from memory.</td><td>Walk through your home with an adult: find the shutoffs, smoke alarms, fire extinguisher, and two ways out of every bedroom. Set up your interview.</td></tr>
              <tr><td>Day 2<br />Dig In</td><td>Hazard research lab (Path A online <b>or</b> Path B paper). Start your plan card and hazard spotlight.</td><td>Do your disaster story interview (15–20 min). Fill in the contacts on your plan card at home.</td></tr>
              <tr><td>Day 3<br />Build It</td><td>Make your <b>final map</b>. Trade with a partner for a legend check. Write up your interview story.</td><td>Finish the map if needed. Optional: check or pack a go-bag with your family.</td></tr>
              <tr><td>Day 4<br />Reflect</td><td>Write your reflection. Optional share (you choose what to show). Turn in all four parts the way Mr. Dopp tells you, with private info covered.</td><td>None. Bonus: practice your plan at home with a quick drill.</td></tr>
            </tbody>
          </table>
        </Card>

        <Card id="map" n={3} accent="#f6c453" title="Part 1: Map My Home" pts="Required · 40 pts">
          <p>Draw your home as a <b>floor plan seen from above</b>: boxes for rooms, gaps for doors, double lines for windows. Then add the symbols below. A ruler helps, but clear beats pretty.</p>
          <p><b>Your map must include:</b></p>
          <ul className="pj-check">
            <li>Every room, with <b>your room</b> labeled &ldquo;ME&rdquo;</li>
            <li>Every outside door</li>
            <li>Two ways out of every bedroom</li>
            <li>Gas, water and electric shutoffs</li>
            <li>Smoke alarms (and CO alarms)</li>
            <li>Fire extinguisher &amp; first-aid kit</li>
            <li>Where the go-bag lives</li>
            <li>Safe spots and hazards</li>
            <li>Meeting place 1 + a legend / key</li>
          </ul>
          <p className="mt-2.5"><b>Legend symbols you need</b> (use these or make your own, as long as your key explains them):</p>
          <table className="pj-table">
            <thead><tr><th>What</th><th>Suggested symbol</th></tr></thead>
            <tbody>
              <tr><td>Way out (door or window)</td><td>Green arrow ➜</td></tr>
              <tr><td>Meeting place 1, right outside your home</td><td>★1</td></tr>
              <tr><td>Meeting place 2, outside your neighborhood</td><td>★2 (write where if it&apos;s off the map)</td></tr>
              <tr><td>Gas · water · electric shutoff</td><td>Ⓖ · Ⓦ · Ⓔ (Ⓟ for a propane tank)</td></tr>
              <tr><td>Smoke alarm · carbon monoxide alarm</td><td>SA · CO</td></tr>
              <tr><td>Fire extinguisher · first-aid kit · go-bag</td><td>FE · ✚ · GB</td></tr>
              <tr><td>Safe spot for Drop, Cover, Hold On (sturdy table, inside wall)</td><td>Blue triangle ▲</td></tr>
              <tr><td>Hazard (tall furniture, unstrapped water heater, heavy things up high, glass over a bed)</td><td>Yellow warning sign ⚠</td></tr>
              <tr><td>Not sure where something is</td><td>A box with &ldquo;?&rdquo;</td></tr>
            </tbody>
          </table>
          <Callout>🏠 Every home counts. A house, an apartment, a trailer, two homes, a ranch: map the one where you sleep most nights. If you can&apos;t find a shutoff, put a &ldquo;?&rdquo; and ask an adult. An honest map earns full credit.</Callout>
        </Card>

        <Card id="example" n={4} accent="#38bdf8" title="Example Maps (Made-Up Homes)">
          <p>This home is invented. Notice the two ways out of each bedroom, the shutoffs in the garage, the safe spots, and the hazards to fix: a tall bookcase, an unstrapped water heater and a mirror over a bed.</p>
          <figure className="dp-figure my-3">
            <div className="dp-scroll"><MainMap /></div>
            <Chips center items={["➜ way out", "★1 meeting place", "G · W · E shutoffs", "SA · CO alarms", "FE extinguisher", "✚ first aid", "GB go-bag", "▲ safe spot", "⚠ hazard"]} />
          </figure>
          <h3 className="mb-1 mt-5 font-display text-[17px] font-extrabold">Two more made-up homes (the tricky edition)</h3>
          <p>Not every home is a one-story house. Look at how each key explains every symbol.</p>
          <figure className="dp-figure my-3">
            <div className="dp-scroll"><ApartmentMap /></div>
            <figcaption className="mt-1.5 text-sm text-muted"><b className="text-fg">Third-Floor Apartment:</b> two stairwells as ways out, no elevators in an emergency, the building manager knows where the shutoffs are, and the meeting place is across the parking lot.</figcaption>
          </figure>
          <figure className="dp-figure my-3">
            <div className="dp-scroll"><RanchMap /></div>
            <figcaption className="mt-1.5 text-sm text-muted"><b className="text-fg">Foothills Ranch:</b> wildfire country, so there are two driveways out, a propane tank valve instead of a gas meter, a well pump instead of city water, a trailer ready for the animals, and a second meeting place in town.</figcaption>
          </figure>
          <p className="text-center text-[13px] text-muted sm:hidden">📱 On a phone, swipe sideways on a map to see all of it.</p>
        </Card>

        <Card id="research" n={5} accent="#34d399" title="Part 2: Hazard Research" pts="20 pts">
          <p>Everyone fills in the <b>family plan card</b> (below) and writes one <b>hazard spotlight</b>. Pick Path A or Path B. Both earn full credit.</p>
          <Two>
            <Box title="🌐 Path A: Online (encouraged)">
              <ol>
                <li>Open Ready.gov&apos;s <a href="https://www.ready.gov/plan" target="_blank" rel="noopener noreferrer">Make a Plan</a> and read the four questions every family plan answers: alerts, shelter, evacuation routes and communication.</li>
                <li>Look up your county on FEMA&apos;s <a href="https://hazards.fema.gov/nri/" target="_blank" rel="noopener noreferrer">National Risk Index</a> map and list its top natural hazards.</li>
                <li>Check the <a href="https://ioem.idaho.gov/" target="_blank" rel="noopener noreferrer">Idaho Office of Emergency Management</a> for how Idaho warns people, and find out how your county sends emergency alerts.</li>
                <li>Fill in the plan card with an adult.</li>
              </ol>
            </Box>
            <Box title="📄 Path B: Paper (no internet)">
              <ol>
                <li>Print the <a href="#plan">family plan card</a> below.</li>
                <li>Fill it in with a parent, grandparent or other trusted adult.</li>
                <li>Use what your family already knows: where the shutoffs are, who to call, the roads out of town, and Chapters 10, 14 and 21.</li>
              </ol>
            </Box>
          </Two>
          <p className="mt-2.5"><b>Hazard spotlight</b> (both paths): pick one hazard that could hit your home (earthquake, wildfire smoke, flood, winter storm, landslide…) and write one paragraph:</p>
          <ul>
            <li>What Earth process causes it (use a word from the chapter)</li>
            <li>One time it happened in or near Idaho, and what happened</li>
            <li>How you&apos;d get a warning, or why you can&apos;t (earthquakes come with no warning)</li>
            <li>What your family will do, and one question you still have</li>
          </ul>
        </Card>

        <Card id="plan" n={6} accent="#34d399" title="Printable Family Plan Card">
          <div className="plan-intro">
            <p>Write &ldquo;?&rdquo; for anything you don&apos;t know yet. Keep the finished card at home and a copy in your go-bag. <b>Don&apos;t post it online.</b></p>
            <p className="no-print"><PrintOnly cls="print-plan" label="Print just the plan card" /></p>
          </div>
          <div className="dp-plan">
            {box("Our household", ["Names", "", "Ages / needs"], 2)}
            {box("Out-of-town contact", ["Name", "Phone"])}
            {box("Local contact", ["Name", "Phone"])}
            {box("Meeting place 1: right outside", ["Where", ""])}
            {box("Meeting place 2: outside our neighborhood", ["Where", ""])}
            {box("School / work pickup plan", ["Who picks up", "Where"])}
            {box("How we get alerts", ["☐ phone emergency alerts", "☐ NOAA weather radio", "☐ county alerts / local news"])}
            {box("Shutoffs", ["Gas", "Water", "Electric panel"])}
            {box("Two ways out of town", ["Route 1", "Route 2"])}
            {box("Medicines & medical needs", ["", ""])}
            {box("Pets & animals", ["Who", "Where they go"])}
            <div className="pc bag"><b>Go-bag check (several days, for everyone)</b><ul>{BAG.map((b) => <li key={b}>{b}</li>)}</ul></div>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Plan questions from Ready.gov&apos;s Make a Plan; go-bag list based on Ready.gov&apos;s Build a Kit and American Red Cross guidance. Phone lines jam after a disaster: an out-of-town contact and text messages often get through when calls don&apos;t.</p>
        </Card>

        <Card id="story" n={7} accent="#f25c45" title="Part 3: Family Disaster Story Interview" pts="20 pts">
          <p>Interview one relative or trusted adult for 15–20 minutes, ideally the oldest person you can reach. In person, phone or video all work. Maybe they remember the <b>1976 Teton Dam flood</b>, the <b>1983 Borah Peak earthquake</b>, the <b>2020 Stanley earthquake</b>, a big wildfire, a blizzard or a long power outage. Ask <b>at least 6</b> of these:</p>
          <ol>
            <li>What&apos;s the biggest natural disaster or emergency you lived through?</li>
            <li>Where were you, and what was a normal day like before it?</li>
            <li>Did you get any warning? How did you find out what was happening?</li>
            <li>What did you do in the first hour?</li>
            <li>What did you wish you had: supplies, information, or a plan?</li>
            <li>How did neighbors or the town help each other?</li>
            <li>How long did it take for life to get back to normal?</li>
            <li>What did our family change after that?</li>
            <li>What&apos;s one thing you&apos;d tell me to do to be ready?</li>
            <li>Was there a funny or surprising moment you still remember?</li>
          </ol>
          <Callout>✍ Write-up (1 page): retell the story in your own words. End with 2–3 sentences on what it taught you about being ready.</Callout>
        </Card>

        <Card id="reflect" n={8} accent="#a78bfa" title="Part 4: What I Can and Can't Control" pts="20 pts">
          <p>Look at your finished map and plan. Answer in full sentences (about 1 page).</p>
          <Two>
            <Box title="⭕ Inside my circle (I can control)">List 3: my plan, my go-bag, knowing the shutoffs and meeting places, practicing Drop, Cover, and Hold On, strapping heavy furniture with an adult.</Box>
            <Box title="🌫 Outside my circle (I can't)">List 3: when an earthquake hits, where faults are, the weather, fire season, how fast a river rises.</Box>
          </Two>
          <ol className="!mt-2.5">
            <li><b>Most and least ready:</b> which hazard is your family most ready for, and which least? Why?</li>
            <li><b>My next step:</b> one specific thing you&apos;ll do in the next two weeks (pack a go-bag, save an out-of-town contact, sign up for alerts, fix one hazard on your map with an adult, run a home drill).</li>
            <li><b>A risk I can&apos;t control:</b> describe one (a fault, a river, a dry hillside). What would accepting it and preparing look like? Accepting isn&apos;t the same as giving up.</li>
            <li><b>You can&apos;t pick the hazard:</b> after making this plan, what does that mean to you now?</li>
            <li><b>Grateful for:</b> one person or helper you&apos;re thankful for (a neighbor, firefighters, the scientists watching faults and volcanoes) and why.</li>
          </ol>
        </Card>

        <Card id="grade" n={9} accent="#f6c453" title="Grading (100 pts)">
          <p>You&apos;re graded on <b>complete and honest</b>, not on how big your home is or how well you draw.</p>
          <table className="pj-table">
            <thead><tr><th>Part</th><th>Full credit looks like</th><th className="pts">Pts</th></tr></thead>
            <tbody>
              <tr><td>Map: rooms &amp; ways out</td><td>Every room and outside door; &ldquo;ME&rdquo; labeled; two ways out of every bedroom marked</td><td className="pts">15</td></tr>
              <tr><td>Map: safety gear</td><td>Shutoffs, alarms, extinguisher, first-aid kit and go-bag shown (or &ldquo;?&rdquo;)</td><td className="pts">10</td></tr>
              <tr><td>Map: legend, safe spots &amp; hazards</td><td>Every symbol in your key; at least 2 safe spots and 2 hazards; meeting place 1</td><td className="pts">10</td></tr>
              <tr><td>Map: readable</td><td>Someone else could find the way out using it</td><td className="pts">5</td></tr>
              <tr><td>Hazard research</td><td>Plan card filled in (Path A or B) + hazard spotlight paragraph</td><td className="pts">20</td></tr>
              <tr><td>Disaster story interview</td><td>6+ questions asked, story retold, lesson stated</td><td className="pts">20</td></tr>
              <tr><td>Reflection</td><td>Circle of control + all 5 prompts with specific answers</td><td className="pts">20</td></tr>
              <tr className="total"><td>Total</td><td /><td className="pts">100</td></tr>
            </tbody>
          </table>
          <Callout>📸 How to turn it in: take a clear picture of your map and your plan card and turn them in the way Mr. Dopp tells you. <b>Cover phone numbers and your address first.</b> Make sure the whole map and your key are in the picture.<br />🏡 The map and card are yours to keep. Put them on the fridge and in your go-bag!</Callout>
        </Card>

        <Card id="hard" n={10} accent="#38bdf8" title="If This Is Hard for You">
          <p>Some homes and families carry hard stuff. The map is still required, and here&apos;s how it works for you:</p>
          <ul>
            <li><b>Two homes?</b> Map either one, or both.</li>
            <li><b>Apartment, shelter, or staying with someone?</b> Map where you sleep most nights. Any home counts.</li>
            <li><b>No one at home can help?</b> Interview any trusted adult: a grandparent, neighbor, coach, school staff, or Mr. Dopp.</li>
            <li><b>Disasters make you anxious?</b> That&apos;s normal. Having a plan is the best answer to &ldquo;what if.&rdquo; Take breaks when you need them.</li>
            <li><b>Your family lived through a fire, flood or loss of a home?</b> You never have to share details. Pick a different story if you want.</li>
            <li><b>Private stays private.</b> Cover phone numbers and addresses on anything you turn in.</li>
            <li><b>Need to talk?</b> Mr. Dopp and the school counselors are here for you.</li>
          </ul>
        </Card>

        <Closing><span className="pj-closing block">You can&apos;t pick the hazard.<br />You can pick how ready you are.</span></Closing>
        <p className="no-print mt-6 text-center text-sm"><Link href="/quake-ready/" className="font-extrabold text-gold underline">🌎 Quake Ready side quest</Link> · <Link href="/hazard-psa/" className="font-extrabold text-gold underline">🎬 Hazard PSA Challenge</Link> · <Link href="/side-quests/" className="font-extrabold text-gold underline">← Side Quests</Link></p>
      </div>
    </>
  );
}
