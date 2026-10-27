import React from 'react';
import { GameState, PlayerEntity, TOTAL_ROUNDS, computeWinnerSummary } from '../game/rules';

interface StatusModalProps {
  gameState: GameState;
  players: PlayerEntity[];
  wonInSuddenDeath: boolean;
  totalRoundsPlayed: number;
  onResume: () => void;
  onPlayAgain: () => void;
  onBackToTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  gameState,
  players,
  wonInSuddenDeath,
  totalRoundsPlayed,
  onResume,
  onPlayAgain,
  onBackToTitle,
}) => {
  if (gameState !== 'paused' && gameState !== 'gameover') {
    return null;
  }

  if (gameState === 'paused') {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(11, 17, 32, 0.85)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-modal-title"
      >
        <div className="w-full max-w-md bg-[#111C33] border-2 border-[#334155] rounded-3xl p-6 shadow-[0_24px_60px_rgba(0,0,0,0.8)] flex flex-col gap-5 text-center">
          <div>
            <h2
              id="pause-modal-title"
              className="font-display font-black text-3xl text-white tracking-wide"
            >
              GAME PAUSED
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Wait for GO! before moving · 3+ Streak earns 2 points per round.
            </p>
          </div>

          <div className="bg-[#0B1120] border border-slate-700 rounded-2xl p-3.5 flex flex-col gap-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-sm px-2 py-1"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-sm border border-slate-950 shrink-0"
                    style={{ backgroundColor: p.colorHex }}
                  />
                  <span className="font-bold text-white">{p.name}</span>
                </div>
                <span className="font-mono-num text-xs font-bold text-amber-300">
                  {p.controlsLabel} Keys · {p.score} pts (🔥{p.streak})
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-black text-base tracking-wide shadow-[0_4px_0_#047857] cursor-pointer whitespace-nowrap"
            >
              Resume Game
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onPlayAgain}
                className="py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-slate-700 border border-slate-600 text-white font-bold text-sm cursor-pointer whitespace-nowrap"
              >
                Restart Match
              </button>
              <button
                type="button"
                onClick={onBackToTitle}
                className="py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm cursor-pointer whitespace-nowrap"
              >
                Change Players
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results / Winner Modal (gameState === 'gameover')
  const summary = computeWinnerSummary(players);
  const topStreak = Math.max(0, ...players.map((p) => p.bestStreak));
  const winnerNames = summary.winners.map((w) => w.name).join(' & ');
  const primaryWinner = summary.winners[0];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(11, 17, 32, 0.88)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-modal-title"
    >
      <div className="w-full max-w-lg bg-[#111C33] border-2 border-[#334155] rounded-3xl p-6 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex flex-col gap-5 text-center">
        {/* Trophy & Winner Announcement */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 border-slate-950 shadow-lg"
            style={{
              backgroundColor: primaryWinner ? primaryWinner.colorHex : '#FACC15',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-9 h-9 fill-slate-950"
              aria-hidden="true"
            >
              <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
            </svg>
          </div>

          <h2
            id="results-modal-title"
            data-testid="winner-headline"
            className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight text-balance"
          >
            {summary.topScore === 0
              ? 'No Points Scored!'
              : summary.isTie
              ? `Tie Game! ${winnerNames}`
              : `${winnerNames} Wins!`}
          </h2>
          <p className="text-sm text-slate-300">
            {wonInSuddenDeath
              ? `Clinched victory in Sudden Death (${totalRoundsPlayed} total rounds)!`
              : `${totalRoundsPlayed || TOTAL_ROUNDS} rounds complete — final standings`}
          </p>
        </div>

        {/* 3 Mastery Stat Tiles (tabular-nums) */}
        <div className="grid grid-cols-3 gap-2.5 bg-[#0B1120] border border-slate-700/80 rounded-2xl p-3">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              WINNING SCORE
            </span>
            <span className="font-mono-num font-black text-xl sm:text-2xl text-amber-300">
              {summary.topScore} PTS
            </span>
          </div>
          <div className="flex flex-col items-center border-x border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ROUNDS PLAYED
            </span>
            <span className="font-mono-num font-black text-xl sm:text-2xl text-white">
              {totalRoundsPlayed || TOTAL_ROUNDS}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              BEST STREAK
            </span>
            <span className="font-mono-num font-black text-xl sm:text-2xl text-emerald-400">
              {topStreak}x 🔥
            </span>
          </div>
        </div>

        {/* Ranked Player Standings */}
        <div className="flex flex-col gap-2" aria-label="Final Player Rankings">
          {summary.rankedPlayers.map((p, idx) => {
            const isWinner = summary.topScore > 0 && idx === 0 && !summary.isTie;
            return (
              <div
                key={p.id}
                data-testid={`result-row-p${p.id}`}
                className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 ${
                  isWinner
                    ? 'bg-[#1E293B] border-amber-400'
                    : 'bg-[#0F172A] border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono-num font-extrabold text-sm text-slate-400 w-5 text-left">
                    #{idx + 1}
                  </span>
                  <span
                    className="w-5 h-5 rounded-md border-2 border-slate-950 shrink-0"
                    style={{ backgroundColor: p.colorHex }}
                  />
                  <div className="text-left">
                    <div className="font-display font-extrabold text-sm sm:text-base text-white leading-tight">
                      {p.name}
                      {isWinner ? ' ★' : ''}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p.controlsLabel} · Best Streak {p.bestStreak}x · False Starts {p.falseStartCount}
                    </div>
                  </div>
                </div>

                <div className="font-mono-num font-black text-xl sm:text-2xl text-amber-300">
                  {p.score} <span className="text-xs font-bold text-slate-400">PTS</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 text-slate-950 font-display font-black text-lg tracking-wide shadow-[0_5px_0_#047857] cursor-pointer whitespace-nowrap"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-[#1E293B] hover:bg-slate-700 border-2 border-slate-600 text-slate-100 font-bold text-sm cursor-pointer whitespace-nowrap"
          >
            Change Players
          </button>
        </div>
      </div>
    </div>
  );
};
