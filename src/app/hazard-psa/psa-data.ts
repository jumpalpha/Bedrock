// ── wave-twinA ── Hazard PSA topics and the 100-point rubric (same parts and points as Dopps Class psa_challenge.html).
import type { PsaScores } from "@/lib/db";

export const HAZARDS = ["Earthquakes", "Wildfire & smoke", "Floods", "Winter storms", "Landslides & rockfall", "Avalanches", "Extreme heat", "Lightning",
  "Volcanoes & Yellowstone", "Go-bags", "Family plans", "Our own hazard idea"];
/** Keys match _b_psa_rubric() in supabase/migrations/007_twinsA.sql. */
export const RUBRIC: [keyof PsaScores, string, number][] = [
  ["plan", "Planning and preparation", 20], ["team", "Teamwork and participation", 20], ["message", "Clarity, accuracy and impact of the message", 20],
  ["creative", "Creativity and originality", 15], ["production", "Video and audio production", 15], ["rules", "Following requirements and submission", 10]];
