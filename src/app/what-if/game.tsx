"use client";
// ── wave-twinB ── What If? : twin of Dopps Class "The What If Game" (whatif.html). Same interaction: read a scenario,
// pick what you think happens, see the outcome, the best (most accurate) answer, the effects, a takeaway and a question.
// The effects are on Earth's four spheres (Chapter 3) instead of the health triangle.
import Link from "next/link";
import { useEffect, useState } from "react";
import { cx } from "@/components/twinb-kit";

// [chapter, chapter title, setup (*…* = highlighted), [[choice, what happens], …] (first = the best answer),
//  effects on [geosphere, hydrosphere, atmosphere, biosphere] (−2…+2), takeaway, think-about question]
type S = [number, string, string, [string, string][], [number, number, number, number], string, string];
const SCENARIOS: S[] = [
  [27, "Earth, Moon, and Sun", "What if Earth *suddenly stopped spinning*?",
    [["Everything not attached to bedrock (air, oceans, people) would keep moving east at up to about 1,000 mph, and huge winds and floods would sweep the planet.", "That's inertia. At the equator, Earth's surface moves about 1,000 miles per hour. The ground would stop, but the atmosphere and oceans wouldn't, so winds faster than any hurricane and enormous waves would scour the surface."],
     ["We would all float off into space.", "Gravity doesn't come from spinning. It comes from Earth's mass, so you'd stay on the ground. You'd actually weigh a tiny bit more at the equator, because spin slightly lightens you there."],
     ["Not much. We'd just lose day and night.", "A sudden stop would be a disaster because of inertia. Even a slow stop would change everything: one side of Earth would face the Sun for about six months at a time."]],
    [-1, -2, -2, -2], "Earth spins once about every 24 hours, so the equator moves about 1,000 mph and Idaho (about 44°N) moves roughly 750 mph. We don't feel it because everything around us, including the air, moves with us.", "Why don't we feel Earth spinning right now?"],
  [15, "Volcanoes", "What if the *Yellowstone supervolcano* had a super-eruption today?",
    [["Ash would fall across much of the U.S., including Idaho, and the climate would cool for a few years. It would be a huge disaster, but not the end of the world.", "USGS computer models show ash up to feet deep within a few hundred miles, inches deep across much of the interior of the country, and only a light dusting on the coasts. Sulfur gas high in the atmosphere would reflect sunlight and cool Earth for a few years."],
     ["It would wipe out all life on Earth.", "Yellowstone has had three super-eruptions (about 2.1 million, 1.3 million and 640,000 years ago), and life went on each time. It would be terrible for the region, not the planet."],
     ["Lava would flood the whole country.", "Lava flows stay within tens of miles of a vent. The big danger from a supervolcano is ash and gas, not rivers of lava."]],
    [-2, -1, -2, -2], "The Yellowstone hotspot made Idaho's Snake River Plain: as the North American Plate slid southwest over it, older calderas were left behind across southern Idaho. The USGS puts the chance of a super-eruption in any given year at about 1 in 730,000.", "How could ash in the air change Idaho's farms for years afterward?"],
  [22, "Climate and Climate Change", "What if *all of Earth's ice* melted?",
    [["Sea level would rise about 230 feet (70 meters), flooding coastal cities. It would take thousands of years.", "Almost all of that water is locked in the ice sheets on Antarctica and Greenland. Melting all of it would take a very long time, but even a few feet of rise floods low coastlines."],
     ["The oceans would rise a few inches.", "There is far too much land ice for that. Antarctica's ice sheet alone is up to about 3 miles thick."],
     ["Melting floating sea ice would raise sea level the most.", "Floating ice already displaces its own weight in water, like ice in a glass. It's ice on land that raises sea level when it melts into the ocean."]],
    [-1, 2, -1, -2], "About 70 m (230 ft) of sea-level rise is the USGS estimate if all glaciers and ice sheets melted. Melting land ice raises sea level; melting sea ice does not.", "Why does ice on land matter more for sea level than ice floating in the ocean?"],
  [27, "Earth, Moon, and Sun", "What if Earth had *no Moon*?",
    [["Tides would be much smaller, nights would be darker, and Earth's tilt would probably wobble more over long times.", "The Sun still makes tides, but they're only about half as strong as the Moon's. Many scientists think the Moon also steadies Earth's tilt, which keeps seasons from swinging wildly over millions of years."],
     ["Earth would stop spinning.", "Earth spins on its own. The Moon actually slows Earth's spin a tiny bit over time through tidal friction."],
     ["We'd have no more seasons.", "Seasons come from Earth's tilt (about 23.5°), not from the Moon. We'd still have summer and winter."]],
    [0, -2, 0, -1], "The Moon's gravity pulls on Earth's oceans, making two tidal bulges. With no Moon, only the Sun's weaker tides would remain.", "Which living things depend on tides?"],
  [13, "Plate Tectonics", "What if *plate tectonics stopped* for good?",
    [["Over millions of years, erosion would wear the mountains down, new volcanoes and big earthquakes would mostly stop, and the rock cycle would slow way down.", "Plate motion builds mountains and recycles rock. Without it, weathering and erosion would keep going, slowly flattening the land, and Earth would lose a key way of recycling carbon."],
     ["The continents would crash together right away.", "Plates move only about as fast as your fingernails grow, a few centimeters a year. Stopping them wouldn't cause a crash."],
     ["Nothing would change.", "Mountains like the Rockies, Idaho's earthquakes and the Pacific Northwest's volcanoes all come from plate motion. A lot would change, just slowly."]],
    [-2, 0, -1, -1], "Earth's internal heat drives the plates. Mountains go up through tectonics and come down through weathering and erosion: two sides of the rock cycle.", "Which Idaho landforms would slowly disappear?"],
  [19, "The Atmosphere", "What if Earth had *no atmosphere*?",
    [["No air to breathe, a black sky, no sound, and huge temperature swings, like the Moon.", "The Moon has almost no atmosphere: its surface reaches about 250 °F in daylight and about −200 °F at night. Liquid water couldn't last at the surface, and every small meteor would hit the ground."],
     ["The sky would still be blue.", "The sky is blue because air molecules scatter blue sunlight. With no air, the sky would be black even in the day."],
     ["It would be about the same, just harder to breathe.", "The atmosphere also blocks harmful ultraviolet light, carries weather and water vapor, and keeps temperatures steady. Life as we know it couldn't survive."]],
    [-1, -2, -2, -2], "The atmosphere is mostly nitrogen (about 78%) and oxygen (about 21%). It's thin, but it protects life, makes weather and keeps temperatures livable.", "Which layer of the atmosphere protects us from ultraviolet light?"],
  [22, "Climate and Climate Change", "What if there were *no greenhouse effect* at all?",
    [["Earth's average temperature would be about 0 °F (−18 °C) instead of about 59 °F (15 °C), and most of the planet would freeze.", "Greenhouse gases like water vapor and carbon dioxide absorb heat that Earth gives off and send some back down. That natural greenhouse effect keeps Earth warm enough for liquid oceans."],
     ["Earth would be warmer.", "It's the other way around. The greenhouse effect traps heat. Without it, heat would escape to space much faster."],
     ["Nothing would change, because the greenhouse effect is only from pollution.", "There has always been a natural greenhouse effect. Burning fossil fuels adds more carbon dioxide, which makes it stronger."]],
    [0, -2, -1, -2], "A natural greenhouse effect is good for life. The problem today is that extra carbon dioxide and methane are strengthening it, warming the climate.", "Why is \"more greenhouse gas\" a problem if some is good?"],
  [14, "Earthquakes", "What if a *magnitude 7 earthquake* hit central Idaho again, like the 1983 Borah Peak quake?",
    [["Expect strong shaking, landslides and rockfalls. Old unreinforced brick buildings are most at risk. During shaking: Drop, Cover and Hold On.", "In 1983 the magnitude 6.9 Borah Peak earthquake split the ground along the Lost River fault, leaving a fault scarp several feet high, and falling masonry killed two children in Challis. Idaho also had a magnitude 6.5 quake near Stanley in 2020."],
     ["Run outside as fast as you can while it's shaking.", "Most earthquake injuries happen when people try to move during shaking and get hit by falling objects. Drop, Cover and Hold On, then go out carefully when it stops."],
     ["Stand in a doorway.", "That old advice came from adobe houses. In modern homes a doorway isn't stronger than anywhere else, and the door can swing into you. Get under a sturdy table."]],
    [-2, -1, 0, -1], "Idaho sits in the Intermountain Seismic Belt, where the crust is being stretched. Normal faults like the Lost River fault are why central Idaho's mountains and valleys line up.", "Where would you take cover in your classroom?"],
  [11, "Groundwater", "What if the *Eastern Snake River Plain Aquifer* were pumped faster than it refills, year after year?",
    [["The water table would drop, wells would need to go deeper, and springs like Thousand Springs would flow less.", "The aquifer is water held in the cracks and pores of layered basalt. It drains out the canyon walls near Hagerman at Thousand Springs. Pumping more than the snowmelt, rivers and irrigation put back lowers the water table, and the springs feel it."],
     ["Nothing. It's an underground lake that never runs out.", "It isn't an open lake. It's water filling tiny spaces in rock, and it can be used up faster than it refills."],
     ["Pumping wells has no effect on rivers or springs.", "Groundwater and surface water are connected. In southern Idaho, falling groundwater levels have been linked to lower spring flows along the Snake River."]],
    [0, -2, 0, -2], "Recharge has to keep up with pumping. Idaho manages the aquifer with water rights and recharge projects that sink extra spring runoff back into the ground.", "Who uses water from the Snake River Plain Aquifer?"],
  [9, "Mass Movement, Wind, and Glaciers", "What if ancient *Lake Bonneville* filled up again today?",
    [["It would flood much of western Utah and could spill north through Red Rock Pass into Idaho, like the Bonneville Flood about 17,000 years ago.", "When Lake Bonneville overtopped Red Rock Pass, it poured into the Portneuf and Snake Rivers in one of the largest floods in Earth's history. It carved canyons and left giant rounded \"melon gravel\" boulders along the Snake River."],
     ["It would slowly fill the Great Salt Lake and nothing else.", "Lake Bonneville was huge, about the size of Lake Michigan. The Great Salt Lake is a small leftover of it."],
     ["Water can't flow from Utah into Idaho.", "It did once. Water flows downhill wherever the land allows, and Red Rock Pass, near Downey, Idaho, was the low point in Bonneville's rim."]],
    [-1, 2, 0, -1], "Lake Bonneville filled during the last ice age, when the climate was cooler and wetter. The Bonneville Flood shows how much work fast-moving water can do in a short time.", "What clues would a geologist look for to prove a giant flood happened?"],
  [28, "The Solar System, Stars, and the Universe", "What if the *Sun suddenly disappeared*?",
    [["We'd still see sunlight for about 8 minutes, then Earth would fly off in a straight line and slowly freeze.", "Light takes about 8 minutes and 20 seconds to travel the 93 million miles from the Sun. Gravity's change also travels at the speed of light, so Earth would keep orbiting for those 8 minutes, then head off in a straight line."],
     ["It would go dark instantly.", "The sunlight already on its way would keep arriving for about 8 minutes. We see the Sun as it was a little over 8 minutes ago."],
     ["Earth would fall into the spot where the Sun was.", "Without the Sun's gravity pulling it inward, Earth would move in a straight line, the direction it was already going, not inward."]],
    [-1, -2, -2, -2], "The Sun holds the planets in orbit and powers almost every process on Earth's surface: weather, the water cycle and photosynthesis.", "Which of Earth's spheres would freeze first, and which would stay warm the longest?"],
  [24, "Earth's History", "What if an *asteroid about 6 miles wide* hit Earth, like the one 66 million years ago?",
    [["Fires, dust and soot would block sunlight for months to years, food chains would collapse, and many species would go extinct.", "That's what happened at the end of the Cretaceous. The impact at Chicxulub, Mexico, helped end the age of dinosaurs, along with about three-quarters of the species on Earth."],
     ["It would just leave a big crater.", "The crater is the least of it. The impact threw so much material into the atmosphere that the whole planet felt it."],
     ["It would only matter near where it hit.", "Global effects come from dust and gas spreading through the atmosphere. That's why one impact changed life everywhere."]],
    [-2, -1, -2, -2], "Mass extinctions mark the boundaries in the geologic time scale. Today NASA tracks large near-Earth asteroids, and none of the big ones found so far is on a collision course.", "Why did small mammals survive when the dinosaurs didn't?"],
];

