export type ZoneColor = 'red' | 'blue' | 'green' | 'yellow';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type RoundPhase = 'countdown' | 'calling' | 'scoring';

export interface ZoneRect {
  id: ZoneColor;
  label: string;
  symbolName: string;
  hex: string;
  fillHex: string;
  borderHex: string;
  textHex: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayerConfig {
  id: number;
  name: string;
  shortName: string;
  colorHex: string;
  accentHex: string;
  shape: 'circle' | 'rounded-square' | 'diamond' | 'hexagon';
  controlsLabel: string;
  keys: {
    up: string[];
    down: string[];
    left: string[];
    right: string[];
  };
}

export interface PlayerEntity {
  id: number;
  name: string;
  shortName: string;
  colorHex: string;
  accentHex: string;
  shape: 'circle' | 'rounded-square' | 'diamond' | 'hexagon';
  controlsLabel: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounceVx: number;
  bounceVy: number;
  bounceTimer: number;
  radius: number;
  score: number;
  streak: number;
  bestStreak: number;
  inTargetZone: boolean;
  scoredLastRound: boolean;
  lastPointsAwarded: number;
  falseStarted: boolean;
  falseStartCount: number;
  isContender: boolean;
  facingX: number;
  facingY: number;
  scaleX: number;
  scaleY: number;
  walkDistance: number;
  hitFlashTimer: number;
}

export interface CollisionEvent {
  playerAId: number;
  playerBId: number;
  contactX: number;
  contactY: number;
  normalX: number;
  normalY: number;
  intensity: number;
}

export interface RoundOutcome {
  targetColor: ZoneColor;
  awardedPlayerIds: number[];
  pointsByPlayerId: Record<number, number>;
  updatedPlayers: PlayerEntity[];
}

export interface WinnerSummary {
  winners: PlayerEntity[];
  isTie: boolean;
  rankedPlayers: PlayerEntity[];
  topScore: number;
}

export interface MatchResolution {
  isGameOver: boolean;
  enterSuddenDeath: boolean;
  contenderIds: number[];
  winnerId: number | null;
}

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 640;
export const ARENA_PADDING = 20;
export const PLAYER_RADIUS = 21;
export const PLAYER_MAX_SPEED = 380;
export const PLAYER_ACCEL = 2750;
export const PLAYER_FRICTION = 11.0;
export const PLAYER_BOUNCE_SPEED = 360;
export const PLAYER_MAX_BOUNCE_SPEED = 480;
export const PLAYER_BOUNCE_DURATION = 0.24;

export const TOTAL_ROUNDS = 15;
export const INITIAL_CALLOUT_DURATION = 2.5;
export const MIN_CALLOUT_DURATION = 1.0;
export const DURATION_STEP_SECONDS = 0.25;
export const ROUNDS_PER_SPEEDUP = 3;

export const PRE_ROUND_COUNTDOWN_DURATION = 2.0; // READY -> 3 -> 2 -> 1 -> GO!
export const RESULT_DURATION = 1.15;

// Compact, high-stakes target plates (176x116) centered in each quadrant
// so players race and body-check each other to be the first to touch the plate.
export const ZONES: Record<ZoneColor, ZoneRect> = {
  red: {
    id: 'red',
    label: 'RED',
    symbolName: 'STAR',
    hex: '#EF4444',
    fillHex: '#DC2626',
    borderHex: '#FCA5A5',
    textHex: '#FEF2F2',
    x: 152,
    y: 102,
    width: 176,
    height: 116,
  },
  blue: {
    id: 'blue',
    label: 'BLUE',
    symbolName: 'DIAMOND',
    hex: '#3B82F6',
    fillHex: '#2563EB',
    borderHex: '#93C5FD',
    textHex: '#EFF6FF',
    x: 632,
    y: 102,
    width: 176,
    height: 116,
  },
  green: {
    id: 'green',
    label: 'GREEN',
    symbolName: 'CLOVER',
    hex: '#10B981',
    fillHex: '#059669',
    borderHex: '#6EE7B7',
    textHex: '#ECFDF5',
    x: 152,
    y: 422,
    width: 176,
    height: 116,
  },
  yellow: {
    id: 'yellow',
    label: 'YELLOW',
    symbolName: 'SUN',
    hex: '#F59E0B',
    fillHex: '#D97706',
    borderHex: '#FDE68A',
    textHex: '#FFFBEB',
    x: 632,
    y: 422,
    width: 176,
    height: 116,
  },
};

export const ZONE_ORDER: ZoneColor[] = ['red', 'blue', 'green', 'yellow'];

export const PLAYER_CONFIGS: PlayerConfig[] = [
  {
    id: 1,
    name: 'Player 1',
    shortName: 'P1',
    colorHex: '#FB7185',
    accentHex: '#FFE4E6',
    shape: 'circle',
    controlsLabel: 'WASD',
    keys: {
      up: ['KeyW', 'w', 'W'],
      down: ['KeyS', 's', 'S'],
      left: ['KeyA', 'a', 'A'],
      right: ['KeyD', 'd', 'D'],
    },
  },
  {
    id: 2,
    name: 'Player 2',
    shortName: 'P2',
    colorHex: '#38BDF8',
    accentHex: '#E0F2FE',
    shape: 'rounded-square',
    controlsLabel: 'Arrows',
    keys: {
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
    },
  },
  {
    id: 3,
    name: 'Player 3',
    shortName: 'P3',
    colorHex: '#A3E635',
    accentHex: '#ECFCCB',
    shape: 'diamond',
    controlsLabel: 'IJKL',
    keys: {
      up: ['KeyI', 'i', 'I'],
      down: ['KeyK', 'k', 'K'],
      left: ['KeyJ', 'j', 'J'],
      right: ['KeyL', 'l', 'L'],
    },
  },
  {
    id: 4,
    name: 'Player 4',
    shortName: 'P4',
    colorHex: '#C084FC',
    accentHex: '#F3E8FF',
    shape: 'hexagon',
    controlsLabel: 'TFGH',
    keys: {
      up: ['KeyT', 't', 'T'],
      down: ['KeyG', 'g', 'G'],
      left: ['KeyF', 'f', 'F'],
      right: ['KeyH', 'h', 'H'],
    },
  },
];

export function getSpawnPositions(playerCount: number): Array<{ x: number; y: number }> {
  const count = Math.max(2, Math.min(4, playerCount));
  const centerX = ARENA_WIDTH / 2;
  const centerY = ARENA_HEIGHT / 2;
  const offset = 34;

  const offsets =
    count === 2
      ? [
          { dx: -offset, dy: 0 },
          { dx: offset, dy: 0 },
        ]
      : count === 3
      ? [
          { dx: -offset, dy: -24 },
          { dx: offset, dy: -24 },
          { dx: 0, dy: 28 },
        ]
      : [
          { dx: -offset, dy: -28 },
          { dx: offset, dy: -28 },
          { dx: -offset, dy: 28 },
          { dx: offset, dy: 28 },
        ];

  return offsets.map((o) => ({ x: centerX + o.dx, y: centerY + o.dy }));
}

export function createInitialPlayers(playerCount: 2 | 3 | 4): PlayerEntity[] {
  const count = Math.max(2, Math.min(4, playerCount));
  const spawns = getSpawnPositions(count);

  return PLAYER_CONFIGS.slice(0, count).map((cfg, index) => {
    const pos = spawns[index] || { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
    return {
      id: cfg.id,
      name: cfg.name,
      shortName: cfg.shortName,
      colorHex: cfg.colorHex,
      accentHex: cfg.accentHex,
      shape: cfg.shape,
      controlsLabel: cfg.controlsLabel,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      bounceVx: 0,
      bounceVy: 0,
      bounceTimer: 0,
      radius: PLAYER_RADIUS,
      score: 0,
      streak: 0,
      bestStreak: 0,
      inTargetZone: false,
      scoredLastRound: false,
      lastPointsAwarded: 0,
      falseStarted: false,
      falseStartCount: 0,
      isContender: true,
      facingX: 0,
      facingY: 1,
      scaleX: 1,
      scaleY: 1,
      walkDistance: 0,
      hitFlashTimer: 0,
    };
  });
}

export function resetPlayersToStartPositions(players: PlayerEntity[]): void {
  const spawns = getSpawnPositions(players.length);
  players.forEach((p, idx) => {
    const pos = spawns[idx] || { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
    p.x = pos.x;
    p.y = pos.y;
    p.vx = 0;
    p.vy = 0;
    p.bounceVx = 0;
    p.bounceVy = 0;
    p.bounceTimer = 0;
    p.inTargetZone = false;
    p.scoredLastRound = false;
    p.lastPointsAwarded = 0;
    p.falseStarted = false;
    p.scaleX = 1;
    p.scaleY = 1;
  });
}

/**
 * Starts at 2.5s for rounds 1-3, then reduces by 0.25s after every 3 rounds,
 * down to a minimum of 1.0s.
 */
export function getCalloutDurationForRound(round: number): number {
  const safeRound = Math.max(1, Math.floor(round));
  const reductions = Math.floor((safeRound - 1) / ROUNDS_PER_SPEEDUP);
  const rawDuration = INITIAL_CALLOUT_DURATION - reductions * DURATION_STEP_SECONDS;
  return Number(Math.max(MIN_CALLOUT_DURATION, rawDuration).toFixed(2));
}

/**
 * Returns the countdown banner label for a given remaining time in the pre-round countdown.
 * Sequence: READY... -> 3 -> 2 -> 1
 */
export function getCountdownStageLabel(remainingTimer: number, totalDuration = PRE_ROUND_COUNTDOWN_DURATION): {
  label: 'READY…' | '3' | '2' | '1';
  stepIndex: number;
} {
  const progress = Math.max(0, Math.min(1, 1 - remainingTimer / totalDuration));
  if (progress < 0.28) {
    return { label: 'READY…', stepIndex: 0 };
  }
  if (progress < 0.52) {
    return { label: '3', stepIndex: 3 };
  }
  if (progress < 0.76) {
    return { label: '2', stepIndex: 2 };
  }
  return { label: '1', stepIndex: 1 };
}

export function isPointInZone(x: number, y: number, zone: ZoneRect, tolerance = 0): boolean {
  return (
    x >= zone.x - tolerance &&
    x <= zone.x + zone.width + tolerance &&
    y >= zone.y - tolerance &&
    y <= zone.y + zone.height + tolerance
  );
}

export function getPlayerZone(player: Pick<PlayerEntity, 'x' | 'y'>): ZoneColor | null {
  for (const color of ZONE_ORDER) {
    if (isPointInZone(player.x, player.y, ZONES[color])) {
      return color;
    }
  }
  return null;
}

/**
 * Returns the first eligible player who has reached the target plate.
 * If multiple players step onto the plate on the exact same frame, the player
 * closest to the plate center wins.
 */
export function findFirstPlayerInZone(
  players: PlayerEntity[],
  targetColor: ZoneColor
): PlayerEntity | null {
  const zone = ZONES[targetColor];
  const centerX = zone.x + zone.width * 0.5;
  const centerY = zone.y + zone.height * 0.5;

  let bestPlayer: PlayerEntity | null = null;
  let bestDistSq = Infinity;

  for (const p of players) {
    if (!p.isContender || p.falseStarted) continue;
    if (isPointInZone(p.x, p.y, zone)) {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPlayer = p;
      }
    }
  }

  return bestPlayer;
}

export function pickNextZoneColor(
  previousColor: ZoneColor | null,
  randomFn: () => number = Math.random
): ZoneColor {
  if (previousColor && randomFn() < 0.75) {
    const others = ZONE_ORDER.filter((c) => c !== previousColor);
    const idx = Math.floor(randomFn() * others.length) % others.length;
    return others[idx];
  }
  const idx = Math.floor(randomFn() * ZONE_ORDER.length) % ZONE_ORDER.length;
  return ZONE_ORDER[idx];
}

export function clampPlayerToArena(player: PlayerEntity): void {
  const minX = ARENA_PADDING + player.radius;
  const maxX = ARENA_WIDTH - ARENA_PADDING - player.radius;
  const minY = ARENA_PADDING + player.radius;
  const maxY = ARENA_HEIGHT - ARENA_PADDING - player.radius;

  if (player.x < minX) {
    player.x = minX;
    if (player.vx < 0) player.vx *= -0.45;
    if (player.bounceVx < 0) player.bounceVx *= -0.5;
  } else if (player.x > maxX) {
    player.x = maxX;
    if (player.vx > 0) player.vx *= -0.45;
    if (player.bounceVx > 0) player.bounceVx *= -0.5;
  }

  if (player.y < minY) {
    player.y = minY;
    if (player.vy < 0) player.vy *= -0.45;
    if (player.bounceVy < 0) player.bounceVy *= -0.5;
  } else if (player.y > maxY) {
    player.y = maxY;
    if (player.vy > 0) player.vy *= -0.45;
    if (player.bounceVy > 0) player.bounceVy *= -0.5;
  }
}

export function triggerPlayerFalseStart(player: PlayerEntity): void {
  if (player.falseStarted || !player.isContender) return;
  player.falseStarted = true;
  player.falseStartCount += 1;
  player.streak = 0;
  player.vx = 0;
  player.vy = 0;
  player.scaleX = 1.25;
  player.scaleY = 0.75;
  player.hitFlashTimer = 0.25;
}

export function stepPlayerMovement(
  player: PlayerEntity,
  inputX: number,
  inputY: number,
  dt: number
): void {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);

  // Disqualified (false-started) or non-contender players cannot steer this round
  const effectiveInputX = player.falseStarted || !player.isContender ? 0 : inputX;
  const effectiveInputY = player.falseStarted || !player.isContender ? 0 : inputY;

  let dirX = effectiveInputX;
  let dirY = effectiveInputY;
  const mag = Math.hypot(dirX, dirY);
  if (mag > 0) {
    dirX /= mag;
    dirY /= mag;
    player.facingX = dirX;
    player.facingY = dirY;
  }

  // Impactful collision stun/recovery: steering starts at 10% on impact and recovers
  // quadratically over 0.24s so body-checks meaningfully knock rivals off their racing line
  const recoveryProgress =
    player.bounceTimer > 0
      ? 1 - Math.min(1, player.bounceTimer / PLAYER_BOUNCE_DURATION)
      : 1;
  const steerScale =
    player.bounceTimer > 0
      ? 0.1 + 0.9 * recoveryProgress * recoveryProgress
      : 1;

  player.vx += dirX * PLAYER_ACCEL * steerScale * clampedDt;
  player.vy += dirY * PLAYER_ACCEL * steerScale * clampedDt;

  const damping = Math.exp(-PLAYER_FRICTION * clampedDt);
  if (mag === 0) {
    player.vx *= damping;
    player.vy *= damping;
  } else {
    player.vx *= Math.exp(-PLAYER_FRICTION * 0.45 * clampedDt);
    player.vy *= Math.exp(-PLAYER_FRICTION * 0.45 * clampedDt);
  }

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > PLAYER_MAX_SPEED) {
    const scale = PLAYER_MAX_SPEED / speed;
    player.vx *= scale;
    player.vy *= scale;
  } else if (speed < 4 && mag === 0) {
    player.vx = 0;
    player.vy = 0;
  }

