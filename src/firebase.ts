import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  RoundPhase,
  TOTAL_ROUNDS,
  ZoneColor,
  getSpawnPositions,
} from './game/rules';

const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.FIREBASE_FIRESTORE_DATABASE_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Blueprint validation constants (synced verbatim with firebase-blueprint.json & firestore.rules)
export const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;
export const UID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const MAX_DISPLAY_NAME_LENGTH = 40;

const PLAYER_UID_STORAGE_KEY = 'colordash_online_uid';
const PLAYER_NAME_STORAGE_KEY = 'colordash_online_name';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || getOrCreatePlayerUid(),
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous ?? true,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface OnlineRoomDoc {
  roomCode: string;
  hostUid: string;
  hostName: string;
  status: 'waiting' | 'playing' | 'finished';
  round: number;
  totalRounds: number;
  suddenDeath: boolean;
  suddenDeathRound: number;
  phase: RoundPhase;
  countdownLabel: 'READY…' | '3' | '2' | '1' | 'GO!';
  targetColor: 'none' | ZoneColor;
  lastWinnerSlot: number;
  winnerSlot: number;
  playerCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OnlinePlayerDoc {
  uid: string;
  roomId: string;
  slot: 1 | 2 | 3 | 4;
  displayName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  score: number;
  streak: number;
  bestStreak: number;
  falseStarted: boolean;
  falseStartCount: number;
  isContender: boolean;
  claimedRound: number;
  joinedAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function getOrCreatePlayerUid(): string {
  try {
    // Use sessionStorage so separate browser tabs on the same device can also join as distinct players
    const existing = sessionStorage.getItem(PLAYER_UID_STORAGE_KEY);
    if (existing && UID_REGEX.test(existing) && existing.length >= 6) {
      return existing;
    }
  } catch {
    // Ignore storage errors
  }

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let generated = 'p_';
  for (let i = 0; i < 18; i++) {
    generated += chars[Math.floor(Math.random() * chars.length)];
  }

  try {
    sessionStorage.setItem(PLAYER_UID_STORAGE_KEY, generated);
  } catch {
    // Ignore storage errors
  }
  return generated;
}

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH));
  } catch {
    // Ignore storage errors
  }
}

export function sanitizeDisplayName(raw: string | null | undefined, fallback = 'Player'): string {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return fallback;
  return cleaned.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function clampNum(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Number(val.toFixed(2))));
}

export async function createOnlineRoom(
  playerUid: string,
  rawPlayerName: string,
  totalRounds = TOTAL_ROUNDS
): Promise<{ roomCode: string; slot: 1 }> {
  const roomCode = generateRoomCode();
  if (!ROOM_CODE_REGEX.test(roomCode) || !UID_REGEX.test(playerUid)) {
    throw new Error('Invalid room code or player ID format.');
  }

  const hostName = sanitizeDisplayName(rawPlayerName, 'Player 1');
  savePlayerName(hostName);

  const spawns = getSpawnPositions(2);
  const spawn0 = spawns[0] || { x: ARENA_WIDTH / 2 - 34, y: ARENA_HEIGHT / 2 };

  const roomPath = `rooms/${roomCode}`;
  const playerPath = `rooms/${roomCode}/players/${playerUid}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'rooms', roomCode), {
      roomCode,
      hostUid: playerUid,
      hostName,
      status: 'waiting',
      round: 1,
      totalRounds: Math.max(1, Math.min(30, Math.round(totalRounds))),
      suddenDeath: false,
      suddenDeathRound: 0,
      phase: 'countdown',
      countdownLabel: 'READY…',
      targetColor: 'none',
      lastWinnerSlot: 0,
      winnerSlot: 0,
      playerCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'rooms', roomCode, 'players', playerUid), {
      uid: playerUid,
      roomId: roomCode,
      slot: 1,
      displayName: hostName,
      x: clampNum(spawn0.x, 0, ARENA_WIDTH),
      y: clampNum(spawn0.y, 0, ARENA_HEIGHT),
      vx: 0,
      vy: 0,
      facingX: 0,
      facingY: 1,
      score: 0,
      streak: 0,
      bestStreak: 0,
      falseStarted: false,
      falseStartCount: 0,
      isContender: true,
      claimedRound: 0,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return { roomCode, slot: 1 };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${roomPath} & ${playerPath}`);
  }
}

