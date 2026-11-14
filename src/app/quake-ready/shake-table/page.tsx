// ── wave-twinA ── twin of Dopps Class cpr_trainer_build.html: build a classroom shake table with a 1-inch shake marker.
import type { Metadata } from "next";
import { PrintSheet } from "@/components/twinA/print-sheet";

export const metadata: Metadata = {
  title: "Build a Shake Table",
  description: "Printable: build a classroom shake table from cardboard, marbles and rubber bands, with a 1-inch shake marker for fair tests.",
};

const css = `.st .need { columns:2; column-gap:16px; } @media (max-width:640px) { .st .need { columns:1; } } @media print { .st .need { columns:2; } }`;

export default function ShakeTable() {
  return (
    <PrintSheet>
      <style>{css}</style>
      <div className="st">
        <h1>Build a Shake Table</h1>
        <p className="sub">Quake Ready · Chapter 14 Earthquakes · Bedrock. A table top that really slides and springs back like shaking ground, with marks that show a 1-inch shake so every test is fair.</p>
        <div className="cols">
          <div>
            <h2>You need</h2>
            <ul className="need">
              <li>2 pieces of stiff cardboard, about the same size (or a cookie sheet on a box lid)</li>
              <li>4 plastic bottle caps</li>
              <li>4 marbles (or golf balls)</li>
              <li>4 large rubber bands</li>
              <li>Packing or duct tape</li>
              <li>A ruler</li>
              <li>Colored tape or a marker</li>
              <li>Building stuff: index cards, or spaghetti and mini marshmallows</li>
            </ul>

            <h2>Option A · Marble table</h2>
            <ol>
              <li>Tape the 4 bottle caps, open side up, near the corners of the <b>bottom</b> board.</li>
              <li>Put a marble in each cap. Lay the <b>top</b> board on the marbles.</li>
              <li>Loop 2 rubber bands around both boards at each end, so the top board <b>springs back to the middle</b>.</li>
              <li>Push the top board sideways and let go: it should slide about an inch and come back.</li>
            </ol>

            <h2>Option B · Tennis-ball table</h2>
            <ol>
              <li>Set 4 tennis balls in a shallow box or cake pan, one near each corner.</li>
              <li>Lay a sturdy board on the balls.</li>
              <li>Tape a rubber band from each side of the board to the box so it springs back. Good for bigger, heavier models.</li>
            </ol>
          </div>

          <div>
            <h2>The 1-inch shake marker</h2>
            <svg viewBox="0 0 320 200" role="img" aria-label="Side view: a bottom board, bottle caps with marbles, a top board with a model tower on it. Tape lines on the bottom board mark the middle and 1 inch to each side.">
              <rect x="0" y="0" width="320" height="200" fill="#fff" />
              <rect x="20" y="160" width="280" height="12" fill="#d6b98c" stroke="#1c2419" strokeWidth="2" />
              <text x="160" y="190" textAnchor="middle" fontSize="11" fontWeight="800" fill="#8a6d3b">bottom board (stays still)</text>
              {[60, 120, 200, 260].map((x) => (
                <g key={x}>
                  <rect x={x - 10} y="150" width="20" height="10" fill="#94a3a0" stroke="#1c2419" strokeWidth="1.2" />
                  <circle cx={x} cy="146" r="7" fill="#38bdf8" stroke="#1c2419" strokeWidth="1.5" />
                </g>
              ))}
              <rect x="40" y="128" width="240" height="11" fill="#e8cfa6" stroke="#1c2419" strokeWidth="2" />
              <text x="160" y="124" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#1c2419">top board (slides)</text>
              <g stroke="#1c2419" strokeWidth="1.6" fill="none">
                <path d="M140 116 L140 46 L180 46 L180 116" /><path d="M140 46 L180 81 M180 46 L140 81 M140 81 L180 116 M180 81 L140 116" />
                <path d="M136 46 L184 46 M136 81 L184 81" />
              </g>
              <text x="192" y="64" fontSize="10.5" fontWeight="800" fill="#1c2419">model tower</text>
              <line x1="160" y1="140" x2="160" y2="176" stroke="#059669" strokeWidth="3" />
              <line x1="125" y1="140" x2="125" y2="176" stroke="#dc2626" strokeWidth="3" strokeDasharray="5 3" />
              <line x1="195" y1="140" x2="195" y2="176" stroke="#dc2626" strokeWidth="3" strokeDasharray="5 3" />
              <defs><marker id="sa" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="#1c2419" /></marker></defs>
              <path d="M200 30 L262 30" stroke="#1c2419" strokeWidth="2" markerEnd="url(#sa)" markerStart="url(#sa)" />
              <text x="231" y="24" textAnchor="middle" fontSize="11" fontWeight="900">shake ↔</text>
              <text x="8" y="22" fontSize="11" fontWeight="900" fill="#059669" stroke="#fff" strokeWidth="4" paintOrder="stroke">MIDDLE line</text>
              <text x="8" y="38" fontSize="11" fontWeight="900" fill="#dc2626" stroke="#fff" strokeWidth="4" paintOrder="stroke">SHAKE lines</text>
              <text x="8" y="51" fontSize="10" fontWeight="800" fill="#dc2626" stroke="#fff" strokeWidth="4" paintOrder="stroke">1 in / 2.5 cm each side</text>
            </svg>
            <ol>
              <li>Mark the edge of the top board with a strip of tape.</li>
              <li>On the bottom board, put a tape line right under it: the <b>middle</b> line.</li>
              <li>Measure <b>1 inch (2.5 cm)</b> to each side and add two more lines: the <b>shake</b> lines.</li>
              <li>When you shake, slide the top board out to a shake line and back past the middle to the other line, every time. Same shake = fair test.</li>
            </ol>

            <h2>Test it</h2>
            <ul>
              <li>Build a tower at least 12 inches (30 cm) tall in 10 minutes, then set it in the middle of the top board.</li>
              <li>Shake shake line to shake line, about 2 times a second, for 10 seconds. Use the Class drill timer on the Quake Ready page.</li>
              <li>Record it: standing, leaning, or fell. Then add triangles (bracing), widen the base or move weight lower, and test again with the same shake.</li>
              <li>Switch builders. Only change one thing at a time.</li>
            </ul>
            <div className="box safety">
              <p><b>⚠ Safety:</b> count the marbles out and back in. Marbles on the floor are a slip hazard. Shake with your hands only, never by jumping or bumping the desk, and keep faces back from snapping spaghetti. Don&apos;t eat the building supplies.</p>
            </div>
          </div>
        </div>
        <p className="foot">Based on classroom shake-table activities used in earthquake engineering education. A model shows why bracing, wide bases and low weight help; it doesn&apos;t predict how a real building will do. Real engineers test on large shake tables and follow building codes. bedrock.doppsclass.com/quake-ready/</p>
      </div>
    </PrintSheet>
  );
}