  if (player.bounceTimer > 0) {
    player.bounceTimer = Math.max(0, player.bounceTimer - clampedDt);
    const bounceDecay = Math.exp(-6.2 * clampedDt);
    player.bounceVx *= bounceDecay;
    player.bounceVy *= bounceDecay;
    if (player.bounceTimer === 0) {
      player.bounceVx = 0;
      player.bounceVy = 0;
    }
  } else {
    player.bounceVx = 0;
    player.bounceVy = 0;
  }

  const totalVx = player.vx + player.bounceVx;
  const totalVy = player.vy + player.bounceVy;

  const dx = totalVx * clampedDt;
  const dy = totalVy * clampedDt;
  player.x += dx;
  player.y += dy;
  player.walkDistance += Math.hypot(dx, dy);

  const relax = Math.exp(-14 * clampedDt);
  const moveSquash = Math.min(speed / PLAYER_MAX_SPEED, 1) * 0.08;
  const targetScaleX = 1 + Math.sin(player.walkDistance * 0.08) * moveSquash;
  const targetScaleY = 1 - Math.sin(player.walkDistance * 0.08) * moveSquash;
  player.scaleX = targetScaleX + (player.scaleX - targetScaleX) * relax;
  player.scaleY = targetScaleY + (player.scaleY - targetScaleY) * relax;