export async function joinOnlineRoom(
  playerUid: string,
  rawPlayerName: string,
  rawRoomCode: string
): Promise<{ roomCode: string; slot: 1 | 2 | 3 | 4 }> {
  const roomCode = rawRoomCode.trim().toUpperCase();
  if (!ROOM_CODE_REGEX.test(roomCode)) {
    throw new Error('Room code must be 6 letters/numbers (e.g. AB12CD).');
  }
  if (!UID_REGEX.test(playerUid)) {
    throw new Error('Invalid player ID.');
  }

  const roomPath = `rooms/${roomCode}`;
  const playersPath = `rooms/${roomCode}/players`;

  let roomSnap;
  try {
    roomSnap = await getDoc(doc(db, 'rooms', roomCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, roomPath);
  }

  if (!roomSnap.exists()) {
    throw new Error(`Room "${roomCode}" not found. Check the 6-character code!`);
  }

  const roomData = roomSnap.data() as OnlineRoomDoc;
  if (roomData.status !== 'waiting') {
    throw new Error(`Room "${roomCode}" has already started or finished.`);
  }

  let playersSnap;
  try {
    const q = query(collection(db, 'rooms', roomCode, 'players'), where('roomId', '==', roomCode));
    playersSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, playersPath);
  }

  const existingPlayers = playersSnap.docs.map((d) => d.data() as OnlinePlayerDoc);
  const alreadyJoined = existingPlayers.find((p) => p.uid === playerUid);
  if (alreadyJoined) {
    const updatedName = sanitizeDisplayName(rawPlayerName, alreadyJoined.displayName);
    savePlayerName(updatedName);
    if (updatedName !== alreadyJoined.displayName) {
      await updateDoc(doc(db, 'rooms', roomCode, 'players', playerUid), {
        displayName: updatedName,
        updatedAt: serverTimestamp(),
      });
    }
    return { roomCode, slot: alreadyJoined.slot };
  }

  if (existingPlayers.length >= 4) {
    throw new Error(`Room "${roomCode}" is full (4/4 players).`);
  }

  const usedSlots = new Set(existingPlayers.map((p) => p.slot));
  const assignedSlot = ([1, 2, 3, 4] as const).find((s) => !usedSlots.has(s)) || 2;
  const newCount = Math.min(4, existingPlayers.length + 1);
  const spawns = getSpawnPositions(Math.max(2, newCount));
  const spawnPos = spawns[assignedSlot - 1] || { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
  const displayName = sanitizeDisplayName(rawPlayerName, `Player ${assignedSlot}`);
  savePlayerName(displayName);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'rooms', roomCode, 'players', playerUid), {
      uid: playerUid,
      roomId: roomCode,
      slot: assignedSlot,
      displayName,
      x: clampNum(spawnPos.x, 0, ARENA_WIDTH),
      y: clampNum(spawnPos.y, 0, ARENA_HEIGHT),
      vx: 0,
      vy: 0,
      facingX: 0,
      facingY: 1,
      score: 0,
      streak: 0,
      bestStreak: 0,
      falseStarted: false,
      falseStartCount: 0,
      isContender: true,
      claimedRound: 0,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'rooms', roomCode), {
      playerCount: newCount,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return { roomCode, slot: assignedSlot };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${playersPath}/${playerUid}`);
  }
}

export async function leaveOnlineRoom(roomCode: string, uid: string, isHost: boolean): Promise<void> {
  if (!ROOM_CODE_REGEX.test(roomCode) || !UID_REGEX.test(uid)) return;
  try {
    await deleteDoc(doc(db, 'rooms', roomCode, 'players', uid));
    if (isHost) {
      await deleteDoc(doc(db, 'rooms', roomCode));
    }
  } catch {
    // Ignore cleanup errors if room already closed
  }
}

export async function startOnlineMatch(
  roomCode: string,
  players: OnlinePlayerDoc[]
): Promise<void> {
  if (!ROOM_CODE_REGEX.test(roomCode)) return;
  const count = Math.max(2, Math.min(4, players.length));
  const spawns = getSpawnPositions(count);

  try {
    const batch = writeBatch(db);
    players.forEach((p, idx) => {
      const pos = spawns[idx] || { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
      batch.update(doc(db, 'rooms', roomCode, 'players', p.uid), {
        x: clampNum(pos.x, 0, ARENA_WIDTH),
        y: clampNum(pos.y, 0, ARENA_HEIGHT),
        vx: 0,
        vy: 0,
        facingX: 0,
        facingY: 1,
        score: 0,
        streak: 0,
        bestStreak: 0,
        falseStarted: false,
        falseStartCount: 0,
        isContender: true,
        claimedRound: 0,
        updatedAt: serverTimestamp(),
      });
    });

    batch.update(doc(db, 'rooms', roomCode), {
      status: 'playing',
      round: 1,
      suddenDeath: false,
      suddenDeathRound: 0,
      phase: 'countdown',
      countdownLabel: 'READY…',
      targetColor: 'none',
      lastWinnerSlot: 0,
      winnerSlot: 0,
      playerCount: players.length,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomCode}`);
  }
}

