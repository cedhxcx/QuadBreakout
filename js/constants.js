(function () {
  window.QB = window.QB || {};
  const width = 800;
  const colors = {
    red: '#FF3B30',
    blue: '#007AFF',
    green: '#34C759',
    yellow: '#FFCC00',
    neutral: '#FFFFFF'
  };
  window.QB.C = Object.freeze({
    WIDTH: width,
    HEIGHT: width,
    BALL_RADIUS: 8,
    BALL_START_SPEED: 4.1,
    BALL_MAX_SPEED: 9.2,
    PADDLE_LENGTH: 100,
    PADDLE_THICKNESS: 11,
    PADDLE_INSET: 34,
    PADDLE_SPEED: 6.4,
    PADDLE_MAX_ANGLE: Math.PI / 3,
    ARENA_RADIUS: 350,
    TWO_PLAYER_BOUNDS: Object.freeze({ left: 70, right: 730, top: 180, bottom: 620 }),
    BRICK_COLUMNS: 5,
    BRICK_ROWS: 5,
    BRICK_WIDTH: 38,
    BRICK_HEIGHT: 23,
    BRICK_GAP: 7,
    MULTIBALL_BRICKS_MIN: 1,
    MULTIBALL_BRICKS_MAX: 2,
    MULTIBALL_HITS_MIN: 2,
    MULTIBALL_HITS_MAX: 3,
    MULTIBALL_COUNT: 5,
    MAX_ACTIVE_BALLS: 5,
    BALL_TRAIL_LENGTH: 5,
    BALL_RESPAWN_MS: 1500,
    BRICK_RESPAWN_MS: 30000,
    MAX_BRICK_RESPAWN_MS: 120000,
    MAX_PARTICLES: 120,
    PARTICLE_COUNT: 8,
    BROADCAST_INTERVAL_MS: 1000 / 30,
    COLORS: colors,
    PLAYERS: Object.freeze([
      Object.freeze({ color: colors.red, label: 'Vermelho' }),
      Object.freeze({ color: colors.blue, label: 'Azul' }),
      Object.freeze({ color: colors.green, label: 'Verde' }),
      Object.freeze({ color: colors.yellow, label: 'Amarelo' }),
      Object.freeze({ color: '#FF9500', label: 'Laranja' }),
      Object.freeze({ color: '#AF52DE', label: 'Roxo' }),
      Object.freeze({ color: '#5AC8FA', label: 'Ciano' }),
      Object.freeze({ color: '#FF2D55', label: 'Rosa' })
    ])
  });
})();
