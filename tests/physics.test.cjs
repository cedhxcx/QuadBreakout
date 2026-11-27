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
assert.equal(twoPlayerState.bricks.filter(brick => brick.special).length, 2, 'the initial grid should contain only one or two special bricks');
assert.ok(twoPlayerState.bricks.filter(brick => brick.special).every(brick =>
  brick.hitsRemaining >= C.MULTIBALL_HITS_MIN && brick.hitsRemaining <= C.MULTIBALL_HITS_MAX
), 'special bricks require two or three hits');
assert.equal(twoPlayerState.bricks.length, C.BRICK_COLUMNS * C.BRICK_ROWS);
assert.equal(C.PADDLE_LENGTH, 100, 'paddles should use the more compact size');
assert.equal(Physics.makeBricks(() => 0, 2).filter(brick => brick.special).length, 1, 'a generated grid can have one special brick');

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
assert.equal(delayedBricks.bricks.length, C.BRICK_COLUMNS * C.BRICK_ROWS, 'the next brick grid returns when the interval expires');

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
assert.equal(brickRespawn.bricks.length, C.BRICK_COLUMNS * C.BRICK_ROWS);

const winner = createPlayingState(8);
winner.scoreLimit = 1;
winner.players[7].score = 1;
Physics.step(winner, 1000 / 60, {}, stableRandom);
assert.equal(winner.phase, 'GAMEOVER');
assert.equal(winner.winnerIndex, 7);

const botState = createPlayingState(2);
botState.players[0].bot = true;
botState.balls = [{ id: 1, x: 180, y: 500, vx: -4, vy: 0, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
assert.equal(AI.getMove(botState, botState.players[0]), -1, 'left-side bot tracks an incoming ball along its defense line');

function makeBotStrikeState() {
  const state = createPlayingState(2);
  state.players[0].bot = true;
  state.balls = [{ id: 1, x: 100, y: 400, vx: -4, vy: 0, radius: C.BALL_RADIUS, ownerColor: C.COLORS.neutral, ownerIndex: null, isMain: true, trail: [] }];
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

console.log('PASS: 2-8 player arenas, configurable respawn, multiball limits, particles, goals, bots, and match end.');
