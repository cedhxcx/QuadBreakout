(function () {
  const C = window.QB.C;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomRange = (min, max, random) => min + (max - min) * random();
  const arenaCache = new Map();

  function playerDescriptor(playerCount, index) {
    const palette = C.PLAYERS[index];
    if (playerCount === 2) {
      return { side: index === 0 ? 'west' : 'east', sideName: index === 0 ? 'Esquerda' : 'Direita', label: palette.label, color: palette.color };
    }
    if (playerCount === 4) {
      const descriptors = [
        { side: 'south', sideName: 'Sul' },
        { side: 'north', sideName: 'Norte' },
        { side: 'west', sideName: 'Oeste' },
        { side: 'east', sideName: 'Leste' }
      ];
      return { ...descriptors[index], label: palette.label, color: palette.color };
    }
    return { side: `side-${index}`, sideName: `Lado ${index + 1}`, label: palette.label, color: palette.color };
  }

  function makePlayer(index, name, id, connected, playerCount) {
    const descriptor = playerDescriptor(playerCount, index);
    return {
      index,
      id: id || null,
      name: name || `Vaga ${descriptor.label}`,
      ...descriptor,
      connected: Boolean(connected),
      bot: false,
      botDifficulty: null,
      score: 0,
      position: 0.5,
      move: 0,
      powerEffect: null,
      powerEffectMs: 0
    };
  }

  function assignBotDifficulty(player, random) {
    player.botDifficulty = 1 + Math.floor((random || Math.random)() * 3);
    return player.botDifficulty;
  }

  function createLobbyState(hostName, hostId, playerCount) {
    const count = clamp(Number(playerCount) || 4, 2, 8);
    const players = Array.from({ length: count }, (_, index) => makePlayer(index, `Vaga ${C.PLAYERS[index].label}`, null, false, count));
    players[0] = makePlayer(0, hostName || 'Jogador', hostId || 'host', true, count);
    return {
      phase: 'LOBBY',
      playerCount: count,
      players,
      balls: [],
      powerup: null,
      powerupSpawnMs: null,
      bricks: [],
      particles: [],
      elapsedMs: 0,
      timeLeftMs: 0,
      timeLimitMs: 120000,
      scoreLimit: 30,
      brickRespawnIntervalMs: C.BRICK_RESPAWN_MS,
      emptyMs: 0,
      bricksRespawnMs: 0,
      nextBallId: 1,
      winnerIndex: null,
      isDraw: false
    };
  }

  function configurePlayerCount(state, requestedCount) {
    const count = clamp(Math.floor(Number(requestedCount) || 4), 2, 8);
    if (state.phase !== 'LOBBY' || state.players.slice(count).some(player => player.connected)) return false;
    const oldPlayers = state.players;
    state.playerCount = count;
    state.players = Array.from({ length: count }, (_, index) => {
      const old = oldPlayers[index];
      const base = old || makePlayer(index, `Vaga ${C.PLAYERS[index].label}`, null, false, count);
      const descriptor = playerDescriptor(count, index);
      return {
        ...base,
        ...descriptor,
        color: base.color || descriptor.color,
        label: base.label || descriptor.label,
        index,
        position: 0.5,
        move: 0
      };
    });
    return true;
  }

  function getArenaGeometry(playerCount) {
    const count = clamp(Math.floor(Number(playerCount) || 4), 2, 8);
    if (arenaCache.has(count)) return arenaCache.get(count);
    if (count === 2) {
      const bounds = C.TWO_PLAYER_BOUNDS;
      const height = bounds.bottom - bounds.top;
      const left = {
        playerIndex: 0,
        start: { x: bounds.left, y: bounds.bottom },
        end: { x: bounds.left, y: bounds.top },
        midpoint: { x: bounds.left, y: (bounds.top + bounds.bottom) / 2 },
        tangent: { x: 0, y: -1 },
        outward: { x: -1, y: 0 },
        length: height
      };
      const right = {
        playerIndex: 1,
        start: { x: bounds.right, y: bounds.top },
        end: { x: bounds.right, y: bounds.bottom },
        midpoint: { x: bounds.right, y: (bounds.top + bounds.bottom) / 2 },
        tangent: { x: 0, y: 1 },
        outward: { x: 1, y: 0 },
        length: height
      };
      const arena = {
        count,
        vertices: [
          { x: bounds.left, y: bounds.top },
          { x: bounds.right, y: bounds.top },
          { x: bounds.right, y: bounds.bottom },
          { x: bounds.left, y: bounds.bottom }
        ],
        sides: [left, right],
        walls: [
          { start: { x: bounds.left, y: bounds.top }, end: { x: bounds.right, y: bounds.top } },
          { start: { x: bounds.right, y: bounds.bottom }, end: { x: bounds.left, y: bounds.bottom } }
        ],
        bounds
      };
      arenaCache.set(count, arena);
      return arena;
    }

    const angleOffset = Math.PI / 2 - Math.PI / count;
    const vertices = Array.from({ length: count }, (_, index) => {
      const angle = angleOffset + index * Math.PI * 2 / count;
      return { x: C.WIDTH / 2 + Math.cos(angle) * C.ARENA_RADIUS, y: C.HEIGHT / 2 + Math.sin(angle) * C.ARENA_RADIUS };
    });
    const edges = vertices.map((start, index) => {
      const end = vertices[(index + 1) % count];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      return {
        start,
        end,
        midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
        tangent: { x: dx / length, y: dy / length },
        outward: { x: dy / length, y: -dx / length },
        length
      };
    });
    const edgeOrder = count === 4 ? [0, 2, 1, 3] : Array.from({ length: count }, (_, index) => index);
    const sides = edgeOrder.map((edgeIndex, playerIndex) => ({ ...edges[edgeIndex], playerIndex }));
    const arena = { count, vertices, sides, walls: [], bounds: null };
    arenaCache.set(count, arena);
    return arena;
  }

  function getSideGeometry(playerCount, playerIndex) {
    return getArenaGeometry(playerCount).sides[playerIndex];
  }

  function makeBricks(random, playerCount, avoidCircle) {
    const rand = random || Math.random;
    const count = clamp(Number(playerCount) || 4, 2, 8);
    const apothem = count === 2 ? 300 : C.ARENA_RADIUS * Math.cos(Math.PI / count);
    const scale = Math.min(1, apothem / 220);
    const brickWidth = C.BRICK_WIDTH * scale;
    const brickHeight = C.BRICK_HEIGHT * scale;
    const brickCount =
      C.MULTIBALL_BRICKS_MIN + Math.floor(rand() * (C.MULTIBALL_BRICKS_MAX - C.MULTIBALL_BRICKS_MIN + 1));
    const quadrants = [0, 1, 2, 3];
    for (let index = quadrants.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(rand() * (index + 1));
      [quadrants[index], quadrants[swapIndex]] = [quadrants[swapIndex], quadrants[index]];
    }

    const offsets = [38, 58, 78, 98].flatMap(x => [38, 58, 78, 98].map(y => ({ x, y })));
    for (let index = offsets.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(rand() * (index + 1));
      [offsets[index], offsets[swapIndex]] = [offsets[swapIndex], offsets[index]];
    }

    const bricks = [];
    const usedQuadrants = new Set();
    for (let index = 0; index < brickCount; index++) {
      let brick = null;
      for (const quadrant of quadrants) {
        if (usedQuadrants.has(quadrant)) continue;
        const signX = quadrant % 2 === 0 ? -1 : 1;
        const signY = quadrant < 2 ? -1 : 1;
        const candidate = offsets.find(offset => {
          const rect = {
            x: C.WIDTH / 2 + signX * offset.x - brickWidth / 2,
            y: C.HEIGHT / 2 + signY * offset.y - brickHeight / 2,
            width: brickWidth,
            height: brickHeight
          };
          return (!avoidCircle || !circleRect(avoidCircle, rect).hit) &&
            !bricks.some(existing =>
              rect.x < existing.x + existing.width + C.BRICK_GAP &&
              rect.x + rect.width + C.BRICK_GAP > existing.x &&
              rect.y < existing.y + existing.height + C.BRICK_GAP &&
              rect.y + rect.height + C.BRICK_GAP > existing.y
            );
        });
        if (!candidate) continue;
        brick = {
          id: index,
          x: C.WIDTH / 2 + signX * candidate.x - brickWidth / 2,
          y: C.HEIGHT / 2 + signY * candidate.y - brickHeight / 2,
          width: brickWidth,
          height: brickHeight,
          special: true,
          hitsRemaining: C.MULTIBALL_HITS_MIN + Math.floor(rand() * (C.MULTIBALL_HITS_MAX - C.MULTIBALL_HITS_MIN + 1))
        };
        usedQuadrants.add(quadrant);
        break;
      }
      if (!brick) throw new Error('Não foi possível posicionar os blocos multiball sem sobreposição.');
      bricks.push(brick);
    }
    return bricks;
  }

  function makeBall(x, y, color, ownerIndex, isMain, angle, speed, id) {
    return {
      id,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: C.BALL_RADIUS,
      ownerColor: color,
      ownerIndex,
      isMain,
      powerType: null,
      trail: []
    };
  }

  function startMatch(state, durationMinutes, scoreLimit, random, multiballIntervalSeconds) {
    const rand = random || Math.random;
    if (window.QB.AI && typeof window.QB.AI.reset === 'function') window.QB.AI.reset();
    state.players.forEach(player => {
      if (!player.connected) {
        player.bot = true;
        player.name = `Bot ${player.sideName}`;
        assignBotDifficulty(player, rand);
      } else {
        player.bot = false;
        player.botDifficulty = null;
      }
      player.position = 0.5;
      player.score = 0;
      player.move = 0;
      player.powerEffect = null;
      player.powerEffectMs = 0;
    });
    state.phase = 'PLAYING';
    state.elapsedMs = 0;
    state.timeLimitMs = clamp(Number(durationMinutes) || 2, 1, 10) * 60000;
    state.timeLeftMs = state.timeLimitMs;
    state.scoreLimit = clamp(Number(scoreLimit) || 30, 1, 100);
    state.brickRespawnIntervalMs = clamp(
      Number(multiballIntervalSeconds) || C.BRICK_RESPAWN_MS / 1000,
      C.BRICK_RESPAWN_MS / 1000,
      C.MAX_BRICK_RESPAWN_MS / 1000
    ) * 1000;
    state.emptyMs = 0;
    state.bricksRespawnMs = 0;
    state.powerup = null;
    state.powerupSpawnMs = C.POWERUP_INITIAL_DELAY_MS;
    state.nextBallId = 1;
    state.winnerIndex = null;
    state.isDraw = false;
    state.particles = [];
    state.bricks = makeBricks(rand, state.playerCount);
    state.balls = [makeBall(
      C.WIDTH / 2,
      C.HEIGHT / 2,
      C.COLORS.neutral,
      null,
      true,
      randomRange(-Math.PI * 0.78, -Math.PI * 0.22, rand),
      C.BALL_START_SPEED,
      state.nextBallId++
    )];
    return state;
  }

  function paddleRect(player, playerCount) {
    const side = getSideGeometry(playerCount || 4, player.index);
    const length = Math.min(C.PADDLE_LENGTH, side.length * 0.42);
    const offset = (player.position - 0.5) * (side.length - length);
    const center = {
      x: side.midpoint.x + side.tangent.x * offset,
      y: side.midpoint.y + side.tangent.y * offset
    };
    return {
      center,
      tangent: side.tangent,
      outward: side.outward,
      length,
      thickness: C.PADDLE_THICKNESS,
      side
    };
  }

  function circleRect(ball, rect) {
    const nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
    const nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > ball.radius * ball.radius) return { hit: false };

    if (distanceSquared < 0.0001) {
      const distances = [
        { distance: Math.abs(ball.x - rect.x), nx: -1, ny: 0 },
        { distance: Math.abs(rect.x + rect.width - ball.x), nx: 1, ny: 0 },
        { distance: Math.abs(ball.y - rect.y), nx: 0, ny: -1 },
        { distance: Math.abs(rect.y + rect.height - ball.y), nx: 0, ny: 1 }
      ];
      distances.sort((a, b) => a.distance - b.distance);
      return { hit: true, nx: distances[0].nx, ny: distances[0].ny, overlap: ball.radius + distances[0].distance };
    }

    const distance = Math.sqrt(distanceSquared);
    return { hit: true, nx: dx / distance, ny: dy / distance, overlap: ball.radius - distance };
  }

  function circlePaddle(ball, paddle) {
    const relativeX = ball.x - paddle.center.x;
    const relativeY = ball.y - paddle.center.y;
    const localX = relativeX * paddle.tangent.x + relativeY * paddle.tangent.y;
    const localY = relativeX * paddle.outward.x + relativeY * paddle.outward.y;
    const halfLength = paddle.length / 2;
    const halfThickness = paddle.thickness / 2;
    const nearX = clamp(localX, -halfLength, halfLength);
    const nearY = clamp(localY, -halfThickness, halfThickness);
    const dx = localX - nearX;
    const dy = localY - nearY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > ball.radius * ball.radius) return { hit: false };

    let nx;
    let ny;
    let overlap;
    if (distanceSquared < 0.0001) {
      const distances = [
        { distance: Math.abs(localX + halfLength), nx: -1, ny: 0 },
        { distance: Math.abs(halfLength - localX), nx: 1, ny: 0 },
        { distance: Math.abs(localY + halfThickness), nx: 0, ny: -1 },
        { distance: Math.abs(halfThickness - localY), nx: 0, ny: 1 }
      ].sort((a, b) => a.distance - b.distance);
      nx = distances[0].nx;
      ny = distances[0].ny;
      overlap = ball.radius + distances[0].distance;
    } else {
      const distance = Math.sqrt(distanceSquared);
      nx = dx / distance;
      ny = dy / distance;
      overlap = ball.radius - distance;
    }
    return {
      hit: true,
      nx: paddle.tangent.x * nx + paddle.outward.x * ny,
      ny: paddle.tangent.y * nx + paddle.outward.y * ny,
      overlap,
      localX,
      halfLength
    };
  }

  function reflect(ball, nx, ny) {
    const towardSurface = ball.vx * nx + ball.vy * ny;
    if (towardSurface < 0) {
      ball.vx -= 2 * towardSurface * nx;
      ball.vy -= 2 * towardSurface * ny;
    }
  }

  function boostBall(ball, factor) {
    const speed = Math.min(C.BALL_MAX_SPEED, Math.hypot(ball.vx, ball.vy) * factor);
    const currentSpeed = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = ball.vx / currentSpeed * speed;
    ball.vy = ball.vy / currentSpeed * speed;
    const minComponent = 1.05;
    if (Math.abs(ball.vx) < minComponent) {
      ball.vx = Math.sign(ball.vx || (Math.random() < 0.5 ? -1 : 1)) * minComponent;
      ball.vy = Math.sign(ball.vy || 1) * Math.sqrt(Math.max(0, speed * speed - ball.vx * ball.vx));
    }
    if (Math.abs(ball.vy) < minComponent) {
      ball.vy = Math.sign(ball.vy || (Math.random() < 0.5 ? -1 : 1)) * minComponent;
      ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy));
    }
  }

  function addParticles(state, x, y, color, count, random) {
    const particleCount = Math.min(count, Math.max(0, C.MAX_PARTICLES - state.particles.length));
    for (let i = 0; i < particleCount; i++) {
      const angle = random() * Math.PI * 2;
      const speed = randomRange(1, 4.2, random);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: randomRange(220, 520, random),
        maxLife: 520,
        size: randomRange(1.5, 3.4, random)
      });
    }
  }

  function makePowerup(random, bricks) {
    const spread = C.POWERUP_CENTER_SPREAD;
    const powerup = {
      type: random() < 0.5 ? 'ice' : 'fire',
      radius: C.BALL_RADIUS * C.POWERUP_SIZE_MULTIPLIER
    };
    for (let attempt = 0; attempt < 64; attempt++) {
      powerup.x = C.WIDTH / 2 + randomRange(-spread, spread, random);
      powerup.y = C.HEIGHT / 2 + randomRange(-spread, spread, random);
      if (!bricks.some(brick => circleRect(powerup, brick).hit)) return powerup;
    }
    return null;
  }

  function spawnPowerupIfReady(state, random) {
    if (state.powerup || state.powerupSpawnMs !== 0) return;
    const powerup = makePowerup(random, state.bricks);
    if (!powerup) return;
    state.powerup = powerup;
    state.powerupSpawnMs = null;
  }

  function updatePowerups(state, elapsedMs, random) {
    state.players.forEach(player => {
      if (player.powerEffectMs <= 0) return;
      player.powerEffectMs = Math.max(0, player.powerEffectMs - elapsedMs);
      if (player.powerEffectMs === 0) player.powerEffect = null;
    });

    if (state.powerupSpawnMs !== null) {
      state.powerupSpawnMs = Math.max(0, state.powerupSpawnMs - elapsedMs);
      spawnPowerupIfReady(state, random);
    }
  }

  function collectPowerup(state, ball, random) {
    const powerup = state.powerup;
    if (!powerup) return;
    const dx = ball.x - powerup.x;
    const dy = ball.y - powerup.y;
    const radius = ball.radius + powerup.radius;
    if (dx * dx + dy * dy > radius * radius) return;

    ball.powerType = powerup.type;
    addParticles(
      state,
      powerup.x,
      powerup.y,
      powerup.type === 'ice' ? C.POWERUP_ICE_COLOR : C.POWERUP_FIRE_COLOR,
      C.PARTICLE_COUNT,
      random
    );
    state.powerup = null;
    state.powerupSpawnMs = C.POWERUP_RESPAWN_MS;
  }

  function scoreGoal(state, ball, defenderIndex, random) {
    const defender = state.players[defenderIndex];
    if (ball.ownerIndex !== null && ball.ownerIndex !== undefined) {
      if (ball.ownerIndex === defenderIndex) defender.score = Math.max(0, defender.score - 1);
      else state.players[ball.ownerIndex].score += 1;
    }
    addParticles(state, ball.x, ball.y, ball.ownerColor, C.PARTICLE_COUNT, random);
  }

  function exitSide(ball, state) {
    const arena = getArenaGeometry(state.playerCount);
    for (const side of arena.sides) {
      const signedDistance = (ball.x - side.midpoint.x) * side.outward.x + (ball.y - side.midpoint.y) * side.outward.y;
      const velocityOutward = ball.vx * side.outward.x + ball.vy * side.outward.y;
      if (signedDistance > ball.radius && velocityOutward > 0) return side.playerIndex;
    }
    return -1;
  }

  function bounceFromPaddle(ball, player, playerCount) {
    const paddle = paddleRect(player, playerCount);
    const collision = circlePaddle(ball, paddle);
    if (!collision.hit) return false;
    const contact = clamp(collision.localX / collision.halfLength, -1, 1);
    const angle = contact * C.PADDLE_MAX_ANGLE;
    const speed = Math.min(C.BALL_MAX_SPEED, Math.hypot(ball.vx, ball.vy) * 1.045 + 0.05);
    const inwardX = -paddle.outward.x;
    const inwardY = -paddle.outward.y;
    ball.vx = (inwardX * Math.cos(angle) + paddle.tangent.x * Math.sin(angle)) * speed;
    ball.vy = (inwardY * Math.cos(angle) + paddle.tangent.y * Math.sin(angle)) * speed;
    ball.ownerColor = player.color;
    ball.ownerIndex = player.index;
    if (ball.powerType) {
      player.powerEffect = ball.powerType;
      player.powerEffectMs = C.POWERUP_DURATION_MS;
      ball.powerType = null;
    }
    ball.x += collision.nx * Math.max(0, collision.overlap);
    ball.y += collision.ny * Math.max(0, collision.overlap);
    return true;
  }

  function breakBrick(state, ball, brick, random, spawnedBalls) {
    state.bricks.splice(state.bricks.indexOf(brick), 1);
    if (ball.ownerIndex !== null && ball.ownerIndex !== undefined) state.players[ball.ownerIndex].score += 1;
    addParticles(state, brick.x + brick.width / 2, brick.y + brick.height / 2, brick.special ? '#c786ff' : ball.ownerColor, C.PARTICLE_COUNT, random);
    if (brick.special) {
      const baseAngle = random() * Math.PI * 2;
      const availableSlots = Math.max(0, C.MAX_ACTIVE_BALLS - state.balls.length - spawnedBalls.length);
      const spawnCount = Math.min(C.MULTIBALL_COUNT - 1, availableSlots);
      for (let i = 0; i < spawnCount; i++) {
        const angle = baseAngle + random() * Math.PI * 2;
        const speed = randomRange(3.2, 5.1, random);
        spawnedBalls.push(makeBall(
          brick.x + brick.width / 2,
          brick.y + brick.height / 2,
          ball.ownerColor,
          ball.ownerIndex,
          false,
          angle,
          speed,
          state.nextBallId++
        ));
      }
    }
    if (state.bricks.length === 0) state.bricksRespawnMs = state.brickRespawnIntervalMs;
  }

  function updatePaddles(state, inputs, dt, random) {
    state.players.forEach(player => {
      let move = 0;
      if (player.bot && window.QB.AI) move = window.QB.AI.getMove(state, player);
      else if (inputs && Object.prototype.hasOwnProperty.call(inputs, player.index)) move = inputs[player.index];
      else move = player.move;
      player.move = clamp(Number(move) || 0, -1, 1);
      const arena = getArenaGeometry(state.playerCount);
      const side = arena.sides[player.index];
      const length = Math.min(C.PADDLE_LENGTH, side.length * 0.42);
      const maxOffset = Math.max(0, (side.length - length) / 2);
      const speedMultiplier = player.powerEffect === 'ice'
        ? C.POWERUP_ICE_SPEED
        : player.powerEffect === 'fire' ? C.POWERUP_FIRE_SPEED : 1;
      const offset = (player.position - 0.5) * 2 * maxOffset + player.move * C.PADDLE_SPEED * speedMultiplier * dt;
      player.position = maxOffset === 0 ? 0.5 : clamp((offset / maxOffset + 1) / 2, 0, 1);
    });
  }

  function bounceTwoPlayerWalls(ball) {
    const bounds = C.TWO_PLAYER_BOUNDS;
    const minY = bounds.top + ball.radius;
    const maxY = bounds.bottom - ball.radius;
    let hit = false;
    if (ball.y < minY && ball.vy < 0) {
      ball.y = minY;
      ball.vy = -ball.vy;
      hit = true;
    } else if (ball.y > maxY && ball.vy > 0) {
      ball.y = maxY;
      ball.vy = -ball.vy;
      hit = true;
    }
    if (hit) boostBall(ball, 1.008);
  }

  function step(state, elapsedMs, inputs, random) {
    if (state.phase !== 'PLAYING') return state;
    const rand = random || Math.random;
    const dt = clamp(elapsedMs / (1000 / 60), 0, 2);
    state.elapsedMs += elapsedMs;
    state.timeLeftMs = Math.max(0, state.timeLeftMs - elapsedMs);
    updatePowerups(state, elapsedMs, rand);
    updatePaddles(state, inputs, dt, rand);

    const remainingBalls = [];
    const spawnedBalls = [];
    state.balls.forEach(ball => {
      ball.trail.unshift({ x: ball.x, y: ball.y });
      if (ball.trail.length > C.BALL_TRAIL_LENGTH) ball.trail.length = C.BALL_TRAIL_LENGTH;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      collectPowerup(state, ball, rand);

      let hitBrick = false;
      for (const brick of state.bricks) {
        const collision = circleRect(ball, brick);
        if (!collision.hit) continue;
        ball.x += collision.nx * Math.max(collision.overlap, 0.1);
        ball.y += collision.ny * Math.max(collision.overlap, 0.1);
        reflect(ball, collision.nx, collision.ny);
        boostBall(ball, 1.012);
        if (brick.special && brick.hitsRemaining > 1) {
          brick.hitsRemaining -= 1;
          addParticles(state, ball.x, ball.y, '#c786ff', 4, rand);
        } else {
          breakBrick(state, ball, brick, rand, spawnedBalls);
        }
        hitBrick = true;
        break;
      }

      if (!hitBrick) {
        for (const player of state.players) {
          if (bounceFromPaddle(ball, player, state.playerCount)) {
            boostBall(ball, 1.025);
            break;
          }
        }
      }

      if (state.playerCount === 2) bounceTwoPlayerWalls(ball);
      const goalSide = exitSide(ball, state);
      if (goalSide !== -1) scoreGoal(state, ball, goalSide, rand);
      else remainingBalls.push(ball);
    });
    state.balls = remainingBalls.concat(spawnedBalls);

    state.particles = state.particles.filter(particle => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      particle.life -= elapsedMs;
      return particle.life > 0;
    });

    if (state.bricks.length === 0) {
      state.bricksRespawnMs = Math.max(0, state.bricksRespawnMs - elapsedMs);
      if (state.bricksRespawnMs === 0) state.bricks = makeBricks(rand, state.playerCount, state.powerup);
    }
    spawnPowerupIfReady(state, rand);

    if (state.balls.length === 0) {
      state.emptyMs += elapsedMs;
      if (state.emptyMs >= C.BALL_RESPAWN_MS) {
        state.balls.push(makeBall(
          C.WIDTH / 2,
          C.HEIGHT / 2,
          C.COLORS.neutral,
          null,
          true,
          randomRange(0, Math.PI * 2, rand),
          C.BALL_START_SPEED,
          state.nextBallId++
        ));
        state.emptyMs = 0;
      }
    } else state.emptyMs = 0;

    const targetWinner = state.players.find(player => player.score >= state.scoreLimit);
    if (targetWinner || state.timeLeftMs <= 0) {
      state.phase = 'GAMEOVER';
      const highScore = Math.max(...state.players.map(player => player.score));
      const winners = state.players.filter(player => player.score === highScore);
      state.isDraw = !targetWinner && winners.length !== 1;
      state.winnerIndex = state.isDraw ? null : (targetWinner || winners[0]).index;
    }
    return state;
  }

  window.QB.Physics = Object.freeze({
    makePlayer,
    assignBotDifficulty,
    createLobbyState,
    configurePlayerCount,
    startMatch,
    makeBricks,
    getArenaGeometry,
    getSideGeometry,
    paddleRect,
    circleRect,
    step
  });
})();