  if (player.hitFlashTimer > 0) {
    player.hitFlashTimer = Math.max(0, player.hitFlashTimer - clampedDt);
  }

  clampPlayerToArena(player);
}

export function resolvePlayerCollisions(players: PlayerEntity[]): CollisionEvent[] {
  const events: CollisionEvent[] = [];

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (!a.isContender || !b.isContender) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;

      if (dist < minDist) {
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        const overlap = minDist - dist;

        // Momentum-weighted overlap separation: faster attacker pushes defender further
        const speedA = Math.hypot(a.vx, a.vy);
        const speedB = Math.hypot(b.vx, b.vy);
        const totalSpd = speedA + speedB;
        const weightA = totalSpd > 20 ? 0.25 + 0.5 * (speedB / totalSpd) : 0.5;
        const weightB = 1 - weightA;

        const sep = overlap + 3.0;
        a.x -= nx * sep * weightA;
        a.y -= ny * sep * weightA;
        b.x += nx * sep * weightB;
        b.y += ny * sep * weightB;

        const rvx = (b.vx + b.bounceVx) - (a.vx + a.bounceVx);
        const rvy = (b.vy + b.bounceVy) - (a.vy + a.bounceVy);
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal <= 50) {
          const closingSpeed = Math.max(0, -velAlongNormal);
          // Competitive, high-impact bump impulse (360 - 480 px/s)
          const baseBounce = Math.min(
            PLAYER_MAX_BOUNCE_SPEED,
            Math.max(PLAYER_BOUNCE_SPEED, 310 + closingSpeed * 0.42)
          );

          // Asymmetric momentum transfer: faster attacker delivers up to 1.35x knockback
          // while taking only 0.65x recoil so aggressive dashes reward the initiator!
          const pushRatioA = totalSpd > 25 ? 0.65 + 0.7 * (speedB / totalSpd) : 1.0;
          const pushRatioB = totalSpd > 25 ? 0.65 + 0.7 * (speedA / totalSpd) : 1.0;

          const bounceA = Math.min(PLAYER_MAX_BOUNCE_SPEED, baseBounce * pushRatioA);
          const bounceB = Math.min(PLAYER_MAX_BOUNCE_SPEED, baseBounce * pushRatioB);

          // Preserve tangential velocity while transferring strong normal impact velocity
          const tx = -ny;
          const ty = nx;
          const aTan = a.vx * tx + a.vy * ty;
          const bTan = b.vx * tx + b.vy * ty;

          a.vx = tx * aTan * 0.8 - nx * 135 * pushRatioA;
          a.vy = ty * aTan * 0.8 - ny * 135 * pushRatioA;
          b.vx = tx * bTan * 0.8 + nx * 145 * pushRatioB;
          b.vy = ty * bTan * 0.8 + ny * 145 * pushRatioB;

          a.bounceVx = -nx * bounceA;
          a.bounceVy = -ny * bounceA;
          a.bounceTimer = PLAYER_BOUNCE_DURATION;

          b.bounceVx = nx * bounceB;
          b.bounceVy = ny * bounceB;
          b.bounceTimer = PLAYER_BOUNCE_DURATION;

          a.scaleX = 1.34;
          a.scaleY = 0.72;
          b.scaleX = 1.34;
          b.scaleY = 0.72;

          a.hitFlashTimer = 0.12;
          b.hitFlashTimer = 0.12;

          events.push({
            playerAId: a.id,
            playerBId: b.id,
            contactX: (a.x + b.x) * 0.5,
            contactY: (a.y + b.y) * 0.5,
            normalX: nx,
            normalY: ny,
            intensity: Math.min(1, Math.max(bounceA, bounceB) / PLAYER_MAX_BOUNCE_SPEED),
          });
        }

        clampPlayerToArena(a);
        clampPlayerToArena(b);
      }
    }
  }
  return events;
}

