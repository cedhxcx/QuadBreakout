const assert = require('node:assert/strict');

global.window = global;
require('../js/constants.js');
require('../js/physics.js');
require('../js/ai.js');

const { C, Physics, AI } = global.QB;
const stableRandom = () => 0.99;

function createPlayingState(playerCount) {
  const state = Physics.createLobbyState('Host', 'host', playerCount);
  Physics.startMatch(state, 2, 30, stableRandom);
  return state;
}

for (let playerCount = 2; playerCount <= 8; playerCount++) {
  const arena = Physics.getArenaGeometry(playerCount);
  assert.equal(arena.sides.length, playerCount, `arena should expose ${playerCount} player sides`);
  assert.equal(arena.vertices.length, playerCount === 2 ? 4 : playerCount);
  if (playerCount >= 3) {
    const sideLengths = arena.sides.map(side => side.length);
    sideLengths.forEach(length => assert.ok(Math.abs(length - sideLengths[0]) < 0.001, 'polygon sides should be equal'));
  }
}

const twoPlayerArena = Physics.getArenaGeometry(2);
assert.ok(twoPlayerArena.bounds.right - twoPlayerArena.bounds.left > twoPlayerArena.bounds.bottom - twoPlayerArena.bounds.top);
assert.deepEqual(twoPlayerArena.sides.map(side => side.outward.x), [-1, 1]);
const fourPlayerArena = Physics.getArenaGeometry(4);
assert.ok(fourPlayerArena.sides[0].midpoint.y > C.HEIGHT / 2, 'red side should be south');
assert.ok(fourPlayerArena.sides[1].midpoint.y < C.HEIGHT / 2, 'blue side should be north');
assert.ok(fourPlayerArena.sides[2].midpoint.x < C.WIDTH / 2, 'green side should be west');
assert.ok(fourPlayerArena.sides[3].midpoint.x > C.WIDTH / 2, 'yellow side should be east');

for (let playerCount = 2; playerCount <= 8; playerCount++) {
  const state = createPlayingState(playerCount);
  assert.ok(state.bricks.length >= 1 && state.bricks.length <= 2, `the ${playerCount}-player arena has at most two multiball bricks`);
  assert.ok(state.bricks.every(brick => brick.special), 'normal bricks are absent for every arena size');
  assert.equal(new Set(state.bricks.map(brick =>
    `${Math.sign(brick.x + brick.width / 2 - C.WIDTH / 2)},${Math.sign(brick.y + brick.height / 2 - C.HEIGHT / 2)}`
  )).size, state.bricks.length, 'multiball bricks occupy separate quadrants');
  state.bricks.forEach(brick => {
    assert.ok(Math.abs(brick.x + brick.width / 2 - C.WIDTH / 2) <= 100);
    assert.ok(Math.abs(brick.y + brick.height / 2 - C.HEIGHT / 2) <= 100);
  });
  const side = Physics.getSideGeometry(playerCount, 0);
  const paddle = Physics.paddleRect(state.players[0], playerCount);
  state.bricks = [];
  state.bricksRespawnMs = 10000;
  state.balls = [{
    id: 1,
    x: paddle.center.x - side.outward.x * 14,
    y: paddle.center.y - side.outward.y * 14,
    vx: side.outward.x * 4,
    vy: side.outward.y * 4,
    radius: C.BALL_RADIUS,
    ownerColor: C.COLORS.neutral,
    ownerIndex: null,
    isMain: true,
    trail: []
  }];
  Physics.step(state, 1000 / 60, { 0: 0 }, stableRandom);
  const ball = state.balls[0];
  assert.ok(ball.vx * side.outward.x + ball.vy * side.outward.y < 0, `paddle should return the ball inward with ${playerCount} players`);
  assert.equal(ball.ownerColor, C.PLAYERS[0].color, 'paddle collision assigns its color to the ball');
}

const lobby = Physics.createLobbyState('Host', 'host', 4);
assert.equal(Physics.configurePlayerCount(lobby, 2), true);
assert.equal(lobby.players.length, 2);
assert.equal(Physics.configurePlayerCount(lobby, 8), true);
assert.equal(lobby.players.length, 8);
lobby.players[7].connected = true;
assert.equal(Physics.configurePlayerCount(lobby, 4), false, 'occupied seats must not be removed');
assert.equal(lobby.players.length, 8);

