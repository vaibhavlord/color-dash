import React, { useState } from 'react';
import { PLAYER_CONFIGS } from '../game/rules';
import { OnlinePlayerDoc, OnlineRoomDoc, ROOM_CODE_REGEX } from '../firebase';

interface OnlineLobbyModalProps {
  isOpen: boolean;
  playerUid: string;
  playerName: string;
  room: OnlineRoomDoc | null;
  onlinePlayers: OnlinePlayerDoc[];
  mySlot: 1 | 2 | 3 | 4 | null;
  busy: boolean;
  errorMsg: string | null;
  onChangePlayerName: (name: string) => void;
  onClose: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartOnlineMatch: () => void;
  onLeaveRoom: () => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  isOpen,
  playerUid,
  playerName,
  room,
  onlinePlayers,
  mySlot,
  busy,
  errorMsg,
  onChangePlayerName,
  onClose,
  onCreateRoom,
  onJoinRoom,
  onStartOnlineMatch,
  onLeaveRoom,
}) => {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const trimmedName = playerName.trim();
  const isNameValid = trimmedName.length >= 1 && trimmedName.length <= 40;
  const isHost = Boolean(room && room.hostUid === playerUid);
  const canStart = isHost && onlinePlayers.length >= 2 && !busy;

  const handleCopyCode = () => {
    if (!room?.roomCode) return;
    navigator.clipboard?.writeText(room.roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeInput.trim().toUpperCase();
    if (!isNameValid || !ROOM_CODE_REGEX.test(cleaned)) return;
    onJoinRoom(cleaned);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(11, 17, 32, 0.88)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="online-lobby-title"
    >
      <div className="w-full max-w-lg bg-[#111C33] border-2 border-[#334155] rounded-3xl p-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex flex-col gap-5 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3.5">
          <div>
            <h2
              id="online-lobby-title"
              className="font-display font-black text-2xl sm:text-3xl text-white tracking-wide"
            >
              ONLINE MULTIPLAYER
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Play live by room code (2–4 players) · No account required
            </p>
          </div>
          <button
            type="button"
            onClick={room ? onLeaveRoom : onClose}
            className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
          >
            {room ? 'Leave Room' : 'Close'}
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div
            data-testid="online-error-banner"
            className="px-3.5 py-2.5 rounded-xl bg-red-950/80 border border-red-500/70 text-xs font-bold text-red-200"
          >
            {errorMsg}
          </div>
        )}

        {!room ? (
          /* Step 1: Set Username & Create or Join by Room Code */
          <div className="flex flex-col gap-4">
            {/* Custom Player Username Field */}
            <div className="p-4 rounded-2xl bg-[#0B1120] border-2 border-slate-700 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="player-name-input"
                  className="text-xs font-extrabold uppercase tracking-wider text-amber-300"
                >
                  Your Player Name
                </label>
                <span className="text-[11px] font-semibold text-slate-400">
                  {trimmedName.length}/24
                </span>
              </div>
              <input
                id="player-name-input"
                type="text"
                value={playerName}
                onChange={(e) => onChangePlayerName(e.target.value.slice(0, 24))}
                placeholder="Enter your username…"
                maxLength={24}
                data-testid="player-name-input"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1E293B] border-2 border-slate-600 focus:border-amber-400 focus:outline-none font-display font-bold text-base text-white placeholder:text-slate-500"
              />
            </div>

            {/* Create New Room */}
            <div className="p-4 rounded-2xl bg-[#1E293B] border border-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold text-base text-white">
                  Host a New Room
                </h3>
                <p className="text-xs text-slate-300">
                  Get a 6-character room code and invite 1–3 friends
                </p>
              </div>
              <button
                type="button"
                onClick={onCreateRoom}
                disabled={busy || !isNameValid}
                data-testid="create-room-btn"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-45 text-slate-950 font-display font-black text-sm tracking-wide shadow-[0_3px_0_#047857] cursor-pointer whitespace-nowrap shrink-0"
              >
                {busy ? 'Creating…' : 'Create Room'}
              </button>
            </div>

            {/* Join Existing Room by Code */}
            <form
              onSubmit={handleJoinSubmit}
              className="p-4 rounded-2xl bg-[#1E293B] border border-slate-600 flex flex-col gap-3"
            >
              <div>
                <h3 className="font-display font-extrabold text-base text-white">
                  Join with Room Code
                </h3>
                <p className="text-xs text-slate-300">
                  Enter the 6-character code shared by the room host
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 6)
                    )
                  }
                  placeholder="AB12CD"
                  maxLength={6}
                  aria-label="6-character Room Code"
                  data-testid="join-code-input"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#0B1120] border-2 border-slate-600 focus:border-amber-400 focus:outline-none font-mono-num font-black text-lg tracking-widest text-white uppercase"
                />
                <button
                  type="submit"
                  disabled={busy || !isNameValid || joinCodeInput.trim().length !== 6}
                  data-testid="join-room-btn"
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-45 text-slate-950 font-display font-black text-sm tracking-wide shadow-[0_3px_0_#B45309] cursor-pointer whitespace-nowrap shrink-0"
                >
                  {busy ? 'Joining…' : 'Join Room'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step 2: Waiting Room Lobby */
          <div className="flex flex-col gap-4">
            {/* Room Code Banner */}
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#0B1120] border-2 border-amber-400/80">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  SHARE ROOM CODE
                </div>
                <div
                  data-testid="active-room-code"
                  className="font-mono-num font-black text-2xl sm:text-3xl tracking-widest text-amber-300"
                >
                  {room.roomCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-white cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            {/* 4 Player Slots */}
            <div className="grid grid-cols-2 gap-2.5">
              {PLAYER_CONFIGS.map((cfg) => {
                const occupant = onlinePlayers.find((p) => p.slot === cfg.id);
                const isMe = occupant && mySlot === cfg.id;
                const isSlotHost = occupant && room.hostUid === occupant.uid;
                return (
                  <div
                    key={cfg.id}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-between ${
                      occupant
                        ? 'bg-[#1E293B] border-slate-500'
                        : 'bg-[#0F172A]/60 border-slate-800 opacity-55'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-5 h-5 rounded-md border-2 border-slate-950 shrink-0"
                        style={{ backgroundColor: cfg.colorHex }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white truncate">
                          {occupant ? occupant.displayName : `Slot ${cfg.id} Open`}
                        </div>
                        <div className="text-[10px] font-bold text-slate-300">
                          {occupant
                            ? `${cfg.shortName}${isMe ? ' · YOU' : ''}${isSlotHost ? ' · HOST' : ''}`
                            : 'Waiting…'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Start / Waiting Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="text-xs font-bold text-slate-300">
                {onlinePlayers.length < 2
                  ? 'Waiting for at least 1 more player to join…'
                  : `${onlinePlayers.length} / 4 players ready!`}
              </div>

              {isHost ? (
                <button
                  type="button"
                  onClick={onStartOnlineMatch}
                  disabled={!canStart}
                  data-testid="start-online-match-btn"
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-45 text-slate-950 font-display font-black text-base tracking-wide shadow-[0_4px_0_#047857] cursor-pointer whitespace-nowrap"
                >
                  Start Online Match
                </button>
              ) : (
                <div className="text-xs font-extrabold text-amber-300">
                  Waiting for Host to start…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
