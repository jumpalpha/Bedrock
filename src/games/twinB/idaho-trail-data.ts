// ── wave-twinB ── The Idaho Trail: content (twin of Dopps Class trail_data.js, The Wellness Trail).
// An Oregon Trail-style trek across Idaho's geology. Same format and numbers as the original; Earth science content.
//
// Event format: { id, realm (1-5, or 0 = any realm), ch, title, text, choices: [ [label, good?, effects, feedback], ... ] }
// Effects (all optional): body / mind / social (party strength: body, mind, team), food, water, meds, parts, coins,
//   day (lose a trail day), hurt / sick (a random traveler gets hurt / sick), heal (cure one), hp (random traveler hp change)
// A good answer also earns +5 coins and counts toward the score.
export type Fx = Partial<Record<"body" | "mind" | "social" | "food" | "water" | "meds" | "parts" | "coins" | "hp" | "hurt" | "sick" | "heal" | "day", number>>;
export type Realm = { n: number; name: string; chs: number[]; color: string; sky: [string, string] };
export type Landmark = { mi: number; name: string; kind: string; icon: string; text: string; realm?: number };
export type Ev = { id: string; realm: number; ch: number; title: string; text: string; choices: [string, boolean, Fx, string][] };
export type Luck = { id: string; text: string; parts?: boolean; fx?: Fx };
export type Rig = { n: number; icon: string; animal: string; wagon: string; title: string };
export type Pace = { label: string; mi: number; body: number; mind: number; note: string };
export type Ration = { label: string; food: number; body: number; mind: number; note: string };

export const TOTAL = 1200;
export const DAY_CAP = 200;

export const REALMS: Realm[] = [
  { n: 1, name: "Snake River Plain", chs: [5, 15], color: "#8C9A5B", sky: ["#8ec5ff", "#f6e7b4"] },
  { n: 2, name: "Craters of the Moon", chs: [7, 12], color: "#6E6A7C", sky: ["#9fb6ff", "#f2d6ff"] },
  { n: 3, name: "Borah Peak Country", chs: [14, 16], color: "#7FA7C9", sky: ["#5a7fd6", "#ffc9a3"] },
  { n: 4, name: "Bonneville Flood Country", chs: [9, 10, 11], color: "#D9A75A", sky: ["#ffb38a", "#ffe1b8"] },
  { n: 5, name: "Hells Canyon", chs: [8, 13, 23], color: "#B5764A", sky: ["#7fd3c8", "#fff0b3"] },
];

// kind: fort (trading post + Realm Trial), river (crossing + water), spring (water), sight (scenic), forage, steep, finish
export const LANDMARKS: Landmark[] = [
  { mi: 0, name: "Island Park Caldera", kind: "start", icon: "🏕️", text: "Your journey begins at the edge of the Yellowstone hotspot. 1,200 miles of Idaho geology stand between you and Hells Canyon." },
  { mi: 80, name: "Mesa Falls", kind: "spring", icon: "💧", text: "The Henrys Fork plunges over Upper Mesa Falls, about 114 feet, across volcanic rock left by a Yellowstone eruption. Good place to refill water." },
  { mi: 160, name: "Menan Buttes", kind: "sight", icon: "⛰️", text: "Two huge tuff cones. They formed when rising basalt magma hit wet ground near the Snake River and blasted into ash. Your party feels the size of it all." },
  { mi: 240, name: "Craters of the Moon", kind: "fort", icon: "🌑", realm: 1, text: "A sea of black lava, some of it only about 2,000 years old. A trading post, and a Realm Trial on Chapters 5 and 15." },
  { mi: 320, name: "Big Lost River", kind: "river", icon: "🌊", text: "The Big Lost River runs out of the mountains, then sinks into the cracked basalt of the plain and disappears underground. First you have to cross it." },
  { mi: 400, name: "Lost River Springs", kind: "spring", icon: "♨️", text: "Cold springs feed the valley below the Lost River Range. Your party breathes easier here." },
  { mi: 480, name: "Mackay", kind: "fort", icon: "⛏️", realm: 2, text: "An old mining town under Idaho's tallest mountains. A trading post, and a Realm Trial on Chapters 7 and 12." },
  { mi: 560, name: "Borah Peak Fault Scarp", kind: "sight", icon: "🏔️", text: "Borah Peak, Idaho's highest point at 12,662 feet. At its foot, the 1983 earthquake left a step in the ground you can still see." },
  { mi: 640, name: "Big Wood River", kind: "river", icon: "🌊", text: "Snowmelt from the mountains makes the Big Wood River cold and fast. Time to decide how to cross." },
  { mi: 720, name: "Shoshone Falls", kind: "fort", icon: "🏞️", realm: 3, text: "The \"Niagara of the West\": 212 feet tall, taller than Niagara Falls. A trading post in Twin Falls, and a Realm Trial on Chapters 14 and 16." },
  { mi: 800, name: "Thousand Springs", kind: "forage", icon: "💦", text: "Groundwater from the Snake River Plain Aquifer pours out of the canyon wall. The valley below is green with orchards and gardens. Great foraging, and clean spring water." },
  { mi: 880, name: "Bonneville Flood Channel", kind: "river", icon: "🌊", text: "About 17,000 years ago, Lake Bonneville burst through Red Rock Pass and roared down this canyon. Giant rounded boulders still line the Snake River." },
  { mi: 960, name: "Bruneau Dunes", kind: "fort", icon: "🏜️", realm: 4, text: "North America's tallest single sand dune, about 470 feet high. A trading post, and a Realm Trial on Chapters 9–11." },
  { mi: 1040, name: "Owyhee Canyonlands", kind: "sight", icon: "🪨", text: "Deep canyons cut through layers of rhyolite from huge eruptions millions of years ago. Watch your footing." },
  { mi: 1120, name: "Seven Devils Climb", kind: "steep", icon: "🗻", text: "The steepest climb on the trail, up to the rim above Hells Canyon. Hearts pound, lungs burn. A spring waits at the top." },
  { mi: 1200, name: "Hells Canyon", kind: "finish", icon: "🏞️", realm: 5, text: "You made it to Hells Canyon, North America's deepest river gorge, almost 8,000 feet deep! One last Realm Trial on Chapters 8, 13 and 23." },
];

