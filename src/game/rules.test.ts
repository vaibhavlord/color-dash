import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HEIGHT,
  ARENA_PADDING,
  ARENA_WIDTH,
  TOTAL_ROUNDS,
  ZONES,
  computeWinnerSummary,
  createInitialPlayers,
  evaluateRoundScoring,
  getCalloutDurationForRound,
  getPlayerZone,
  isPointInZone,
  pickNextZoneColor,
  resolveMatchProgression,
  resolvePlayerCollisions,
  stepPlayerMovement,
  triggerPlayerFalseStart,
} from './rules';

test('createInitialPlayers spawns requested number of players in neutral center', () => {
  const p2 = createInitialPlayers(2);
  assert.equal(p2.length, 2);
  assert.equal(getPlayerZone(p2[0]), null);
  assert.equal(getPlayerZone(p2[1]), null);

  const p4 = createInitialPlayers(4);
  assert.equal(p4.length, 4);
  for (const p of p4) {
    assert.equal(p.score, 0);
    assert.equal(getPlayerZone(p), null);
  }
});

test('getCalloutDurationForRound starts at 2.5s and reduces by 0.25s every 3 rounds down to 1.0s', () => {
  assert.equal(getCalloutDurationForRound(1), 2.5);
  assert.equal(getCalloutDurationForRound(2), 2.5);
  assert.equal(getCalloutDurationForRound(3), 2.5);
  assert.equal(getCalloutDurationForRound(4), 2.25);
  assert.equal(getCalloutDurationForRound(6), 2.25);
  assert.equal(getCalloutDurationForRound(7), 2.0);
  assert.equal(getCalloutDurationForRound(10), 1.75);
  assert.equal(getCalloutDurationForRound(13), 1.5);
  assert.equal(getCalloutDurationForRound(15), 1.5);
  assert.equal(getCalloutDurationForRound(16), 1.25);
  assert.equal(getCalloutDurationForRound(19), 1.0);
  assert.equal(getCalloutDurationForRound(25), 1.0);
});

test('isPointInZone and getPlayerZone accurately identify colored quadrants', () => {
  const redCenter = {
    x: ZONES.red.x + ZONES.red.width / 2,
    y: ZONES.red.y + ZONES.red.height / 2,
  };
  assert.equal(isPointInZone(redCenter.x, redCenter.y, ZONES.red), true);
  assert.equal(isPointInZone(redCenter.x, redCenter.y, ZONES.blue), false);
  assert.equal(getPlayerZone(redCenter), 'red');
});

test('stepPlayerMovement moves player, clamps within arena bounds, and locks false-started players', () => {
  const [player, falsePlayer] = createInitialPlayers(2);
  const startX = player.x;

  for (let i = 0; i < 10; i++) {
    stepPlayerMovement(player, 1, 0, 0.03);
  }
  assert.ok(player.x > startX, 'Player should move right when inputX is +1');

  // False-started player cannot steer
  const fsStartX = falsePlayer.x;
  triggerPlayerFalseStart(falsePlayer);
  assert.equal(falsePlayer.falseStarted, true);
  stepPlayerMovement(falsePlayer, 1, 0, 0.03);
  assert.equal(falsePlayer.x, fsStartX, 'False-started player should not move from steering input');

  // Force far outside arena and verify clamping
  player.x = -500;
  player.y = 9999;
  stepPlayerMovement(player, -1, 1, 0.016);
  assert.ok(player.x >= ARENA_PADDING + player.radius);
  assert.ok(player.y <= ARENA_HEIGHT - ARENA_PADDING - player.radius);
  assert.ok(player.x <= ARENA_WIDTH - ARENA_PADDING - player.radius);
});

test('colored plates are compact (176x116) and clearly separated', () => {
  for (const zone of Object.values(ZONES)) {
    assert.equal(zone.width, 176);
    assert.equal(zone.height, 116);
  }
  const horizontalGap = ZONES.blue.x - (ZONES.red.x + ZONES.red.width);
  const verticalGap = ZONES.green.y - (ZONES.red.y + ZONES.red.height);
  assert.ok(horizontalGap >= 300, 'Plates should have wide horizontal separation');
  assert.ok(verticalGap >= 200, 'Plates should have wide vertical separation');
});

test('resolvePlayerCollisions delivers competitive, impactful knockback that knocks a rival off course', () => {
  const players = createInitialPlayers(2);
  // Place Player 2 standing near the right edge of the Red plate
  const rightEdge = ZONES.red.x + ZONES.red.width;
  const startP2X = rightEdge - 18;
  const centerY = ZONES.red.y + ZONES.red.height / 2;

  players[1].x = startP2X;
  players[1].y = centerY;
  players[1].vx = 0;
  players[1].vy = 0;
  assert.equal(isPointInZone(players[1].x, players[1].y, ZONES.red), true);

  // Place Player 1 dashing right at full speed, slamming into Player 2
  players[0].x = startP2X - 28;
  players[0].y = centerY;
  players[0].vx = 380;
  players[0].vy = 0;

  const events = resolvePlayerCollisions(players);
  assert.equal(events.length, 1);

  const distAfter = Math.hypot(players[1].x - players[0].x, players[1].y - players[0].y);
  assert.ok(distAfter >= players[0].radius + players[1].radius);
  assert.ok(players[1].bounceVx > 350, 'Defender should receive strong rightward knockback');
  assert.ok(
    players[1].bounceVx > Math.abs(players[0].bounceVx),
    'Faster attacker should transfer greater knockback to the defender than recoil taken'
  );

  // Step through the 0.24s impact recovery window while Player 2 tries to resist
  for (let step = 0; step < 14; step++) {
    stepPlayerMovement(players[1], -1, 0, 0.016);
  }

  const totalDisplacement = players[1].x - startP2X;
  assert.equal(
    isPointInZone(players[1].x, players[1].y, ZONES.red),
    false,
    'Competitor on plate should be knocked completely off the plate'
  );
  assert.ok(
    totalDisplacement > 45 && totalDisplacement < 140,
    `Impact displacement (${totalDisplacement.toFixed(1)}px) should be strong and competitive`
  );
});

