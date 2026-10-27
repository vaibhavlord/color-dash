import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, HudSnapshot, OnlineSessionConfig } from './components/GameCanvas';
import { GameHud } from './components/GameHud';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import {
  OnlinePlayerDoc,
  OnlineRoomDoc,
  createOnlineRoom,
  getOrCreatePlayerUid,
  getSavedPlayerName,
  joinOnlineRoom,
  leaveOnlineRoom,
  savePlayerName,
  startOnlineMatch,
  subscribeToOnlineRoom,
} from './firebase';
import {
  GameState,
  INITIAL_CALLOUT_DURATION,
  PRE_ROUND_COUNTDOWN_DURATION,
  PlayerEntity,
  TOTAL_ROUNDS,
  createInitialPlayers,
} from './game/rules';
import { sound } from './game/sound';

function getInitialConfig(): {
  initialState: GameState;
  initialPlayers: 2 | 3 | 4;
  initialRounds: number;
} {
  if (typeof window === 'undefined') {
    return { initialState: 'title', initialPlayers: 2, initialRounds: TOTAL_ROUNDS };
  }
  const params = new URLSearchParams(window.location.search);
  const pParam = Number(params.get('players'));
  const initialPlayers: 2 | 3 | 4 =
    pParam === 3 ? 3 : pParam === 4 ? 4 : 2;
  const rParam = Number(params.get('rounds'));
  const initialRounds =
    Number.isFinite(rParam) && rParam >= 1 && rParam <= 30
      ? Math.round(rParam)
      : TOTAL_ROUNDS;
  const autostart = params.get('autostart') === '1';
  const state: GameState = autostart ? 'playing' : 'title';
  document.body.dataset.state = state;
  return { initialState: state, initialPlayers, initialRounds };
}

