(function () {
  const C = window.QB.C;
  let plans = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomRange = (min, max, random) => min + (max - min) * random();
  const profiles = {
    1: { reactionFrames: 40, commitFrames: 18, roamRadius: 0.42, minShift: 0.14, aimError: 0.06, maxImpactOffset: 0.5, roamMinMs: 500, roamMaxMs: 950, interceptRadius: 0.06, interceptGain: 14, interceptPeriodMinMs: 1200, interceptPeriodMaxMs: 1800 },
    2: { reactionFrames: 54, commitFrames: 18, roamRadius: 0.3, minShift: 0.11, aimError: 0.04, maxImpactOffset: 0.65, roamMinMs: 700, roamMaxMs: 1200, interceptRadius: 0.05, interceptGain: 16, interceptPeriodMinMs: 1400, interceptPeriodMaxMs: 2000 },
    3: { reactionFrames: 72, commitFrames: 18, roamRadius: 0.2, minShift: 0.08, aimError: 0.02, maxImpactOffset: 0.75, roamMinMs: 850, roamMaxMs: 1400, interceptRadius: 0.045, interceptGain: 18, interceptPeriodMinMs: 1600, interceptPeriodMaxMs: 2200 }
  };

  function chooseImpactOffset(random, profile) {
    const style = random();
    if (style < 0.3) return (random() - 0.5) * 0.5;
    const direction = random() < 0.5 ? -1 : 1;
    const strength = 0.3 + random() * (profile.maxImpactOffset - 0.3);
    return direction * strength;
  }

  function reflectInRange(position, min, max) {
    const span = max - min;
    const folded = ((position - min) % (span * 2) + span * 2) % (span * 2);
    return min + (folded <= span ? folded : span * 2 - folded);
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

    const contactOffset = chooseImpactOffset(random, profile) * paddleLength / 2;
    const aimError = (random() * 2 - 1) * travel * profile.aimError;
    const aimPosition = clamp(0.5 + (candidate.alongSide - contactOffset + aimError) / travel, 0, 1);
    return {
      ballId: candidate.ball.id,
      mode: 'intercept',
      contactOffset,
      aimError,
      aimPosition,
      targetPosition: aimPosition,
      wanderPhase: random() * Math.PI * 2,
      wanderPeriodMs: randomRange(profile.interceptPeriodMinMs, profile.interceptPeriodMaxMs, random),
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
      const contactDistance = C.PADDLE_INSET + C.PADDLE_THICKNESS / 2 + ball.radius;
      const distance = (side.midpoint.x - ball.x) * side.outward.x +
        (side.midpoint.y - ball.y) * side.outward.y - contactDistance;
      const speedOutward = ball.vx * side.outward.x + ball.vy * side.outward.y;
      if (speedOutward <= 0 || distance < -(contactDistance + ball.radius)) return;
      const time = Math.max(0, distance / speedOutward);
      const targetX = ball.x + ball.vx * time;
      let targetY = ball.y + ball.vy * time;
      if (state.playerCount === 2) {
        const bounds = C.TWO_PLAYER_BOUNDS;
        targetY = reflectInRange(targetY, bounds.top + ball.radius, bounds.bottom - ball.radius);
      }
      const alongSide = (targetX - side.midpoint.x) * side.tangent.x + (targetY - side.midpoint.y) * side.tangent.y;
      if (Math.abs(alongSide) > side.length / 2 + ball.radius) return;
      candidates.push({ ball, time, alongSide, distance });
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

    if (plan.mode === 'intercept' && focused) {
      if (focused.distance > 0) {
        plan.aimPosition = clamp(0.5 + (focused.alongSide - plan.contactOffset + plan.aimError) / travel, 0, 1);
      }
      const contactMargin = Math.max(0, paddleLength / 2 + focused.ball.radius -
        Math.abs(plan.contactOffset) - Math.abs(plan.aimError));
      const safeRadius = Math.min(profile.interceptRadius, contactMargin / travel * 0.7);
      const commitment = clamp(focused.time / profile.commitFrames, 0, 1);
      const radius = safeRadius * commitment * commitment;
      const wander = Math.sin(now / plan.wanderPeriodMs * Math.PI * 2 + plan.wanderPhase) * radius;
      plan.targetPosition = clamp(plan.aimPosition + wander, 0, 1);
    }

    const delta = plan.targetPosition - player.position;
    if (plan.mode === 'intercept') return Math.abs(delta) < 0.002 ? 0 : clamp(delta * profile.interceptGain, -1, 1);
    return Math.abs(delta) < 0.012 ? 0 : Math.sign(delta);
  }

  function reset() {
    plans = new WeakMap();
  }

  window.QB.AI = Object.freeze({ getMove, reset });
})();