/**
 * Evaluates points earned when the round concludes:
 * - Whoever reaches the target plate FIRST wins the round (1 point for streak 1-2, 2 points for 3+ streak).
 * - Only that single first player earns points for the round; everyone else earns 0 and resets streak.
 */
export function evaluateRoundScoring(
  players: PlayerEntity[],
  targetColor: ZoneColor,
  firstWinnerId?: number | null
): RoundOutcome {
  const resolvedWinner =
    firstWinnerId !== undefined
      ? players.find((p) => p.id === firstWinnerId && p.isContender && !p.falseStarted) || null
      : findFirstPlayerInZone(players, targetColor);

  const winnerId = resolvedWinner ? resolvedWinner.id : null;
  const awardedPlayerIds: number[] = [];
  const pointsByPlayerId: Record<number, number> = {};

  const updatedPlayers = players.map((player) => {
    if (!player.isContender || player.falseStarted || player.id !== winnerId) {
      pointsByPlayerId[player.id] = 0;
      return {
        ...player,
        streak: 0,
        inTargetZone: false,
        scoredLastRound: false,
        lastPointsAwarded: 0,
      };
    }

    const newStreak = player.streak + 1;
    const pointsEarned = newStreak >= 3 ? 2 : 1;
    awardedPlayerIds.push(player.id);
    pointsByPlayerId[player.id] = pointsEarned;

    return {
      ...player,
      score: player.score + pointsEarned,
      streak: newStreak,
      bestStreak: Math.max(player.bestStreak, newStreak),
      inTargetZone: true,
      scoredLastRound: true,
      lastPointsAwarded: pointsEarned,
      scaleX: 1.32,
      scaleY: 0.72,
      hitFlashTimer: 0.28,
    };
  });

  return {
    targetColor,
    awardedPlayerIds,
    pointsByPlayerId,
    updatedPlayers,
  };
}

