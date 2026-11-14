export type Medal = { at: number; name: string; icon: string };

export type InputType =
  | "tap" | "up" | "down" | "left" | "right" | "rotate" | "drop"
  | "release-tap" | "release-up" | "release-down" | "release-left" | "release-right" | "release-rotate" | "release-drop";

export type PointerType = "down" | "move" | "drag" | "up";

export type HeroPose = "happy" | "hurt" | "wings" | "run" | "back";

export type GameConfig = {
  key: string; // localStorage key, same as the original game so stats carry over
  title: string;
  subtitle: string;
  W: number;
  H: number;
  medals: Medal[];
  winAt?: number;
  winText?: string;
  overTitle?: string;
  howTo: string;
  controls: string;
  facts: string[];
  swipe?: boolean;
  repeatKeys?: boolean;
  upIsTap?: boolean;
  spaceType?: InputType; // what the Space key sends (default "tap")
  keys?: Record<string, InputType>; // extra key codes, e.g. { KeyF: "rotate" }
  deathDelay?: number;
  pad?: { label: string; type: InputType; wide?: boolean }[];
  padAlways?: boolean;
  sprites?: string[];
  heroless?: boolean;
  accent?: string;
};

export type Api = {
  W: number;
  H: number;
  ctx: CanvasRenderingContext2D;
  state: "menu" | "play" | "dying" | "over" | "paused";
  score: number;
  best: number;
  time: number;
  won: boolean;
  addScore(n: number): void;
  setScore(n: number): void;
  win(text?: string): void;
  gameOver(quiet?: boolean): void;
  particles: {
    burst(x: number, y: number, color: string, n?: number, speed?: number, size?: number): void;
    trail(x: number, y: number, color: string): void;
  };
  float(text: string, x: number, y: number, color?: string): void;
  shake(amount?: number, duration?: number): void;
  flash(duration?: number): void;
  sfx(name: "flap" | "jump" | "coin" | "point" | "swipe" | "hit" | "win" | "medal" | "click" | "drop" | "clear"): void;
  toast(text: string, ms?: number): void;
  sprite(name: string): HTMLImageElement | HTMLCanvasElement | null;
  drawSprite(name: string, x: number, y: number, size: number, rot?: number, alpha?: number, flipX?: boolean): boolean;
  drawHero(x: number, y: number, size: number, rot?: number, pose?: HeroPose): void;
  drawHeroAs(color: string, x: number, y: number, size: number, rot?: number, pose?: HeroPose): void; // rivals in another color
  rr(x: number, y: number, w: number, h: number, r: number): void;
  font(size: number, weight?: number): string;
  heroSwatch(): string;
  store: { get<T>(k: string, d: T): T; set(k: string, v: unknown): void };
};

export type GameLogic = {
  reset(A: Api): void;
  update(dt: number, A: Api): void;
  draw(ctx: CanvasRenderingContext2D, A: Api): void;
  input?(type: InputType, A: Api): void;
  pointer?(type: PointerType, x: number, y: number, A: Api): void;
  key?(code: string, A: Api): void; // raw keydown while playing, for game-specific keys like 1–9
};

export type GameModule = { config: GameConfig; create(): GameLogic };