const twoPlayerState = createPlayingState(2);
assert.equal(twoPlayerState.players[1].bot, true, 'vacant seats become bots at match start');
assert.equal(twoPlayerState.balls[0].ownerColor, C.COLORS.neutral);
assert.equal(twoPlayerState.bricks.filter(brick => brick.special).length, 2, 'the initial arena should contain only special multiball bricks');
assert.ok(twoPlayerState.bricks.length >= 1 && twoPlayerState.bricks.length <= 2, 'the arena should only contain one or two multiball bricks');
assert.ok(twoPlayerState.bricks.every(brick => brick.special), 'normal bricks are no longer generated');
assert.equal(new Set(twoPlayerState.bricks.map(brick => Math.sign(brick.x + brick.width / 2 - C.WIDTH / 2) + ',' + Math.sign(brick.y + brick.height / 2 - C.HEIGHT / 2))).size, twoPlayerState.bricks.length, 'multiball bricks are placed in separate quadrants');
assert.ok(twoPlayerState.bricks.filter(brick => brick.special).every(brick =>
  brick.hitsRemaining >= C.MULTIBALL_HITS_MIN && brick.hitsRemaining <= C.MULTIBALL_HITS_MAX
), 'special bricks require two or three hits');
assert.ok(twoPlayerState.bricks.every(brick => Math.abs(brick.x + brick.width / 2 - C.WIDTH / 2) <= 100), 'multiball bricks stay close to the center');
assert.equal(C.PADDLE_LENGTH, 100, 'paddles should use the more compact size');
assert.equal(Physics.makeBricks(() => 0, 2).length, 1, 'the arena can generate a single multiball brick');

const customRespawn = Physics.createLobbyState('Host', 'host', 2);
Physics.startMatch(customRespawn, 2, 30, stableRandom, 45);
assert.equal(customRespawn.brickRespawnIntervalMs, 45000, 'the host can configure the brick respawn interval');

const goals = createPlayingState(4);
goals.bricks = [];
goals.bricksRespawnMs = 10000;
goals.balls = [{ id: 1, x: 400, y: 80, vx: 0, vy: -4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.red, ownerIndex: 0, isMain: true, trail: [] }];
Physics.step(goals, 1000 / 60, {}, stableRandom);
assert.equal(goals.players[0].score, 1, 'opponent-colored goals award the ball owner');

const ownGoal = createPlayingState(4);
ownGoal.bricks = [];
ownGoal.bricksRespawnMs = 10000;
ownGoal.players[1].score = 1;
ownGoal.balls = [{ id: 1, x: 400, y: 80, vx: 0, vy: -4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.blue, ownerIndex: 1, isMain: true, trail: [] }];
Physics.step(ownGoal, 1000 / 60, {}, stableRandom);
assert.equal(ownGoal.players[1].score, 0, 'own goals remove one point without going below zero');