test('evaluateRoundScoring awards points ONLY to the first player to reach the plate, with 2 pts on 3+ streak', () => {
  let players = createInitialPlayers(2);
  // Put Player 1 at the center of Blue plate (reached first) and Player 2 near the edge of Blue plate
  players[0].x = ZONES.blue.x + ZONES.blue.width / 2;
  players[0].y = ZONES.blue.y + ZONES.blue.height / 2;
  players[1].x = ZONES.blue.x + 15;
  players[1].y = ZONES.blue.y + 15;

  // Round 1: Even if both are in Blue, ONLY the first/closest player (P1) wins the round!
  let outcome = evaluateRoundScoring(players, 'blue', players[0].id);
  players = outcome.updatedPlayers;
  assert.deepEqual(outcome.awardedPlayerIds, [1]);
  assert.equal(players[0].score, 1);
  assert.equal(players[0].streak, 1);
  assert.equal(players[1].score, 0);
  assert.equal(players[1].streak, 0);

  // Round 2: P1 reaches first again -> gets 1 pt (streak 2 -> total 2)
  outcome = evaluateRoundScoring(players, 'blue', players[0].id);
  players = outcome.updatedPlayers;
  assert.equal(players[0].score, 2);
  assert.equal(players[0].streak, 2);

  // Round 3: P1 reaches first for 3rd time in a row -> earns 2 points! (total 4)
  outcome = evaluateRoundScoring(players, 'blue', players[0].id);
  players = outcome.updatedPlayers;
  assert.equal(outcome.pointsByPlayerId[1], 2);
  assert.equal(players[0].score, 4);
  assert.equal(players[0].streak, 3);

  // Round 4: P2 reaches first this time -> P2 gets 1 pt, P1 gets 0 and resets streak!
  outcome = evaluateRoundScoring(players, 'blue', players[1].id);
  players = outcome.updatedPlayers;
  assert.deepEqual(outcome.awardedPlayerIds, [2]);
  assert.equal(players[1].score, 1);
  assert.equal(players[1].streak, 1);
  assert.equal(players[0].score, 4);
  assert.equal(players[0].streak, 0);

  // Round 5: False-started player cannot win even if passed as firstWinnerId
  triggerPlayerFalseStart(players[1]);
  outcome = evaluateRoundScoring(players, 'blue', players[1].id);
  players = outcome.updatedPlayers;
  assert.deepEqual(outcome.awardedPlayerIds, []);
  assert.equal(players[1].score, 1);
});

test('resolveMatchProgression triggers Sudden Death on Round 15 tie and ends when one contender scores alone', () => {
  const players = createInitialPlayers(3);
  players[0].score = 10;
  players[1].score = 10;
  players[2].score = 6;

  // At end of Round 15, P1 and P2 are tied at 10 -> enters Sudden Death
  const res15 = resolveMatchProgression(players, TOTAL_ROUNDS, TOTAL_ROUNDS, false);
  assert.equal(res15.isGameOver, false);
  assert.equal(res15.enterSuddenDeath, true);
  assert.deepEqual(res15.contenderIds, [1, 2]);

  // Mark contenders
  players[0].isContender = true;
  players[1].isContender = true;
  players[2].isContender = false;

  // Sudden Death round 1: neither scores -> continues Sudden Death
  players[0].scoredLastRound = false;
  players[1].scoredLastRound = false;
  const resSD1 = resolveMatchProgression(players, 16, TOTAL_ROUNDS, true);
  assert.equal(resSD1.isGameOver, false);
  assert.equal(resSD1.enterSuddenDeath, true);

  // Sudden Death round 2: P2 scores while P1 does not -> P2 wins immediately!
  players[0].scoredLastRound = false;
  players[1].scoredLastRound = true;
  players[1].score = 11;
  const resSD2 = resolveMatchProgression(players, 17, TOTAL_ROUNDS, true);
  assert.equal(resSD2.isGameOver, true);
  assert.equal(resSD2.winnerId, 2);

  const summary = computeWinnerSummary(players);
  assert.equal(summary.isTie, false);
  assert.equal(summary.winners[0].id, 2);
});

test('pickNextZoneColor always returns a valid ZoneColor', () => {
  for (let i = 0; i < 25; i++) {
    const c = pickNextZoneColor('red');
    assert.ok(['red', 'blue', 'green', 'yellow'].includes(c));
  }
});