export default function App() {
  const [{ initialState, initialPlayers, initialRounds }] = useState(getInitialConfig);
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(initialPlayers);
  const [sessionId, setSessionId] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.isMuted());
  const [wonInSuddenDeath, setWonInSuddenDeath] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  // Firebase Online Multiplayer State (No login required — Room Code + Custom Username)
  const [playerUid] = useState<string>(() => getOrCreatePlayerUid());
  const [playerName, setPlayerName] = useState<string>(
    () => getSavedPlayerName() || 'Player 1'
  );
  const [onlineLobbyOpen, setOnlineLobbyOpen] = useState<boolean>(false);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [mySlot, setMySlot] = useState<1 | 2 | 3 | 4 | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomDoc | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayerDoc[]>([]);
  const [onlineBusy, setOnlineBusy] = useState<boolean>(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    round: 1,
    totalRounds: initialRounds,
    suddenDeath: false,
    suddenDeathRound: 0,
    phase: 'countdown',
    countdownLabel: 'READY…',
    roundDuration: INITIAL_CALLOUT_DURATION,
    targetColor: null,
    players: createInitialPlayers(initialPlayers),
    lastAwardedIds: [],
  }));

  const [finalPlayers, setFinalPlayers] = useState<PlayerEntity[]>(() =>
    createInitialPlayers(initialPlayers)
  );

  const timerBarRef = useRef<HTMLDivElement | null>(null);
  const timerTextRef = useRef<HTMLSpanElement | null>(null);

  const updateGameState = useCallback((next: GameState) => {
    document.body.dataset.state = next;
    setGameState(next);
  }, []);

  const handleChangePlayerName = useCallback((nextName: string) => {
    setPlayerName(nextName);
    savePlayerName(nextName);
  }, []);

  useEffect(() => {
    if (!activeRoomCode) {
      setOnlineRoom(null);
      setOnlinePlayers([]);
      return;
    }

    const unsub = subscribeToOnlineRoom(
      activeRoomCode,
      (roomDoc) => {
        setOnlineRoom(roomDoc);
        if (!roomDoc) {
          setActiveRoomCode(null);
          setMySlot(null);
        }
      },
      (playersList) => {
        setOnlinePlayers(playersList);
      }
    );

    return () => unsub();
  }, [activeRoomCode]);

  // Automatically start the game on all clients when the Online Room transitions to 'playing'
  useEffect(() => {
    if (onlineRoom?.status === 'playing' && gameState === 'title') {
      const count = Math.max(2, Math.min(4, onlinePlayers.length || onlineRoom.playerCount)) as
        | 2
        | 3
        | 4;
      setPlayerCount(count);
      setOnlineLobbyOpen(false);
      setWonInSuddenDeath(false);
      setSessionId((prev) => prev + 1);
      updateGameState('playing');
    }
  }, [onlineRoom?.status, onlineRoom?.playerCount, onlinePlayers.length, gameState, updateGameState]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleSelectPlayerCount = useCallback((count: 2 | 3 | 4) => {
    sound.playPop(480);
    setPlayerCount(count);
  }, []);

  const handleStartLocalGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveRoomCode(null);
    setMySlot(null);
    setOnlineLobbyOpen(false);
    sound.playPop(580);
    setWonInSuddenDeath(false);
    setSessionId((prev) => prev + 1);
    updateGameState('playing');
  }, [updateGameState]);

  const handleOpenOnlineLobby = useCallback(() => {
    sound.playPop(520);
    setOnlineError(null);
    setOnlineLobbyOpen(true);
  }, []);

  const handleCreateRoom = useCallback(async () => {
    const cleanedName = playerName.trim() || 'Player 1';
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const { roomCode, slot } = await createOnlineRoom(
        playerUid,
        cleanedName,
        initialRounds
      );
      setActiveRoomCode(roomCode);
      setMySlot(slot);
      sound.playPop(600);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Could not create room.');
    } finally {
      setOnlineBusy(false);
    }
  }, [playerUid, playerName, initialRounds]);

  const handleJoinRoom = useCallback(
    async (code: string) => {
      const cleanedName = playerName.trim() || 'Player';
      setOnlineBusy(true);
      setOnlineError(null);
      try {
        const { roomCode, slot } = await joinOnlineRoom(
          playerUid,
          cleanedName,
          code
        );
        setActiveRoomCode(roomCode);
        setMySlot(slot);
        sound.playPop(600);
      } catch (err) {
        setOnlineError(err instanceof Error ? err.message : 'Could not join room.');
      } finally {
        setOnlineBusy(false);
      }
    },
    [playerUid, playerName]
  );

  const handleLeaveRoom = useCallback(async () => {
    if (activeRoomCode) {
      await leaveOnlineRoom(
        activeRoomCode,
        playerUid,
        onlineRoom?.hostUid === playerUid
      );
    }
    setActiveRoomCode(null);
    setMySlot(null);
    setOnlineRoom(null);
    setOnlinePlayers([]);
    setOnlineError(null);
  }, [activeRoomCode, playerUid, onlineRoom?.hostUid]);

  const handleStartOnlineMatch = useCallback(async () => {
    if (!activeRoomCode || onlinePlayers.length < 2) return;
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      await startOnlineMatch(activeRoomCode, onlinePlayers);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Failed to start match.');
    } finally {
      setOnlineBusy(false);
    }
  }, [activeRoomCode, onlinePlayers]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  const handlePause = useCallback(() => {
    sound.playPop(400);
    updateGameState('paused');
  }, [updateGameState]);

  const handleResume = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    sound.playPop(520);
    updateGameState('playing');
  }, [updateGameState]);

  const handleBackToTitle = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (activeRoomCode) {
      leaveOnlineRoom(
        activeRoomCode,
        playerUid,
        onlineRoom?.hostUid === playerUid
      ).catch(() => {});
    }
    setActiveRoomCode(null);
    setMySlot(null);
    setOnlineLobbyOpen(false);
    sound.playPop(420);
    setSessionId((prev) => prev + 1);
    updateGameState('title');
  }, [activeRoomCode, playerUid, onlineRoom?.hostUid, updateGameState]);

  const handleGameOver = useCallback(
    (endPlayers: PlayerEntity[], suddenDeathWin: boolean) => {
      setFinalPlayers(endPlayers);
      setWonInSuddenDeath(suddenDeathWin);
      updateGameState('gameover');
    },
    [updateGameState]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Ignore global shortcuts if typing in an input inside the online modal
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (gameState === 'title' && !onlineLobbyOpen) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartLocalGame();
        } else if (e.key === '2') {
          handleSelectPlayerCount(2);
        } else if (e.key === '3') {
          handleSelectPlayerCount(3);
        } else if (e.key === '4') {
          handleSelectPlayerCount(4);
        }
      } else if (gameState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handlePause();
        } else if (e.code === 'KeyR' && !activeRoomCode) {
          e.preventDefault();
          handleStartLocalGame();
        }
      } else if (gameState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleResume();
        }
      } else if (gameState === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartLocalGame();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    onlineLobbyOpen,
    activeRoomCode,
    handleStartLocalGame,
    handlePause,
    handleResume,
    handleToggleMute,
    handleSelectPlayerCount,
  ]);

  const activeOnlineSession: OnlineSessionConfig | null =
    activeRoomCode && mySlot && onlineRoom
      ? {
          roomCode: activeRoomCode,
          myUid: playerUid,
          mySlot,
          isHost: onlineRoom.hostUid === playerUid,
          room: onlineRoom,
          onlinePlayers,
        }
      : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#0B1120]">
      <GameCanvas
        gameState={gameState}
        playerCount={playerCount}
        totalRounds={initialRounds}
        countdownDuration={PRE_ROUND_COUNTDOWN_DURATION}
        sessionId={sessionId}
        reducedMotion={reducedMotion}
        onlineSession={activeOnlineSession}
        timerBarRef={timerBarRef}
        timerTextRef={timerTextRef}
        onHudSync={setHud}
        onGameOver={handleGameOver}
      />

      {gameState === 'title' && (
        <TitleScreen
          playerCount={playerCount}
          isMuted={isMuted}
          onSelectPlayerCount={handleSelectPlayerCount}
          onStartGame={handleStartLocalGame}
          onOpenOnlineLobby={handleOpenOnlineLobby}
          onToggleMute={handleToggleMute}
        />
      )}

      {gameState === 'title' && (
        <OnlineLobbyModal
          isOpen={onlineLobbyOpen}
          playerUid={playerUid}
          playerName={playerName}
          room={onlineRoom}
          onlinePlayers={onlinePlayers}
          mySlot={mySlot}
          busy={onlineBusy}
          errorMsg={onlineError}
          onChangePlayerName={handleChangePlayerName}
          onClose={() => setOnlineLobbyOpen(false)}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onStartOnlineMatch={handleStartOnlineMatch}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {gameState === 'playing' && (
        <GameHud
          hud={hud}
          isMuted={isMuted}
          timerBarRef={timerBarRef}
          timerTextRef={timerTextRef}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={activeRoomCode ? handleBackToTitle : handleStartLocalGame}
        />
      )}

      <StatusModal
        gameState={gameState}
        players={gameState === 'gameover' ? finalPlayers : hud.players}
        wonInSuddenDeath={wonInSuddenDeath}
        totalRoundsPlayed={hud.round}
        onResume={handleResume}
        onPlayAgain={handleStartLocalGame}
        onBackToTitle={handleBackToTitle}
      />
    </div>
  );
}