export const PACE: Record<string, Pace> = {
  steady: { label: "Steady", mi: 12, body: 0, mind: 0, note: "12 mi/day · easy on the body" },
  brisk: { label: "Brisk", mi: 16, body: -1, mind: -1, note: "16 mi/day · a little tiring" },
  grueling: { label: "Grueling", mi: 20, body: -3, mind: -2, note: "20 mi/day · fastest, wears you down" },
};
export const RATIONS: Record<string, Ration> = {
  balanced: { label: "Full meals", food: 2, body: 1, mind: 0, note: "2 lb per person · keeps you strong" },
  light: { label: "Light meals", food: 1, body: -1, mind: -1, note: "1 lb per person · saves food" },
  skip: { label: "Skip meals", food: 0, body: -4, mind: -3, note: "no food · energy and mood crash fast" },
};
export const PRICES: Record<string, [number, number, string]> = { food: [25, 8, "lb of food"], water: [5, 4, "days of water"], meds: [1, 12, "first-aid kit"], parts: [1, 10, "spare wagon wheel"] };

export const BOT_NAMES = ["Rosa", "Eli", "Maya", "Theo", "Ana", "Sam", "Jade", "Leo", "Nia", "Owen"];
export const COMPANIONS = ["Jake", "Brielle", "Marcus", "Hazel", "Tomas", "Kenzie"];

const E = (id: string, realm: number, ch: number, title: string, text: string, choices: [string, boolean, Fx, string][]): Ev => ({ id, realm, ch, title, text, choices });

