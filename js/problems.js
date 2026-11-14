// Problem generators for the Unit 4 (Linear Relations) review.
// Pure data + math, no DOM: loaded as a classic script in the browser
// (window.Problems) and via require() in the node tests.
(function (root) {
  'use strict';

  // ---------- random + number helpers ----------
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function randReal(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function nonZero(a, b) { let v; do v = randInt(a, b); while (v === 0); return v; }
  function round(x, d = 2) { const f = 10 ** d; return Math.round(x * f) / f; }

  // Display a number: trims float noise and uses a real minus sign.
  function fmt(x, d = 2) {
    const r = round(x, d);
    return (r < 0 ? '−' : '') + String(Math.abs(r));
  }
  function money(x) {
    const r = round(x, 2);
    const abs = Math.abs(r);
    return (r < 0 ? '−' : '') + '$' + (Number.isInteger(abs) ? String(abs) : abs.toFixed(2));
  }

  // Read a typed number. Tolerates $, commas, spaces, unicode minus,
  // trailing units ("15 $/h", "4.5in") and fractions ("3/4").
  function parseNum(str) {
    if (str == null) return NaN;
    const s = String(str).trim().replace(/[−–—]/g, '-').replace(/[$,\s]/g, '');
    const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+))(?:\/(\d+\.?\d*|\.\d+))?/);
    if (!m) return NaN;
    const n = parseFloat(m[1]);
    return m[2] !== undefined ? n / parseFloat(m[2]) : n;
  }
  function close(a, b, tol = 1e-6) { return Number.isFinite(a) && Math.abs(a - b) <= tol + 1e-9; }

  // A "nice" axis step (1, 2, 2.5, 5 × 10^k) at least as big as raw.
  function niceStep(raw) {
    const p = 10 ** Math.floor(Math.log10(raw));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  function leastSquares(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((s, x) => s + x, 0) / n;
    const my = ys.reduce((s, y) => s + y, 0) / n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const m = sxy / sxx;
    return { m, b: my - m * mx };
  }

  // ---------- HTML snippets for math ----------
  const V = (s) => `<var>${s}</var>`;
  const frac = (n, d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;

  // [[coef, varHtml], ...] → "3x − 2" with tidy signs and no "1x".
  function expr(terms) {
    let out = '';
    for (const [c, v] of terms) {
      if (c === 0) continue;
      const abs = Math.abs(c);
      const body = v ? (abs === 1 ? v : fmt(abs) + v) : fmt(abs);
      if (!out) out = (c < 0 ? '−' : '') + body;
      else out += (c < 0 ? ' − ' : ' + ') + body;
    }
    return out || '0';
  }

  // ---------- Q1: linear or nonlinear (equations) ----------
  const VARS = [['y', 'x'], ['y', 'x'], ['y', 'x'], ['d', 't'], ['C', 'n'], ['h', 't'], ['P', 'm']];

  const LINEAR_EQS = [
    () => {
      const [Y, X] = pick(VARS), a = nonZero(-9, 9), b = nonZero(-15, 15);
      return { html: `${V(Y)} = ${expr([[a, V(X)], [b, '']])}`, why: `${V(X)} only appears to the power 1, so the rate of change is constant.` };
    },
    () => {
      const [Y, X] = pick(VARS), b = randInt(10, 60), a = -randInt(2, 9);
      return { html: `${V(Y)} = ${expr([[b, ''], [a, V(X)]])}`, why: `The order of the terms doesn't matter: this is ${V(Y)} = ${expr([[a, V(X)], [b, '']])}, a straight line.` };
    },
    () => {
      const d = pick([2, 3, 4, 5]), n = pick([1, 1, 2, 3].filter((k) => k < d)), b = nonZero(-12, 12);
      return { html: `${frac(n, d)}${V('x')} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${V('y')}`, why: `A fraction is still just a number multiplying ${V('x')} (power 1). Having ${V('y')} on the right side changes nothing.` };
    },
    () => {
      const a = pick([0.25, 0.5, 0.75, 1.5, 2.5]), b = pick([1.5, 2.25, 4.5, 12]);
      return { html: `${V('C')} = ${expr([[a, V('n')], [b, '']])}`, why: `Decimals are fine — ${V('n')} is still only to the power 1.` };
    },
    () => {
      const base = randInt(2, 5), a = nonZero(-6, 6);
      return { html: `${V('y')} = ${base}<sup>2</sup> ${a < 0 ? '−' : '+'} ${expr([[Math.abs(a), V('x')]])}`, why: `Careful: only the number ${base} is squared (${base}<sup>2</sup> = ${base * base}). ${V('x')} is still to the power 1.` };
    },
    () => {
      const a = randInt(1, 6), b = nonZero(-5, 5), c = randInt(1, 12) * pick([1, 2, 3]);
      return { html: `${expr([[a, V('x')], [b, V('y')]])} = ${c}`, why: `Solve for ${V('y')} and you get a straight line. Neither ${V('x')} nor ${V('y')} is squared.` };
    },
  ];

  const NONLINEAR_EQS = [
    () => {
      const a = nonZero(-5, 5), b = nonZero(-9, 9);
      return { html: `${V('y')} = ${expr([[a, `${V('x')}<sup>2</sup>`], [b, '']])}`, why: `${V('x')} is squared (power 2), so the graph is a parabola.` };
    },
    () => {
      const c = randInt(1, 6), d = randInt(20, 150);
      return { html: `${V('h')} = −4.9(${V('t')} − ${c})<sup>2</sup> + ${d}`, why: `The bracket containing ${V('t')} is squared, so this is a curve (a parabola).` };
    },
    () => {
      const b = nonZero(-9, 9), c = nonZero(-15, 15);
      return { html: `${V('y')} = ${expr([[1, `${V('x')}<sup>2</sup>`], [b, V('x')], [c, '']])}`, why: `There is an ${V('x')}<sup>2</sup> term, so it's nonlinear — even though it also has an ${V('x')} term.` };
    },
    () => {
      const a = randInt(2, 24);
      return { html: `${V('y')} = ${frac(a, V('x'))}`, why: `${V('x')} is in the denominator. Dividing by ${V('x')} makes a curve.` };
    },
    () => {
      const base = pick([2, 3, 10]), c = randInt(1, 5);
      return { html: `${V('y')} = ${c > 1 ? c + '(' : ''}${base}<sup>${V('x')}</sup>${c > 1 ? ')' : ''}`, why: `${V('x')} is an exponent. Each step multiplies ${V('y')} instead of adding a fixed amount.` };
    },
    () => {
      const b = nonZero(-6, 6);
      return { html: `${V('y')} = ${V('x')}(${expr([[1, V('x')], [b, '']])})`, why: `Expand it: ${V('x')} × ${V('x')} = ${V('x')}<sup>2</sup>, so there's a squared term hiding in there.` };
    },
    () => {
      const b = nonZero(-9, 9);
      return { html: `${V('y')} = ${expr([[1, `${V('x')}<sup>3</sup>`], [b, '']])}`, why: `${V('x')} is cubed (power 3), so it's a curve.` };
    },
  ];

  function genEquations() {
    const k = randInt(2, 4);
    const lin = shuffle(LINEAR_EQS).slice(0, k).map((f) => ({ ...f(), linear: true }));
    const non = shuffle(NONLINEAR_EQS).slice(0, 6 - k).map((f) => ({ ...f(), linear: false }));
    return { items: shuffle(lin.concat(non)) };
  }

  // ---------- Q2: linear or nonlinear (graphs) ----------
  const GRAPH_KINDS = {
    line() {
      const m = pick([-3, -2, -1, -0.5, 0.5, 1, 2, 3, 1 / 3, -1 / 3, 2 / 3, -2 / 3]), b = randInt(-3, 3);
      return { f: (x) => m * x + b, linear: true, why: 'One straight line → linear.' };
    },
    flat() {
      const c = nonZero(-4, 4);
      return { f: () => c, linear: true, why: 'A horizontal line is still a straight line (its rate of change is 0) → linear.' };
    },
    parabola() {
      const a = pick([-2, -1, -0.5, 0.5, 1, 2]), h = randInt(-2, 2), k = a > 0 ? randInt(-5, -1) : randInt(1, 5);
      return { f: (x) => a * (x - h) ** 2 + k, linear: false, why: 'It curves and turns around (a parabola) → nonlinear.' };
    },
    exp() {
      const base = pick([2, 0.5]), h = randInt(-1, 1), k = randInt(-4, -1);
      return { f: (x) => base ** (x - h) + k, linear: false, why: 'It curves — getting steeper on one side and flatter on the other → nonlinear.' };
    },
    abs() {
      const a = pick([-2, -1, 1, 2, 0.5]), h = randInt(-2, 2), k = a > 0 ? randInt(-4, 0) : randInt(0, 4);
      return { f: (x) => a * Math.abs(x - h) + k, linear: false, why: 'It is made of straight pieces, but it bends at the corner. A linear relation is one single straight line → nonlinear.' };
    },
    cubic() {
      const a = pick([0.1, -0.1, 0.15, -0.15]), h = randInt(-1, 1), k = randInt(-1, 1);
      return { f: (x) => a * (x - h) ** 3 + k, linear: false, why: 'S-shaped curve → nonlinear.' };
    },
    gentle() {
      const a = pick([0.07, -0.07, 0.08, -0.08]), m = pick([0.5, 1, -0.5, -1]), b = randInt(-1, 1);
      return { f: (x) => a * x * x + m * x + b, linear: false, why: 'Look closely (or hold a ruler up to the screen): it bends a little. Even a slight curve → nonlinear.' };
    },
  };

  function genGraphs() {
    const lin = ['line', 'line', 'flat'], non = ['parabola', 'exp', 'abs', 'cubic', 'gentle'];
    const kinds = shuffle([pick(lin), pick(non), pick(rand01() ? lin : non)]);
    return { items: kinds.map((k) => ({ kind: k, ...GRAPH_KINDS[k]() })) };
  }
  function rand01() { return Math.random() < 0.5; }

  // ---------- Q3: first differences ----------
  function genDifferences() {
    const step = pick([1, 1, 2, 2, 3, 5]);
    const x0 = step === 1 ? randInt(-3, 2) : step * randInt(-2, 0);
    const n = pick([4, 5]);
    const xs = Array.from({ length: n }, (_, i) => x0 + i * step);
    let ys, kind;
    if (rand01()) {
      kind = 'linear';
      const m = nonZero(-6, 6), b = randInt(-10, 10);
      ys = xs.map((x) => m * x + b);
    } else {
      kind = pick(['quad', 'quad', 'double', 'bump']);
      if (kind === 'quad') {
        const a = step >= 3 ? pick([-1, 1]) : pick([-2, -1, 1, 2]), b = randInt(-3, 3), c = randInt(-5, 8);
        ys = xs.map((x) => a * x * x + b * x + c);
      } else if (kind === 'double') {
        const c = pick([1, 2, 3, 5]);
        ys = xs.map((_, i) => c * 2 ** i);
      } else {
        const m = nonZero(-5, 5), b = randInt(-10, 10);
        ys = xs.map((x) => m * x + b);
        ys[randInt(1, n - 1)] += pick([-1, 1]);
      }
    }
    const diffs = ys.slice(1).map((y, i) => y - ys[i]);
    const linear = diffs.every((d) => d === diffs[0]);
    return { xs, ys, diffs, step, linear, kind };
  }

  // ---------- Q4–5: rate of change & initial value ----------
  // rate = rise·yStep/xStep and initial value = init·yStep, so tables and
  // graphs always land on whole grid units.
  const RATE_CONTEXTS = [
    { iv: 'Time', ivU: 'h', dv: 'Earnings', dvU: '$', rateU: '$/h', invU: 'h/$', pairs: [[1, 5], [2, 10]], rise: [2, 5], init: [0, 30], x0: [0] },
    { iv: 'Distance', ivU: 'km', dv: 'Fuel', dvU: 'L', rateU: 'L/km', invU: 'km/L', pairs: [[50, 1]], rise: [-6, -3], init: [40, 70], x0: [0] },
    { iv: 'Number of cookies', ivU: 'cookies', dv: 'Flour', dvU: 'g', rateU: 'g/cookie', invU: 'cookies/g', pairs: [[10, 10], [20, 20]], rise: [5, 9], init: [0, 0], x0: [1] },
    { iv: 'Time', ivU: 'min', dv: 'Distance', dvU: 'm', rateU: 'm/min', invU: 'min/m', pairs: [[1, 1], [2, 2]], rise: [2, 6], init: [0, 6], x0: [0, 1] },
    { iv: 'Time', ivU: 'h', dv: 'Rental cost', dvU: '$', rateU: '$/h', invU: 'h/$', pairs: [[1, 5], [2, 10]], rise: [2, 4], init: [4, 10], x0: [0, 1] },
    { iv: 'Load mass', ivU: 't', dv: 'Shipping cost', dvU: '$', rateU: '$/t', invU: 't/$', pairs: [[2, 50], [2, 100]], rise: [2, 4], init: [4, 8], x0: [0] },
    { iv: 'Time', ivU: 'min', dv: 'Water in tank', dvU: 'L', rateU: 'L/min', invU: 'min/L', pairs: [[1, 5], [2, 10]], rise: [-4, -2], init: [20, 40], x0: [0] },
    { iv: 'Time', ivU: 'weeks', dv: 'Savings', dvU: '$', rateU: '$/week', invU: 'weeks/$', pairs: [[1, 5], [2, 10]], rise: [2, 6], init: [0, 20], x0: [0, 1] },
    { iv: 'Time', ivU: 'h', dv: 'Candle height', dvU: 'cm', rateU: 'cm/h', invU: 'h/cm', pairs: [[1, 1], [2, 1]], rise: [-3, -1], init: [18, 30], x0: [0] },
    { iv: 'Tickets sold', ivU: 'tickets', dv: 'Profit', dvU: '$', rateU: '$/ticket', invU: 'tickets/$', pairs: [[10, 50]], rise: [1, 3], init: [-8, -4], x0: [0], allowNeg: true },
  ];

  function genRate(mode) {
    const ctx = pick(RATE_CONTEXTS);
    mode = mode || pick(['table', 'graph']);
    for (;;) {
      const [xStep, yStep] = pick(ctx.pairs);
      let rise = randInt(...ctx.rise), init = randInt(...ctx.init);
      const k0 = pick(ctx.x0), n = 5;
      let gridY = yStep;
      if (mode === 'graph') {
        // Keep the graph readable: coarsen the grid until there are ≤ 14 rows.
        const vals = [0, ...Array.from({ length: n + 1 }, (_, i) => init + rise * (k0 + i))];
        const span = Math.max(...vals) - Math.min(...vals) + 1;
        const m = [1, 2, 4, 5, 10].find((c) => span / c <= 14) || 10;
        init = m * Math.round(init / m);
        rise = m * Math.round(rise / m) || m * Math.sign(rise);
        gridY = yStep * m;
      }
      const rate = rise * yStep / xStep, initV = init * yStep;
      const xs = Array.from({ length: n }, (_, i) => (k0 + i) * xStep);
      const ys = xs.map((x) => round(initV + rate * x, 6));
      if (!ctx.allowNeg && Math.min(...ys) < 0) continue;
      return { ctx, mode, xs, ys, rate, init: initV, xStep, gridY };
    }
  }

  // ---------- Q6–7: scatter plots & line of best fit ----------
  const NAMES = ['Mark', 'Priya', 'Jonah', 'Aisha', 'Leo', 'Mei', 'Sam', 'Noor'];
  const FIT_CONTEXTS = [
    { story: (n) => `The table shows ${n}'s height as they grew up.`, xName: 'Age', xU: 'years', yName: 'Height', yU: 'cm', xs: [1, 2, 3, 4, 5, 6, 7, 8], b: [58, 66], m: [7, 10], noise: 3, dp: 0, interp: [2.5, 4.5, 5.5, 6.5], extrap: [10, 11, 12] },
    { story: () => 'The length of a young alligator was recorded every month.', xName: 'Time', xU: 'months', yName: 'Length', yU: 'in.', xs: [0, 1, 2, 3, 4, 5, 6, 7], b: [1.5, 2.5], m: [0.9, 1.2], noise: 0.3, dp: 1, interp: [1.5, 2.5, 3.5, 4.5], extrap: [10, 12] },
    { story: (n) => `${n} measured a sunflower every week.`, xName: 'Time', xU: 'weeks', yName: 'Height', yU: 'cm', xs: [0, 1, 2, 3, 4, 5, 6, 7, 8], b: [4, 10], m: [10, 16], noise: 4, dp: 0, interp: [2.5, 3.5, 5.5], extrap: [10, 12] },
    { story: (n) => `${n} weighed their new puppy every week.`, xName: 'Age', xU: 'weeks', yName: 'Mass', yU: 'kg', xs: [2, 3, 4, 5, 6, 7, 8, 9], b: [0.5, 1.5], m: [0.6, 1.0], noise: 0.25, dp: 1, interp: [3.5, 5.5, 6.5], extrap: [12, 14] },
    { story: (n) => `${n} tracked their phone battery while streaming videos.`, xName: 'Time', xU: 'h', yName: 'Battery', yU: '%', xs: [0, 1, 2, 3, 4, 5, 6], b: [95, 100], m: [-9, -7], noise: 3, dp: 0, interp: [1.5, 2.5, 4.5], extrap: [8, 9] },
  ];

  function genFit() {
    const ctx = pick(FIT_CONTEXTS);
    const name = pick(NAMES);
    const m = randReal(...ctx.m), b = randReal(...ctx.b);
    const xs = ctx.xs.slice();
    const ys = xs.map((x) => round(b + m * x + randReal(-ctx.noise, ctx.noise), ctx.dp));
    const fit = leastSquares(xs, ys);
    const interpX = pick(ctx.interp), extrapX = pick(ctx.extrap);
    const at = (x) => fit.m * x + fit.b;
    const all = ys.concat([at(interpX), at(extrapX)]);
    const lo = Math.min(...all), hi = Math.max(...all);
    const yGrid = niceStep((hi - lo) / 8);
    const yMin = Math.max(0, Math.floor((lo - yGrid) / yGrid) * yGrid);
    const yMax = Math.ceil((hi + yGrid / 2) / yGrid) * yGrid;
    const tol = Math.max(ctx.noise * 1.5, (hi - lo) * 0.05);
    return {
      ...ctx, story: ctx.story(name), name, xs, ys, fit, interpX, extrapX,
      interpY: at(interpX), extrapY: at(extrapX), tol,
      view: { xMin: 0, xMax: extrapX + 1, yMin, yMax, yGrid },
    };
  }

  // ---------- Q8–9: fixed fee + rate per item ----------
  const FEE_CONTEXTS = [
    {
      story: (f, r) => `The zoo charges a ${money(f)} admission fee plus ${money(r)} for each exhibit you visit.`,
      iv: 'Number of exhibits visited', item: 'exhibit', items: 'exhibits', letter: 'n',
      fee: () => randInt(3, 8), rate: () => randInt(2, 4), xs: [[0, 1, 2, 3, 4]], extrap: [10, 16], budgetN: [8, 15],
      costQ: (n) => `the total cost of visiting ${n} exhibits`, budgetQ: (B) => `how many exhibits you can visit with ${money(B)}`,
    },
    {
      story: (f, r) => `To host a party at ${pick(['Monte Manor', 'Lakeview Hall', 'The Grand Loft'])}, you pay a flat fee of ${money(f)} plus ${money(r)} per guest.`,
      iv: 'Number of guests', item: 'guest', items: 'guests', letter: 'n',
      fee: () => 10 * randInt(6, 15), rate: () => randInt(10, 25), xs: [[0, 3, 6, 9, 12], [0, 4, 8, 12]], extrap: [40, 60], budgetN: [20, 40],
      costQ: (n) => `the cost of a party with ${n} guests`, budgetQ: (B) => `how many guests you can invite with a budget of ${money(B)}`,
    },
    {
      story: (f, r) => `Strike Lanes charges ${money(f)} for shoe rental plus ${money(r)} per game of bowling.`,
      iv: 'Number of games', item: 'game', items: 'games', letter: 'g',
      fee: () => randInt(3, 6), rate: () => pick([4, 4.5, 5, 5.5, 6, 7]), xs: [[0, 1, 2, 3, 4]], extrap: [7, 10], budgetN: [5, 9],
      costQ: (n) => `the total cost of bowling ${n} games`, budgetQ: (B) => `how many games you can bowl with ${money(B)}`,
    },
    {
      story: (f, r) => `FitZone gym charges a ${money(f)} sign-up fee plus ${money(r)} per month.`,
      iv: 'Number of months', item: 'month', items: 'months', letter: 'm',
      fee: () => 5 * randInt(5, 15), rate: () => 5 * randInt(3, 8), xs: [[0, 2, 4, 6, 8], [0, 3, 6, 9, 12]], extrap: [18, 24], budgetN: [10, 20],
      costQ: (n) => `the total cost of a ${n}-month membership`, budgetQ: (B) => `how many months you can be a member with ${money(B)}`,
    },
    {
      story: (f, r) => `A taxi charges a ${money(f)} base fare plus ${money(r)} per kilometre.`,
      iv: 'Distance travelled (km)', item: 'km', items: 'km', letter: 'd',
      fee: () => pick([3, 3.5, 4, 4.5, 5]), rate: () => pick([2, 2.5, 3]), xs: [[0, 1, 2, 3, 4], [0, 2, 4, 6, 8]], extrap: [12, 25], budgetN: [10, 20],
      costQ: (n) => `the fare for a ${n} km trip`, budgetQ: (B) => `how many whole kilometres you can travel with ${money(B)}`,
    },
    {
      story: (f, r) => `A phone plan costs ${money(f)} per month plus ${money(r)} for each GB of data used.`,
      iv: 'Data used (GB)', item: 'GB', items: 'GB', letter: 'd',
      fee: () => 5 * randInt(4, 8), rate: () => randInt(5, 10), xs: [[0, 1, 2, 3, 4], [0, 2, 4, 6, 8]], extrap: [10, 15], budgetN: [6, 12],
      costQ: (n) => `the monthly bill when ${n} GB are used`, budgetQ: (B) => `how many whole GB you can use in a month with ${money(B)}`,
    },
  ];

  function genFee() {
    const ctx = pick(FEE_CONTEXTS);
    const fee = ctx.fee(), rate = ctx.rate();
    const xs = pick(ctx.xs);
    const cost = (n) => round(fee + rate * n, 2);
    const extrapN = randInt(...ctx.extrap);
    const budgetN = randInt(...ctx.budgetN);
    // Sometimes leave change over so the answer needs rounding down.
    const extra = rand01() ? 0 : pick([1, 2, 3].filter((e) => e < rate));
    const budget = cost(budgetN) + extra;
    return {
      ctx, fee, rate, xs, ys: xs.map(cost), story: ctx.story(fee, rate),
      extrapN, extrapCost: cost(extrapN), budget, budgetN,
    };
  }

  // ---------- Q10: describing the rate of change ----------
  const TREND_KINDS = {
    linPos() { const b = randInt(0, 4), e = randInt(7, 10); return { f: (x) => b + (e - b) / 10 * x, sign: 'Positive', trend: 'Constant', why: 'A straight line going up: the rate of change is positive and the same everywhere (constant).' }; },
    linNeg() { const b = randInt(7, 10), e = randInt(0, 3); return { f: (x) => b + (e - b) / 10 * x, sign: 'Negative', trend: 'Constant', why: 'A straight line going down: the rate of change is negative and the same everywhere (constant).' }; },
    zero() { const c = randInt(2, 8); return { f: () => c, sign: 'Zero', trend: 'Constant', why: 'A flat line: y does not change, so the rate of change is zero — and it stays zero (constant).' }; },
    convex() {
      const c = randInt(0, 3), e = randInt(8, 10);
      if (rand01()) { const k = (e - c) / 100; return { f: (x) => c + k * x * x, sign: 'Positive', trend: 'Increasing', why: 'The graph goes up, so the rate of change is positive. It gets steeper as x grows, so the rate of change is increasing.' }; }
      const s = (e - c + 1); return { f: (x) => c - 1 + s ** (x / 10), sign: 'Positive', trend: 'Increasing', why: 'The graph goes up, so the rate of change is positive. It gets steeper and steeper, so the rate of change is increasing.' };
    },
    concave() {
      const c = randInt(0, 3), e = randInt(7, 10);
      if (rand01()) { const k = (e - c) / Math.sqrt(10); return { f: (x) => c + k * Math.sqrt(Math.max(x, 0)), sign: 'Positive', trend: 'Decreasing', why: 'The graph still goes up, so the rate of change is positive. But it flattens out — the slope gets smaller — so the rate of change is decreasing. Positive and decreasing at the same time!' }; }
      const s = pick([2, 2.5, 3]), A = (e - c) / (1 - Math.exp(-10 / s));
      return { f: (x) => c + A * (1 - Math.exp(-x / s)), sign: 'Positive', trend: 'Decreasing', why: 'The graph still goes up, so the rate of change is positive. But it levels off — the slope gets smaller — so the rate of change is decreasing. Positive and decreasing at the same time!' };
    },
  };

  function genTrend() {
    const kind = pick(['linPos', 'linNeg', 'zero', 'convex', 'convex', 'concave', 'concave', 'concave']);
    return { kind, ...TREND_KINDS[kind]() };
  }
  function slopeAt(f, x, h = 1e-4) { return (f(x + h) - f(x - h)) / (2 * h); }

  // ---------- Q11: comparing two plans (linear systems) ----------
  const COMPARE_CONTEXTS = [
    {
      names: [['Balloons R Fun', 'Singing Balloons'], ['Pop Shop', 'Air Mail Balloons']],
      intro: (p) => `${p} wants balloons delivered to a party.`,
      line: (c) => `${c.name} charges ${money(c.r)} per balloon and ${money(c.f)} for delivery.`,
      item: 'balloon', items: 'balloons', rates: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], fee: [1, 8], step: 0.5,
    },
    {
      names: [['Wheel Deal', 'Spoke & Go'], ['City Cycles', 'Pedal Power']],
      intro: (p) => `${p} wants to rent a bike for the day.`,
      line: (c) => `${c.name} charges ${money(c.f)} plus ${money(c.r)} per hour.`,
      item: 'hour', items: 'hours', rates: [3, 4, 5, 6, 7, 8], fee: [5, 20], step: 1,
    },
    {
      names: [['Pizza Planet', 'Slice Express'], ['Mama Rosa\'s', 'Crust Club']],
      intro: (p) => `${p} is ordering pizzas for the class party.`,
      line: (c) => `${c.name} charges ${money(c.r)} per pizza plus a ${money(c.f)} delivery fee.`,
      item: 'pizza', items: 'pizzas', rates: [9, 10, 11, 12, 13, 14], fee: [2, 10], step: 1,
    },
    {
      names: [['Pixel Palace', 'Game Galaxy'], ['Retro Rumble', 'Joystick Junction']],
      intro: (p) => `${p} is choosing an arcade.`,
      line: (c) => `${c.name} charges ${money(c.f)} to get in plus ${money(c.r)} per game.`,
      item: 'game', items: 'games', rates: [0.5, 0.75, 1, 1.25, 1.5, 2], fee: [2, 10], step: 0.5,
    },
  ];

  function genCompare() {
    const ctx = pick(COMPARE_CONTEXTS);
    const [nameA, nameB] = shuffle(pick(ctx.names));
    const person = pick(NAMES);
    for (;;) {
      const [r1, r2] = shuffle(ctx.rates).slice(0, 2).sort((a, b) => a - b);
      const fLow = randInt(...ctx.fee);
      const D = round(Math.round((r2 - r1) * randReal(3, 12) / ctx.step) * ctx.step, 2);
      const nStar = round(D / (r2 - r1), 9);
      if (D <= 0 || nStar < 3 || nStar > 12) continue;
      // A: cheaper per item but bigger fixed fee; B: the opposite.
      const A = { name: nameA, r: r1, f: fLow + D };
      const B = { name: nameB, r: r2, f: fLow };
      const cStar = A.r * nStar + A.f;
      return {
        ctx, person, A, B, nStar, cStar,
        story: [ctx.intro(person), ...shuffle([ctx.line(A), ctx.line(B)])].join(' '),
        bMax: Math.ceil(nStar) - 1, // largest n where B is cheaper
        aMin: Math.floor(nStar) + 1, // smallest n where A is cheaper
      };
    }
  }

  const api = {
    randInt, pick, shuffle, round, fmt, money, parseNum, close, niceStep, leastSquares, slopeAt, expr, V, frac,
    genEquations, genGraphs, genDifferences, genRate, genFit, genFee, genTrend, genCompare,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Problems = api;
})(typeof window !== 'undefined' ? window : globalThis);
