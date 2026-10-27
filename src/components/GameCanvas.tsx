import React, { useEffect, useRef } from 'react';
import {
  ARENA_HEIGHT,
  ARENA_PADDING,
  ARENA_WIDTH,
  GameState,
  INITIAL_CALLOUT_DURATION,
  PLAYER_CONFIGS,
  PRE_ROUND_COUNTDOWN_DURATION,
  PlayerEntity,
  RESULT_DURATION,
  RoundPhase,
  TOTAL_ROUNDS,
  ZONES,
  ZONE_ORDER,
  ZoneColor,
  ZoneRect,
  createInitialPlayers,
  evaluateRoundScoring,
  findFirstPlayerInZone,
  getCalloutDurationForRound,
  getCountdownStageLabel,
  getSpawnPositions,
  isPointInZone,
  pickNextZoneColor,
  resetPlayersToStartPositions,
  resolveMatchProgression,
  resolvePlayerCollisions,
  stepPlayerMovement,
  triggerPlayerFalseStart,
} from '../game/rules';
import {
  OnlinePlayerDoc,
  OnlineRoomDoc,
  hostBatchUpdateRoundAndPlayers,
  hostUpdateOnlineRoom,
  syncLocalPlayerStateToFirestore,
} from '../firebase';
import { sound } from '../game/sound';

export interface OnlineSessionConfig {
  roomCode: string;
  myUid: string;
  mySlot: 1 | 2 | 3 | 4;
  isHost: boolean;
  room: OnlineRoomDoc;
  onlinePlayers: OnlinePlayerDoc[];
}

export interface HudSnapshot {
  round: number;
  totalRounds: number;
  suddenDeath: boolean;
  suddenDeathRound: number;
  phase: RoundPhase;
  countdownLabel: 'READY…' | '3' | '2' | '1' | 'GO!';
  roundDuration: number;
  targetColor: ZoneColor | null;
  players: PlayerEntity[];
  lastAwardedIds: number[];
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingPopup {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

const PARTICLE_POOL_SIZE = 140;
const POPUP_POOL_SIZE = 24;
const SHOCKWAVE_POOL_SIZE = 16;

interface GameCanvasProps {
  gameState: GameState;
  playerCount: 2 | 3 | 4;
  totalRounds?: number;
  countdownDuration?: number;
  sessionId: number;
  reducedMotion: boolean;
  onlineSession?: OnlineSessionConfig | null;
  timerBarRef: React.RefObject<HTMLDivElement | null>;
  timerTextRef: React.RefObject<HTMLSpanElement | null>;
  onHudSync: (snapshot: HudSnapshot) => void;
  onGameOver: (finalPlayers: PlayerEntity[], wonInSuddenDeath: boolean) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  playerCount,
  totalRounds = TOTAL_ROUNDS,
  countdownDuration = PRE_ROUND_COUNTDOWN_DURATION,
  sessionId,
  reducedMotion,
  onlineSession = null,
  timerBarRef,
  timerTextRef,
  onHudSync,
  onGameOver,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stateRef = useRef<GameState>(gameState);
  const playerCountRef = useRef<2 | 3 | 4>(playerCount);
  const totalRoundsRef = useRef<number>(totalRounds);
  const countdownDurationRef = useRef<number>(countdownDuration);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const onlineSessionRef = useRef<OnlineSessionConfig | null>(onlineSession);
  const onHudSyncRef = useRef(onHudSync);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    playerCountRef.current = playerCount;
  }, [playerCount]);

  useEffect(() => {
    totalRoundsRef.current = totalRounds;
  }, [totalRounds]);