export const EVENTS: Ev[] = [
  // ───────────── Realm 1 · Snake River Plain (Ch 5 Igneous Rocks, Ch 15 Volcanoes) ─────────────
  E("r1-basalt", 1, 5, "Black Rock Everywhere", "The plain is paved with dark, fine-grained rock full of little holes. Your party argues about what it is.",
    [["Basalt: lava that cooled fast at the surface. The holes are gas bubbles (vesicles).", true, { mind: 4 }, "Right. Basalt is an extrusive igneous rock. Fast cooling makes crystals too small to see, and escaping gas leaves vesicles (Ch 5)."],
     ["Granite, from deep underground.", false, { mind: -2 }, "Granite is intrusive: it cools slowly underground, so it's light-colored with crystals you can see (Ch 5)."],
     ["Sandstone made of black sand.", false, { mind: -2 }, "Sandstone is sedimentary, made of cemented sand grains. This rock formed from lava (Ch 5)."]]),
  E("r1-hotspot", 1, 15, "Volcanoes in the Middle of a Plate?", "Idaho isn't on a plate boundary, but the Snake River Plain is covered with volcanoes. A traveler asks why.",
    [["A hotspot: a plume of hot mantle. The plate slid southwest over it, leaving a trail of volcanoes that leads to Yellowstone.", true, { mind: 5 }, "That's the Yellowstone hotspot (Ch 15). The Snake River Plain is the track of the North American Plate moving over it."],
     ["A subduction zone runs right under Idaho.", false, { mind: -2 }, "Subduction makes volcano chains like the Cascades, far to the west (Ch 13). The Snake River Plain is a hotspot track."],
     ["Meteors hit here and melted the rock.", false, { mind: -3 }, "The craters and cones on the plain are volcanic, not impact craters (Ch 15)."]]),
  E("r1-shield", 1, 15, "Gentle Slopes", "You pass a broad hill with very gentle slopes, built from many thin, dark lava flows. What kind of volcano is it?",
    [["A shield volcano, built by runny basaltic lava.", true, { mind: 3 }, "Low-silica basalt flows easily and spreads out, building wide, gentle shield volcanoes (Ch 15)."],
     ["A cinder cone.", false, { mind: -1 }, "Cinder cones are small and steep, built from loose chunks of lava thrown into the air (Ch 15)."],
     ["A composite volcano like Mount St. Helens.", false, { mind: -2 }, "Composite volcanoes are tall and steep, with layers of ash and thick lava, and they erupt explosively (Ch 15)."]]),
  E("r1-obsidian", 1, 5, "Shiny Black Glass", "Someone finds a chunk of glassy black rock that breaks with sharp, curved edges.",
    [["Obsidian: lava that cooled so fast that no crystals could form.", true, { coins: 5, mind: 2 }, "Obsidian is volcanic glass (Ch 5). Native peoples traded Idaho obsidian for sharp tools and points."],
     ["A big crystal of a mineral.", false, { mind: -2 }, "Minerals have an orderly crystal structure. Obsidian is glass: it has none (Ch 4–5)."],
     ["A lump of coal.", false, { mind: -2 }, "Coal is sedimentary rock made from ancient plants. It's dull and breaks into blocks, not glass (Ch 25)."]]),
  E("r1-viscosity", 1, 15, "Two Kinds of Lava", "One old flow is dark and spread for miles. Another is light-colored and piled up thick near its vent. What explains the difference?",
    [["Silica. Low-silica basalt is runny; high-silica rhyolite is thick and sticky (viscous).", true, { mind: 4 }, "Viscosity depends mostly on silica. Thick rhyolite traps gas, which is why rhyolite eruptions, like Yellowstone's, can be so explosive (Ch 15)."],
     ["Only temperature. The light one was colder.", false, { mind: -1 }, "Temperature matters, but silica content is the big difference between basalt and rhyolite (Ch 15)."],
     ["The light one is just older and faded.", false, { mind: -2 }, "Color comes from composition: light rocks are rich in silica, dark rocks are rich in iron and magnesium (Ch 5)."]]),
  E("r1-ash", 1, 15, "Ash on the Wind", "Wind kicks up a cloud of fine volcanic ash from an old deposit, and it starts blowing straight at you.",
    [["Cover your nose and mouth, protect your eyes, and keep the supplies covered.", true, { body: 2 }, "Volcanic ash is tiny bits of rock and glass, not soft soot. It scratches eyes and irritates lungs (Ch 15)."],
     ["Breathe it in. It's just dust.", false, { body: -6, sick: 1 }, "Ash particles are sharp and can damage lungs. Always cover up (Ch 15)."],
     ["Wash it off the wagon with your drinking water.", false, { water: -5 }, "Wet ash turns into a heavy, cement-like paste, and now you're short on water (Ch 15)."]]),

  // ───────────── Realm 2 · Craters of the Moon (Ch 7 Rock Cycle, Ch 12 Earth's Interior) ─────────────
  E("r2-tube", 2, 7, "A Cave in the Lava", "You find a long tunnel running through the lava field. How did it form?",
    [["A lava tube: the top of a flow cooled into a crust while hot lava kept flowing underneath, then drained out.", true, { mind: 4 }, "Craters of the Moon has many lava tubes you can walk through (Ch 15)."],
     ["Miners dug it.", false, { mind: -2 }, "The smooth walls and dripped-lava ceiling show it formed from flowing lava, not tools."],
     ["Groundwater dissolved it, like a limestone cave.", false, { mind: -1 }, "Limestone caves are dissolved by acidic groundwater (Ch 11). Basalt doesn't dissolve like that; this cave formed from lava."]]),
  E("r2-cycle", 2, 7, "Rock Cycle Riddle", "A traveler says the black basalt here could someday become sandstone. Could it?",
    [["Yes. Weathering and erosion break it into sediment, which can be compacted and cemented into sedimentary rock.", true, { mind: 5 }, "That's the rock cycle (Ch 7): any rock can become any other kind, given time and the right processes."],
     ["No. Igneous rock stays igneous forever.", false, { mind: -2 }, "The rock cycle has no dead ends (Ch 7). Weathering attacks every rock at the surface."],
     ["Only if it melts first.", false, { mind: -1 }, "Melting makes magma, which cools into igneous rock. Sedimentary rock needs weathering, erosion and deposition (Ch 7)."]]),
  E("r2-aa", 2, 5, "Ropy or Jagged?", "Some lava here is smooth and ropy. Some is a jumble of sharp, jagged chunks. Which do you walk the party across?",
    [["The smooth, ropy pāhoehoe. Jagged ʻaʻā lava shreds boots and skin.", true, { body: 2 }, "Both are basalt; ʻaʻā is rougher because it cooled and broke apart as it moved. Hawaiian words, same rock (Ch 15)."],
     ["The jagged ʻaʻā. It has better grip.", false, { hurt: 1 }, "ʻAʻā is razor-sharp. Someone slipped and got cut."],
     ["Whichever is closer. Lava is lava.", false, { hurt: 1 }, "The jagged flow cost you: a bad fall on sharp rock."]]),
  E("r2-layers", 2, 12, "What's Down There?", "At the campfire, someone asks what's under all this lava, all the way to the center of Earth.",
    [["Crust, then mantle, then a liquid outer core and a solid inner core.", true, { mind: 4, social: 2 }, "Earth is layered by composition and by how solid each layer is (Ch 12)."],
     ["A huge sea of lava right under the crust.", false, { mind: -2 }, "The mantle is solid rock that flows very slowly. Magma forms only in certain places (Ch 12)."],
     ["The same solid rock all the way through.", false, { mind: -2 }, "Seismic waves show Earth has distinct layers, including a liquid outer core (Ch 12)."]]),
  E("r2-seismic", 2, 12, "How Do They Know?", "Nobody has ever drilled into the mantle. So how do scientists know what's inside Earth?",
    [["Seismic waves change speed and bend as they pass through different layers, and S waves can't pass through the liquid outer core.", true, { mind: 5 }, "Earthquake waves are like an X-ray of Earth (Ch 12). The S-wave shadow zone revealed the liquid outer core."],
     ["Deep mines reach the core.", false, { mind: -2 }, "The deepest hole ever drilled is only about 7.6 miles deep. The core starts about 1,800 miles down (Ch 12)."],
     ["Volcanoes bring up pieces of the core.", false, { mind: -2 }, "Volcanoes bring up magma from the upper mantle and crust, not the core (Ch 12)."]]),
  E("r2-heat", 2, 19, "Noon on Black Rock", "The black lava is baking in the summer sun, and the trail has no shade.",
    [["Travel early and late, rest in shade at midday, and drink water.", true, { body: 2 }, "Dark surfaces absorb more sunlight than light ones (low albedo), so lava fields get very hot (Ch 19)."],
     ["Push through the hottest part of the day.", false, { body: -5, water: -2 }, "Heat on dark rock adds up fast. The party is drained and drank extra water."],
     ["Take off your boots to cool your feet.", false, { hurt: 1 }, "Sun-baked basalt can burn bare feet. Ouch."]]),

  // ───────────── Realm 3 · Borah Peak Country (Ch 14 Earthquakes, Ch 16 Mountain Building) ─────────────
  E("r3-quake", 3, 14, "The Ground Shakes!", "Shaking starts while you're camped under a rocky slope.",
    [["Move away from the slope if you can, then drop, cover your head and hold on until it stops.", true, { body: 2 }, "Falling rocks and objects cause most earthquake injuries. In 1983 the Borah Peak quake set off rockfalls across the range (Ch 14)."],
     ["Climb the slope for a better view.", false, { hurt: 1 }, "Shaking loosens rocks. Someone got hit by a falling rock."],
     ["Hide under the wagon right next to the slope.", false, { hurt: 1 }, "Too close to the slope: a rockfall dented the wagon and someone got hurt."]]),
  E("r3-fault", 3, 14, "A Step in the Ground", "You see a long, sharp step in the ground where one side dropped down. Here the crust is being pulled apart. What kind of fault is it?",
    [["A normal fault: tension pulls the crust apart and one block slides down.", true, { mind: 5 }, "The Lost River fault is a normal fault. In 1983 it moved, leaving a scarp several feet high (Ch 14)."],
     ["A reverse fault.", false, { mind: -2 }, "Reverse faults form from compression, which pushes one block up and over the other (Ch 14)."],
     ["A strike-slip fault.", false, { mind: -2 }, "In strike-slip faults, blocks slide sideways past each other, like the San Andreas Fault (Ch 14)."]]),
  E("r3-range", 3, 16, "Why These Mountains?", "The Lost River Range rises like a long, straight wall beside a flat valley. How did it form?",
    [["Fault-block mountains: the crust stretched, blocks tilted up along normal faults, and valleys dropped down.", true, { mind: 4 }, "Central Idaho is part of the Basin and Range, where stretching makes ranges and valleys side by side (Ch 16)."],
     ["Folded mountains from two continents crashing together.", false, { mind: -1 }, "Folded mountains like the Himalayas form from compression. These came from tension (Ch 16)."],
     ["They're old volcanoes.", false, { mind: -2 }, "These ranges are made of uplifted sedimentary layers, not volcanic cones (Ch 16)."]]),
  E("r3-magnitude", 3, 14, "How Much Bigger?", "A traveler says a magnitude 7 earthquake is \"just a little bigger\" than a magnitude 6.",
    [["No. Each step up in magnitude releases about 32 times more energy.", true, { mind: 5 }, "Magnitude scales go up by powers. A magnitude 7 releases about 32 times the energy of a 6, and about 1,000 times a 5 (Ch 14)."],
     ["Right, it's only 1 more.", false, { mind: -2 }, "The scale isn't like a ruler: every whole number is a big jump in energy (Ch 14)."],
     ["It's exactly twice as big.", false, { mind: -2 }, "Each step is about 32 times the energy, not 2 times (Ch 14)."]]),
  E("r3-epicenter", 3, 14, "Find the Epicenter", "A ranger has readings from three seismograph stations, each showing how far away the quake was.",
    [["Draw a circle around each station with that distance. The epicenter is where all three circles cross.", true, { mind: 4, coins: 5 }, "That's triangulation (Ch 14). The gap between P and S wave arrivals tells each station's distance."],
     ["One station is enough.", false, { mind: -2 }, "One station gives a distance, not a direction: the quake could be anywhere on that circle (Ch 14)."],
     ["Go where the damage looks worst.", false, { day: 1 }, "Damage depends on ground and buildings too. You spent a day wandering (Ch 14)."]]),
  E("r3-thin-air", 3, 19, "Thin Air", "Climbing toward the high country, your party gets out of breath fast.",
    [["Slow down and drink water. Air pressure is lower up high, so each breath holds less oxygen.", true, { body: 3 }, "Air pressure drops with altitude because there's less air above you (Ch 19)."],
     ["Sprint to the top before the air gets thinner.", false, { body: -5, sick: 1 }, "Pushing hard at altitude caused altitude sickness: headache and nausea."],
     ["The air's the same. You're just out of shape.", false, { body: -3 }, "Air pressure really does drop with height (Ch 19). Pacing yourself matters."]]),

  // ───────────── Realm 4 · Bonneville Flood Country (Ch 9 Mass Movement/Wind/Glaciers, Ch 10 Rivers, Ch 11 Groundwater) ─────────────
  E("r4-boulders", 4, 10, "Giant Rounded Boulders", "Rounded boulders the size of cars are scattered along the river, far from any cliff.",
    [["\"Melon gravel\": the Bonneville Flood rolled and rounded them, then dropped them as the water slowed.", true, { mind: 5 }, "Fast water can carry huge loads; when it slows, the biggest pieces drop first (Ch 10)."],
     ["A glacier pushed them here.", false, { mind: -1 }, "Glaciers leave angular, scratched rocks in moraines. These are rounded by tumbling in water (Ch 9)."],
     ["Farmers moved them.", false, { mind: -2 }, "They weigh tons. Only a flood this big could move them."]]),
  E("r4-bend", 4, 10, "Where to Cross?", "The river curves in a big bend. Where is the water fastest and deepest?",
    [["On the outside of the bend, where the river cuts into the bank. Cross on a straight stretch instead.", true, { mind: 3 }, "Water moves fastest on the outside of a meander and slowest on the inside, where sand bars form (Ch 10)."],
     ["On the inside of the bend.", false, { food: -10 }, "The inside is slow and shallow. You misjudged and lost some supplies."],
     ["It's the same everywhere.", false, { food: -10 }, "Rivers aren't the same across. The current grabbed some supplies."]]),
  E("r4-springs", 4, 11, "Water From a Wall", "Water pours out of the canyon wall high above the river. Where does it come from?",
    [["Groundwater moving through the cracked basalt of the Snake River Plain Aquifer, from snowmelt and rivers far upstream.", true, { mind: 4, water: 3 }, "Rock that's porous and permeable holds and moves groundwater. The aquifer drains out at Thousand Springs (Ch 11)."],
     ["A leaking pipe.", false, { mind: -2 }, "No pipes here. This is natural groundwater flow (Ch 11)."],
     ["Ocean water pushing inland.", false, { mind: -2 }, "Idaho is hundreds of miles from the ocean. This is fresh groundwater (Ch 11)."]]),
  E("r4-dune", 4, 9, "Sand on the Move", "Wind is howling at the dunes, and sand is sliding down the steep side of a dune.",
    [["The steep side faces away from the wind. Wind pushes sand up the gentle side, and it slides down the slip face.", true, { mind: 4 }, "That's how dunes migrate downwind (Ch 9)."],
     ["The steep side faces into the wind.", false, { mind: -2 }, "The gentle slope faces the wind; the steep slip face is on the sheltered side (Ch 9)."],
     ["Dunes never move.", false, { mind: -2 }, "Wind keeps moving dune sand, a little at a time (Ch 9)."]]),
  E("r4-flash", 4, 10, "Dark Clouds Upstream", "You're camped in a dry wash. Thunderstorms are building over the hills upstream.",
    [["Move camp to higher ground now. A flash flood can arrive even if it isn't raining where you are.", true, { body: 1 }, "Rain upstream can send a wall of water down a dry channel in minutes (Ch 10)."],
     ["Stay put. It's not raining here.", false, { food: -20, hurt: 1 }, "A flash flood roared through camp at night. Supplies lost and someone hurt."],
     ["Wait in the wash to watch the storm.", false, { food: -15, hurt: 1 }, "Never wait in a channel during storms. The water came fast."]]),
  E("r4-witch", 4, 11, "The Water Witch", "A stranger offers to find water with a forked stick for 10 coins.",
    [["No thanks. Groundwater is found with geology, test wells and maps of the water table, not sticks.", true, { mind: 3 }, "Dowsing has failed every fair scientific test. Hydrogeologists study rock layers instead (Ch 11)."],
     ["Pay him. It can't hurt.", false, { coins: -10 }, "He pointed at a spot and left with your coins. No water."],
     ["Pay him double to be sure.", false, { coins: -20, mind: -2 }, "Double the coins, same result (Ch 1: ask for evidence)."]]),

  // ───────────── Realm 5 · Hells Canyon (Ch 8 Weathering & Erosion, Ch 13 Plate Tectonics, Ch 23 Fossils & Geologic Time) ─────────────
  E("r5-carve", 5, 8, "What Carved This?", "Hells Canyon is deeper than the Grand Canyon. What made it?",
    [["The Snake River cutting down over millions of years as the land rose.", true, { mind: 4 }, "Running water is the main force of erosion on land (Ch 8, 10). Uplift gave the river more cutting power."],
     ["An earthquake split the ground open.", false, { mind: -2 }, "Earthquakes don't open canyons like this. Erosion did, slowly (Ch 8)."],
     ["A glacier scooped it out.", false, { mind: -1 }, "Glaciers make U-shaped valleys. Hells Canyon is a V-shaped river canyon (Ch 9)."]]),
  E("r5-terrane", 5, 13, "Islands in Idaho?", "A geologist says some rocks in Hells Canyon formed as volcanic islands out in the Pacific Ocean. How did they get here?",
    [["Plate motion carried the islands east and stuck them onto the edge of North America.", true, { mind: 5 }, "These added pieces are called accreted terranes. Western Idaho was once near the coastline (Ch 13)."],
     ["Sea level used to be higher than the mountains.", false, { mind: -2 }, "Sea level never rose that high. The rocks moved, not the ocean (Ch 13)."],
     ["A giant flood carried them.", false, { mind: -2 }, "Floods move boulders, not whole mountains of rock (Ch 13)."]]),
  E("r5-frost", 5, 8, "Split Boulders", "On the cold rim, boulders are split apart, with ice in the cracks at dawn.",
    [["Frost wedging: water freezes and expands by about 9%, prying the rock apart.", true, { mind: 4 }, "Repeated freezing and thawing is a powerful kind of mechanical weathering in mountains (Ch 8)."],
     ["Lightning split them.", false, { mind: -1 }, "Lightning can shatter rock, but ice in every crack points to frost wedging (Ch 8)."],
     ["The rocks dried out and cracked.", false, { mind: -1 }, "The ice is the clue: freezing water expands (Ch 8)."]]),
  E("r5-shell", 5, 23, "A Seashell in the Mountains", "High on the canyon wall, someone finds a fossil seashell in limestone.",
    [["The rock formed on an ancient sea floor, then plate motion and uplift raised it.", true, { mind: 4, coins: 5 }, "Fossils tell us about past environments (Ch 23). Marine fossils on land mean the land was once under the sea."],
     ["A bird dropped it.", false, { mind: -2 }, "It's inside the rock, so it was buried when the rock formed (Ch 23)."],
     ["The canyon flooded last year.", false, { mind: -2 }, "Turning a shell into a fossil in limestone takes far longer than a year (Ch 23)."]]),
  E("r5-layers", 5, 23, "Which Layer Is Oldest?", "Flat layers stack up the canyon wall, and a dark dike cuts straight through all of them.",
    [["The bottom layer is oldest, and the dike is younger than every layer it cuts.", true, { mind: 5 }, "Superposition and cross-cutting relationships are the rules of relative dating (Ch 23)."],
     ["The top layer is oldest.", false, { mind: -2 }, "In undisturbed layers, the oldest is on the bottom (law of superposition, Ch 23)."],
     ["The dike is the oldest thing there.", false, { mind: -2 }, "Something that cuts through layers must be younger than them (Ch 23)."]]),
  E("r5-rockfall", 5, 9, "Rocks on the Move", "After a rainstorm, small rocks are bouncing down a steep slope above the trail.",
    [["Wait for the slope to settle, then cross quickly and watch upslope. Don't stop under it.", true, { body: 1 }, "Rain loosens rock and soil; gravity does the rest. Rockfall is a fast kind of mass movement (Ch 9)."],
     ["Stop under the slope for a snack.", false, { hurt: 1 }, "A falling rock hit someone. Never linger below an active slope."],
     ["Climb up and push the loose rocks down.", false, { hurt: 1, day: 1 }, "That started a small slide. Someone got hurt and the trail was blocked for a day."]]),

  // ───────────── Extras (any realm) ─────────────
  E("x-water", 0, 11, "Crystal-Clear Creek", "A sparkling mountain creek. Thirsty travelers want to drink straight from it.",
    [["Boil or filter it first.", true, { water: 4 }, "Clear water can still carry microbes like Giardia from animals upstream. Treat backcountry water (Ch 11, 26)."],
     ["It's clear, so it's clean. Drink up!", false, { sick: 1 }, "Clear doesn't mean safe. Someone came down with Giardia."],
     ["Skip drinking until the next town.", false, { body: -5 }, "Dehydration is dangerous on the trail. Treat the water instead."]]),
  E("x-lightning", 0, 21, "Thunder on the Ridge", "Thunder rumbles close. You're crossing an open ridge.",
    [["Get off the ridge to lower ground, away from lone trees. If you can hear thunder, lightning is close enough to strike.", true, { body: 1 }, "Lightning tends to strike the tallest object around (Ch 21)."],
     ["Shelter under the tallest tree.", false, { hurt: 1 }, "Lone tall trees attract strikes. A nearby strike knocked someone down."],
     ["Keep going. The storm is still far away.", false, { hurt: 1 }, "Lightning can strike miles from the storm. A close strike sent the party scrambling."]]),
  E("x-pyrite", 0, 4, "Gold in the Creek?", "Shiny, brassy-yellow cubes glint in a creek. Is it gold?",
    [["Test it. Pyrite (fool's gold) leaves a greenish-black streak and is brittle; gold leaves a yellow streak and is soft.", true, { mind: 3, coins: 5 }, "Streak and hardness identify minerals better than color (Ch 4). It was pyrite, but you sold a nice specimen."],
     ["It's gold for sure! Load up the wagon.", false, { day: 1 }, "Hauling fool's gold cost you a day."],
     ["Shiny rocks are worthless. Ignore it.", false, { mind: -1 }, "Testing is what scientists do. You missed a chance to learn (Ch 4)."]]),
  E("x-garnet", 0, 4, "Red Crystals", "In a north Idaho creek, you find dark red crystals. A local says they're garnets. How could you check?",
    [["Try to scratch glass with one. Garnet is about 7 to 7.5 on the Mohs scale, harder than glass.", true, { mind: 4, coins: 5 }, "Hardness is a key mineral test (Ch 4). Idaho's state gem is the star garnet, found in only a few places in the world."],
     ["Taste it.", false, { mind: -2 }, "Taste only works for a few minerals, like halite (salt). Not garnet (Ch 4)."],
     ["Color alone proves it.", false, { mind: -1 }, "Many minerals share colors. Use hardness, streak and crystal shape (Ch 4)."]]),
  E("x-barometer", 0, 20, "Falling Pressure", "The barometer is dropping fast and high clouds are thickening from the west.",
    [["A storm is likely on the way. Make camp early and tie everything down.", true, { body: 2 }, "Falling air pressure usually means a low-pressure system and stormy weather (Ch 20)."],
     ["Falling pressure means clear skies. Push on.", false, { body: -4, food: -10 }, "Rising pressure brings clear skies; falling pressure brings storms (Ch 20). The storm caught you."],
     ["Barometers don't predict anything.", false, { body: -3 }, "Air pressure is one of the best clues to coming weather (Ch 20)."]]),
  E("x-polaris", 0, 27, "Which Way Is North?", "Clear night, no compass. Which star helps you find north?",
    [["Polaris, the North Star, found by following the pointer stars of the Big Dipper.", true, { mind: 3 }, "Polaris sits almost directly above Earth's North Pole, so it barely moves. Its height above the horizon roughly equals your latitude (Ch 2, 27)."],
     ["The brightest star in the sky.", false, { day: 1 }, "The brightest star at night is Sirius, not Polaris. You headed the wrong way for a day."],
     ["Any star near the horizon.", false, { day: 1 }, "Stars rise and set as Earth rotates. Only Polaris stays put (Ch 27)."]]),
  E("x-fire", 0, 26, "Breaking Camp", "Morning. Time to leave camp.",
    [["Drown the campfire, stir the ashes and feel for heat. Make sure it's dead out.", true, { social: 3 }, "Most wildfires are started by people. Idaho's dry summers make every spark count (Ch 26)."],
     ["Kick some dirt on it and go.", false, { day: 1, social: -3 }, "Buried coals can smolder for hours. The fire crept into grass and you lost a day helping put it out."],
     ["Leave it. It'll burn out on its own.", false, { day: 1, social: -4 }, "It didn't. You spent a day fighting a grass fire."]]),
];

