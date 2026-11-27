(function () {
  const C = window.QB.C;
  let plans = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomRange = (min, max, random) => min + (max - min) * random();
  const profiles = {
    1: { reactionFrames: 20, roamRadius: 0.42, minShift: 0.14, aimError: 0.2, roamMinMs: 500, roamMaxMs: 950 },
    2: { reactionFrames: 42, roamRadius: 0.3, minShift: 0.11, aimError: 0.1, roamMinMs: 700, roamMaxMs: 1200 },
    3: { reactionFrames: 72, roamRadius: 0.2, minShift: 0.08, aimError: 0.04, roamMinMs: 850, roamMaxMs: 1400 }
  };

  function chooseImpactOffset(random) {
    const style = random();
    if (style < 0.18) return (random() - 0.5) * 0.36;
    const direction = random() < 0.5 ? -1 : 1;
    const strength = style < 0.72 ? 0.62 + random() * 0.3 : 0.28 + random() * 0.45;
    return direction * strength;
  }

  function makePlan(state, candidate, player, profile, paddleLength, travel, random) {
    const now = Number(state.elapsedMs) || 0;
    if (!candidate || candidate.time > profile.reactionFrames) {
      const base = candidate ? clamp(0.5 + candidate.alongSide / travel, 0.1, 0.9) : player.position;
      let targetPosition = clamp(base + (random() * 2 - 1) * profile.roamRadius, 0.08, 0.92);
      if (Math.abs(targetPosition - player.position) < profile.minShift) {
        const direction = random() < 0.5 ? -1 : 1;
        targetPosition = clamp(player.position + direction * profile.minShift, 0.08, 0.92);
      }
      return {
        ballId: candidate ? candidate.ball.id : null,
        mode: 'roam',
        targetPosition,
        expiresAt: now + randomRange(profile.roamMinMs, profile.roamMaxMs, random)
      };
    }

    const contactOffset = chooseImpactOffset(random) * paddleLength / 2;
    const aimError = (random() * 2 - 1) * travel * profile.aimError;
    return {
      ballId: candidate.ball.id,
      mode: 'intercept',
      targetPosition: clamp(0.5 + (candidate.alongSide - contactOffset + aimError) / travel, 0, 1),
      expiresAt: now + Math.max(250, candidate.time * (1000 / 60) + 350)
    };
  }

  function getMove(state, player, random) {
    if (!state.balls.length) return 0;
    const rand = random || Math.random;
    const difficulty = clamp(Math.floor(Number(player.botDifficulty) || 2), 1, 3);
    const profile = profiles[difficulty];
    const side = window.QB.Physics.getSideGeometry(state.playerCount, player.index);
    const paddleLength = Math.min(C.PADDLE_LENGTH, side.length * 0.42);
    const travel = Math.max(1, side.length - paddleLength);
    const candidates = [];

    state.balls.forEach(ball => {
      const distance = (side.midpoint.x - ball.x) * side.outward.x + (side.midpoint.y - ball.y) * side.outward.y;
      const speedOutward = ball.vx * side.outward.x + ball.vy * side.outward.y;
      if (speedOutward <= 0 || distance < -ball.radius) return;
      const time = Math.max(0, distance / speedOutward);
      const targetX = ball.x + ball.vx * time;
      const targetY = ball.y + ball.vy * time;
      const alongSide = (targetX - side.midpoint.x) * side.tangent.x + (targetY - side.midpoint.y) * side.tangent.y;
      candidates.push({ ball, time, alongSide });
    });

    candidates.sort((a, b) => a.time - b.time);
    const best = candidates[0] || null;
    const now = Number(state.elapsedMs) || 0;
    let plan = plans.get(player);
    let focused = plan && plan.ballId !== null
      ? candidates.find(candidate => candidate.ball.id === plan.ballId)
      : null;

    if (plan && plan.ballId !== null && !focused) plan = null;
    const betterThreat = best && focused && best.ball.id !== focused.ball.id && best.time < focused.time * 0.55;
    const tracked = focused || best;
    const reactNow = plan && plan.mode === 'roam' && tracked && tracked.time <= profile.reactionFrames;
    const resumeRoaming = plan && plan.mode === 'intercept' && focused && focused.time > profile.reactionFrames;
    if (!plan || now >= plan.expiresAt || (best && plan.ballId === null) || betterThreat || reactNow || resumeRoaming) {
      plan = makePlan(state, best, player, profile, paddleLength, travel, rand);
      plans.set(player, plan);
      focused = best;
    }

    const delta = plan.targetPosition - player.position;
    return Math.abs(delta) < 0.012 ? 0 : Math.sign(delta);
  }

  function reset() {
    plans = new WeakMap();
  }

  window.QB.AI = Object.freeze({ getMove, reset });
})();
