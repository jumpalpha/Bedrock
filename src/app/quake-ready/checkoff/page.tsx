// ── wave-twinA ── twin of Dopps Class cpr_checkoff.html: the teacher's earthquake-drill skills check-off (blank rows only).
import type { Metadata } from "next";
import { PrintSheet } from "@/components/twinA/print-sheet";

export const metadata: Metadata = {
  title: "Earthquake Drill Check-Off Sheet",
  description: "Teacher check-off sheet for the in-class Drop, Cover, and Hold On earthquake drill (record of practice).",
  robots: { index: false },
};

const css = `
.co .fields { display:flex; gap:18px; flex-wrap:wrap; font-size:12.5px; font-weight:800; margin-bottom:8px; }
.co .fields span { white-space:nowrap; }
.co .line { display:inline-block; border-bottom:1.5px solid #111; min-width:120px; height:14px; vertical-align:bottom; }
.co .bx { display:inline-block; width:12px; height:12px; border:1.5px solid #111; vertical-align:-2px; margin-right:3px; }
.co table { table-layout:fixed; }
.co th, .co td { border:1.2px solid #111; font-size:10.5px; text-align:center; vertical-align:middle; }
.co th { padding:4px 2px; font-weight:900; line-height:1.15; background:#f2f2f2; }
.co th.grp { background:#e3e3e3; font-size:10px; letter-spacing:.03em; }
.co td { height:0.34in; }
.co td.num { font-weight:800; }
.co .ck { display:inline-block; width:15px; height:15px; border:1.5px solid #111; border-radius:2px; }
.co .notes { display:grid; grid-template-columns:1.3fr 1fr; gap:14px; margin-top:8px; font-size:10.5px; line-height:1.4; }
.co .notes b { font-weight:900; }
.co .sign { margin-top:6px; font-size:12px; font-weight:800; }
.co h1 { font-size:19px; }
.co .sub { font-size:11.5px; }
@media print { .paper { font-size:12px; } }`;

export default function DrillCheckoff() {
  return (
    <PrintSheet landscape printLabel="Print (1 page, landscape)">
      <style>{css}</style>
      <div className="co">
        <h1>Earthquake Drill Skills Check-Off: Record of Practice</h1>
        <p className="sub">Earth Science · Chapter 14 Earthquakes · Quake Ready drill, following the Great ShakeOut &ldquo;Drop, Cover, and Hold On&rdquo; and Ready.gov earthquake guidance. Keep this sheet. Then mark each passing student&apos;s drill as checked off in the Teacher Dashboard (Be Ready tab).</p>
        <div className="fields">
          <span>Date: <span className="line" /></span>
          <span>Period: <span className="line" style={{ minWidth: 60 }} /></span>
          <span>Drill: <span className="bx" />classroom ShakeOut drill &nbsp; <span className="bx" />full evacuation drill &nbsp; <span className="bx" />other: <span className="line" style={{ minWidth: 90 }} /></span>
          <span>Teacher: <span className="line" style={{ minWidth: 150 }} /></span>
        </div>
        <table>
          <colgroup>
            <col style={{ width: "0.28in" }} /><col style={{ width: "2.05in" }} />
            <col /><col /><col /><col /><col /><col /><col /><col /><col /><col />
            <col style={{ width: "0.62in" }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>#</th><th rowSpan={2}>Student name</th>
              <th className="grp" colSpan={5}>DURING THE SHAKING (drill timer, 60 s)</th>
              <th className="grp" colSpan={4}>AFTER THE SHAKING</th>
              <th className="grp" rowSpan={2}>Aftershock: drops again</th>
              <th rowSpan={2}>Teacher initials</th>
            </tr>
            <tr>
              <th>Drops right away</th><th>Covers head &amp; neck</th><th>Under sturdy desk or by inside wall</th><th>Holds on the full 60 s</th><th>Stays put (no running)</th>
              <th>Looks for hazards before moving</th><th>Names gas &amp; water shutoffs</th><th>Walks out on route (no running)</th><th>At assembly area for roll call</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i}><td className="num">{i + 1}</td><td />{Array.from({ length: 10 }, (_, j) => <td key={j}><span className="ck" /></td>)}<td /></tr>
            ))}
          </tbody>
        </table>
        <div className="notes">
          <div>
            <b>Pass = every box ✓.</b> <b>Drop</b>: onto hands and knees as soon as the drill starts. <b>Cover</b>: one arm over head and neck; under a sturdy desk or table, or low beside an interior wall away from windows and tall furniture.
            <b> Hold on</b>: to the desk leg (or head and neck) for the whole 60-second drill, moving with the desk. <b>Stays put</b>: no running, no doorways.
            <b> After</b>: waits and looks around before moving; can say where the gas and water shutoffs usually are and that you only shut gas off if you smell gas or hear hissing (an adult does it, and only the gas company turns it back on);
            walks the evacuation route; checks in at the assembly area. <b>Aftershock</b>: drops, covers and holds on again (Class drill timer, Quake Ready page).
          </div>
          <div>
            <b>Absent or not yet passed?</b> Leave the row blank and re-check on a make-up day. Students using a wheelchair or walker: <b>Lock, Cover, Hold On</b> counts as Drop, Cover, Hold On.<br />
            <b>Notes:</b>
            <div className="line" style={{ display: "block", minWidth: 0, width: "100%", marginTop: 6 }} />
            <div className="line" style={{ display: "block", minWidth: 0, width: "100%", marginTop: 8 }} />
            <div className="sign">Teacher signature: <span className="line" style={{ minWidth: 200 }} /></div>
          </div>
        </div>
      </div>
    </PrintSheet>
  );
}