export const LUCK: Luck[] = [
  { id: "l-wheel", text: "A wagon wheel cracks on a sharp lava rock.", parts: true },
  { id: "l-dust", text: "A dust storm blows across the plain. You lose a day.", fx: { day: 1, mind: -2 } },
  { id: "l-oxen", text: "Your oxen wandered off in the night. It takes a day to find them.", fx: { day: 1 } },
  { id: "l-ranch", text: "Friendly ranchers share a sack of Idaho potatoes with you.", fx: { food: 15, social: 3 } },
  { id: "l-huck", text: "You find a patch of wild huckleberries, Idaho's state fruit. (+10 lb food)", fx: { food: 10 } },
  { id: "l-spring", text: "A small, clear spring bubbles out of the basalt. (+4 water)", fx: { water: 4 } },
  { id: "l-view", text: "A gorgeous sunset lights up the mountains and lifts everyone's mood.", fx: { mind: 4 } },
  { id: "l-song", text: "Someone starts a song around the fire and everyone joins in.", fx: { social: 4, mind: 2 } },
  { id: "l-agate", text: "You find an agate by the trail and trade it at the next stop. (+8 coins)", fx: { coins: 8 } },
  { id: "l-squirrel", text: "Ground squirrels raided the food bag overnight. (-12 lb food)", fx: { food: -12 } },
];

// Rigs: each finish this term upgrades the student's wagon team. Drawn as SVG, so no art files are needed.
export const RIGS: Rig[] = [
  { n: 0, icon: "🐂", animal: "Ox", wagon: "Canvas wagon", title: "Greenhorn" },
  { n: 1, icon: "🐎", animal: "Horse", wagon: "Bronze wagon", title: "Trailblazer" },
  { n: 2, icon: "🦬", animal: "Bison", wagon: "Silver wagon", title: "Pathfinder" },
  { n: 3, icon: "🦕", animal: "Triceratops", wagon: "Gold wagon", title: "Rockhound Legend" },
  { n: 4, icon: "🐉", animal: "Magma Dragon", wagon: "Diamond wagon", title: "Magma Voyager" },
  { n: 5, icon: "👑", animal: "Crowned Magma Dragon", wagon: "Diamond wagon", title: "Grand Geologist" },
];
// ── end wave-twinB ──
