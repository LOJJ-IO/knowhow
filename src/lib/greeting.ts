/** Home topbar greetings — a rotating pool, filtered by time of day, weekday,
 *  and season. Weather-dependent lines are omitted until we have a weather
 *  signal; inventing rain would be worse than leaving them out.
 *
 *  Picked once per browser tab (sessionStorage) so the heading doesn't shuffle
 *  under the person while they work. Favorites are weighted when eligible. */

export type GreetingContext = {
  hour: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  month: number; // 1–12
};

type When = (ctx: GreetingContext) => boolean;

type Line = {
  /** Includes `{name}` — every line addresses the person by first name. */
  text: string;
  when?: When;
  favorite?: boolean;
};

const always: When = () => true;

const morning: When = ({ hour }) => hour >= 5 && hour < 12;
const afternoon: When = ({ hour }) => hour >= 12 && hour < 18;
const evening: When = ({ hour }) => hour >= 18 && hour < 22;
const night: When = ({ hour }) => hour >= 22 || hour < 5;
const early: When = ({ hour }) => hour >= 5 && hour < 8;
const lateNight: When = ({ hour }) => hour >= 22 || hour < 5;

const weekday =
  (d: number): When =>
  (ctx) =>
    ctx.weekday === d;
const weekend: When = ({ weekday: d }) => d === 0 || d === 6;
const midweek: When = ({ weekday: d }) => d === 2 || d === 3; // Tue/Wed
const humpDay: When = ({ weekday: d }) => d === 3;

type Season = "spring" | "summer" | "fall" | "winter";
function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}
const season =
  (s: Season): When =>
  (ctx) =>
    seasonOf(ctx.month) === s;