const neutralGoal = createPlayingState(4);
neutralGoal.bricks = [];
neutralGoal.bricksRespawnMs = 10000;
neutralGoal.balls = [{ id: 1, x: 400, y: 80, vx: 0, vy: -4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
Physics.step(neutralGoal, 1000 / 60, {}, stableRandom);
assert.ok(neutralGoal.players.every(player => player.score === 0), 'neutral balls do not award points');

const ordinaryBrick = createPlayingState(2);
ordinaryBrick.bricks = [{ id: 1, x: 380, y: 390, width: 40, height: 20, special: false }];
ordinaryBrick.balls = [{ id: 1, x: 400, y: 380, vx: 0, vy: 4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.red, ownerIndex: 0, isMain: true, trail: [] }];
Physics.step(ordinaryBrick, 1000 / 60, {}, stableRandom);
assert.equal(ordinaryBrick.bricks.length, 0);
assert.equal(ordinaryBrick.players[0].score, 1);
assert.equal(ordinaryBrick.balls.length, 1, 'ordinary brick collisions keep one ball in play');

const cappedParticles = createPlayingState(2);
cappedParticles.bricks = [{ id: 1, x: 380, y: 390, width: 40, height: 20, special: false, hitsRemaining: 1 }];
cappedParticles.particles = Array.from({ length: C.MAX_PARTICLES - 1 }, () => ({
  x: 0, y: 0, vx: 0, vy: 0, color: '#fff', life: 1000, maxLife: 1000, size: 1
}));
cappedParticles.balls = [{ id: 1, x: 400, y: 380, vx: 0, vy: 4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.red, ownerIndex: 0, isMain: true, trail: [] }];
Physics.step(cappedParticles, 1000 / 60, {}, stableRandom);
assert.equal(cappedParticles.particles.length, C.MAX_PARTICLES, 'particle effects stay within a fixed rendering budget');

const delayedBricks = createPlayingState(2);
delayedBricks.bricks = [{ id: 1, x: 380, y: 390, width: 40, height: 20, special: false, hitsRemaining: 1 }];
delayedBricks.balls = [{ id: 1, x: 400, y: 380, vx: 0, vy: 4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.red, ownerIndex: 0, isMain: true, trail: [] }];
Physics.step(delayedBricks, 1000 / 60, {}, stableRandom);
assert.equal(delayedBricks.bricks.length, 0);
assert.ok(delayedBricks.bricksRespawnMs > C.BRICK_RESPAWN_MS - 100, 'the countdown should begin near 30 seconds');
Physics.step(delayedBricks, C.BRICK_RESPAWN_MS - 100, {}, stableRandom);
assert.equal(delayedBricks.bricks.length, 0, 'bricks should not return before the configured interval');
Physics.step(delayedBricks, 100, {}, stableRandom);
assert.ok(delayedBricks.bricks.length >= 1 && delayedBricks.bricks.length <= 2, 'only multiball bricks return when the interval expires');
assert.ok(delayedBricks.bricks.every(brick => brick.special), 'normal bricks are absent after a respawn too');

const multiball = createPlayingState(3);
multiball.bricks = [{ id: 1, x: 380, y: 390, width: 40, height: 20, special: true, hitsRemaining: 3 }];
multiball.balls = [{ id: 1, x: 400, y: 380, vx: 0, vy: 4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.green, ownerIndex: 2, isMain: true, trail: [] }];
for (let hit = 1; hit <= 3; hit++) {
  const ball = multiball.balls[0];
  ball.x = 400;
  ball.y = 380;
  ball.vx = 0;
  ball.vy = 4;
  Physics.step(multiball, 1000 / 60, {}, stableRandom);
  if (hit < 3) assert.equal(multiball.bricks[0].hitsRemaining, 3 - hit, 'special bricks should survive their first hits');
}
assert.equal(multiball.bricks.length, 0, 'a multiball brick breaks after its required hits');
assert.equal(multiball.balls.length, C.MAX_ACTIVE_BALLS, 'multiball is capped at five active balls total');
assert.ok(multiball.balls.every(ball => ball.ownerColor === C.COLORS.green && ball.ownerIndex === 2));
assert.equal(multiball.players[2].score, 1);

const cappedMultiball = createPlayingState(2);
cappedMultiball.bricks = [{ id: 1, x: 380, y: 390, width: 40, height: 20, special: true, hitsRemaining: 1 }];
cappedMultiball.balls = Array.from({ length: C.MAX_ACTIVE_BALLS }, (_, index) => ({
  id: index + 1,
  x: index === 0 ? 400 : 100 + index * 20,
  y: index === 0 ? 380 : 100,
  vx: 0,
  vy: index === 0 ? 4 : 0,
  radius: C.BALL_RADIUS,
  ownerColor: C.COLORS.green,
  ownerIndex: 0,
  isMain: index === 0,
  trail: []
}));
Physics.step(cappedMultiball, 1000 / 60, {}, stableRandom);
assert.equal(cappedMultiball.balls.length, C.MAX_ACTIVE_BALLS, 'additional multiball bricks cannot exceed the active ball cap');

const wallBounce = createPlayingState(2);
wallBounce.bricks = [];
wallBounce.bricksRespawnMs = 10000;
wallBounce.balls = [{ id: 1, x: 400, y: 190, vx: 0, vy: -4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
Physics.step(wallBounce, 1000 / 60, {}, stableRandom);
assert.ok(wallBounce.balls[0].vy > 0, 'two-player rectangle bounces balls from its top wall');

const respawn = createPlayingState(2);
respawn.balls = [];
respawn.emptyMs = C.BALL_RESPAWN_MS - 10;
Physics.step(respawn, 20, {}, stableRandom);
assert.equal(respawn.balls.length, 1);
assert.equal(respawn.balls[0].ownerColor, C.COLORS.neutral);

const brickRespawn = createPlayingState(3);
brickRespawn.bricks = [];
brickRespawn.bricksRespawnMs = 10;
brickRespawn.balls = [];
Physics.step(brickRespawn, 20, {}, stableRandom);
assert.ok(brickRespawn.bricks.length >= 1 && brickRespawn.bricks.length <= 2);
assert.ok(brickRespawn.bricks.every(brick => brick.special));

const winner = createPlayingState(8);
winner.scoreLimit = 1;
winner.players[7].score = 1;
Physics.step(winner, 1000 / 60, {}, stableRandom);
assert.equal(winner.phase, 'GAMEOVER');
assert.equal(winner.winnerIndex, 7);

const botDifficultyState = Physics.createLobbyState('Host', 'host', 8);
const difficultyRolls = [0.01, 0.34, 0.67, 0.99, 0.01, 0.34, 0.67];
let difficultyRollIndex = 0;
Physics.startMatch(botDifficultyState, 2, 30, () => difficultyRolls[difficultyRollIndex++] || 0.99);
assert.deepEqual(botDifficultyState.players.slice(1).map(player => player.botDifficulty), [1, 2, 3, 3, 1, 2, 3]);
assert.ok(botDifficultyState.players.slice(1).every(player => player.bot), 'all empty seats become difficulty-rated bots');
assert.equal(botDifficultyState.players[0].botDifficulty, null, 'human players do not receive bot difficulty');

const botState = createPlayingState(2);
botState.players[0].bot = true;
botState.balls = [{ id: 1, x: 180, y: 500, vx: -4, vy: 0, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
assert.equal(AI.getMove(botState, botState.players[0]), -1, 'left-side bot tracks an incoming ball along its defense line');

function makeBotStrikeState() {
  const state = createPlayingState(2);
  state.players[0].bot = true;
  state.balls = [{ id: 1, x: 160, y: 400, vx: -4, vy: 0, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
  return state;
}

function sequenceRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const centerStrike = makeBotStrikeState();
assert.equal(AI.getMove(centerStrike, centerStrike.players[0], sequenceRandom([0.1, 0.5, 0.5])), 0, 'bots can aim for the center of the paddle');

const upperEdgeStrike = makeBotStrikeState();
assert.equal(AI.getMove(upperEdgeStrike, upperEdgeStrike.players[0], sequenceRandom([0.5, 0.9, 0.5, 0.5])), -1, 'bots can target one side of the paddle');
assert.equal(AI.getMove(upperEdgeStrike, upperEdgeStrike.players[0], () => 0.1), -1, 'the selected contact point stays stable while intercepting');
upperEdgeStrike.elapsedMs = 5000;
assert.equal(AI.getMove(upperEdgeStrike, upperEdgeStrike.players[0], sequenceRandom([0.5, 0.1, 0.5, 0.5])), 1, 'bots can choose the opposite side on a later intercept');

const leftPatrol = createPlayingState(2);
leftPatrol.players[0].bot = true;
leftPatrol.balls = [{ id: 1, x: 400, y: 400, vx: 0, vy: 0, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
assert.equal(AI.getMove(leftPatrol, leftPatrol.players[0], () => 0.1), -1, 'bots patrol instead of remaining centered when no ball is approaching');

function makeDifficultyThreat(difficulty, x) {
  const state = createPlayingState(2);
  state.players[0].bot = true;
  state.players[0].botDifficulty = difficulty;
  state.balls = [{ id: 1, x: x || 200, y: 400, vx: -5, vy: 0, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
  return state;
}

const roamingBot = makeDifficultyThreat(1, 400);
assert.equal(AI.getMove(roamingBot, roamingBot.players[0], () => 0.99), 1, 'low-difficulty bots reposition while the ball is still distant');
roamingBot.elapsedMs = 1000;
assert.equal(AI.getMove(roamingBot, roamingBot.players[0], () => 0.01), -1, 'roaming bots choose a new movement direction over time');
const assertiveLowLevelBot = makeDifficultyThreat(1, 293);
assert.equal(AI.getMove(assertiveLowLevelBot, assertiveLowLevelBot.players[0], sequenceRandom([0.1, 0.5, 0.5, 0.5])), 0, 'low-difficulty bots still make accurate intercepts with time to react');
const reactingBot = makeDifficultyThreat(3);
assert.equal(AI.getMove(reactingBot, reactingBot.players[0], sequenceRandom([0.5, 0.9, 0.5, 0.5])), -1, 'high-difficulty bots react earlier to an incoming ball');

const movingInterceptBot = makeDifficultyThreat(3);
assert.equal(AI.getMove(movingInterceptBot, movingInterceptBot.players[0], sequenceRandom([0.1, 0.5, 0.5, 0.5])), 0, 'intercept movement starts from the planned contact point');
movingInterceptBot.elapsedMs = 400;
assert.equal(AI.getMove(movingInterceptBot, movingInterceptBot.players[0], () => 0.99), 1, 'bots make a lateral adjustment while tracking an incoming ball');
movingInterceptBot.players[0].position = 0.54;
movingInterceptBot.elapsedMs = 450;
assert.equal(AI.getMove(movingInterceptBot, movingInterceptBot.players[0], () => 0.01), -1, 'bots keep moving around the intercept point instead of stopping there');

const wallBounceBot = makeDifficultyThreat(3);
wallBounceBot.bricks = [];
wallBounceBot.balls = [{ id: 1, x: 317.5, y: 600, vx: -5, vy: 8, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
assert.equal(AI.getMove(wallBounceBot, wallBounceBot.players[0], sequenceRandom([0.1, 0.5, 0.5, 0.5])), 1, 'two-player bots account for wall bounces when aiming');

function makeEmptyPowerupState() {
  const state = createPlayingState(2);
  state.balls = [];
  state.bricks = [];
  state.bricksRespawnMs = 30000;
  return state;
}

const powerupState = makeEmptyPowerupState();
assert.equal(powerupState.powerupSpawnMs, C.POWERUP_INITIAL_DELAY_MS);
Physics.step(powerupState, C.POWERUP_INITIAL_DELAY_MS - 1, {}, stableRandom);
assert.equal(powerupState.powerup, null, 'the first power-up waits for its three-second timer');
assert.equal(powerupState.powerupSpawnMs, 1);
Physics.step(powerupState, 1, {}, stableRandom);
assert.equal(powerupState.powerup.type, 'fire', 'the power-up type is selected randomly');
assert.equal(powerupState.powerup.radius, C.BALL_RADIUS * 1.5);
assert.equal(powerupState.powerupSpawnMs, null, 'an uncollected power-up does not have a respawn countdown');
const iceSpawn = makeEmptyPowerupState();
iceSpawn.powerupSpawnMs = 0;
Physics.step(iceSpawn, 0, {}, () => 0.1);
assert.equal(iceSpawn.powerup.type, 'ice', 'ice power-ups can also be selected');
const uncollectedPowerup = { ...powerupState.powerup };
Physics.step(powerupState, 10000, {}, stableRandom);
assert.deepEqual(powerupState.powerup, uncollectedPowerup, 'an uncollected power-up remains available');

const powerupBall = {
  id: 1,
  x: powerupState.powerup.x,
  y: powerupState.powerup.y,
  vx: 0,
  vy: 0,
  radius: C.BALL_RADIUS,
  ownerColor: C.COLORS.neutral,
  ownerIndex: null,
  isMain: true,
  trail: []
};
powerupState.balls = [powerupBall];
Physics.step(powerupState, 0, {}, stableRandom);
assert.equal(powerupState.powerup, null, 'a ball collects a power-up by passing through it');
assert.equal(powerupBall.powerType, 'fire', 'the ball keeps the power-up type until it hits a paddle');
assert.equal(powerupState.powerupSpawnMs, C.POWERUP_RESPAWN_MS, 'the respawn countdown starts only after collection');
powerupState.balls = [];
Physics.step(powerupState, C.POWERUP_RESPAWN_MS - 1, {}, stableRandom);
assert.equal(powerupState.powerup, null, 'the next power-up waits for the full respawn interval');
Physics.step(powerupState, 1, {}, stableRandom);
assert.ok(powerupState.powerup, 'another power-up appears after the respawn interval');

const centerPowerup = { type: 'ice', x: C.WIDTH / 2, y: C.HEIGHT / 2, radius: C.BALL_RADIUS * 1.5 };
const bricksAroundPowerup = Physics.makeBricks(stableRandom, 4, centerPowerup);
assert.ok(bricksAroundPowerup.length <= 2, 'multiball bricks leave the active power-up area clear');
bricksAroundPowerup.forEach(brick => {
  const closestX = Math.max(brick.x, Math.min(centerPowerup.x, brick.x + brick.width));
  const closestY = Math.max(brick.y, Math.min(centerPowerup.y, brick.y + brick.height));
  assert.ok((closestX - centerPowerup.x) ** 2 + (closestY - centerPowerup.y) ** 2 > centerPowerup.radius ** 2);
});
const powerupDuringBrickRespawn = makeEmptyPowerupState();
powerupDuringBrickRespawn.powerup = centerPowerup;
powerupDuringBrickRespawn.bricksRespawnMs = 1;
Physics.step(powerupDuringBrickRespawn, 1, {}, stableRandom);
assert.ok(powerupDuringBrickRespawn.bricks.length > 0, 'bricks still respawn while an uncollected power-up is active');
powerupDuringBrickRespawn.bricks.forEach(brick => {
  const closestX = Math.max(brick.x, Math.min(centerPowerup.x, brick.x + brick.width));
  const closestY = Math.max(brick.y, Math.min(centerPowerup.y, brick.y + brick.height));
  assert.ok((closestX - centerPowerup.x) ** 2 + (closestY - centerPowerup.y) ** 2 > centerPowerup.radius ** 2);
});
const powerupWithBricks = createPlayingState(4);
powerupWithBricks.powerupSpawnMs = 0;
Physics.step(powerupWithBricks, 0, {}, stableRandom);
assert.ok(powerupWithBricks.powerup, 'power-ups can spawn while multiball bricks remain');
assert.ok(powerupWithBricks.bricks.length > 0, 'spawning a power-up does not remove multiball bricks');
powerupWithBricks.bricks.forEach(brick => {
  const closestX = Math.max(brick.x, Math.min(powerupWithBricks.powerup.x, brick.x + brick.width));
  const closestY = Math.max(brick.y, Math.min(powerupWithBricks.powerup.y, brick.y + brick.height));
  assert.ok((closestX - powerupWithBricks.powerup.x) ** 2 + (closestY - powerupWithBricks.powerup.y) ** 2 > powerupWithBricks.powerup.radius ** 2);
});

function makePowerupPaddleHit(type) {
  const state = createPlayingState(2);
  state.bricks = [];
  state.bricksRespawnMs = 30000;
  const player = state.players[0];
  const paddle = Physics.paddleRect(player, state.playerCount);
  state.balls = [{
    id: 1,
    x: paddle.center.x - paddle.outward.x * 14,
    y: paddle.center.y,
    vx: paddle.outward.x * 4,
    vy: paddle.outward.y * 4,
    radius: C.BALL_RADIUS,
    ownerColor: C.COLORS.neutral,
    ownerIndex: null,
    isMain: true,
    powerType: type,
    trail: []
  }];
  return state;
}

const icedPlayer = makePowerupPaddleHit('ice');
Physics.step(icedPlayer, 1000 / 60, {}, stableRandom);
assert.equal(icedPlayer.players[0].powerEffect, 'ice', 'a paddle hit applies the collected ice effect');
assert.equal(icedPlayer.players[0].powerEffectMs, C.POWERUP_DURATION_MS);
assert.equal(icedPlayer.balls[0].powerType, null, 'a charged ball consumes its effect on the first paddle hit');

const firedPlayer = makePowerupPaddleHit('fire');
Physics.step(firedPlayer, 1000 / 60, {}, stableRandom);
assert.equal(firedPlayer.players[0].powerEffect, 'fire', 'a paddle hit applies the collected fire effect');

function playerMovement(effect) {
  const state = createPlayingState(2);
  state.balls = [];
  state.bricks = [];
  state.bricksRespawnMs = 30000;
  state.players[0].powerEffect = effect;
  state.players[0].powerEffectMs = effect ? C.POWERUP_DURATION_MS : 0;
  Physics.step(state, 1000 / 60, { 0: 1 }, stableRandom);
  return state.players[0].position - 0.5;
}

const normalMovement = playerMovement(null);
assert.ok(Math.abs(playerMovement('ice') / normalMovement - 0.75) < 0.0001, 'ice slows paddle movement to 75%');
assert.ok(Math.abs(playerMovement('fire') / normalMovement - 1.25) < 0.0001, 'fire speeds paddle movement to 125%');

const expiredEffect = createPlayingState(2);
expiredEffect.players[0].powerEffect = 'ice';
expiredEffect.players[0].powerEffectMs = C.POWERUP_DURATION_MS;
expiredEffect.balls = [];
expiredEffect.bricks = [];
expiredEffect.bricksRespawnMs = 30000;
Physics.step(expiredEffect, C.POWERUP_DURATION_MS, {}, stableRandom);
assert.equal(expiredEffect.players[0].powerEffect, null, 'player effects expire after eight seconds');

console.log('PASS: 2-8 player arenas, configurable respawn, multiball limits, power-ups, particles, goals, bots, and match end.');