const SPH = ["Geosphere", "Hydrosphere", "Atmosphere", "Biosphere"];
const shuffle = <T,>(a: T[]) => { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
const Hi = ({ t }: { t: string }) => <>{t.split("*").map((p, i) => (i % 2 ? <em key={i} className="not-italic text-gold">{p}</em> : <span key={i}>{p}</span>))}</>;

export function WhatIfGame() {
  const [deck, setDeck] = useState<number[]>(() => SCENARIOS.map((_, k) => k));
  const [i, setI] = useState(0);
  const [order, setOrder] = useState<number[]>([0, 1, 2]);
  const [picked, setPicked] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const [played, setPlayed] = useState(0);
  useEffect(() => { setDeck(shuffle(SCENARIOS.map((_, k) => k))); setOrder(shuffle([0, 1, 2])); }, []);
  const n = SCENARIOS.length;
  const fx = (label: string, v: number) => (
    <span key={label} className={cx("rounded-full px-2.5 py-0.5 text-[12.5px] font-extrabold", v > 0 ? "bg-emerald/15 text-emerald" : v < 0 ? "bg-crimson/15 text-crimson" : "bg-fg/[0.07] text-muted")}>
      {v > 0 ? "▲" : v < 0 ? "▼" : "•"} {label}{v ? " " + (v > 0 ? "+" : "") + v : ""}</span>
  );
  const pick = (k: number) => { if (picked != null) return; setPicked(k); setPlayed(played + 1); if (k === 0) setBest(best + 1); };
  const next = () => { setI(i + 1); setPicked(null); setOrder(shuffle([0, 1, 2])); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const again = () => { setI(0); setBest(0); setPlayed(0); setPicked(null); setOrder(shuffle([0, 1, 2])); setDeck(shuffle(SCENARIOS.map((_, k) => k))); };
  const s = i < n ? SCENARIOS[deck[i]] : null;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap gap-2">
        <span className="glass rounded-full px-3 py-1 text-sm font-extrabold">Scenario {Math.min(i + 1, n)} of {n}</span>
        <span className="glass rounded-full px-3 py-1 text-sm font-extrabold">⭐ Best answer found {best} of {played}</span>
      </div>
      {!s ? (
        <div className="block-panel mt-4 p-6 text-center">
          <h2 className="font-display text-3xl font-extrabold text-gold">You finished all {n}! 🏆</h2>
          <p className="mt-2 leading-relaxed">You found the best answer in <b>{best} of {n}</b> scenarios. The pattern: Earth&apos;s spheres are connected, so a change in one (the air, the water, the rock or life) spreads to the others.</p>
          <button onClick={again} className="btn-block btn-grass mt-4">Play again ↻</button>
        </div>
      ) : (
        <div className="block-panel mt-4 p-5">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-muted"><Link href={`/chapters/${s[0]}/`} className="hover:text-fg hover:underline">Chapter {s[0]} · {s[1]}</Link></div>
          <div className="my-2 text-lg font-extrabold leading-snug sm:text-xl"><Hi t={s[2]} /></div>
          <div className="mt-3 grid gap-2">
            {order.map((k) => (
              <button key={k} disabled={picked != null} onClick={() => pick(k)}
                className={cx("min-h-12 rounded-xl border-2 px-3.5 py-3 text-left text-[15px] font-bold leading-snug transition",
                  picked === k ? "border-gold bg-gold/10" : picked != null && k === 0 ? "border-emerald" : "border-line",
                  picked == null && "hover:border-sky hover:bg-sky/10")}>
                {picked != null && k === 0 ? "⭐ " : ""}{s[3][k][0]}
              </button>
            ))}
          </div>
          {picked != null && (
            <>
              <div className="mt-3.5 rounded-xl bg-fg/[0.05] p-3.5 text-[15px] leading-relaxed"><b>{picked === 0 ? "⭐ Best answer! " : "What really happens: "}</b>{s[3][picked][1]}
                <div className="mt-2 flex flex-wrap gap-1.5">{SPH.map((l, j) => fx(l, s[4][j]))}</div></div>
              {picked !== 0 && <div className="mt-2.5 rounded-xl bg-fg/[0.05] p-3.5 text-[15px] leading-relaxed"><b>⭐ The best answer: </b>{s[3][0][0]} {s[3][0][1]}</div>}
              <div className="mt-3 rounded-lg border-l-4 border-sky bg-sky/10 px-3 py-2.5 text-sm leading-relaxed">💡 {s[5]}</div>
              <div className="mt-3 text-sm leading-relaxed"><b className="block">Think about it:</b>{s[6]}</div>
              <button onClick={next} className="btn-block btn-grass mt-4">{i + 1 < n ? "Next scenario ▶" : "See my results"}</button>
            </>
          )}
        </div>
      )}
      <p className="mt-4 text-sm leading-relaxed text-muted">Optional, just for thinking it through, and great for a class discussion. The effects show which of Earth&apos;s four spheres would be hit hardest (▼) or gain (▲).</p>
    </div>
  );
}
// ── end wave-twinB ──
