import React from 'react';
import { HudSnapshot } from './GameCanvas';
import { ZONES, ZoneColor } from '../game/rules';

interface GameHudProps {
  hud: HudSnapshot;
  isMuted: boolean;
  timerBarRef: React.RefObject<HTMLDivElement | null>;
  timerTextRef: React.RefObject<HTMLSpanElement | null>;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

const CALLOUT_STYLES: Record<
  ZoneColor,
  { bg: string; swatchHex: string; border: string; text: string; badge: string }
> = {
  red: {
    bg: '#DC2626',
    swatchHex: '#EF4444',
    border: '#FCA5A5',
    text: '#FFFFFF',
    badge: '★ STAR',
  },
  blue: {
    bg: '#2563EB',
    swatchHex: '#3B82F6',
    border: '#93C5FD',
    text: '#FFFFFF',
    badge: '◆ DIAMOND',
  },
  green: {
    bg: '#059669',
    swatchHex: '#10B981',
    border: '#6EE7B7',
    text: '#FFFFFF',
    badge: '♣ CLOVER',
  },
  yellow: {
    bg: '#D97706',
    swatchHex: '#F59E0B',
    border: '#FDE68A',
    text: '#FFFFFF',
    badge: '☀ SUN',
  },
};

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  isMuted,
  timerBarRef,
  timerTextRef,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const targetZone = hud.targetColor ? ZONES[hud.targetColor] : null;
  const callStyle = hud.targetColor ? CALLOUT_STYLES[hud.targetColor] : null;
  const falseStarters = hud.players.filter((p) => p.falseStarted);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:px-5 sm:py-3">
      {/* Top Perimeter Bar: Scoreboard (Left) — Big Color Callout (Center) — Utility Actions (Right) */}
      <div className="w-full max-w-[1440px] mx-auto grid grid-cols-12 items-center gap-2 sm:gap-3">
        {/* Left Cluster: Player Scores, Streaks & False-Start Status */}
        <div
          className="col-span-12 lg:col-span-5 flex flex-wrap xl:flex-nowrap items-center gap-1.5"
          aria-label="Player Scores"
        >
          {hud.players.map((p) => {
            const justScored =
              hud.phase === 'scoring' && hud.lastAwardedIds.includes(p.id);
            const hasStreakBonus = p.streak >= 3;
            return (
              <div
                key={p.id}
                data-testid={`hud-score-p${p.id}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111C33] border-2 transition-transform whitespace-nowrap shrink-0 ${
                  !p.isContender ? 'opacity-40' : ''
                }`}
                style={{
                  borderColor: p.falseStarted
                    ? '#EF4444'
                    : justScored
                    ? '#FACC15'
                    : hasStreakBonus
                    ? '#F59E0B'
                    : '#334155',
                  transform: justScored ? 'scale(1.06)' : 'scale(1)',
                }}
              >
                <span
                  className="w-3 h-3 rounded-sm border border-slate-950 shrink-0"
                  style={{ backgroundColor: p.colorHex }}
                />
                <span className="text-[11px] font-extrabold text-white">
                  {p.shortName}{' '}
                  <span className="text-slate-300 font-semibold">
                    ({p.controlsLabel})
                  </span>
                </span>

                {p.falseStarted ? (
                  <span
                    data-testid={`false-start-p${p.id}`}
                    className="text-[10px] font-extrabold uppercase text-red-400 ml-0.5"
                  >
                    False start!
                  </span>
                ) : p.streak >= 1 ? (
                  <span
                    data-testid={`streak-p${p.id}`}
                    className={`text-[10px] font-extrabold ml-0.5 ${
                      hasStreakBonus ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    🔥{p.streak}x{hasStreakBonus ? ' (2PT)' : ''}
                  </span>
                ) : null}

                <span className="ml-1 font-mono-num font-extrabold text-base sm:text-lg text-amber-300 leading-none">
                  {Math.round(p.score)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Center Cluster: READY... 3, 2, 1, GO! & Color Callout with Matching Swatch */}
        <div className="col-span-9 lg:col-span-4 flex flex-col items-center justify-center">
          <div
            data-testid="color-callout-banner"
            className="w-full max-w-[440px] rounded-2xl border-2 px-4 py-2 bg-[#111C33] shadow-[0_10px_28px_rgba(0,0,0,0.75)] transition-colors"
            style={{
              borderColor:
                hud.phase === 'countdown'
                  ? '#F59E0B'
                  : callStyle
                  ? callStyle.swatchHex
                  : '#475569',
            }}
          >
            {/* Header Row: Round / Sudden Death + Unlimited Time Race Status */}
            <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
              <span className="whitespace-nowrap">
                {hud.suddenDeath
                  ? `⚡ SUDDEN DEATH #${hud.suddenDeathRound} · FIRST TO REACH`
                  : `ROUND ${hud.round} / ${hud.totalRounds} · FIRST TO REACH`}
              </span>
              <span
                ref={timerTextRef}
                data-testid="countdown-timer"
                className="font-mono-num text-xs sm:text-sm font-black text-amber-300 whitespace-nowrap"
              >
                ∞ TIME
              </span>
            </div>

            {/* Main Callout Row */}
            <div className="flex items-center justify-center my-1">
              {hud.phase === 'countdown' || !targetZone ? (
                <div
                  data-testid="pre-round-countdown"
                  className="flex items-center justify-center gap-3 whitespace-nowrap"
                >
                  {(['READY…', '3', '2', '1'] as const).map((step) => {
                    const active = hud.countdownLabel === step;
                    return (
                      <span
                        key={step}
                        className={`font-display font-black tracking-wide transition-transform ${
                          active
                            ? 'text-2xl sm:text-3xl text-amber-300 scale-110'
                            : 'text-sm sm:text-base text-slate-500'
                        }`}
                      >
                        {step}
                      </span>
                    );
                  })}
                  <span className="font-display font-black text-sm sm:text-base text-slate-500">
                    GO!
                  </span>
                </div>
              ) : hud.phase === 'scoring' ? (
                <div
                  data-testid="round-winner-callout"
                  className="flex items-center justify-center gap-2.5 whitespace-nowrap"
                >
                  {hud.lastAwardedIds.length > 0 ? (
                    <>
                      <span className="font-display font-black text-lg sm:text-xl text-amber-300 uppercase">
                        🏆 {hud.players.find((p) => p.id === hud.lastAwardedIds[0])?.shortName} FIRST!
                      </span>
                      <span
                        data-testid="callout-color-swatch"
                        aria-label={`${targetZone.label} color swatch`}
                        className="w-6 h-6 rounded-md border-2 border-white shrink-0"
                        style={{ backgroundColor: callStyle?.swatchHex || targetZone.hex }}
                      />
                      <span className="font-display font-black text-lg sm:text-xl text-emerald-300 uppercase">
                        +{hud.players.find((p) => p.id === hud.lastAwardedIds[0])?.lastPointsAwarded || 1} PT
                      </span>
                    </>
                  ) : (
                    <span className="font-display font-black text-lg sm:text-2xl text-red-300 uppercase">
                      ⚠️ ALL FALSE START — NO WINNER!
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 whitespace-nowrap">
                  <span className="font-display font-black text-lg sm:text-xl text-emerald-400 uppercase">
                    GO!
                  </span>
                  {/* High-Contrast Matching Color Swatch */}
                  <span
                    data-testid="callout-color-swatch"
                    aria-label={`${targetZone.label} color swatch`}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border-2 border-white shadow-[0_0_12px_rgba(255,255,255,0.35)] shrink-0"
                    style={{ backgroundColor: callStyle?.swatchHex || targetZone.hex }}
                  />
                  <span
                    className="font-display font-black text-2xl sm:text-3xl tracking-wider uppercase"
                    style={{ color: callStyle?.border || '#FFFFFF' }}
                  >
                    {targetZone.label}!
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                    {callStyle?.badge}
                  </span>
                </div>
              )}
            </div>

            {/* Smooth 60fps Shrinking Timer Bar */}
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
              <div
                ref={timerBarRef}
                className="w-full h-full origin-left rounded-full transition-colors"
                style={{
                  transform: 'scaleX(1)',
                  backgroundColor:
                    hud.phase === 'countdown'
                      ? '#F59E0B'
                      : callStyle?.swatchHex || '#10B981',
                }}
              />
            </div>
          </div>

          {/* False-Start Warning Toast when someone moves before GO! */}
          {falseStarters.length > 0 && (
            <div
              data-testid="false-start-banner"
              className="mt-1 text-[11px] font-extrabold text-red-300 tracking-wide whitespace-nowrap"
            >
              False start! {falseStarters.map((p) => p.shortName).join(', ')} moved before GO — no points this round!
            </div>
          )}
        </div>

        {/* Right Cluster: Compact Utility Controls (Mute [M], Pause [P], Restart [R]) */}
        <div className="col-span-3 lg:col-span-3 flex items-center justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
            title={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
            className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-xl bg-[#111C33] border-2 border-[#334155] hover:border-amber-400 text-slate-100 transition-transform active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              {isMuted ? (
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              ) : (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause Game [P]"
            title="Pause Game [P]"
            className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-xl bg-[#111C33] border-2 border-[#334155] hover:border-amber-400 text-slate-100 transition-transform active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            aria-label="Restart Game [R]"
            title="Restart Game [R]"
            className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-xl bg-[#111C33] border-2 border-[#334155] hover:border-amber-400 text-slate-100 transition-transform active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom Subtle Controls & Rules Strip */}
      <div className="text-center text-[11px] font-semibold text-slate-300/90 tracking-wide">
        First to Reach Wins! · Smash Rivals Off Course · 3+ Streak = 2 Pts ·{' '}
        {hud.players.map((p) => `${p.shortName}: ${p.controlsLabel}`).join(' · ')} · P Pause · R Restart
      </div>
    </div>
  );
};