/**
 * Determines after a round whether the match continues, ends with a sole winner,
 * or enters / continues Sudden Death between tied top contenders.
 */
export function resolveMatchProgression(
  players: PlayerEntity[],
  currentRound: number,
  totalRegularRounds: number,
  isSuddenDeath: boolean
): MatchResolution {
  // Regular rounds before the final regular round simply continue
  if (!isSuddenDeath && currentRound < totalRegularRounds) {
    return {
      isGameOver: false,
      enterSuddenDeath: false,
      contenderIds: players.map((p) => p.id),
      winnerId: null,
    };
  }

  if (!isSuddenDeath) {
    // End of final regular round (e.g. Round 15)
    const maxScore = Math.max(0, ...players.map((p) => p.score));
    const topPlayers = players.filter((p) => p.score === maxScore);

    if (topPlayers.length === 1) {
      return {
        isGameOver: true,
        enterSuddenDeath: false,
        contenderIds: [topPlayers[0].id],
        winnerId: topPlayers[0].id,
      };
    }

    // Tie at the top -> enter Sudden Death between the tied leaders!
    return {
      isGameOver: false,
      enterSuddenDeath: true,
      contenderIds: topPlayers.map((p) => p.id),
      winnerId: null,
    };
  }

  // Already in Sudden Death: check contenders who scored this round
  const contenders = players.filter((p) => p.isContender);
  const scoredContenders = contenders.filter((p) => p.scoredLastRound);

  if (scoredContenders.length === 1) {
    // Exactly one contender scored while the other(s) did not -> immediate Sudden Death winner!
    return {
      isGameOver: true,
      enterSuddenDeath: true,
      contenderIds: [scoredContenders[0].id],
      winnerId: scoredContenders[0].id,
    };
  }

  if (scoredContenders.length > 1) {
    // Multiple contenders scored; narrow Sudden Death to those who scored (or highest total if separated)
    const maxContenderScore = Math.max(...scoredContenders.map((p) => p.score));
    const remaining = scoredContenders.filter((p) => p.score === maxContenderScore);
    if (remaining.length === 1) {
      return {
        isGameOver: true,
        enterSuddenDeath: true,
        contenderIds: [remaining[0].id],
        winnerId: remaining[0].id,
      };
    }
    return {
      isGameOver: false,
      enterSuddenDeath: true,
      contenderIds: remaining.map((p) => p.id),
      winnerId: null,
    };
  }

  // Nobody among the contenders scored this round -> sudden death continues with same contenders
  return {
    isGameOver: false,
    enterSuddenDeath: true,
    contenderIds: contenders.map((p) => p.id),
    winnerId: null,
  };
}

export function computeWinnerSummary(players: PlayerEntity[]): WinnerSummary {
  const rankedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.isContender !== a.isContender) return b.isContender ? 1 : -1;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.id - b.id;
  });

  const topScore = rankedPlayers.length > 0 ? rankedPlayers[0].score : 0;
  const winners = rankedPlayers.filter((p) => p.score === topScore);

  return {
    winners,
    isTie: winners.length > 1,
    rankedPlayers,
    topScore,
  };
}
