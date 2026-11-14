// ── wave-twinA ── twin of Dopps Class cpr_paper_aed.html: a printable paper seismograph with cut-out strips and a
// read-in-order script for partner practice.
import type { Metadata } from "next";
import { PrintSheet } from "@/components/twinA/print-sheet";

export const metadata: Metadata = {
  title: "Paper Seismograph",
  description: "Printable paper seismograph: build it from a box, a cup and a marker, cut out the seismogram strips, and record a classroom 'quake' with a partner script.",
};

const css = `
.ps th, .ps td { border:1.5px solid #1c2419; padding:5px 7px; font-size:12px; line-height:1.35; text-align:left; vertical-align:top; }
.ps th { background:#fde68a; font-weight:900; }
.ps td.n { width:26px; text-align:center; font-weight:900; }
.ps td.say { font-weight:800; }
.ps .cols { grid-template-columns:1.05fr 1fr; gap:16px; }
@media print { .ps .cols { grid-template-columns:1.05fr 1fr; } }`;

const ticks = (y: number, from: number) =>
  Array.from({ length: 11 }, (_, i) => (
    <g key={i}>
      <line x1={34 + i * 27} y1={y + 34} x2={34 + i * 27} y2={y + (i % 5 === 0 ? 22 : 28)} stroke="#1c2419" strokeWidth="1.2" />
      {i % 2 === 0 && <text x={34 + i * 27} y={y + 49} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#1c2419">{from + i}s</text>}
    </g>
  ));

export default function PaperSeismograph() {
  return (
    <PrintSheet>
      <style>{css}</style>
      <div className="ps">
        <h1>Paper Seismograph</h1>
        <p className="sub">Quake Ready · Chapter 14 Earthquakes · Bedrock. Build it from a box, a cup and a marker, then cut out the two seismogram strips. Practice in threes: a <b>puller</b>, a <b>shaker</b>, and <b>&ldquo;the seismologist&rdquo;</b>, who reads the script out loud.</p>
        <div className="cols">
          <div>
            <svg viewBox="0 0 340 438" role="img" aria-label="Side view of a paper seismograph: a box on its side, a cup with coins hanging from a string, a marker poking through the cup onto a paper strip that is pulled through the box. Below, two cut-out seismogram strips with second marks.">
              <rect x="40" y="20" width="230" height="200" fill="#fff7e6" stroke="#8a6d3b" strokeWidth="4" />
              <text x="155" y="40" textAnchor="middle" fontSize="11" fontWeight="800" fill="#8a6d3b">cardboard box on its side</text>
              <line x1="155" y1="24" x2="155" y2="112" stroke="#1c2419" strokeWidth="1.6" />
              <rect x="146" y="20" width="18" height="8" fill="#94a3a0" stroke="#1c2419" strokeWidth="1" />
              <text x="168" y="70" fontSize="10.5" fontWeight="800" fill="#1c2419">string</text>
              <path d="M128 112 L182 112 L174 178 L136 178 Z" fill="#cfe6f7" stroke="#1c2419" strokeWidth="2.2" />
              <ellipse cx="155" cy="160" rx="16" ry="5" fill="#f6c453" stroke="#1c2419" strokeWidth="1" />
              <ellipse cx="155" cy="168" rx="16" ry="5" fill="#f6c453" stroke="#1c2419" strokeWidth="1" />
              <text x="188" y="140" fontSize="10.5" fontWeight="800" fill="#1c2419">cup + coins</text>
              <text x="188" y="152" fontSize="10.5" fontWeight="800" fill="#1c2419">= the mass</text>
              <rect x="151" y="168" width="8" height="40" rx="2" fill="#1c2419" />
              <path d="M151 208 L159 208 L155 216 Z" fill="#dc2626" />
              <text x="104" y="196" textAnchor="end" fontSize="10.5" fontWeight="800" fill="#1c2419">marker</text>
              <line x1="106" y1="193" x2="148" y2="193" stroke="#1c2419" strokeWidth="1" />
              <rect x="6" y="214" width="328" height="12" fill="#fff" stroke="#1c2419" strokeWidth="1.5" />
              <path d="M20 220 L60 220 L66 216 L72 224 L78 215 L84 225 L90 218 L96 221 L150 220" fill="none" stroke="#dc2626" strokeWidth="1.5" />
              <text x="252" y="246" fontSize="11" fontWeight="900" fill="#1c2419">PULL →</text>
              <path d="M300 242 L330 242" stroke="#1c2419" strokeWidth="2" markerEnd="url(#ar)" />
              <text x="60" y="262" fontSize="11" fontWeight="900" fill="#c2410c">↔ SHAKE the table, not the cup</text>
              <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#1c2419" /></marker></defs>
              <rect x="6" y="280" width="328" height="74" rx="8" fill="none" stroke="#1c2419" strokeWidth="1.2" strokeDasharray="6 5" />
              <text x="14" y="293" fontSize="9.5" fontWeight="800" fill="#666">✂ cut out · strip 1</text>
              <rect x="20" y="298" width="300" height="40" fill="#fff" stroke="#1c2419" strokeWidth="2" />
              {ticks(298, 0)}
              <line x1="20" y1="312" x2="320" y2="312" stroke="#94a3a0" strokeWidth="1" strokeDasharray="3 3" />
              <rect x="6" y="358" width="328" height="74" rx="8" fill="none" stroke="#1c2419" strokeWidth="1.2" strokeDasharray="6 5" />
              <text x="14" y="371" fontSize="9.5" fontWeight="800" fill="#666">✂ cut out · strip 2 (tape to the end of strip 1)</text>
              <rect x="20" y="376" width="300" height="40" fill="#fff" stroke="#1c2419" strokeWidth="2" />
              {ticks(376, 10)}
              <line x1="20" y1="390" x2="320" y2="390" stroke="#94a3a0" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
            <div className="how">
              <p><b>Build it:</b> stand a box on its side on a table. Poke a hole in the top and hang a paper cup from a string so it swings freely just above the table. Push a marker down through a hole in the bottom of the cup so the tip <b>just touches</b> the strip. Add coins or sand to the cup. Slide the strip under the marker.</p>
              <p style={{ marginTop: 4 }}><b>Why it works:</b> <b>inertia</b>. The heavy cup tends to stay still while the table and box move under it, so the marker draws the shaking. Real seismometers use the same idea.</p>
            </div>
          </div>
          <div>
            <h2>The seismologist&apos;s script (read in order)</h2>
            <table>
              <tbody>
                <tr><th>#</th><th>&ldquo;The seismologist&rdquo; says</th><th>The puller and shaker do</th></tr>
                <tr><td className="n">1</td><td className="say">&ldquo;Recorder on. Quiet ground.&rdquo;</td><td>The puller pulls the strip slowly and steadily, about one tick a second. Nobody touches the table: a flat line.</td></tr>
                <tr><td className="n">2</td><td className="say">&ldquo;P wave arriving!&rdquo;</td><td>The shaker gives 2 seconds of quick, small push-pull taps. P waves arrive first.</td></tr>
                <tr><td className="n">3</td><td className="say">&ldquo;S wave arriving!&rdquo;</td><td>3 seconds of bigger side-to-side shakes. The puller keeps pulling at the same speed.</td></tr>
                <tr><td className="n">4</td><td className="say">&ldquo;Surface waves. Strongest shaking!&rdquo;</td><td>4 seconds of the strongest shaking (keep it safe), then let it fade out. These waves cause most damage.</td></tr>
                <tr><td className="n">5</td><td className="say">&ldquo;Shaking stopped. Look around.&rdquo;</td><td>The shaker lets go. The puller pulls 3 more seconds of flat line.</td></tr>
                <tr><td className="n">6</td><td className="say">&ldquo;Aftershock!&rdquo;</td><td>One short shake. In a real quake: Drop, Cover, and Hold On again.</td></tr>
                <tr><td className="n">7</td><td className="say">&ldquo;Read the seismogram.&rdquo;</td><td>Label P, S, surface waves and the aftershock. Count the ticks between P and S, and circle the biggest wiggle.</td></tr>
              </tbody>
            </table>
            <h2>How to practice in threes</h2>
            <ol>
              <li>The seismologist reads a line only after the step before it is done.</li>
              <li>The shaker shakes the <b>table</b>, never the cup or the box.</li>
              <li>If the marker skips, add coins or push it down a little and run it again.</li>
              <li>Switch roles and record again. Compare: which strip has the biggest S&ndash;P gap? That &ldquo;quake&rdquo; would be the farthest away.</li>
            </ol>
            <p style={{ marginTop: 6 }}><b>Remember:</b> one station tells you <b>how far</b> away a quake is, not which way. Seismologists use three stations to find the epicenter (triangulation, Chapter 14).</p>
          </div>
        </div>
        <p className="foot">Based on USGS explanations of seismometers and seismic waves. A paper seismograph shows the idea of an inertial mass; it is not a measuring instrument. bedrock.doppsclass.com/quake-ready/</p>
      </div>
    </PrintSheet>
  );
}