export async function syncLocalPlayerStateToFirestore(
  roomCode: string,
  uid: string,
  state: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facingX: number;
    facingY: number;
    falseStarted: boolean;
    falseStartCount: number;
    claimedRound: number;
  }
): Promise<void> {
  if (!ROOM_CODE_REGEX.test(roomCode) || !UID_REGEX.test(uid)) return;
  const path = `rooms/${roomCode}/players/${uid}`;
  try {
    await updateDoc(doc(db, 'rooms', roomCode, 'players', uid), {
      x: clampNum(state.x, 0, ARENA_WIDTH),
      y: clampNum(state.y, 0, ARENA_HEIGHT),
      vx: clampNum(state.vx, -1200, 1200),
      vy: clampNum(state.vy, -1200, 1200),
      facingX: clampNum(state.facingX, -1, 1),
      facingY: clampNum(state.facingY, -1, 1),
      falseStarted: Boolean(state.falseStarted),
      falseStartCount: Math.max(0, Math.min(50, Math.round(state.falseStartCount))),
      claimedRound: Math.max(0, Math.min(50, Math.round(state.claimedRound))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function hostUpdateOnlineRoom(
  roomCode: string,
  patch: Partial<
    Pick<
      OnlineRoomDoc,
      | 'status'
      | 'round'
      | 'totalRounds'
      | 'suddenDeath'
      | 'suddenDeathRound'
      | 'phase'
      | 'countdownLabel'
      | 'targetColor'
      | 'lastWinnerSlot'
      | 'winnerSlot'
      | 'playerCount'
    >
  >
): Promise<void> {
  if (!ROOM_CODE_REGEX.test(roomCode)) return;
  const path = `rooms/${roomCode}`;
  try {
    await updateDoc(doc(db, 'rooms', roomCode), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function hostBatchUpdateRoundAndPlayers(
  roomCode: string,
  roomPatch: Partial<
    Pick<
      OnlineRoomDoc,
      | 'status'
      | 'round'
      | 'totalRounds'
      | 'suddenDeath'
      | 'suddenDeathRound'
      | 'phase'
      | 'countdownLabel'
      | 'targetColor'
      | 'lastWinnerSlot'
      | 'winnerSlot'
      | 'playerCount'
    >
  >,
  playerUpdates: Array<{
    uid: string;
    patch: Partial<
      Pick<
        OnlinePlayerDoc,
        | 'x'
        | 'y'
        | 'vx'
        | 'vy'
        | 'facingX'
        | 'facingY'
        | 'score'
        | 'streak'
        | 'bestStreak'
        | 'falseStarted'
        | 'falseStartCount'
        | 'isContender'
        | 'claimedRound'
      >
    >;
  }>
): Promise<void> {
  if (!ROOM_CODE_REGEX.test(roomCode)) return;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'rooms', roomCode), {
      ...roomPatch,
      updatedAt: serverTimestamp(),
    });
    for (const item of playerUpdates) {
      batch.update(doc(db, 'rooms', roomCode, 'players', item.uid), {
        ...item.patch,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomCode}`);
  }
}

export function subscribeToOnlineRoom(
  roomCode: string,
  onRoomChange: (room: OnlineRoomDoc | null) => void,
  onPlayersChange: (players: OnlinePlayerDoc[]) => void
): () => void {
  if (!ROOM_CODE_REGEX.test(roomCode)) {
    return () => {};
  }

  const roomPath = `rooms/${roomCode}`;
  const playersPath = `rooms/${roomCode}/players`;

  const unsubRoom = onSnapshot(
    doc(db, 'rooms', roomCode),
    (snap) => {
      if (!snap.exists()) {
        onRoomChange(null);
        return;
      }
      onRoomChange(snap.data() as OnlineRoomDoc);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, roomPath);
    }
  );

  const playersQuery = query(
    collection(db, 'rooms', roomCode, 'players'),
    where('roomId', '==', roomCode)
  );
  const unsubPlayers = onSnapshot(
    playersQuery,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as OnlinePlayerDoc)
        .sort((a, b) => a.slot - b.slot);
      onPlayersChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, playersPath);
    }
  );

  return () => {
    unsubRoom();
    unsubPlayers();
  };
}