const LINES: Line[] = [
  // Playful
  { text: "Look who's here, {name}!" },
  { text: "Oh, it's {name}!" },
  { text: "Hey there, {name}!" },
  { text: "Well hello, {name}." },
  { text: "Howdy, {name}!" },
  { text: "Hey hey, {name}!" },
  { text: "There you are, {name}!" },
  { text: "You're back, {name}!" },
  { text: "And you're in, {name}!" },
  { text: "{name} has arrived." },
  { text: "The legend returns — hey, {name}." },
  { text: "Guess who's back? {name}." },
  { text: "Fancy seeing you here, {name}." },
  { text: "Good to see you, {name}." },
  { text: "Hey stranger… {name}!" },

  // Time / routine
  { text: "Morning, {name}!", when: morning },
  { text: "Afternoon, {name}!", when: afternoon },
  { text: "Evening, {name}!", when: evening },
  { text: "Good night, {name}.", when: night },
  { text: "Up and at 'em, {name}!", when: early },
  { text: "Bright and early, {name}!", when: early },
  { text: "You're up early, {name}.", when: early },
  { text: "Burning the midnight oil, {name}?", when: lateNight },
  { text: "Still going, {name}?", when: lateNight },
  { text: "Late-night crew reporting, {name}.", when: lateNight },
  { text: "Rise and shine, {name}!", when: early },
  { text: "Another early one, {name}.", when: early },
  { text: "Calling it a night, {name}?", when: night },

  // Day-specific
  { text: "Monday made it, {name}.", when: weekday(1) },
  { text: "Tuesday's calling, {name}.", when: weekday(2) },
  { text: "Midweek, {name}!", when: midweek },
  { text: "Happy hump day, {name}!", when: humpDay },
  { text: "That Thursday energy, {name}.", when: weekday(4) },
  { text: "Friday at last, {name}!", when: weekday(5) },
  { text: "Friday looks good on you, {name}.", when: weekday(5) },
  { text: "Saturday mode, {name}.", when: weekday(6) },
  { text: "Sunday vibes, {name}.", when: weekday(0) },
  { text: "Weekend mode, {name}!", when: weekend },
  { text: "The weekend is yours, {name}.", when: weekend },
  { text: "Sunday reset, {name}.", when: weekday(0) },

  // Very short / UI-friendly
  { text: "Hey, {name}." },
  { text: "Hi, {name}." },
  { text: "Yo, {name}." },
  { text: "Welcome, {name}." },
  { text: "Welcome back, {name}." },
  { text: "Good to see you, {name}." },
  { text: "You're back, {name}." },
  { text: "Let's go, {name}." },
  { text: "Here we go, {name}." },
  { text: "We're on, {name}." },
  { text: "Ready, {name}?" },
  { text: "What's next, {name}?" },
  { text: "What's on today, {name}?" },
  { text: "What's the move, {name}?" },

  // Slightly clever
  { text: "New day, {name}." },
  { text: "Another day, {name}." },
  { text: "And just like that… {name}." },
  { text: "Today's guest: {name}." },
  { text: "Now entering: {name}." },
  { text: "Currently featuring: {name}." },
  { text: "Looking like your kind of day, {name}." },
  { text: "The day has begun, {name}." },
  { text: "Your desk awaits, {name}." },
  { text: "The workspace is yours, {name}." },
  { text: "Back to it, {name}." },
  { text: "Let's pick up where we left off, {name}." },
  { text: "Round two, {name}." },
  { text: "Next chapter, {name}." },

  // Season (no live weather — rainy/cold/sunny wait on a real signal)
  { text: "Sunny side up, {name}!" },
  { text: "Warm welcome, {name}!" },
  { text: "Perfect day to get things done, {name}." },
  { text: "Fall is calling, {name}.", when: season("fall") },
  { text: "Spring has sprung, {name}!", when: season("spring") },
  { text: "Summer's here, {name}!", when: season("summer") },
  { text: "Winter mode on, {name}.", when: season("winter") },

  // Favorites (weighted when eligible)
  { text: "{name} returns!", favorite: true },
  { text: "There you are, {name}.", favorite: true },
  { text: "Hello night owl, {name}!", when: lateNight, favorite: true },
  { text: "Hello early bird, {name}!", when: early, favorite: true },
  { text: "Welcome to the weekend, {name}.", when: weekend, favorite: true },
  { text: "Friday at last, {name}!", when: weekday(5), favorite: true },
  { text: "Midweek, {name}!", when: midweek, favorite: true },
  { text: "Rise and shine, {name}!", when: early, favorite: true },
  { text: "Still up, {name}?", when: lateNight, favorite: true },
  { text: "Look who's here, {name}!", favorite: true },
  { text: "Fancy seeing you here, {name}.", favorite: true },
  { text: "Back to it, {name}.", favorite: true },
  { text: "What's the move, {name}?", favorite: true },
  { text: "And we're back, {name}.", favorite: true },
  { text: "Let's go, {name}.", favorite: true },
];

const STORAGE_KEY = "knohow.home-greeting.v2";

function contextFrom(now: Date): GreetingContext {
  return {
    hour: now.getHours(),
    weekday: now.getDay(),
    month: now.getMonth() + 1,
  };
}

function eligible(now: Date): Line[] {
  const ctx = contextFrom(now);
  return LINES.filter((line) => (line.when ?? always)(ctx));
}

function fill(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}

function chooseTemplate(now: Date): string {
  const pool = eligible(now);
  const favorites = pool.filter((line) => line.favorite);
  const useFavorite = favorites.length > 0 && Math.random() < 0.55;
  const from = useFavorite ? favorites : pool;
  return from[Math.floor(Math.random() * from.length)]!.text;
}

/** One greeting for this tab session. Reuses the stored template so revisiting
 *  Home doesn't shuffle the title; a new tab (or cleared session) picks again. */
export function pickGreeting(name: string, now = new Date()): string {
  if (typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { template } = JSON.parse(raw) as { template?: string };
        if (template) return fill(template, name);
      }
    } catch {
      /* pick fresh */
    }
  }

  const template = chooseTemplate(now);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ template }));
  } catch {
    /* private mode / quota — still return the pick */
  }
  return fill(template, name);
}

/** What people call each other. Falls back to the whole string. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