  useEffect(() => {
    countdownDurationRef.current = countdownDuration;
  }, [countdownDuration]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    onlineSessionRef.current = onlineSession;
  }, [onlineSession]);

  useEffect(() => {
    onHudSyncRef.current = onHudSync;
  }, [onHudSync]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  const simRef = useRef<{
    players: PlayerEntity[];
    round: number;
    suddenDeath: boolean;
    suddenDeathRound: number;
    phase: RoundPhase;
    countdownLabel: 'READY…' | '3' | '2' | '1' | 'GO!';
    lastCountdownStep: number;
    phaseTimer: number;
    phaseDuration: number;
    roundDuration: number;
    targetColor: ZoneColor | null;
    lastTickHalfSec: number;
    hitstopTimer: number;
    shakeTrauma: number;
    lastAwardedIds: number[];
    particles: Particle[];
    particleCursor: number;
    popups: FloatingPopup[];
    popupCursor: number;
    shockwaves: ShockwaveRing[];
    shockwaveCursor: number;
    ambientTime: number;
    keysHeld: Set<string>;
    keysJustPressed: Set<string>;
    resetSession: (count: 2 | 3 | 4) => void;
  } | null>(null);

  useEffect(() => {
    const particles: Particle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      color: '#FFFFFF',
      alpha: 1,
      life: 0,
      maxLife: 0.5,
    }));

    const popups: FloatingPopup[] = Array.from({ length: POPUP_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -40,
      text: '+1',
      color: '#FDE047',
      life: 0,
      maxLife: 0.9,
    }));

    const shockwaves: ShockwaveRing[] = Array.from({ length: SHOCKWAVE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 8,
      maxRadius: 48,
      color: '#FDE047',
      life: 0,
      maxLife: 0.28,
    }));

    const spawnParticles = (
      x: number,
      y: number,
      color: string,
      count: number,
      speedMin: number,
      speedMax: number,
      size = 5
    ) => {
      if (!simRef.current) return;
      const actualCount = reducedMotionRef.current ? Math.min(3, Math.ceil(count * 0.25)) : count;
      for (let i = 0; i < actualCount; i++) {
        const p = simRef.current.particles[simRef.current.particleCursor];
        simRef.current.particleCursor = (simRef.current.particleCursor + 1) % PARTICLE_POOL_SIZE;
        const angle = (Math.PI * 2 * i) / actualCount + (Math.random() * 0.5 - 0.25);
        const spd = speedMin + Math.random() * (speedMax - speedMin);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd;
        p.size = size + Math.random() * 3;
        p.color = color;
        p.alpha = 1;
        p.maxLife = 0.35 + Math.random() * 0.3;
        p.life = p.maxLife;
      }
    };

    const spawnPopup = (x: number, y: number, text: string, color: string) => {
      if (!simRef.current) return;
      const pop = simRef.current.popups[simRef.current.popupCursor];
      simRef.current.popupCursor = (simRef.current.popupCursor + 1) % POPUP_POOL_SIZE;
      pop.active = true;
      pop.x = x;
      pop.y = y;
      pop.vy = -65;
      pop.text = text;
      pop.color = color;
      pop.maxLife = 0.85;
      pop.life = 0.85;
    };

    const spawnShockwave = (x: number, y: number, color = '#FDE047', maxRadius = 52) => {
      if (!simRef.current) return;
      const sw = simRef.current.shockwaves[simRef.current.shockwaveCursor];
      simRef.current.shockwaveCursor =
        (simRef.current.shockwaveCursor + 1) % SHOCKWAVE_POOL_SIZE;
      sw.active = true;
      sw.x = x;
      sw.y = y;
      sw.radius = 10;
      sw.maxRadius = maxRadius;
      sw.color = color;
      sw.maxLife = 0.3;
      sw.life = 0.3;
    };

    const syncHud = () => {
      if (!simRef.current) return;
      onHudSyncRef.current({
        round: simRef.current.round,
        totalRounds: totalRoundsRef.current,
        suddenDeath: simRef.current.suddenDeath,
        suddenDeathRound: simRef.current.suddenDeathRound,
        phase: simRef.current.phase,
        countdownLabel: simRef.current.countdownLabel,
        roundDuration: simRef.current.roundDuration,
        targetColor: simRef.current.targetColor,
        players: simRef.current.players.map((p) => ({ ...p })),
        lastAwardedIds: [...simRef.current.lastAwardedIds],
      });
    };

    const sim = {
      players: createInitialPlayers(playerCountRef.current),
      round: 1,
      suddenDeath: false,
      suddenDeathRound: 0,
      phase: 'countdown' as RoundPhase,
      countdownLabel: 'READY…' as 'READY…' | '3' | '2' | '1' | 'GO!',
      lastCountdownStep: -1,
      phaseTimer: countdownDurationRef.current,
      phaseDuration: countdownDurationRef.current,
      roundDuration: INITIAL_CALLOUT_DURATION,
      targetColor: null as ZoneColor | null,
      lastTickHalfSec: 5,
      hitstopTimer: 0,
      shakeTrauma: 0,
      lastAwardedIds: [] as number[],
      particles,
      particleCursor: 0,
      popups,
      popupCursor: 0,
      shockwaves,
      shockwaveCursor: 0,
      ambientTime: 0,
      keysHeld: new Set<string>(),
      keysJustPressed: new Set<string>(),
      resetSession: (count: 2 | 3 | 4) => {
        sim.players = createInitialPlayers(count);
        sim.round = 1;
        sim.suddenDeath = false;
        sim.suddenDeathRound = 0;
        sim.phase = 'countdown';
        sim.countdownLabel = 'READY…';
        sim.lastCountdownStep = -1;
        sim.phaseTimer = countdownDurationRef.current;
        sim.phaseDuration = countdownDurationRef.current;
        sim.roundDuration = getCalloutDurationForRound(1);
        sim.targetColor = null;
        sim.lastTickHalfSec = 5;
        sim.hitstopTimer = 0;
        sim.shakeTrauma = 0;
        sim.lastAwardedIds = [];
        sim.keysHeld.clear();
        sim.keysJustPressed.clear();
        for (const p of sim.particles) p.active = false;
        for (const pop of sim.popups) pop.active = false;
        for (const sw of sim.shockwaves) sw.active = false;
        syncHud();
      },
    };

    simRef.current = sim;
    syncHud();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current !== 'playing') return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', ' '].includes(e.key) ||
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
      ) {
        e.preventDefault();
      }
      if (!e.repeat) {
        sim.keysJustPressed.add(e.code);
        sim.keysJustPressed.add(e.key);
      }
      sim.keysHeld.add(e.code);
      sim.keysHeld.add(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      sim.keysHeld.delete(e.code);
      sim.keysHeld.delete(e.key);
    };

    const clearKeys = () => {
      sim.keysHeld.clear();
      sim.keysJustPressed.clear();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearKeys);
    const handleVisChange = () => {
      if (document.hidden) clearKeys();
    };
    document.addEventListener('visibilitychange', handleVisChange);

    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      canvasWidth = Math.max(320, rect.width);
      canvasHeight = Math.max(240, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvasWidth * dpr);
      canvas.height = Math.round(canvasHeight * dpr);
    };

    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    let rafId = 0;
    let lastTime = performance.now();
    let bumpSoundCooldown = 0;
    let onlineSyncTimer = 0;

    const drawZoneSymbol = (
      ctx: CanvasRenderingContext2D,
      id: ZoneColor,
      cx: number,
      cy: number,
      r: number
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      if (id === 'red') {
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? r : r * 0.45;
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(angle) * rad;
          const py = Math.sin(angle) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else if (id === 'blue') {
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.85, 0);
        ctx.closePath();
      } else if (id === 'green') {
        const leafR = r * 0.46;
        const offset = r * 0.44;
        ctx.arc(0, -offset, leafR, 0, Math.PI * 2);
        ctx.arc(offset, 0, leafR, 0, Math.PI * 2);
        ctx.arc(0, offset, leafR, 0, Math.PI * 2);
        ctx.arc(-offset, 0, leafR, 0, Math.PI * 2);
      } else {
        for (let i = 0; i < 16; i++) {
          const rad = i % 2 === 0 ? r : r * 0.62;
          const angle = (i * Math.PI) / 8;
          const px = Math.cos(angle) * rad;
          const py = Math.sin(angle) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    };

    const drawPlayerShape = (
      ctx: CanvasRenderingContext2D,
      shape: PlayerEntity['shape'],
      r: number
    ) => {
      ctx.beginPath();
      if (shape === 'circle') {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      } else if (shape === 'rounded-square') {
        const s = r * 1.72;
        ctx.roundRect(-s / 2, -s / 2, s, s, 9);
      } else if (shape === 'diamond') {
        const d = r * 1.22;
        ctx.moveTo(0, -d);
        ctx.lineTo(d, 0);
        ctx.lineTo(0, d);
        ctx.lineTo(-d, 0);
        ctx.closePath();
      } else {
        const h = r * 1.1;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          const px = Math.cos(angle) * h;
          const py = Math.sin(angle) * h;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      sim.ambientTime += dt;
      if (bumpSoundCooldown > 0) bumpSoundCooldown -= dt;

      if (sim.shakeTrauma > 0) {
        sim.shakeTrauma = Math.max(0, sim.shakeTrauma - dt * 2.4);
      }

      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = sim.particles[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-4 * dt);
        p.vy *= Math.exp(-4 * dt);
        p.alpha = Math.max(0, p.life / p.maxLife);
      }

      for (let i = 0; i < POPUP_POOL_SIZE; i++) {
        const pop = sim.popups[i];
        if (!pop.active) continue;
        pop.life -= dt;
        if (pop.life <= 0) {
          pop.active = false;
          continue;
        }
        pop.y += pop.vy * dt;
        pop.vy *= Math.exp(-3 * dt);
      }

      for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
        const sw = sim.shockwaves[i];
        if (!sw.active) continue;
        sw.life -= dt;
        if (sw.life <= 0) {
          sw.active = false;
          continue;
        }
        const progress = 1 - sw.life / sw.maxLife;
        sw.radius = 10 + (sw.maxRadius - 10) * progress;
      }

      if (stateRef.current === 'title') {
        const demoTargetIdx = Math.floor(sim.ambientTime / 2.8) % ZONE_ORDER.length;
        const demoZone = ZONES[ZONE_ORDER[demoTargetIdx]];
        const targetCx = demoZone.x + demoZone.width * 0.5;
        const targetCy = demoZone.y + demoZone.height * 0.5;

        sim.players.forEach((p, idx) => {
          const angleOffset = sim.ambientTime * 1.4 + idx * 1.6;
          const goalX = targetCx + Math.cos(angleOffset) * 75;
          const goalY = targetCy + Math.sin(angleOffset) * 55;
          const dx = goalX - p.x;
          const dy = goalY - p.y;
          const dist = Math.hypot(dx, dy);
          const ix = dist > 12 ? dx / dist : 0;
          const iy = dist > 12 ? dy / dist : 0;
          stepPlayerMovement(p, ix * 0.65, iy * 0.65, dt);
        });
        const demoCollisions = resolvePlayerCollisions(sim.players);
        for (const ev of demoCollisions) {
          spawnShockwave(ev.contactX, ev.contactY, '#FDE047');
        }
      } else if (stateRef.current === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        } else {
          // Advance round state machine
          sim.phaseTimer -= dt;

          if (sim.phase === 'countdown') {
            const activeOnline = onlineSessionRef.current;

            // Keep online display names & remote positions synced during countdown
            if (activeOnline) {
              for (const op of activeOnline.onlinePlayers) {
                const localP = sim.players.find((p) => p.id === op.slot);
                if (localP) {
                  localP.name = op.displayName;
                  localP.shortName = op.slot === activeOnline.mySlot ? `${op.displayName.slice(0, 8)} (YOU)` : op.displayName.slice(0, 10);
                  localP.score = op.score;
                  localP.streak = op.streak;
                  localP.bestStreak = op.bestStreak;
                  localP.isContender = op.isContender;
                  if (op.slot !== activeOnline.mySlot) {
                    localP.falseStarted = op.falseStarted;
                  }
                }
              }
            }

            // Update READY... -> 3 -> 2 -> 1 stage label and play countdown beep
            const stage = getCountdownStageLabel(sim.phaseTimer, sim.phaseDuration);
            if (stage.stepIndex !== sim.lastCountdownStep) {
              sim.lastCountdownStep = stage.stepIndex;
              sim.countdownLabel = stage.label;
              if (stage.stepIndex > 0) {
                sound.playCountdownStep(stage.stepIndex);
              }
              if (activeOnline && activeOnline.isHost) {
                hostUpdateOnlineRoom(activeOnline.roomCode, {
                  countdownLabel: stage.label,
                }).catch(() => {});
              }
              syncHud();
            }

            // Detect FALSE START!
            const inStrictWindow = stage.stepIndex > 0; // During 3, 2, 1
            let anyFalseStartTriggered = false;

            for (let i = 0; i < sim.players.length; i++) {
              const player = sim.players[i];
              if (!player.isContender || player.falseStarted) continue;

              // In online mode, only evaluate local keyboard input for mySlot (using WASD or Arrows)
              if (activeOnline && player.id !== activeOnline.mySlot) continue;

              const cfg = PLAYER_CONFIGS[i];
              const allPlayerKeys = activeOnline
                ? [
                    ...PLAYER_CONFIGS[0].keys.up,
                    ...PLAYER_CONFIGS[0].keys.down,
                    ...PLAYER_CONFIGS[0].keys.left,
                    ...PLAYER_CONFIGS[0].keys.right,
                    ...PLAYER_CONFIGS[1].keys.up,
                    ...PLAYER_CONFIGS[1].keys.down,
                    ...PLAYER_CONFIGS[1].keys.left,
                    ...PLAYER_CONFIGS[1].keys.right,
                  ]
                : [
                    ...cfg.keys.up,
                    ...cfg.keys.down,
                    ...cfg.keys.left,
                    ...cfg.keys.right,
                  ];
              const pressedFresh = allPlayerKeys.some((k) => sim.keysJustPressed.has(k));
              const heldDuring321 =
                inStrictWindow && allPlayerKeys.some((k) => sim.keysHeld.has(k));

              if (pressedFresh || heldDuring321) {
                triggerPlayerFalseStart(player);
                anyFalseStartTriggered = true;
                sound.playFalseStart();
                spawnShockwave(player.x, player.y, '#EF4444', 56);
                spawnParticles(player.x, player.y, '#EF4444', 12, 60, 150, 4);
                spawnPopup(player.x, player.y - player.radius - 16, 'FALSE START!', '#F87171');
                sim.shakeTrauma = Math.min(0.35, sim.shakeTrauma + 0.18);

                if (activeOnline && player.id === activeOnline.mySlot) {
                  syncLocalPlayerStateToFirestore(activeOnline.roomCode, activeOnline.myUid, {
                    x: player.x,
                    y: player.y,
                    vx: 0,
                    vy: 0,
                    facingX: player.facingX,
                    facingY: player.facingY,
                    falseStarted: true,
                    falseStartCount: player.falseStartCount,
                    claimedRound: 0,
                  }).catch(() => {});
                }
              }
            }

            if (anyFalseStartTriggered) {
              syncHud();
            }

            // Relax player animations while waiting at starting line
            for (const p of sim.players) {
              stepPlayerMovement(p, 0, 0, dt);
            }

            // When countdown reaches 0 -> GO! Call out a random color with unlimited round time!
            if (activeOnline && !activeOnline.isHost) {
              // Guest waits for Host's room snapshot to switch to 'calling'
              if (
                activeOnline.room.phase === 'calling' &&
                activeOnline.room.targetColor !== 'none'
              ) {
                const nextColor = activeOnline.room.targetColor;
                sim.targetColor = nextColor;
                sim.phase = 'calling';
                sim.countdownLabel = 'GO!';
                sim.roundDuration = 0;
                sim.phaseDuration = 0;
                sim.phaseTimer = 0;
                sound.playCallout(nextColor);
                syncHud();
              }
            } else if (sim.phaseTimer <= 0) {
              const nextColor = pickNextZoneColor(sim.targetColor);
              sim.targetColor = nextColor;
              sim.phase = 'calling';
              sim.countdownLabel = 'GO!';
              sim.roundDuration = 0;
              sim.phaseDuration = 0;
              sim.phaseTimer = 0; // Counts up elapsed race time during calling
              sound.playCallout(nextColor);
              if (activeOnline && activeOnline.isHost) {
                hostUpdateOnlineRoom(activeOnline.roomCode, {
                  phase: 'calling',
                  countdownLabel: 'GO!',
                  targetColor: nextColor,
                }).catch(() => {});
              }
              syncHud();
            }
          } else if (sim.phase === 'calling') {
            const activeOnline = onlineSessionRef.current;

            // Process player movement during active GO! phase
            for (let i = 0; i < sim.players.length; i++) {
              const player = sim.players[i];

              if (activeOnline && player.id !== activeOnline.mySlot) {
                // Remote player in online mode: interpolate smoothly toward Firestore coordinates
                const remoteDoc = activeOnline.onlinePlayers.find((op) => op.slot === player.id);
                if (remoteDoc) {
                  player.falseStarted = remoteDoc.falseStarted;
                  player.isContender = remoteDoc.isContender;
                  player.facingX = remoteDoc.facingX;
                  player.facingY = remoteDoc.facingY;
                  const blend = Math.min(1, dt * 14);
                  player.x += (remoteDoc.x - player.x) * blend;
                  player.y += (remoteDoc.y - player.y) * blend;
                  player.vx = remoteDoc.vx;
                  player.vy = remoteDoc.vy;
                }
                stepPlayerMovement(player, 0, 0, dt);
                continue;
              }

              const cfg = PLAYER_CONFIGS[i];
              let ix = 0;
              let iy = 0;
              const upKeys = activeOnline
                ? [...PLAYER_CONFIGS[0].keys.up, ...PLAYER_CONFIGS[1].keys.up]
                : cfg.keys.up;
              const downKeys = activeOnline
                ? [...PLAYER_CONFIGS[0].keys.down, ...PLAYER_CONFIGS[1].keys.down]
                : cfg.keys.down;
              const leftKeys = activeOnline
                ? [...PLAYER_CONFIGS[0].keys.left, ...PLAYER_CONFIGS[1].keys.left]
                : cfg.keys.left;
              const rightKeys = activeOnline
                ? [...PLAYER_CONFIGS[0].keys.right, ...PLAYER_CONFIGS[1].keys.right]
                : cfg.keys.right;

              if (upKeys.some((k) => sim.keysHeld.has(k))) iy -= 1;
              if (downKeys.some((k) => sim.keysHeld.has(k))) iy += 1;
              if (leftKeys.some((k) => sim.keysHeld.has(k))) ix -= 1;
              if (rightKeys.some((k) => sim.keysHeld.has(k))) ix += 1;

              const prevSpeed = Math.hypot(player.vx, player.vy);
              stepPlayerMovement(player, ix, iy, dt);
              const newSpeed = Math.hypot(player.vx, player.vy);

              if (prevSpeed < 50 && newSpeed >= 50 && !reducedMotionRef.current) {
                spawnParticles(
                  player.x,
                  player.y + player.radius * 0.6,
                  player.accentHex,
                  3,
                  25,
                  65,
                  3
                );
              }
            }

            // Resolve competitive, high-impact player-to-player collisions
            const collisionEvents = resolvePlayerCollisions(sim.players);
            if (collisionEvents.length > 0) {
              const impactWords = ['SMASH!', 'POW!', 'BASH!', 'CRASH!'];
              for (let cIdx = 0; cIdx < collisionEvents.length; cIdx++) {
                const ev = collisionEvents[cIdx];
                const pA = sim.players.find((p) => p.id === ev.playerAId);
                const pB = sim.players.find((p) => p.id === ev.playerBId);
                spawnShockwave(ev.contactX, ev.contactY, '#FDE047', 62);
                spawnShockwave(ev.contactX, ev.contactY, '#FB923C', 42);
                spawnParticles(ev.contactX, ev.contactY, '#FDE047', 12, 85, 220, 4.5);
                if (pA) {
                  spawnParticles(ev.contactX, ev.contactY, pA.colorHex, 6, 65, 175, 3.8);
                }
                if (pB) {
                  spawnParticles(ev.contactX, ev.contactY, pB.colorHex, 6, 65, 175, 3.8);
                }
              }

              if (!reducedMotionRef.current) {
                sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.028);
              }
              sim.shakeTrauma = Math.min(0.45, sim.shakeTrauma + 0.22);

              if (bumpSoundCooldown <= 0) {
                const firstEv = collisionEvents[0];
                sound.playBump(firstEv.intensity);
                const word =
                  impactWords[Math.floor(sim.ambientTime * 10) % impactWords.length];
                spawnPopup(firstEv.contactX, firstEv.contactY - 28, word, '#FB923C');
                bumpSoundCooldown = 0.22;
              }
            }

            // Track elapsed time in the round
            sim.phaseTimer += dt * 2;

            // Check if any eligible contender can still play
            const anyEligibleContender = sim.players.some(
              (p) => p.isContender && !p.falseStarted
            );

            const target = sim.targetColor || 'red';

            // In online mode, periodically sync my local position & plate claim to Firestore
            if (activeOnline) {
              onlineSyncTimer += dt;
              const myPlayer = sim.players.find((p) => p.id === activeOnline.mySlot);
              if (myPlayer) {
                const reachedNow =
                  myPlayer.isContender &&
                  !myPlayer.falseStarted &&
                  isPointInZone(myPlayer.x, myPlayer.y, ZONES[target]);
                if (reachedNow || onlineSyncTimer >= 0.085) {
                  onlineSyncTimer = 0;
                  syncLocalPlayerStateToFirestore(activeOnline.roomCode, activeOnline.myUid, {
                    x: myPlayer.x,
                    y: myPlayer.y,
                    vx: myPlayer.vx,
                    vy: myPlayer.vy,
                    facingX: myPlayer.facingX,
                    facingY: myPlayer.facingY,
                    falseStarted: myPlayer.falseStarted,
                    falseStartCount: myPlayer.falseStartCount,
                    claimedRound: reachedNow ? sim.round : 0,
                  }).catch(() => {});
                }
              }
            }

            if (activeOnline && !activeOnline.isHost) {
              // Guest watches Host room transition to 'scoring'
              if (activeOnline.room.phase === 'scoring') {
                const winSlot = activeOnline.room.lastWinnerSlot;
                const outcome = evaluateRoundScoring(
                  sim.players,
                  target,
                  winSlot > 0 ? winSlot : null
                );
                sim.players = outcome.updatedPlayers;
                sim.lastAwardedIds = outcome.awardedPlayerIds;
                sim.phase = 'scoring';
                sim.phaseDuration = RESULT_DURATION;
                sim.phaseTimer = RESULT_DURATION;
                sound.playRoundScore(outcome.awardedPlayerIds.length, false);
                syncHud();
              }
            } else {
              // Local mode OR Online Host: check if anyone reached the plate (or claimed via Firestore)
              let firstWinner = findFirstPlayerInZone(sim.players, target);
              if (!firstWinner && activeOnline) {
                const remoteClaimer = activeOnline.onlinePlayers.find(
                  (op) => op.claimedRound === sim.round && op.isContender && !op.falseStarted
                );
                if (remoteClaimer) {
                  firstWinner = sim.players.find((p) => p.id === remoteClaimer.slot) || null;
                }
              }

              if (firstWinner || (!anyEligibleContender && sim.phaseTimer >= 0.6)) {
                const outcome = evaluateRoundScoring(
                  sim.players,
                  target,
                  firstWinner ? firstWinner.id : null
                );
                sim.players = outcome.updatedPlayers;
                sim.lastAwardedIds = outcome.awardedPlayerIds;
                sim.phase = 'scoring';
                sim.phaseDuration = RESULT_DURATION;
                sim.phaseTimer = RESULT_DURATION;
                sim.hitstopTimer = firstWinner ? 0.06 : 0.04;
                sim.shakeTrauma = outcome.awardedPlayerIds.length > 0 ? 0.5 : 0.25;

                const anyStreakBonus = Object.values(outcome.pointsByPlayerId).some(
                  (pts) => pts >= 2
                );
                if (firstWinner) {
                  sound.playZoneEnter();
                }
                sound.playRoundScore(outcome.awardedPlayerIds.length, anyStreakBonus);

                if (activeOnline && activeOnline.isHost) {
                  const playerUpdates = activeOnline.onlinePlayers.map((op) => {
                    const updatedP = sim.players.find((p) => p.id === op.slot);
                    return {
                      uid: op.uid,
                      patch: {
                        score: updatedP ? updatedP.score : op.score,
                        streak: updatedP ? updatedP.streak : 0,
                        bestStreak: updatedP ? updatedP.bestStreak : op.bestStreak,
                      },
                    };
                  });
                  hostBatchUpdateRoundAndPlayers(
                    activeOnline.roomCode,
                    {
                      phase: 'scoring',
                      lastWinnerSlot: firstWinner ? firstWinner.id : 0,
                    },
                    playerUpdates
                  ).catch(() => {});
                }

                for (const p of sim.players) {
                  if (!p.isContender) continue;
                  const pts = outcome.pointsByPlayerId[p.id] || 0;
                  if (pts >= 2) {
                    spawnShockwave(p.x, p.y, '#FDE047', 74);
                    spawnShockwave(p.x, p.y, ZONES[target].borderHex, 54);
                    spawnParticles(p.x, p.y, '#FDE047', 26, 90, 250, 5.5);
                    spawnParticles(p.x, p.y, p.colorHex, 14, 70, 190, 4.5);
                    spawnPopup(
                      p.x,
                      p.y - p.radius - 16,
                      `FIRST! +2 PTS (${p.streak}x🔥)`,
                      '#FDE047'
                    );
                  } else if (pts === 1) {
                    spawnShockwave(p.x, p.y, '#FDE047', 64);
                    spawnShockwave(p.x, p.y, ZONES[target].borderHex, 48);
                    spawnParticles(p.x, p.y, ZONES[target].borderHex, 22, 80, 210, 5);
                    spawnParticles(p.x, p.y, p.colorHex, 12, 60, 160, 4);
                    spawnPopup(p.x, p.y - p.radius - 14, 'FIRST! +1 PT 🏆', '#FDE047');
                  } else if (p.falseStarted) {
                    spawnPopup(p.x, p.y - p.radius - 8, '0 PT (EARLY)', '#F87171');
                  } else {
                    spawnPopup(p.x, p.y - p.radius - 6, 'TOO SLOW', '#94A3B8');
                  }
                }

                syncHud();
              }
            }
          } else if (sim.phase === 'scoring') {
            const activeOnline = onlineSessionRef.current;

            if (activeOnline && !activeOnline.isHost) {
              if (activeOnline.room.status === 'finished') {
                sound.playVictory();
                const finalSnapshot = sim.players.map((p) => ({ ...p }));
                onGameOverRef.current(finalSnapshot, sim.suddenDeath);
              } else if (
                activeOnline.room.phase === 'countdown' &&
                activeOnline.room.round !== sim.round
              ) {
                sim.round = activeOnline.room.round;
                sim.suddenDeath = activeOnline.room.suddenDeath;
                sim.suddenDeathRound = activeOnline.room.suddenDeathRound;
                resetPlayersToStartPositions(sim.players);
                sim.phase = 'countdown';
                sim.countdownLabel = 'READY…';
                sim.lastCountdownStep = -1;
                sim.phaseDuration = countdownDurationRef.current;
                sim.phaseTimer = countdownDurationRef.current;
                sim.targetColor = null;
                sim.lastAwardedIds = [];
                syncHud();
              }
            } else if (sim.phaseTimer <= 0) {
              const progression = resolveMatchProgression(
                sim.players,
                sim.round,
                totalRoundsRef.current,
                sim.suddenDeath
              );

              if (progression.isGameOver) {
                sound.playVictory();
                if (activeOnline && activeOnline.isHost) {
                  hostUpdateOnlineRoom(activeOnline.roomCode, {
                    status: 'finished',
                    winnerSlot: progression.winnerId || 1,
                  }).catch(() => {});
                }
                const finalSnapshot = sim.players.map((p) => ({ ...p }));
                onGameOverRef.current(finalSnapshot, sim.suddenDeath);
              } else {
                const enteringSuddenDeathNow =
                  progression.enterSuddenDeath && !sim.suddenDeath;
                sim.suddenDeath = progression.enterSuddenDeath;
                if (sim.suddenDeath) {
                  sim.suddenDeathRound += 1;
                }
                for (const p of sim.players) {
                  p.isContender = progression.contenderIds.includes(p.id);
                }

                if (enteringSuddenDeathNow) {
                  sound.playSuddenDeath();
                  spawnPopup(
                    ARENA_WIDTH / 2,
                    ARENA_HEIGHT / 2 - 48,
                    'SUDDEN DEATH!',
                    '#FACC15'
                  );
                }

                sim.round += 1;
                resetPlayersToStartPositions(sim.players);
                sim.phase = 'countdown';
                sim.countdownLabel = 'READY…';
                sim.lastCountdownStep = -1;
                sim.phaseDuration = countdownDurationRef.current;
                sim.phaseTimer = countdownDurationRef.current;
                sim.roundDuration = getCalloutDurationForRound(sim.round);
                sim.targetColor = null;
                sim.lastAwardedIds = [];
                sim.keysHeld.clear();
                sim.keysJustPressed.clear();

                if (activeOnline && activeOnline.isHost) {
                  const spawns = getSpawnPositions(sim.players.length);
                  const playerUpdates = activeOnline.onlinePlayers.map((op, idx) => {
                    const updatedP = sim.players.find((p) => p.id === op.slot);
                    const pos = spawns[idx] || { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
                    return {
                      uid: op.uid,
                      patch: {
                        x: pos.x,
                        y: pos.y,
                        vx: 0,
                        vy: 0,
                        falseStarted: false,
                        claimedRound: 0,
                        isContender: updatedP ? updatedP.isContender : true,
                      },
                    };
                  });
                  hostBatchUpdateRoundAndPlayers(
                    activeOnline.roomCode,
                    {
                      round: sim.round,
                      suddenDeath: sim.suddenDeath,
                      suddenDeathRound: sim.suddenDeathRound,
                      phase: 'countdown',
                      countdownLabel: 'READY…',
                      targetColor: 'none',
                      lastWinnerSlot: 0,
                    },
                    playerUpdates
                  ).catch(() => {});
                }

                syncHud();
              }
            }
          }

          sim.keysJustPressed.clear();
        }

        // Update high-frequency DOM status bar & race readout directly without React re-render
        if (timerBarRef.current) {
          const ratio =
            sim.phase === 'countdown'
              ? Math.max(0, Math.min(1, sim.phaseTimer / Math.max(0.01, sim.phaseDuration)))
              : 1;
          timerBarRef.current.style.transform = `scaleX(${ratio.toFixed(3)})`;
        }
        if (timerTextRef.current) {
          if (sim.phase === 'calling') {
            timerTextRef.current.textContent = `∞ TIME · ${Math.max(0, sim.phaseTimer).toFixed(1)}s`;
          } else if (sim.phase === 'countdown') {
            timerTextRef.current.textContent = 'WAIT FOR GO!';
          } else {
            timerTextRef.current.textContent = 'ROUND OVER!';
          }
        }
      }

      // Render Arena on Canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#0B1120';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const topMargin = stateRef.current === 'playing' ? 120 : 36;
      const bottomMargin = 28;
      const sideMargin = 28;
      const availW = Math.max(260, canvasWidth - sideMargin * 2);
      const availH = Math.max(200, canvasHeight - topMargin - bottomMargin);
      const scale = Math.min(availW / ARENA_WIDTH, availH / ARENA_HEIGHT);

      const offsetX = (canvasWidth - ARENA_WIDTH * scale) * 0.5;
      const offsetY = topMargin + (availH - ARENA_HEIGHT * scale) * 0.5;

      let shakeX = 0;
      let shakeY = 0;
      if (sim.shakeTrauma > 0 && !reducedMotionRef.current) {
        const mag = sim.shakeTrauma * sim.shakeTrauma * 14;
        shakeX = (Math.random() * 2 - 1) * mag;
        shakeY = (Math.random() * 2 - 1) * mag;
      }

      ctx.translate(offsetX + shakeX, offsetY + shakeY);
      ctx.scale(scale, scale);

      // Outer Arena Board Shadow & Base
      ctx.fillStyle = '#060A14';
      ctx.beginPath();
      ctx.roundRect(-8, -4, ARENA_WIDTH + 16, ARENA_HEIGHT + 16, 34);
      ctx.fill();

      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = sim.suddenDeath ? '#F59E0B' : '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT, 28);
      ctx.fill();
      ctx.stroke();

      // Inner playable floor
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(
        ARENA_PADDING,
        ARENA_PADDING,
        ARENA_WIDTH - ARENA_PADDING * 2,
        ARENA_HEIGHT - ARENA_PADDING * 2,
        20
      );
      ctx.fill();

      // Subtle grid lines in neutral corridor
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 2;
      for (let gx = 80; gx < ARENA_WIDTH; gx += 80) {
        ctx.beginPath();
        ctx.moveTo(gx, ARENA_PADDING);
        ctx.lineTo(gx, ARENA_HEIGHT - ARENA_PADDING);
        ctx.stroke();
      }
      for (let gy = 80; gy < ARENA_HEIGHT; gy += 80) {
        ctx.beginPath();
        ctx.moveTo(ARENA_PADDING, gy);
        ctx.lineTo(ARENA_WIDTH - ARENA_PADDING, gy);
        ctx.stroke();
      }

      // Central starting court circle (lights up amber during READY... 3, 2, 1 countdown)
      ctx.save();
      ctx.translate(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
      const isHoldLine =
        stateRef.current === 'playing' && sim.phase === 'countdown';
      ctx.strokeStyle = isHoldLine
        ? 'rgba(251, 191, 36, 0.65)'
        : 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = isHoldLine ? 4 : 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isHoldLine) {
        ctx.font = '900 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FDE047';
        ctx.fillText('HOLD FOR GO!', 0, 84);
      }
      ctx.restore();

      // Draw the 4 Compact Colored Plates (176x116 raised tactile target pads)
      for (const colorKey of ZONE_ORDER) {
        const z: ZoneRect = ZONES[colorKey];
        const isTarget =
          stateRef.current === 'playing' && sim.targetColor === colorKey;
        const isOtherDuringCall =
          stateRef.current === 'playing' &&
          sim.targetColor !== null &&
          sim.targetColor !== colorKey;

        ctx.save();
        ctx.globalAlpha = isOtherDuringCall ? 0.45 : 0.98;

        // Tactile plate elevation shadow
        ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
        ctx.beginPath();
        ctx.roundRect(z.x, z.y + 7, z.width, z.height, 16);
        ctx.fill();

        // Plate bevel rim
        ctx.fillStyle = z.fillHex;
        ctx.beginPath();
        ctx.roundRect(z.x, z.y, z.width, z.height, 16);
        ctx.fill();

        // Plate top surface
        ctx.fillStyle = z.hex;
        ctx.beginPath();
        ctx.roundRect(z.x + 5, z.y + 5, z.width - 10, z.height - 10, 12);
        ctx.fill();

        const zCx = z.x + z.width / 2;
        const zCy = z.y + z.height / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        drawZoneSymbol(ctx, colorKey, zCx, zCy - 15, 21);

        ctx.fillStyle = z.textHex;
        ctx.font = '800 20px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(z.label, zCx, zCy + 17);

        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fillText(z.symbolName, zCx, zCy + 34);

        if (isTarget) {
          const pulse = reducedMotionRef.current
            ? 1
            : 0.5 + 0.5 * Math.sin(sim.ambientTime * 13);

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 4.5 + pulse * 3;
          ctx.beginPath();
          ctx.roundRect(z.x - 3, z.y - 3, z.width + 6, z.height + 6, 18);
          ctx.stroke();

          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([12, 8]);
          ctx.lineDashOffset = reducedMotionRef.current ? 0 : -sim.ambientTime * 60;
          ctx.beginPath();
          ctx.roundRect(z.x - 9, z.y - 9, z.width + 18, z.height + 18, 22);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = z.borderHex;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(z.x, z.y, z.width, z.height, 16);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Directional floor guide arrow from center to target zone during 'calling'
      if (stateRef.current === 'playing' && sim.phase === 'calling' && sim.targetColor) {
        const tz = ZONES[sim.targetColor];
        const tx = tz.x + tz.width / 2;
        const ty = tz.y + tz.height / 2;
        const cx = ARENA_WIDTH / 2;
        const cy = ARENA_HEIGHT / 2;
        const angle = Math.atan2(ty - cy, tx - cx);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const shift = reducedMotionRef.current ? 0 : (sim.ambientTime * 45) % 24;
        ctx.fillStyle = '#FDE047';
        for (let step = 0; step < 2; step++) {
          const dist = 24 + step * 24 + shift * 0.5;
          ctx.globalAlpha = 0.75 - step * 0.25;
          ctx.beginPath();
          ctx.moveTo(dist + 12, 0);
          ctx.lineTo(dist - 4, -10);
          ctx.lineTo(dist - 4, 10);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Collision & Zone-Entry Shockwave Rings
      for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
        const sw = sim.shockwaves[i];
        if (!sw.active) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife) * 0.85;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Pooled Particles
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = sim.particles[i];
        if (!p.active) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const maxScore = Math.max(0, ...sim.players.map((p) => p.score));

      // Draw Players
      for (const p of sim.players) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (!p.isContender) {
          ctx.globalAlpha = 0.28;
        }

        // Safe zone ring under player when standing in called-out zone
        if (
          stateRef.current === 'playing' &&
          p.inTargetZone &&
          sim.targetColor &&
          !p.falseStarted
        ) {
          ctx.save();
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // False-start warning ring
        if (stateRef.current === 'playing' && p.falseStarted) {
          ctx.save();
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(0, p.radius * 0.78, p.radius * 0.85, p.radius * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();

        // Character body with squash & stretch
        ctx.save();
        ctx.scale(p.scaleX, p.scaleY);

        ctx.fillStyle = p.hitFlashTimer > 0 ? '#FFFFFF' : p.falseStarted ? '#64748B' : p.colorHex;
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 4.5;
        drawPlayerShape(ctx, p.shape, p.radius);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = p.accentHex;
        ctx.lineWidth = 2;
        drawPlayerShape(ctx, p.shape, p.radius - 3.5);
        ctx.stroke();

        const lookX = p.facingX * 4.5;
        const lookY = p.facingY * 4.5;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-7 + lookX * 0.5, -4 + lookY * 0.5, 5.2, 0, Math.PI * 2);
        ctx.arc(7 + lookX * 0.5, -4 + lookY * 0.5, 5.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(-7 + lookX, -4 + lookY, 2.7, 0, Math.PI * 2);
        ctx.arc(7 + lookX, -4 + lookY, 2.7, 0, Math.PI * 2);
        ctx.fill();

        if (p.bounceTimer > 0 || p.falseStarted) {
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(lookX * 0.4, 4 + lookY * 0.3, 3.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(lookX * 0.4, 2 + lookY * 0.3, 6, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }

        ctx.restore();

        // Leader Crown if leading with >= 1 point
        if (maxScore > 0 && p.score === maxScore) {
          ctx.save();
          ctx.translate(0, -p.radius - 26);
          ctx.fillStyle = '#FACC15';
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-9, 4);
          ctx.lineTo(-11, -6);
          ctx.lineTo(-4, -1);
          ctx.lineTo(0, -8);
          ctx.lineTo(4, -1);
          ctx.lineTo(11, -6);
          ctx.lineTo(9, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Overhead Player Label Tag (P1, P2, P3, P4 + Streak flame badge)
        ctx.save();
        ctx.translate(0, -p.radius - 11);
        ctx.font = '800 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tagText =
          p.streak >= 3 ? `${p.shortName} 🔥${p.streak}` : p.shortName;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0F172A';
        ctx.strokeText(tagText, 0, 0);
        ctx.fillStyle = p.streak >= 3 ? '#FDE047' : '#FFFFFF';
        ctx.fillText(tagText, 0, 0);
        ctx.restore();

        ctx.restore();
      }

      // Draw Floating Popups
      for (let i = 0; i < POPUP_POOL_SIZE; i++) {
        const pop = sim.popups[i];
        if (!pop.active) continue;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (pop.life / pop.maxLife) * 1.4);
        ctx.font = '900 21px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#0F172A';
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      ctx.restore();
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', handleVisChange);
    };
  }, []);

  useEffect(() => {
    if (simRef.current) {
      simRef.current.resetSession(playerCount);
    }
  }, [sessionId, playerCount]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0B1120]"
      data-testid="arena-container"
    >
      <canvas
        ref={canvasRef}
        tabIndex={-1}
        aria-label="Color Dash Game Arena"
        className="block w-full h-full focus:outline-none"
      />
    </div>
  );
};
