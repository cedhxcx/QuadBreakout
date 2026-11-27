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

const multiball = createPlayingState(3);
multiball.bricks = [{ id: 1, x: 380, y: 390, width: 40, height: 20, special: true }];
multiball.balls = [{ id: 1, x: 400, y: 380, vx: 0, vy: 4, radius: C.BALL_RADIUS, ownerColor: C.COLORS.green, ownerIndex: 2, isMain: true, trail: [] }];
Physics.step(multiball, 1000 / 60, {}, stableRandom);
assert.equal(multiball.balls.length, 1 + C.MULTIBALL_COUNT, 'special bricks spawn exactly 20 extra balls');
assert.ok(multiball.balls.every(ball => ball.ownerColor === C.COLORS.green && ball.ownerIndex === 2));
assert.equal(multiball.players[2].score, 1);

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

console.log('PASS: 2-8 player arenas, lobby resizing, goals, bricks, multiball, respawns, bots, and match end.');
