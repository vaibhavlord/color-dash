import React from 'react';
import { PLAYER_CONFIGS } from '../game/rules';

interface TitleScreenProps {
  playerCount: 2 | 3 | 4;
  isMuted: boolean;
  onSelectPlayerCount: (count: 2 | 3 | 4) => void;
  onStartGame: () => void;
  onOpenOnlineLobby: () => void;
  onToggleMute: () => void;
}

const KEYCAP_GROUPS: Record<number, { top: string; left: string; down: string; right: string }> = {
  1: { top: 'W', left: 'A', down: 'S', right: 'D' },
  2: { top: '↑', left: '←', down: '↓', right: '→' },
  3: { top: 'I', left: 'J', down: 'K', right: 'L' },
  4: { top: 'T', left: 'F', down: 'G', right: 'H' },
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  playerCount,
  isMuted,
  onSelectPlayerCount,
  onStartGame,
  onOpenOnlineLobby,
  onToggleMute,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at 50% 45%, rgba(11, 17, 32, 0.72) 0%, rgba(11, 17, 32, 0.92) 100%)',
      }}
    >
      {/* Top Utility Row: Mute Toggle */}
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto">
        <div className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
          First to Reach Wins · Unlimited Round Time · Local & Online Multiplayer
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1E293B] border-2 border-[#334155] hover:border-amber-400 text-slate-100 text-xs font-bold transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            {isMuted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
          <span>{isMuted ? 'Sound Off [M]' : 'Sound On [M]'}</span>
        </button>
      </div>

      {/* Center Stage: Custom SVG Title Lockup + Player Setup Card */}
      <main className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto my-auto gap-4">
        <div className="flex flex-col items-center text-center">
          <svg
            viewBox="0 0 620 128"
            className="w-full max-w-[500px] h-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)]"
            role="img"
            aria-label="Color Dash"
          >
            <rect
              x="26"
              y="16"
              width="132"
              height="92"
              rx="22"
              fill="#EF4444"
              stroke="#0F172A"
              strokeWidth="6"
              transform="rotate(-4 92 62)"
            />
            <rect
              x="172"
              y="12"
              width="132"
              height="92"
              rx="22"
              fill="#3B82F6"
              stroke="#0F172A"
              strokeWidth="6"
              transform="rotate(3 238 58)"
            />
            <rect
              x="318"
              y="16"
              width="132"
              height="92"
              rx="22"
              fill="#10B981"
              stroke="#0F172A"
              strokeWidth="6"
              transform="rotate(-2 384 62)"
            />
            <rect
              x="462"
              y="14"
              width="132"
              height="92"
              rx="22"
              fill="#F59E0B"
              stroke="#0F172A"
              strokeWidth="6"
              transform="rotate(4 528 60)"
            />

            <circle cx="52" cy="36" r="8" fill="#FEF2F2" opacity="0.65" />
            <rect
              x="276"
              y="24"
              width="14"
              height="14"
              rx="3"
              fill="#EFF6FF"
              opacity="0.65"
              transform="rotate(45 283 31)"
            />
            <circle cx="426" cy="34" r="8" fill="#ECFDF5" opacity="0.65" />
            <circle cx="568" cy="34" r="8" fill="#FFFBEB" opacity="0.65" />

            <text
              x="310"
              y="81"
              textAnchor="middle"
              fontFamily="Outfit, sans-serif"
              fontWeight="900"
              fontSize="68"
              letterSpacing="3"
              fill="#FFFFFF"
              stroke="#0F172A"
              strokeWidth="16"
              strokeLinejoin="round"
              style={{ paintOrder: 'stroke fill' }}
            >
              COLOR DASH
            </text>
          </svg>
          <p className="mt-1 text-sm sm:text-base font-medium text-slate-200 max-w-2xl text-balance">
            Wait for <strong className="text-amber-300">READY… 3, 2, 1, GO!</strong> — <strong className="text-emerald-300">whoever reaches the called plate FIRST wins the round!</strong> Body-check rivals off course and chain 3-round streaks for 2x points!
          </p>
        </div>

        {/* Main Setup & Controls Card */}
        <div className="pointer-events-auto w-full bg-[#111C33] border-2 border-[#334155] rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.75)] flex flex-col gap-5">
          {/* Player Count Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-slate-700/80">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                How many players?
              </h2>
              <p className="text-xs text-slate-300">
                Play Local on one keyboard or host an Online Multiplayer room
              </p>
            </div>

            <div
              className="flex items-center gap-2 p-1.5 bg-[#0B1120] rounded-2xl border border-slate-700"
              role="group"
              aria-label="Player count selector"
            >
              {([2, 3, 4] as const).map((count) => {
                const active = playerCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => onSelectPlayerCount(count)}
                    aria-pressed={active}
                    className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-transform cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-amber-400 text-slate-950 shadow-[0_3px_0_#B45309] scale-[1.02]'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    {count} Players
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4-Player Keyboard Controls Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PLAYER_CONFIGS.map((cfg) => {
              const isActive = cfg.id <= playerCount;
              const keys = KEYCAP_GROUPS[cfg.id];
              return (
                <div
                  key={cfg.id}
                  data-testid={`player-card-${cfg.id}`}
                  className={`flex flex-col items-center justify-between rounded-2xl p-3.5 border-2 transition-opacity ${
                    isActive
                      ? 'bg-[#1E293B] border-slate-600 opacity-100'
                      : 'bg-[#0F172A]/60 border-slate-800 opacity-45'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-md border-2 border-slate-950 inline-block shrink-0"
                        style={{ backgroundColor: cfg.colorHex }}
                      />
                      <span className="font-display font-extrabold text-sm text-white">
                        {cfg.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-300">
                      {isActive ? 'READY' : 'OFF'}
                    </span>
                  </div>

                  <div
                    className="flex flex-col items-center gap-1 my-1"
                    aria-label={`${cfg.name} keys ${cfg.controlsLabel}`}
                  >
                    <kbd className="w-8 h-7 flex items-center justify-center rounded-lg bg-[#0B1120] border-b-2 border-slate-600 text-xs font-mono-num font-bold text-white">
                      {keys.top}
                    </kbd>
                    <div className="flex items-center gap-1">
                      <kbd className="w-8 h-7 flex items-center justify-center rounded-lg bg-[#0B1120] border-b-2 border-slate-600 text-xs font-mono-num font-bold text-white">
                        {keys.left}
                      </kbd>
                      <kbd className="w-8 h-7 flex items-center justify-center rounded-lg bg-[#0B1120] border-b-2 border-slate-600 text-xs font-mono-num font-bold text-white">
                        {keys.down}
                      </kbd>
                      <kbd className="w-8 h-7 flex items-center justify-center rounded-lg bg-[#0B1120] border-b-2 border-slate-600 text-xs font-mono-num font-bold text-white">
                        {keys.right}
                      </kbd>
                    </div>
                  </div>

                  <div className="mt-1.5 text-xs font-bold tracking-wide text-amber-300">
                    {cfg.controlsLabel} Keys
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Start Game & Online Multiplayer CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
            <div className="text-xs text-slate-300 text-center sm:text-left">
              <strong className="text-emerald-300">First to Reach</strong> Wins Round ·{' '}
              <strong className="text-amber-300">2 Pts</strong> on 3+ Streak ·{' '}
              <strong className="text-red-400">False Start</strong> if early!
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                data-testid="online-multiplayer-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenOnlineLobby();
                }}
                className="flex-1 sm:flex-initial px-6 py-3.5 rounded-2xl bg-sky-400 hover:bg-sky-300 active:translate-y-0.5 text-slate-950 font-display font-black text-base sm:text-lg tracking-wide shadow-[0_5px_0_#0369A1] transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Online Multiplayer
              </button>

              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStartGame();
                }}
                className="flex-1 sm:flex-initial px-8 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 text-slate-950 font-display font-black text-base sm:text-lg tracking-wide shadow-[0_5px_0_#047857] transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Safe Margin: Single Flat Control-Hint Line */}
      <div className="text-center text-xs font-medium text-slate-300 tracking-wide">
        WASD (P1) · Arrows (P2) · IJKL (P3) · TFGH (P4) · Enter / Space Start · P Pause · M Mute
      </div>
    </div>
  );
};
