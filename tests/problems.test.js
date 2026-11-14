// Generators are random, so each test samples many problems and checks the
// invariants the UI and the answer key rely on.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/problems.js');

const N = 2000;
const times = (fn) => { for (let i = 0; i < N; i++) fn(); };
const isLinearTable = (ys) => ys.slice(1).every((y, i) => y - ys[i] === ys[1] - ys[0]);

test('parseNum reads what students type', () => {
  const cases = [['15', 15], ['-0.1', -0.1], ['−0.1', -0.1], ['$250', 250], ['-$4', -4], ['1/2', 0.5],
    ['15 $/h', 15], ['4.5in', 4.5], ['1,200', 1200], ['.5', 0.5], [' 7 ', 7]];
  for (const [s, v] of cases) assert.equal(P.parseNum(s), v, s);
  for (const s of ['', 'abc', '$']) assert.ok(Number.isNaN(P.parseNum(s)), s);
});

test('fmt and money', () => {
  assert.equal(P.fmt(-0.08), '−0.08');
  assert.equal(P.fmt(0.1 + 0.2), '0.3');
  assert.equal(P.money(12.5), '$12.50');
  assert.equal(P.money(915), '$915');
});

test('equation sets have 6 items with both kinds', () => times(() => {
  const { items } = P.genEquations();
  assert.equal(items.length, 6);
  assert.ok(items.some((i) => i.linear) && items.some((i) => !i.linear));
  for (const it of items) assert.ok(it.html && it.why && !it.html.includes('NaN'));
}));

test('graph sets: linear graphs are straight, nonlinear ones are not', () => times(() => {
  const { items } = P.genGraphs();
  assert.equal(items.length, 3);
  assert.ok(items.some((i) => i.linear) && items.some((i) => !i.linear));
  for (const it of items) {
    const ys = [-4, -1, 2, 5].map(it.f);
    const d = ys.slice(1).map((y, i) => y - ys[i]);
    const straight = d.every((v) => Math.abs(v - d[0]) < 1e-9);
    assert.equal(straight, it.linear, it.kind);
  }
}));

test('first differences match the table and the linear flag', () => times(() => {
  const p = P.genDifferences();
  assert.equal(p.diffs.length, p.xs.length - 1);
  p.diffs.forEach((d, i) => assert.equal(d, p.ys[i + 1] - p.ys[i]));
  assert.equal(p.linear, isLinearTable(p.ys));
  assert.equal(p.linear, p.kind === 'linear');
  assert.ok(isLinearTable(p.xs));
}));

test('rate problems: values fit the rate/initial value and land on the grid', () => times(() => {
  for (const mode of ['table', 'graph']) {
    const p = P.genRate(mode);
    p.xs.forEach((x, i) => assert.ok(Math.abs(p.ys[i] - (p.init + p.rate * x)) < 1e-6));
    if (!p.ctx.allowNeg) assert.ok(Math.min(...p.ys) >= 0);
    assert.notEqual(p.rate, 0);
    if (mode === 'graph') {
      for (const y of [...p.ys, p.init]) assert.ok(Math.abs(y / p.gridY - Math.round(y / p.gridY)) < 1e-6, `${y} on grid ${p.gridY}`);
      const rows = (Math.max(0, ...p.ys) - Math.min(0, ...p.ys)) / p.gridY;
      assert.ok(rows <= 16, `too many grid rows: ${rows}`);
    }
  }
}));

test('line of best fit: predictions are inside the view, interp is inside the data', () => times(() => {
  const p = P.genFit();
  const { view } = p;
  assert.ok(p.interpX > p.xs[0] && p.interpX < p.xs[p.xs.length - 1]);
  assert.ok(p.extrapX > p.xs[p.xs.length - 1] && p.extrapX < view.xMax);
  for (const y of [...p.ys, p.interpY, p.extrapY]) assert.ok(y >= view.yMin && y <= view.yMax, `${y} outside ${view.yMin}..${view.yMax}`);
  assert.ok(p.tol > 0);
}));

test('fee problems: table, extrapolation and budget are consistent', () => times(() => {
  const p = P.genFee();
  p.xs.forEach((x, i) => assert.equal(p.ys[i], P.round(p.fee + p.rate * x, 2)));
  assert.equal(p.extrapCost, P.round(p.fee + p.rate * p.extrapN, 2));
  assert.ok(p.extrapN > p.xs[p.xs.length - 1]);
  assert.equal(Math.floor(P.round((p.budget - p.fee) / p.rate, 9)), p.budgetN);
}));

