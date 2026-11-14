// The Sprite Arcade lineup. Kept free of game code so any page (e.g. home) can list the cards cheaply.
// Cover art lives at /art/game-<slug>.png; cards fall back to the emoji while it's missing.
export type ArcadeGame = {
  slug: string; title: string; subtitle: string; emoji: string; color: string; goal: string;
  // ── wave-arcadeA ── which arcade-page shelf the card sits on; no group = the Sprite Arcade posters
  group?: "classics" | "brain";
  section?: "classic" | "team" | "partner" | "classroom"; // wave-arcadeB: which arcade shelf (none = Sprite Arcade)
  href?: string; // ── wave-live ── the card opens this page instead of /arcade/play/<slug>/
};

export const arcadeGames: ArcadeGame[] = [
  { slug: "sprite-flap", title: "Sprite Flap", subtitle: "Fly through the volcanic vents!", emoji: "🌋", color: "#FF8C42", goal: "Score 15" },
  { slug: "sprite-dash", title: "Sprite Dash", subtitle: "Race across the Snake River Plain!", emoji: "☄️", color: "#FCD34D", goal: "Reach 1,000" },
  { slug: "sprite-run", title: "Sprite Run", subtitle: "Outrun the landslide!", emoji: "🪨", color: "#A78BFA", goal: "Run 1,000 m" },
  { slug: "sprite-snake", title: "Sprite Snake", subtitle: "Mine a chain of crystals!", emoji: "💎", color: "#22C55E", goal: "Score 150" },
  { slug: "sprite-sling", title: "Sprite Slingshot", subtitle: "Launch at the boulder fort!", emoji: "🎯", color: "#38BDF8", goal: "Clear 3 levels" },
  // ── wave-arcadeA ──
  { slug: "sprite-catch", title: "Sprite Catch", subtitle: "Catch falling crystals. Dodge the meteors, build combos!", emoji: "🧺", color: "#C48CFF", goal: "Score 1,000", group: "classics" },
  { slug: "sprite-slice", title: "Sprite Slice", subtitle: "Swipe to split flying space rocks. Don't slice the lava bombs!", emoji: "☄️", color: "#FF8C42", goal: "Score 800", group: "classics" },
  { slug: "sprite-maze", title: "Sprite Maze", subtitle: "Collect groundwater, dodge hazards. Star garnets turn the tables!", emoji: "💧", color: "#22D3EE", goal: "Clear the maze", group: "classics" },
  { slug: "sprite-climb", title: "Sprite Climb", subtitle: "Jump rolling boulders and climb to the Golden Geode!", emoji: "🧗", color: "#FCD34D", goal: "Grab the Golden Geode", group: "classics" },
  { slug: "sprite-dodge", title: "Sprite Dodge", subtitle: "The Magma King hurls lava bombs. Survive 60 seconds!", emoji: "👑", color: "#F25C45", goal: "Survive 60s", group: "classics" },
  { slug: "sprite-hoops", title: "Sprite Hoops", subtitle: "Toss rock samples into the bucket. Sink 7 of 10!", emoji: "🪣", color: "#F28C28", goal: "Sink 7 of 10", group: "classics" },
  { slug: "sprite-rider", title: "Sprite Rider", subtitle: "Dirt-bike Idaho's hills, ramps and lava fields!", emoji: "🏍️", color: "#84CC16", goal: "Finish track 1", group: "classics" },
  { slug: "sprite-memory", title: "Sprite Memory", subtitle: "Flip cards and match Earth science pairs before time runs out.", emoji: "🃏", color: "#A78BFA", goal: "Clear 2 levels", group: "classics" },
  { slug: "sprite-siege", title: "Sprite Siege", subtitle: "Defend your base from Earth's hazards. Answer questions for diamonds!", emoji: "🛡️", color: "#38BDF8", goal: "Reach wave 20", group: "classics" },
  { slug: "how-smart", title: "How Smart Am I?", subtitle: "Questions get harder when you're right. 3rd grade to grad school.", emoji: "🎓", color: "#F6C453", goal: "Beat a 10th grader", group: "brain" },
  { slug: "word-quest", title: "Word Quest", subtitle: "Guess the 5-letter Earth science word in 6 tries.", emoji: "🔤", color: "#34D399", goal: "Solve 3 words", group: "brain" },
  { slug: "vocab-slice", title: "Vocab Slice", subtitle: "Read the definition, slice the rock with the matching term.", emoji: "💎", color: "#5EEAD4", goal: "Match 10 terms", group: "brain" },
  // ── end wave-arcadeA ──
  // ── wave-arcadeB ──
  { slug: "meteor-invaders", title: "Meteor Invaders", subtitle: "Blast comets and space rocks. Beat 3 swarms!", emoji: "☄️", color: "#FF8C42", goal: "Beat 3 waves", section: "classic" },
  { slug: "rock-breaker", title: "Rock Breaker", subtitle: "Bounce a magma ball around the rock cycle.", emoji: "🧱", color: "#E8A33D", goal: "Clear 2 walls", section: "classic" },
  { slug: "field-trip-day", title: "Field Trip Day", subtitle: "Lava dash, boulder hurdles, scarp jump and more.", emoji: "🏅", color: "#FCD34D", goal: "3,000 all-around", section: "classic" },
  { slug: "hazard-showdown", title: "Hazard Showdown", subtitle: "Prepared or not? Which is safer? Myth or fact?", emoji: "⚖️", color: "#F25C45", goal: "Get 10 right", section: "classic" },
  { slug: "mineral-2048", title: "Mineral 2048", subtitle: "Merge minerals up the Mohs scale to diamond.", emoji: "💎", color: "#38BDF8", goal: "Reach 512 Corundum", section: "classic" },
  { slug: "strata-stack", title: "Strata Stack", subtitle: "Stack falling rock layers and clear 10 lines.", emoji: "🟫", color: "#C2703D", goal: "Clear 10 lines", section: "classic" },
  { slug: "crater-pong", title: "Crater Pong", subtitle: "Land a meteorite in 10 famous craters.", emoji: "🌑", color: "#A78BFA", goal: "Hit all 10 craters", section: "classic" },
  { slug: "planet-defense", title: "Planet Defense", subtitle: "Tower defense with Earth's atmosphere vs meteors and solar wind.", emoji: "🛡️", color: "#5EEAD4", goal: "Survive 10 waves", section: "classic" },
  { slug: "quake-sweeper", title: "Quake Sweeper", subtitle: "Minesweeper on a fault zone. Flag the hidden quakes!", emoji: "🫨", color: "#F6C453", goal: "Clear zone 1", section: "classic" },
  { slug: "blast-blocks", title: "Blast Blocks", subtitle: "Drag gem blocks, blast full rows and columns, chain combos!", emoji: "🧊", color: "#34D399", goal: "Score 2,000", section: "classic" },
  { slug: "lava-snipes", title: "Lava Snipes", subtitle: "Maze shooter: cap the lava vents with computer teammates, co-op or red vs. blue.", emoji: "🌋", color: "#FF6B3D", goal: "Cap every vent", section: "team" },
  { slug: "team-hangman", title: "Team Hangman", subtitle: "Hangman for 2–4 teams with Earth science words.", emoji: "🪢", color: "#84CC16", goal: "2–4 teams", section: "team" },
  { slug: "fossil-memory", title: "Fossil Memory", subtitle: "Match pairs of fossils, from trilobites to the Hagerman Horse.", emoji: "🦴", color: "#E9DCC2", goal: "Most pairs wins", section: "partner" },
  { slug: "bedrock-spin", title: "Bedrock Spin", subtitle: "Spin for a quick Earth science challenge to kick off or close class.", emoji: "🌀", color: "#F28C28", goal: "8 spins", section: "classroom" },
  // ── end wave-arcadeB ──
  // ── wave-classroom ── Dopps Class classroom (projector) games, game for game
  { slug: "bedrock-jeopardy", title: "Bedrock Jeopardy", subtitle: "Pick 5 realms × 5 values, hidden Daily Doubles, Final Jeopardy with wagers.", emoji: "📋", color: "#F6C453", goal: "2–4 teams", section: "classroom" },
  { slug: "deal-or-no-deal", title: "Deal or No Deal", subtitle: "25 briefcases hide points, Earth hazard estimations and bonus challenges.", emoji: "💼", color: "#C2703D", goal: "Beat the Banker", section: "classroom" },
  { slug: "wheel-of-fortune", title: "Wheel of Fortune", subtitle: "Spin, dodge Bankrupt, and solve Earth science key-term phrases.", emoji: "🎡", color: "#38BDF8", goal: "2–4 teams", section: "classroom" },
  { slug: "millionaire", title: "Who Wants to Be a Millionaire", subtitle: "15-step money ladder, three lifelines, safe havens at Q5 and Q10.", emoji: "💰", color: "#34D399", goal: "Reach $1,000,000", section: "classroom" },
  { slug: "hot-takes", title: "Hot Takes Buzzer Battle", subtitle: "4-player buzzers with Hot Take, Rapid Fire and Blitz rounds.", emoji: "⚡", color: "#FF8C42", goal: "4 players", section: "classroom" },
  { slug: "escape-room", title: "Earth Escape Room", subtitle: "Volcano Lab, Flood Zone, Quake City: puzzle chains on a 5-minute timer.", emoji: "🔐", color: "#5EEAD4", goal: "Escape 3 rooms", section: "classroom" },
  { slug: "bedrock-survivor", title: "Bedrock Survivor", subtitle: "Earn immunity, debate Earth issues, vote someone out at Tribal Council.", emoji: "🔥", color: "#F25C45", goal: "Up to 6 players", section: "classroom" },
  { slug: "guess-the-number", title: "Guess the Number", subtitle: "Real Earth science numbers: core depth, Mohs values, Borah Peak and more.", emoji: "🎰", color: "#FCD34D", goal: "4 mini-games", section: "classroom" },
  { slug: "earth-feud", title: "Earth Science Feud", subtitle: "Top answers (teacher's estimate), strikes, steals and Fast Money.", emoji: "📺", color: "#F28C28", goal: "2 teams", section: "classroom" },
  { slug: "earth-imposter", title: "Earth Imposter", subtitle: "A secret imposter spreads fake facts. Fact-check and vote them out.", emoji: "🚨", color: "#A78BFA", goal: "6 players", section: "classroom" },
  { slug: "earth-taboo", title: "Earth Science Taboo", subtitle: "Describe the key word without the 5 forbidden words.", emoji: "🤐", color: "#E879F9", goal: "60s turns", section: "classroom" },
  { slug: "would-you-rather", title: "Would You Rather", subtitle: "10 Earth science dilemmas with class voting and debate prompts.", emoji: "🤔", color: "#84CC16", goal: "Class vote", section: "classroom" },
  { slug: "pictionary", title: "Earth Science Pictionary", subtitle: "Full drawing canvas with 24 drawable Earth science terms.", emoji: "🎨", color: "#22D3EE", goal: "Multi-team", section: "classroom" },
  { slug: "shark-tank", title: "Bedrock Shark Tank", subtitle: "Pitch a hazard, resource or energy solution. 5-part rubric.", emoji: "🦈", color: "#0EA5E9", goal: "Capstone", section: "classroom" },
  { slug: "myth-busters", title: "Myth Busters", subtitle: "18 Earth science myths, true or false, streak bonuses.", emoji: "💥", color: "#F59E0B", goal: "Timed mode", section: "classroom" },
  // ── end wave-classroom ──
  // ── wave-live ── two-device partner games (/partner/) and live class games (/live/)
  { slug: "partner-tic-tac-toe", title: "Tic-Tac-Toe", subtitle: "Star Garnet vs. Sapphire. Computer, same device, or two devices with a code.", emoji: "💎", color: "#e0475e", goal: "3 in a row", section: "partner", href: "/partner/tic-tac-toe/" },
  { slug: "partner-connect-4", title: "Connect 4", subtitle: "Magma vs. Sulfur. Drop four in a row before your partner does.", emoji: "🌋", color: "#f2542d", goal: "4 in a row", section: "partner", href: "/partner/connect-4/" },
  { slug: "partner-core-sample-hunt", title: "Core Sample Hunt", subtitle: "Battleship for prospectors: hide 5 ore deposits, drill to find theirs.", emoji: "⛏️", color: "#f6c453", goal: "Find 5 deposits", section: "partner", href: "/partner/core-sample-hunt/" },
  { slug: "partner-dots-and-boxes", title: "Dots & Boxes", subtitle: "Stake survey claims. Close a box to claim it and go again.", emoji: "🗺️", color: "#3b8fe8", goal: "Most claims", section: "partner", href: "/partner/dots-and-boxes/" },
  { slug: "live-games", title: "Live Class Games", subtitle: "Join with the code on the projector: votes, Showdown and Realm Raid.", emoji: "⚔️", color: "#a78bfa", goal: "6-digit code", section: "team", href: "/live/" },
  { slug: "gold-rush-live", title: "Gold Rush Live", subtitle: "The whole class digs gold at once. Answer, buy mining gear, top the board.", emoji: "⛏️", color: "#f6c453", goal: "Most gold wins", section: "team", href: "/live/" },
  // ── end wave-live ──
];

export const arcadeGame = (slug: string) => arcadeGames.find((g) => g.slug === slug);