test('trend graphs agree with their labels', () => times(() => {
  const p = P.genTrend();
  const s = [1, 5, 9].map((x) => P.slopeAt(p.f, x));
  const sign = s.every((v) => Math.abs(v) < 1e-6) ? 'Zero' : s.every((v) => v > 0) ? 'Positive' : 'Negative';
  assert.equal(sign, p.sign);
  const trend = Math.abs(s[2] - s[0]) < 1e-4 ? 'Constant' : s[2] > s[0] ? 'Increasing' : 'Decreasing';
  assert.equal(trend, p.trend);
  for (const x of [0, 5, 10]) assert.ok(p.f(x) >= 0 && p.f(x) <= 10.001, `f(${x}) = ${p.f(x)}`);
}));

test('comparing plans: intersection and cheaper ranges are right', () => times(() => {
  const p = P.genCompare();
  const { A, B } = p;
  const ca = (n) => A.r * n + A.f, cb = (n) => B.r * n + B.f;
  assert.ok(p.nStar >= 3 && p.nStar <= 12);
  assert.ok(Math.abs(ca(p.nStar) - cb(p.nStar)) < 1e-6);
  assert.ok(Math.abs(p.cStar - ca(p.nStar)) < 1e-6);
  for (let n = 0; n <= 30; n++) {
    if (n <= p.bMax) assert.ok(cb(n) < ca(n) - 1e-9, `B should be cheaper at ${n}`);
    if (n >= p.aMin) assert.ok(ca(n) < cb(n) - 1e-9, `A should be cheaper at ${n}`);
  }
  assert.ok(p.story.includes(A.name) && p.story.includes(B.name));
}));

test('variable roles: five distinct pairs, independent not always on one side', () => times(() => {
  const { items } = P.genVarRoles();
  assert.equal(items.length, 5);
  assert.equal(new Set(items.map((i) => i.ind)).size, 5);
  assert.ok(items.some((i) => i.indLeft) && items.some((i) => !i.indLeft));
  for (const it of items) assert.ok(it.ind && it.dep && it.why && it.ind !== it.dep);
}));

test('variance: one tight and one wide population, all points on the grid', () => {
  for (let k = 0; k < 200; k++) {
    const ds = P.genVarianceDists();
    const { n, xMax, yMax, sds } = P.VARIANCE;
    assert.deepEqual(ds.map((d) => d.sd).sort((a, b) => a - b), sds);
    for (const d of ds) {
      assert.equal(d.pts.length, n);
      for (const [x, y] of d.pts) assert.ok(x > 0 && x < xMax && y > 0 && y < yMax, `${x}, ${y}`);
      assert.ok(Number.isFinite(d.fit.m) && Number.isFinite(d.fit.b));
    }
  }
});

test('variance: samples are distinct indices into the population', () => times(() => {
  const s = P.sampleIdx(P.VARIANCE.n, P.VARIANCE.sample);
  assert.equal(s.length, P.VARIANCE.sample);
  assert.equal(new Set(s).size, s.length);
  for (const i of s) assert.ok(Number.isInteger(i) && i >= 0 && i < P.VARIANCE.n);
}));

test('variance: a line fitted on flipped axes maps back onto the original points', () => times(() => {
  const flip = P.genFlip();
  const m = (Math.random() - 0.5) * 4, b = Math.random() * 12;
  const line = P.unflipLine(m, b, flip);
  for (const x of [0, 2.5, 7, 10]) {
    // A point on the line as drawn on the flipped plot…
    const [ox, oy] = P.flipPt([x, m * x + b], flip); // mirroring is its own inverse
    // …lies on the unflipped line in original coordinates.
    assert.ok(Math.abs(line.m * ox + line.b - oy) < 1e-9, `${flip} at ${x}`);
  }
}));

test('error data: points on the grid, and no nearby line beats least squares', () => times(() => {
  const p = P.genErrorData();
  assert.equal(p.xs.length, 10);
  p.xs.forEach((x, i) => assert.ok(x > 0 && x < P.VARIANCE.xMax && p.ys[i] > 0 && p.ys[i] < P.VARIANCE.yMax));
  assert.ok(Math.abs(p.best - P.sumSquares(p.xs, p.ys, p.fit.m, p.fit.b)) < 1e-9);
  for (const [dm, db] of [[0.05, 0], [-0.05, 0], [0, 0.2], [0, -0.2], [0.03, -0.15]]) {
    assert.ok(P.sumSquares(p.xs, p.ys, p.fit.m + dm, p.fit.b + db) > p.best);
  }
}));

test('sumSquares adds up squared vertical errors', () => {
  assert.equal(P.sumSquares([0, 1, 2], [1, 3, 2], 1, 0), 1 + 4 + 0);
});
