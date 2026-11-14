// UI: routing, the shared problem frame, and one renderer per topic.
(function () {
  'use strict';
  const P = window.Problems, G = window.Graph;
  const { fmt, money, parseNum, close, shuffle, niceStep, slopeAt, expr, V } = P;

  // ---------- DOM helpers ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      e.append(kid instanceof Node ? kid : document.createTextNode(kid));
    }
    return e;
  }
  const letter = (i) => String.fromCharCode(97 + i);
  const par = (v) => (v < 0 ? `(${fmt(v, 3)})` : fmt(v, 3));
  const poss = (name) => name + (name.endsWith('s') ? '’' : '’s');
  const withUnit = (v, u) => (u === '$' ? money(v) : `${fmt(v, 3)} ${u}`);
  const row = (label, ...kids) => h('div', { class: 'row' }, h('span', { class: 'row-label', html: label }), ...kids);
  const part = (tag, html, ...kids) => h('div', { class: 'part' }, h('span', { class: 'tag' }, tag + ')'), h('div', { class: 'part-body' }, h('p', { html }), ...kids));

  function mark(el, ok) { el.classList.toggle('ok', ok); el.classList.toggle('bad', !ok); }
  function clearMark(el) { el.classList.remove('ok', 'bad'); }

  // ---------- answer fields ----------
  // Every field is { el, filled(), check() → boolean, reveal() }.
  function numField(answer, { tol = 1e-6, prefix, suffix, size = 6, label = 'answer', show } = {}) {
    const input = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', size, 'aria-label': label });
    const fix = h('span', { class: 'fix' });
    const el = h('span', { class: 'field num' }, prefix && h('span', { class: 'affix' }, prefix), input, suffix && h('span', { class: 'affix' }, suffix), fix);
    input.addEventListener('input', () => clearMark(el));
    return {
      el, input,
      filled: () => input.value.trim() !== '',
      check() { const ok = close(parseNum(input.value), answer, tol); mark(el, ok); if (ok) fix.textContent = ''; return ok; },
      reveal() { if (!el.classList.contains('ok')) fix.textContent = '→ ' + (show != null ? show : fmt(answer, 3)); },
    };
  }

  function selectField(options, answer, label = 'choose') {
    const sel = h('select', { 'aria-label': label }, h('option', { value: '' }, 'choose…'), options.map((o) => h('option', { value: o }, o)));
    const fix = h('span', { class: 'fix' });
    const el = h('span', { class: 'field sel' }, sel, fix);
    sel.addEventListener('change', () => clearMark(el));
    return {
      el,
      filled: () => sel.value !== '',
      check() { const ok = sel.value === answer; mark(el, ok); if (ok) fix.textContent = ''; return ok; },
      reveal() { if (!el.classList.contains('ok')) fix.textContent = '→ ' + answer; },
    };
  }

  function choiceField(options, answer, label = 'choose') {
    let value = '';
    const el = h('span', { class: 'field choice', role: 'group', 'aria-label': label });
    const btns = options.map((o) => h('button', {
      type: 'button', class: 'seg', 'aria-pressed': 'false',
      onclick() {
        value = o;
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b === this)));
        clearMark(el);
      },
    }, o));
    el.append(...btns);
    return {
      el,
      filled: () => value !== '',
      check() { const ok = value === answer; mark(el, ok); return ok; },
      reveal() { btns.forEach((b) => b.classList.toggle('answer', b.textContent === answer)); },
    };
  }

  // ---------- progress (per-browser convenience only) ----------
  const STORE = 'linear-relations-practice';
  function loadStats() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  }
  function saveStat(id, right, total) {
    try {
      const s = loadStats();
      const t = s[id] || { n: 0, right: 0, total: 0 };
      t.n++; t.right += right; t.total += total;
      s[id] = t;
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch { /* storage blocked: progress just isn't remembered */ }
  }

  // ---------- the problem frame ----------
  // Renders one generated problem with Check / worked solution / next controls.
  function mountProblem(host, topic, opts = {}) {
    host.replaceChildren();
    const p = topic.gen();
    const body = h('div', { class: 'problem-body' });
    const api = topic.mount(body, p);
    const result = h('p', { class: 'result', 'aria-live': 'polite' });
    const solution = h('div', { class: 'solution', hidden: true });
    let checked = false;
    const checkBtn = h('button', { class: 'btn primary', type: 'button' }, 'Check');
    const solBtn = h('button', { class: 'btn', type: 'button', hidden: true }, 'Show worked solution');
    const nextBtn = h('button', { class: 'btn', type: 'button', disabled: !!opts.lockNext }, opts.nextLabel || 'New question ↻');

    checkBtn.addEventListener('click', () => {
      const empty = api.fields.filter((f) => !f.filled()).length;
      if (empty) {
        result.className = 'result warn';
        result.textContent = `Answer everything first — ${empty} still empty.`;
        return;
      }
      let right = 0;
      for (const f of api.fields) if (f.check()) right++;
      const total = api.fields.length;
      if (api.afterCheck) api.afterCheck();
      const all = right === total;
      result.className = 'result ' + (all ? 'good' : 'meh');
      result.textContent = all
        ? `All ${total} correct — nice work!`
        : `${right} of ${total} correct. Fix the ones marked in red and check again, or open the worked solution.`;
      if (solution.hidden) solBtn.hidden = false;
      if (!checked) {
        checked = true;
        saveStat(topic.id, right, total);
        nextBtn.disabled = false;
        if (opts.onFirstCheck) opts.onFirstCheck(right, total);
      }
    });
    solBtn.addEventListener('click', () => {
      solution.innerHTML = '<h4>Worked solution</h4>' + topic.explain(p);
      solution.hidden = false;
      solBtn.hidden = true;
      api.fields.forEach((f) => f.reveal());
    });
    nextBtn.addEventListener('click', () => (opts.onNext ? opts.onNext() : mountProblem(host, topic, opts)));

    host.append(body, h('div', { class: 'actions' }, checkBtn, solBtn, nextBtn), result, solution);
  }

  // ---------- draggable line ----------
  // Two handles hs = [{ x, y }, { x, y }] define a line drawn across the view v.
  // onMove runs after every drag or arrow-key step. Returns the line as x → y.
  function dragLine(g, v, hs, onMove) {
    const line = G.el('line', { class: 'g-user' }, g.plot);
    const at = (x) => hs[0].y + (hs[1].y - hs[0].y) / (hs[1].x - hs[0].x) * (x - hs[0].x);
    const draw = () => {
      line.setAttribute('x1', g.X(v.xMin)); line.setAttribute('y1', g.Y(at(v.xMin)));
      line.setAttribute('x2', g.X(v.xMax)); line.setAttribute('y2', g.Y(at(v.xMax)));
      hs.forEach((hd) => { hd.node.setAttribute('transform', `translate(${g.X(hd.x)} ${g.Y(hd.y)})`); });
    };
    hs.forEach((hd, i) => {
      hd.node = G.el('g', { class: 'g-handle', tabindex: 0, role: 'slider', 'aria-label': `line handle ${i + 1}` }, g.over);
      G.el('circle', { r: 18, class: 'g-hit' }, hd.node);
      G.el('circle', { r: 7.5 }, hd.node);
      hd.node.addEventListener('pointerdown', (e) => { hd.node.setPointerCapture(e.pointerId); hd.drag = true; e.preventDefault(); });
      hd.node.addEventListener('pointerup', () => { hd.drag = false; });
      hd.node.addEventListener('pointermove', (e) => {
        if (!hd.drag) return;
        const d = g.toData(e), other = hs[1 - i];
        const x = Math.min(v.xMax - 0.1, Math.max(v.xMin + 0.1, d.x));
        if (Math.abs(x - other.x) >= 0.5) hd.x = x;
        hd.y = Math.min(v.yMax, Math.max(v.yMin, d.y));
        onMove(); draw();
      });
      hd.node.addEventListener('keydown', (e) => {
        const step = v.yGrid / 10;
        if (e.key === 'ArrowUp') hd.y = Math.min(v.yMax, hd.y + step);
        else if (e.key === 'ArrowDown') hd.y = Math.max(v.yMin, hd.y - step);
        else return;
        e.preventDefault(); onMove(); draw();
      });
    });
    draw();
    return at;
  }

  // ---------- topics ----------
  const TOPICS = [];

  // Q1 — equations
  TOPICS.push({
    id: 'eq', short: 'Equations', ref: 'Q1', title: 'Linear or nonlinear? — Equations',
    blurb: 'Spot the power of the variable.',
    idea: `A relation is <b>linear</b> when the variable is only to the <b>first power</b>, like ${V('y')} = 3${V('x')} + 2.
      If you see ${V('x')}<sup>2</sup>, ${V('x')}<sup>3</sup>, ${V('x')} in a denominator, or ${V('x')} as an exponent, it's <b>nonlinear</b>.
      Watch out: 3<sup>2</sup> is just the number 9 — squaring a <i>number</i> doesn't make it nonlinear.`,
    gen: P.genEquations,
    mount(el, p) {
      const fields = p.items.map((it) => choiceField(['Linear', 'Nonlinear'], it.linear ? 'Linear' : 'Nonlinear'));
      el.append(
        h('p', { class: 'prompt' }, 'Decide whether each equation represents a linear or a nonlinear relation.'),
        h('div', { class: 'items' }, p.items.map((it, i) => h('div', { class: 'item' },
          h('span', { class: 'tag' }, letter(i) + ')'),
          h('span', { class: 'math', html: it.html }),
          fields[i].el))),
      );
      return { fields };
    },
    explain: (p) => `<ol type="a">${p.items.map((it) =>
      `<li><span class="math">${it.html}</span> → <b>${it.linear ? 'linear' : 'nonlinear'}</b>. ${it.why}</li>`).join('')}</ol>`,
  });

  // Q2 — graphs
  TOPICS.push({
    id: 'graphs', short: 'Graphs', ref: 'Q2', title: 'Linear or nonlinear? — Graphs',
    blurb: 'Straight line or not?',
    idea: `A linear relation graphs as <b>one straight line</b> — horizontal lines count too.
      Any curve, bend, or corner means the relation is <b>nonlinear</b>. When a graph is <i>almost</i> straight, hold a ruler up to it.`,
    gen: P.genGraphs,
    mount(el, p) {
      const fields = p.items.map((it) => choiceField(['Linear', 'Nonlinear'], it.linear ? 'Linear' : 'Nonlinear'));
      el.append(
        h('p', { class: 'prompt' }, 'Decide whether each graph represents a linear or a nonlinear relation.'),
        h('div', { class: 'graph-row' }, p.items.map((it, i) => {
          const g = G.make({ xMin: -6, xMax: 6, yMin: -6, yMax: 6, xGrid: 1, yGrid: 1, xLabel: 2, yLabel: 2, centerAxes: true, width: 240, height: 240 });
          g.fn(it.f, 'g-curve');
          return h('figure', { class: 'mini' }, h('figcaption', {}, letter(i) + ')'), g.svg, fields[i].el);
        })),
      );
      return { fields };
    },
    explain: (p) => `<ol type="a">${p.items.map((it) => `<li><b>${it.linear ? 'Linear' : 'Nonlinear'}</b>. ${it.why}</li>`).join('')}</ol>`,
  });

  // Q3 — first differences
  TOPICS.push({
    id: 'diffs', short: 'First differences', ref: 'Q3', title: 'First differences',
    blurb: 'Use a table to decide linear vs nonlinear.',
    idea: `First difference = (next ${V('y')}) − (this ${V('y')}). When the ${V('x')}-values go up in <b>equal steps</b>:
      first differences all the <b>same</b> → linear; first differences <b>not all the same</b> → nonlinear.
      Always finish with a concluding statement that gives the reason.`,
    gen: P.genDifferences,
    mount(el, p) {
      const diffFields = p.diffs.map((d, i) => numField(d, { size: 4, label: `first difference ${i + 1}` }));
      const kind = selectField(['linear', 'nonlinear'], p.linear ? 'linear' : 'nonlinear', 'linear or nonlinear');
      const why = selectField(['are constant', 'are not constant'], p.linear ? 'are constant' : 'are not constant', 'reason');
      const table = h('table', { class: 'data diff' },
        h('thead', {}, h('tr', {}, h('th', {}, h('var', {}, 'x')), h('th', {}, h('var', {}, 'y')), h('th', { class: 'd' }, 'first difference'))),
        h('tbody', {}, p.xs.map((x, i) => h('tr', {},
          h('td', {}, fmt(x)), h('td', {}, fmt(p.ys[i])),
          h('td', { class: 'd' }, i > 0 ? h('div', { class: 'between' }, h('span', { class: 'brace' }, '⟩'), diffFields[i - 1].el) : null)))));
      el.append(
        h('p', { class: 'prompt' }, 'Calculate the first differences to decide whether the relation is linear or nonlinear. Then complete the concluding statement.'),
        h('div', { class: 'diff-wrap' }, table),
        h('p', { class: 'statement' }, 'The relation is ', kind.el, ' because the first differences ', why.el, '.'),
      );
      return { fields: [...diffFields, kind, why] };
    },
    explain(p) {
      const lines = p.diffs.map((d, i) => `<li>${fmt(p.ys[i + 1])} − ${par(p.ys[i])} = <b>${fmt(d)}</b></li>`).join('');
      let note = '';
      if (p.step !== 1) note += `<p>The ${V('x')}-values go up by ${p.step} each row. The steps are equal, so comparing first differences still works.</p>`;
      if (p.kind === 'bump') note += '<p>Almost all of the differences match, but not all of them. Even one mismatch makes the relation nonlinear.</p>';
      if (p.kind === 'double') note += `<p>Here each ${V('y')}-value is double the one before: the ${V('y')}-values multiply instead of adding a fixed amount.</p>`;
      return `<ul class="calc">${lines}</ul>${note}
        <p class="conclusion">The first differences ${p.linear ? `are all ${fmt(p.diffs[0])} — they are constant` : 'are not constant'},
        so the relation is <b>${p.linear ? 'linear' : 'nonlinear'}</b>.</p>`;
    },
  });

  // Independent vs dependent — one small table per pair.
  // Each pair is one field, so choosing a role for one variable sets the
  // other's role too and the two can never both be I or both be D.
  const ROLE = { I: 'independent', D: 'dependent' };
  const other = (r) => (r === 'I' ? 'D' : 'I');

  function pairRadios(it, i) {
    const names = it.indLeft ? [it.ind, it.dep] : [it.dep, it.ind];
    const answer = it.indLeft ? ['I', 'D'] : ['D', 'I'];
    let value = ['', ''];
    const radios = names.map((name, k) => ['I', 'D'].map((r) => h('input', {
      type: 'radio', name: `role-${i}-${k}`, value: r, 'aria-label': `${letter(i)}) ${name}: ${ROLE[r]}`,
      onchange() {
        value = k === 0 ? [r, other(r)] : [other(r), r];
        radios.forEach((rs, j) => rs.forEach((x) => { x.checked = x.value === value[j]; }));
        clearMark(el);
      },
    })));
    const el = h('table', { class: 'data roles' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'var-name' }, h('span', { class: 'tag' }, letter(i) + ')')),
        h('th', { class: 'role-cell', title: 'independent' }, 'I'), h('th', { class: 'role-cell', title: 'dependent' }, 'D'))),
      h('tbody', {}, names.map((name, k) => h('tr', {},
        h('td', { class: 'var-name' }, name),
        radios[k].map((x) => h('td', { class: 'role-cell' }, h('label', {}, x)))))));
    return {
      el,
      filled: () => value[0] !== '',
      check() { const ok = value[0] === answer[0]; mark(el, ok); return ok; },
      reveal() {
        if (el.classList.contains('ok')) return;
        radios.forEach((rs, k) => rs.forEach((x) => x.parentNode.parentNode.classList.toggle('answer', x.value === answer[k])));
      },
    };
  }

  TOPICS.push({
    id: 'vars', short: 'Indep. vs Dep.', ref: 'Q4–5 warm-up', title: 'Independent or dependent variable?',
    blurb: 'Which quantity depends on the other?',
    idea: `The <b>independent</b> variable (<b>I</b>) is the one you choose or that changes on its own — it goes on the horizontal axis (${V('x')}).
      The <b>dependent</b> variable (<b>D</b>) is the one whose value <i>depends on it</i> — it goes on the vertical axis (${V('y')}).
      Ask: <i>“Which one is affected by the other?”</i> The sentence order can fool you — the independent variable is not always named first.`,
    gen: P.genVarRoles,
    mount(el, p) {
      const fields = p.items.map(pairRadios);
      el.append(
        h('p', { class: 'prompt' }, 'For each pair of variables, decide which is the independent variable (I) and which is the dependent variable (D).'),
        h('div', { class: 'role-cards' }, fields.map((f) => f.el)),
      );
      return { fields };
    },
    explain: (p) => `<ol type="a">${p.items.map((it) =>
      `<li><b>Independent:</b> ${it.ind}. <b>Dependent:</b> ${it.dep}. ${it.why}</li>`).join('')}</ol>`,
  });

  // Q4–5 — rate of change & initial value
  TOPICS.push({
    id: 'rate', short: 'Rate & initial value', ref: 'Q4–5', title: 'Rate of change & initial value',
    blurb: 'Read them from tables and graphs, with units.',
    idea: `<b>Rate of change</b> = Δ${V('y')} ÷ Δ${V('x')} = (${V('y')}<sub>2</sub> − ${V('y')}<sub>1</sub>) ÷ (${V('x')}<sub>2</sub> − ${V('x')}<sub>1</sub>).
      Its units are <i>dependent unit</i> per <i>independent unit</i> (e.g. $/h).
      <b>Initial value</b> = the ${V('y')}-value when ${V('x')} = 0 (where the line meets the vertical axis).
      The <b>independent</b> variable is in the left column / on the horizontal axis; the <b>dependent</b> variable depends on it.`,
    gen: () => P.genRate(),
    mount(el, p) {
      const c = p.ctx;
      const ivH = `${c.iv} (${c.ivU})`, dvH = `${c.dv} (${c.dvU})`;
      let shown;
      if (p.mode === 'table') {
        shown = h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ivH), h('th', {}, dvH))),
          h('tbody', {}, p.xs.map((x, i) => h('tr', {}, h('td', {}, fmt(x)), h('td', {}, fmt(p.ys[i], 3))))));
      } else {
        const xMax = p.xs[p.xs.length - 1] + p.xStep;
        const lo = Math.min(0, ...p.ys, p.init), hi = Math.max(...p.ys, p.init);
        const yMin = Math.floor(lo / p.gridY) * p.gridY - (lo < 0 ? p.gridY : 0);
        const yMax = Math.ceil(hi / p.gridY) * p.gridY + p.gridY;
        const g = G.make({ xMin: 0, xMax, yMin, yMax, xGrid: p.xStep, yGrid: p.gridY, xTitle: ivH, yTitle: dvH, width: 420, height: 340 });
        g.seg(0, p.init, xMax, p.init + p.rate * xMax, 'g-curve');
        p.xs.forEach((x, i) => g.dot(x, p.ys[i]));
        shown = h('div', { class: 'graph-box' }, g.svg);
      }
      const units = [...new Set([c.rateU, c.invU, c.dvU, c.ivU])];
      const roc = numField(p.rate, { label: 'rate of change' });
      const unit = selectField(shuffle(units), c.rateU, 'units of rate of change');
      const init = numField(p.init, c.dvU === '$' ? { prefix: '$', label: 'initial value' } : { suffix: c.dvU, label: 'initial value' });
      const vars = shuffle([c.iv, c.dv]);
      const ivSel = selectField(vars, c.iv, 'independent variable');
      const dvSel = selectField(vars, c.dv, 'dependent variable');
      el.append(
        h('p', { class: 'prompt' }, `Determine the rate of change, the initial value, and the independent and dependent variables for this ${p.mode}. Include the units.`),
        h('div', { class: 'split' }, shown, h('div', { class: 'form' },
          row('Rate of change', roc.el, unit.el),
          row('Initial value', init.el),
          row('Independent variable', ivSel.el),
          row('Dependent variable', dvSel.el))),
      );
      return { fields: [roc, unit, init, ivSel, dvSel] };
    },
    explain(p) {
      const c = p.ctx, n = p.xs.length - 1;
      const [x1, y1, x2, y2] = [p.xs[0], p.ys[0], p.xs[n], p.ys[n]];
      const where = p.mode === 'table' ? 'two rows of the table' : 'two points on the line';
      const initLine = x1 === 0
        ? `<p><b>Initial value:</b> the ${c.dv.toLowerCase()} when ${c.iv.toLowerCase()} is 0 → <b>${withUnit(p.init, c.dvU)}</b>.</p>`
        : `<p><b>Initial value:</b> the ${p.mode} doesn't start at 0, so work backwards from the first point:
           ${fmt(y1, 3)} − ${par(p.rate)} × ${fmt(x1)} = <b>${withUnit(p.init, c.dvU)}</b>.
           ${p.mode === 'graph' ? 'You can also extend the line back to the vertical axis.' : ''}</p>`;
      return `<p><b>Rate of change:</b> pick ${where}, e.g. (${fmt(x1)}, ${fmt(y1, 3)}) and (${fmt(x2)}, ${fmt(y2, 3)}).</p>
        <p class="calc-line">Δ${V('y')} ÷ Δ${V('x')} = (${fmt(y2, 3)} − ${par(y1)}) ÷ (${fmt(x2)} − ${par(x1)}) = ${fmt(y2 - y1, 3)} ÷ ${fmt(x2 - x1)} = <b>${fmt(p.rate, 3)} ${c.rateU}</b></p>
        <p>Units: ${c.dv.toLowerCase()} units per ${c.iv.toLowerCase()} unit → ${c.rateU}.
        ${p.rate < 0 ? `The rate is negative because the ${c.dv.toLowerCase()} goes <i>down</i> as the ${c.iv.toLowerCase()} goes up.` : ''}</p>
        ${initLine}
        <p><b>Independent variable:</b> ${c.iv} (${c.ivU}) — ${p.mode === 'table' ? 'left column' : 'horizontal axis'}.
        <b>Dependent variable:</b> ${c.dv} (${c.dvU}) — it depends on the ${c.iv.toLowerCase()}.</p>`;
    },
  });

  // Q6–7 — line of best fit
  TOPICS.push({
    id: 'fit', short: 'Line of best fit', ref: 'Q6–7', title: 'Scatter plots & line of best fit',
    blurb: 'Drag a line through the data, then predict.',
    idea: `A <b>line of best fit</b> follows the trend of the points, with about as many points above it as below.
      <b>Interpolate</b> = predict a value <i>inside</i> the range of the data. <b>Extrapolate</b> = predict <i>beyond</i> the data
      — less reliable, because it assumes the trend keeps going.`,
    gen: P.genFit,
    mount(el, p) {
      const v = p.view, yU = p.yU;
      const g = G.make({
        xMin: v.xMin, xMax: v.xMax, xGrid: 1, xLabel: v.xMax > 10 ? 2 : 1,
        yMin: v.yMin, yMax: v.yMax, yGrid: v.yGrid / 2, yLabel: v.yGrid,
        xTitle: `${p.xName} (${p.xU})`, yTitle: `${p.yName} (${yU})`, width: 460, height: 340,
      });
      for (const x of [p.interpX, p.extrapX]) g.seg(x, v.yMin, x, v.yMax, 'g-guide');
      p.xs.forEach((x, i) => g.dot(x, p.ys[i]));

      // Two draggable handles define the student's line.
      const mean = p.ys.reduce((s, y) => s + y, 0) / p.ys.length;
      let moved = false;
      const userAt = dragLine(g, v, [{ x: p.xs[0], y: mean }, { x: p.xs[p.xs.length - 1], y: mean }],
        () => { moved = true; clearMark(box); });

      const feedback = h('p', { class: 'fit-feedback' });
      const box = h('div', { class: 'graph-box fit-box' }, g.svg, feedback);
      const fitAt = (x) => p.fit.m * x + p.fit.b;
      const range = Math.max(...p.ys) - Math.min(...p.ys);
      const lineField = {
        el: box,
        filled: () => moved,
        check() {
          const ends = [p.xs[0], p.xs[p.xs.length - 1]];
          const err = Math.max(...ends.map((x) => Math.abs(userAt(x) - fitAt(x)))) / range;
          const ok = err <= 0.12;
          mark(box, ok);
          const above = p.xs.filter((x, i) => p.ys[i] > userAt(x)).length;
          const below = p.xs.length - above;
          feedback.innerHTML = `Your line has <b>${above}</b> point${above === 1 ? '' : 's'} above and <b>${below}</b> below. `
            + (err <= 0.06 ? 'It is very close to the calculated line of best fit (dashed). '
              : ok ? 'It is close to the calculated line of best fit (dashed). '
                : 'It is quite far from the calculated line of best fit (dashed) — try to follow the trend through the middle of the points. ');
          return ok;
        },
        reveal() {},
      };
      let shownFit = false;
      const afterCheck = () => {
        if (shownFit) return;
        shownFit = true;
        g.seg(v.xMin, fitAt(v.xMin), v.xMax, fitAt(v.xMax), 'g-fit');
      };

      const kinds = ['Interpolation', 'Extrapolation'];
      const pred1 = numField(p.interpY, { tol: p.tol, suffix: yU, show: '≈ ' + fmt(p.interpY, 1), label: 'prediction 1' });
      const kind1 = selectField(kinds, 'Interpolation', 'interpolation or extrapolation');
      const pred2 = numField(p.extrapY, { tol: p.tol * 1.5, suffix: yU, show: '≈ ' + fmt(p.extrapY, 1), label: 'prediction 2' });
      const kind2 = selectField(kinds, 'Extrapolation', 'interpolation or extrapolation');
      const what = p.yName.toLowerCase();
      el.append(
        h('p', { class: 'prompt' }, p.story),
        h('div', { class: 'hscroll' }, h('table', { class: 'data horiz' }, h('tbody', {},
          h('tr', {}, h('th', {}, `${p.xName} (${p.xU})`), p.xs.map((x) => h('td', {}, fmt(x)))),
          h('tr', {}, h('th', {}, `${p.yName} (${yU})`), p.ys.map((y) => h('td', {}, fmt(y, 1))))))),
        part('a', 'The scatter plot is drawn for you. <b>Drag the two orange handles</b> to place your line of best fit.', box),
        part('b', `Use your line to predict the ${what} at <b>${fmt(p.interpX)} ${p.xU}</b>.`, h('div', { class: 'inline' }, pred1.el, h('span', {}, 'This is'), kind1.el)),
        part('c', `Use your line to predict the ${what} at <b>${fmt(p.extrapX)} ${p.xU}</b>.`, h('div', { class: 'inline' }, pred2.el, h('span', {}, 'This is'), kind2.el)),
      );
      return { fields: [lineField, pred1, kind1, pred2, kind2], afterCheck };
    },
    explain(p) {
      const first = p.xs[0], last = p.xs[p.xs.length - 1];
      return `<p>The dashed line is the calculated line of best fit: ${V('y')} ≈ ${expr([[P.round(p.fit.m, 2), V('x')], [P.round(p.fit.b, 1), '']])}.
        Your line doesn't have to match it exactly — any answer within about ±${fmt(p.tol, 1)} ${p.yU} is accepted.</p>
        <p><b>${fmt(p.interpX)} ${p.xU}</b> is inside the data (${fmt(first)} to ${fmt(last)} ${p.xU}), so this is <b>interpolation</b>:
        the line gives about <b>${fmt(p.interpY, 1)} ${p.yU}</b>.</p>
        <p><b>${fmt(p.extrapX)} ${p.xU}</b> is beyond the data, so this is <b>extrapolation</b>: extend the line to get about
        <b>${fmt(p.extrapY, 1)} ${p.yU}</b>. It assumes the trend continues, so it's less reliable.</p>`;
    },
  });

  // Q8–9 — fixed fee + rate word problems
  TOPICS.push({
    id: 'fee', short: 'Word problems', ref: 'Q8–9', title: 'Building a linear model',
    blurb: 'Fixed fee + cost per item: table, graph, equation.',
    idea: `“A fixed fee plus a cost for each item” is a linear relation: <b>C = (rate)·${V('n')} + (fixed fee)</b>.
      The <b>rate of change</b> is the cost per item, and the <b>initial value</b> is the fixed fee (the cost when ${V('n')} = 0).
      Always define your variables before writing the equation.`,
    gen: P.genFee,
    mount(el, p) {
      const c = p.ctx, L = c.letter, dv = 'Total cost ($)';
      const vars = shuffle([c.iv, dv]);
      const ivSel = selectField(vars, c.iv, 'independent variable');
      const dvSel = selectField(vars, dv, 'dependent variable');
      const roc = numField(p.rate, { prefix: '$', suffix: `per ${c.item}`, size: 5, label: 'rate of change' });
      const init = numField(p.fee, { prefix: '$', size: 5, label: 'initial value' });
      const cells = p.xs.map((x, i) => numField(p.ys[i], { prefix: '$', size: 5, label: `cost for ${x}` }));
      const extrap = numField(p.extrapCost, { prefix: '$', size: 7, label: 'extrapolated cost' });
      const m = numField(p.rate, { size: 4, label: 'coefficient' });
      const b = numField(p.fee, { size: 4, label: 'constant' });
      const budget = numField(p.budgetN, { suffix: c.items, size: 4, label: 'budget answer' });

      const xMax = p.xs[p.xs.length - 1] + (p.xs[1] - p.xs[0]);
      const top = p.fee + p.rate * xMax;
      const yGrid = niceStep(top / 10);
      const g = G.make({ xMin: 0, xMax, xGrid: p.xs[1] - p.xs[0], yMin: 0, yMax: Math.ceil(top / yGrid) * yGrid, yGrid, yLabel: yGrid * 2, xTitle: c.iv, yTitle: dv, width: 380, height: 300 });
      const dots = G.el('g', {}, g.over);
      const plotTable = (checked) => {
        dots.replaceChildren();
        p.xs.forEach((x, i) => {
          const y = parseNum(cells[i].input.value);
          if (Number.isFinite(y)) g.dot(x, y, checked ? (close(y, p.ys[i]) ? 'g-pt ok' : 'g-pt bad') : 'g-pt', 5, dots);
        });
      };
      cells.forEach((f) => f.input.addEventListener('input', () => plotTable(false)));

      const table = h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, c.iv), h('th', {}, dv))),
        h('tbody', {}, p.xs.map((x, i) => h('tr', {}, h('td', {}, fmt(x)), h('td', {}, cells[i].el)))));

      el.append(
        h('p', { class: 'prompt story' }, p.story),
        part('a', 'State the independent and dependent variables.', h('div', { class: 'form' }, row('Independent', ivSel.el), row('Dependent', dvSel.el))),
        part('b', 'Determine the rate of change and the initial value.', h('div', { class: 'form' }, row('Rate of change', roc.el), row('Initial value', init.el))),
        part('c', 'Complete the table of values. <span class="muted">(d) Your points are graphed as you type — do they line up?</span>',
          h('div', { class: 'split' }, table, h('div', { class: 'graph-box' }, g.svg))),
        part('e', `Extrapolate to find ${c.costQ(p.extrapN)}.`, extrap.el),
        part('f', `Write an equation for this relation. Let <var>C</var> be the total cost ($) and ${V(L)} be the ${c.iv.toLowerCase().replace(/ \(.*\)/, '')}.`,
          h('div', { class: 'inline eqn' }, h('span', { class: 'grp' }, h('var', {}, 'C'), ' =', m.el, h('var', {}, L)), h('span', { class: 'grp' }, '+', b.el))),
        part('g', `Use your equation to determine ${c.budgetQ(p.budget)}.`, budget.el),
      );
      let line = null;
      return {
        fields: [ivSel, dvSel, roc, init, ...cells, extrap, m, b, budget],
        afterCheck() {
          if (!line) line = g.seg(0, p.fee, xMax, top, 'g-curve faint');
          plotTable(true);
        },
      };
    },
    explain(p) {
      const c = p.ctx, L = c.letter;
      const exact = (p.budget - p.fee) / p.rate;
      return `<ol type="a">
        <li><b>Independent:</b> ${c.iv} — you choose it. <b>Dependent:</b> Total cost ($) — it depends on how many ${c.items}.</li>
        <li><b>Rate of change</b> = ${money(p.rate)} per ${c.item} (the cost goes up by ${money(p.rate)} for each extra ${c.item}).
          <b>Initial value</b> = ${money(p.fee)} (the cost for 0 ${c.items}: the fixed fee).</li>
        <li>Each cost = ${money(p.fee)} + ${money(p.rate)} × (number of ${c.items}): ${p.xs.map((x, i) => `${fmt(x)} → ${money(p.ys[i])}`).join(', ')}.</li>
        <li>The points lie on a straight line that starts at (0, ${fmt(p.fee)}) on the vertical axis.</li>
        <li>C = ${money(p.fee)} + ${money(p.rate)} × ${p.extrapN} = <b>${money(p.extrapCost)}</b>.</li>
        <li><var>C</var> = ${fmt(p.rate)}${V(L)} + ${fmt(p.fee)}, where <var>C</var> is the total cost ($) and ${V(L)} is the ${c.iv.toLowerCase().replace(/ \(.*\)/, '')}.</li>
        <li>${fmt(p.budget)} = ${fmt(p.rate)}${V(L)} + ${fmt(p.fee)} → ${fmt(p.budget - p.fee)} = ${fmt(p.rate)}${V(L)} → ${V(L)} = ${fmt(p.budget - p.fee)} ÷ ${fmt(p.rate)} = ${fmt(exact, 2)}.
          ${Number.isInteger(P.round(exact, 6)) ? '' : `You can't pay for part of one, so round <i>down</i> (rounding up would cost more than ${money(p.budget)}).`}
          Answer: <b>${p.budgetN} ${c.items}</b>.</li>
      </ol>`;
    },
  });

  // Q10 — describing the rate of change
  TOPICS.push({
    id: 'trend', short: 'Describing change', ref: 'Q10', title: 'Describing the rate of change',
    blurb: 'Positive, negative or zero — constant, increasing or decreasing?',
    idea: `<b>Sign:</b> the graph goes up (left → right) → <b>positive</b>; goes down → <b>negative</b>; flat → <b>zero</b>.
      <b>Behaviour:</b> a straight line → <b>constant</b>; getting steeper → <b>increasing</b>; flattening out → <b>decreasing</b>.
      A graph can go <i>up</i> while its rate of change is <i>decreasing</i> — it's still climbing, just more slowly.`,
    gen: P.genTrend,
    mount(el, p) {
      const g = G.make({ xMin: 0, xMax: 10, yMin: 0, yMax: 10, xGrid: 1, yGrid: 1, xLabel: 2, yLabel: 2, width: 360, height: 320 });
      g.fn(p.f, 'g-curve', 0, 10);
      const sign = choiceField(['Positive', 'Negative', 'Zero'], p.sign, 'sign of the rate of change');
      const trend = choiceField(['Constant', 'Increasing', 'Decreasing'], p.trend, 'how the rate of change behaves');

      // Tangent explorer, revealed after checking.
      const tangent = G.el('line', { class: 'g-tangent' }, g.plot);
      const pt = g.dot(0, 0, 'g-pt accent', 5);
      const readout = h('p', { class: 'readout' });
      const slider = h('input', { type: 'range', min: 0.5, max: 9.5, step: 0.1, value: 1, 'aria-label': 'x position' });
      const explorer = h('div', { class: 'explorer', hidden: true },
        h('p', { class: 'muted' }, 'Slide along the graph and watch the slope of the tangent line (the rate of change at that point):'),
        slider, readout);
      const drawTangent = () => {
        const x = +slider.value, y = p.f(x), s = slopeAt(p.f, x);
        tangent.setAttribute('x1', g.X(x - 3)); tangent.setAttribute('y1', g.Y(y - 3 * s));
        tangent.setAttribute('x2', g.X(x + 3)); tangent.setAttribute('y2', g.Y(y + 3 * s));
        pt.setAttribute('cx', g.X(x)); pt.setAttribute('cy', g.Y(y));
        readout.innerHTML = `At ${V('x')} = ${(+x).toFixed(1)}, the rate of change is <b>${fmt(s, 2)}</b>`;
      };
      slider.addEventListener('input', drawTangent);
      tangent.style.display = 'none'; pt.style.display = 'none';

      el.append(
        h('p', { class: 'prompt' }, 'Describe the rate of change shown by this graph.'),
        h('div', { class: 'split' },
          h('div', { class: 'graph-box' }, g.svg, explorer),
          h('div', { class: 'form' }, row('The rate of change is', sign.el), row('and it is', trend.el))),
      );
      return {
        fields: [sign, trend],
        afterCheck() {
          explorer.hidden = false;
          tangent.style.display = ''; pt.style.display = '';
          drawTangent();
        },
      };
    },
    explain(p) {
      const s = [1, 5, 9].map((x) => `${V('x')} = ${x}: <b>${fmt(slopeAt(p.f, x), 2)}</b>`).join(' · ');
      return `<p><b>${p.sign}, ${p.trend.toLowerCase()}.</b> ${p.why}</p><p>Slope of the tangent at ${s}</p>`;
    },
  });

  // Q11 — comparing two plans
  TOPICS.push({
    id: 'compare', short: 'Comparing plans', ref: 'Q11', title: 'Comparing two plans',
    blurb: 'Where do the lines cross, and which deal is better?',
    idea: `Write an equation for each option, then find where the lines <b>intersect</b> (set the equations equal).
      Before the intersection one option is cheaper; after it, the other one is.
      When a question asks <i>when</i> to choose an option, answer with the <b>independent variable</b> (e.g. “for 6 or more balloons”), not a dollar amount.`,
    gen: P.genCompare,
    mount(el, p) {
      const { A, B, ctx } = p;
      const xMax = Math.max(12, Math.min(20, Math.ceil(p.nStar * 1.8)));
      const top = Math.max(A.r * xMax + A.f, B.r * xMax + B.f);
      const yGrid = niceStep(top / 12);
      const g = G.make({ xMin: 0, xMax, xGrid: 1, xLabel: 2, yMin: 0, yMax: Math.ceil(top / yGrid) * yGrid, yGrid, yLabel: yGrid * 2, xTitle: `Number of ${ctx.items}`, yTitle: 'Total cost ($)', width: 460, height: 340 });
      g.seg(0, A.f, xMax, A.r * xMax + A.f, 'g-curve');
      g.seg(0, B.f, xMax, B.r * xMax + B.f, 'g-curve-2');

      // Hover/tap to compare costs at a whole number of items.
      const guide = G.el('line', { class: 'g-guide', y1: g.box.t, y2: g.box.t + g.box.h }, g.over);
      const dA = g.dot(0, 0, 'g-pt line1', 5), dB = g.dot(0, 0, 'g-pt line2', 5);
      const readout = h('p', { class: 'readout' }, `Hover over (or tap) the graph to compare costs.`);
      const hide = (on) => [guide, dA, dB].forEach((n) => { n.style.display = on ? '' : 'none'; });
      hide(false);
      const show = (e) => {
        const n = Math.max(0, Math.min(xMax, Math.round(g.toData(e).x)));
        const ca = A.r * n + A.f, cb = B.r * n + B.f;
        guide.setAttribute('x1', g.X(n)); guide.setAttribute('x2', g.X(n));
        dA.setAttribute('cx', g.X(n)); dA.setAttribute('cy', g.Y(ca));
        dB.setAttribute('cx', g.X(n)); dB.setAttribute('cy', g.Y(cb));
        hide(true);
        readout.innerHTML = `${n} ${n === 1 ? ctx.item : ctx.items}: <span class="k1">${A.name} ${money(ca)}</span> · <span class="k2">${B.name} ${money(cb)}</span>`;
      };
      g.svg.addEventListener('pointermove', show);
      g.svg.addEventListener('pointerdown', show);
      g.svg.addEventListener('pointerleave', () => hide(false));

      const eq = (c) => {
        const m = numField(c.r, { size: 4, label: `${c.name} rate` }), b = numField(c.f, { size: 4, label: `${c.name} fee` });
        return { fields: [m, b], el: h('div', { class: 'inline eqn' }, h('span', { class: 'who' }, c.name + ':'), h('span', { class: 'grp' }, h('var', {}, 'C'), ' =', m.el, h('var', {}, 'n')), h('span', { class: 'grp' }, '+', b.el)) };
      };
      const eA = eq(A), eB = eq(B);
      const nF = numField(p.nStar, { tol: 0.06, size: 5, show: fmt(p.nStar, 2), label: 'intersection n' });
      const cF = numField(p.cStar, { tol: 0.06, prefix: '$', size: 6, show: money(p.cStar), label: 'intersection cost' });
      const bF = numField(p.bMax, { size: 3, suffix: ctx.items, label: `most ${ctx.items} where ${B.name} is cheaper` });
      const aF = numField(p.aMin, { size: 3, suffix: ctx.items, label: `fewest ${ctx.items} where ${A.name} is cheaper` });

      el.append(
        h('p', { class: 'prompt story' }, p.story),
        h('div', { class: 'graph-box' }, h('div', { class: 'legend' }, h('span', { class: 'k1' }, A.name), h('span', { class: 'k2' }, B.name)), g.svg, readout),
        part('a', `Write an equation for each company. Let <var>C</var> be the total cost ($) and ${V('n')} the number of ${ctx.items}.`, eA.el, eB.el),
        part('b', 'Where do the two lines intersect? (Round to 2 decimal places.)',
          h('div', { class: 'inline' }, h('span', { class: 'grp' }, h('var', {}, 'n'), ' =', nF.el), h('span', { class: 'grp gap' }, h('var', {}, 'C'), ' =', cF.el))),
        part('c', `When should ${p.person} choose each company?`,
          h('div', { class: 'inline' }, `${B.name} is cheaper for at most`, bF.el),
          h('div', { class: 'inline' }, `${A.name} is cheaper for at least`, aF.el)),
      );
      return { fields: [...eA.fields, ...eB.fields, nF, cF, bF, aF] };
    },
    explain(p) {
      const { A, B, ctx } = p;
      const whole = Number.isInteger(P.round(p.nStar, 6));
      return `<ol type="a">
        <li>Rate per ${ctx.item} goes with ${V('n')}; the fixed fee is the initial value.<br>
          ${A.name}: <var>C</var> = ${fmt(A.r)}${V('n')} + ${fmt(A.f)} &nbsp;·&nbsp; ${B.name}: <var>C</var> = ${fmt(B.r)}${V('n')} + ${fmt(B.f)}</li>
        <li>Set them equal: ${fmt(A.r)}${V('n')} + ${fmt(A.f)} = ${fmt(B.r)}${V('n')} + ${fmt(B.f)}
          → ${fmt(A.f - B.f)} = ${fmt(B.r - A.r)}${V('n')} → ${V('n')} = ${fmt(A.f - B.f)} ÷ ${fmt(B.r - A.r)} ≈ <b>${fmt(p.nStar, 2)}</b>.<br>
          Cost: <var>C</var> = ${fmt(A.r)}(${fmt(p.nStar, 2)}) + ${fmt(A.f)} ≈ <b>${money(p.cStar)}</b>. The lines cross at about (${fmt(p.nStar, 2)}, ${fmt(p.cStar, 2)}).</li>
        <li>Left of the intersection, ${poss(B.name)} line is lower (smaller fixed fee). Right of it, ${poss(A.name)} line is lower (cheaper per ${ctx.item}).
          ${whole ? `At exactly ${fmt(p.nStar)} ${ctx.items} they cost the same.` : `You can't order ${fmt(p.nStar, 2)} ${ctx.items}, so look at whole numbers on each side.`}<br>
          <b>${B.name}</b> for ${p.bMax} ${ctx.items} or fewer; <b>${A.name}</b> for ${p.aMin} ${ctx.items} or more.<br>
          <span class="callout">The question asks <i>when</i> — answer with a number of ${ctx.items}, not a dollar amount.</span></li>
      </ol>`;
    },
  });

  const byId = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

  // ---------- views ----------
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');

  function statLine(id) {
    const s = loadStats()[id];
    if (!s || !s.total) return h('p', { class: 'stat muted' }, 'Not practised yet');
    const pct = Math.round(100 * s.right / s.total);
    return h('p', { class: 'stat' }, h('span', { class: 'meter' }, h('span', { style: `width:${pct}%` })), `${s.n} done · ${pct}% correct`);
  }

  function renderHome() {
    app.replaceChildren(
      h('section', { class: 'hero' },
        h('h1', {}, 'Linear relations practice'),
        h('p', {}, 'Every question is freshly generated with new numbers and contexts, so you practise the method — not the answers. Check your work, fix what\'s red, then open the worked solution.')),
      h('div', { class: 'cards' },
        h('a', { class: 'card test-card', href: '#/test' },
          h('span', { class: 'ref' }, 'All topics'),
          h('h3', {}, 'Practice test →'),
          h('p', {}, `${TOPICS.length} questions, one from each topic, with a score at the end.`)),
        TOPICS.map((t) => h('a', { class: 'card', href: `#/topic/${t.id}` },
          h('span', { class: 'ref' }, `Like review ${t.ref}`),
          h('h3', {}, t.title),
          h('p', {}, t.blurb),
          statLine(t.id))),
        h('a', { class: 'card', href: '#/advanced' },
          h('span', { class: 'ref' }, 'Advanced'),
          h('h3', {}, 'Variance & lines of best fit'),
          h('p', {}, 'Why do lines of best fit vary more when the data is spread out?'))),
    );
  }

  function topicHeader(t, extra) {
    return h('div', { class: 'topic-head' },
      h('span', { class: 'ref' }, extra || `Like review ${t.ref}`),
      h('h2', {}, t.title),
      h('details', { class: 'idea', open: true }, h('summary', {}, 'Key idea'), h('div', { html: t.idea })));
  }

  function renderTopic(t) {
    const host = h('div', { class: 'card problem' });
    app.replaceChildren(topicHeader(t), host);
    mountProblem(host, t);
  }

  function renderTest() {
    const results = [];
    let i = 0;
    const step = () => {
      if (i === TOPICS.length) return summary();
      const t = TOPICS[i];
      const host = h('div', { class: 'card problem' });
      const bar = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': TOPICS.length, 'aria-valuenow': i },
        h('span', { style: `width:${100 * i / TOPICS.length}%` }));
      app.replaceChildren(bar, topicHeader(t, `Practice test · question ${i + 1} of ${TOPICS.length}`), host);
      mountProblem(host, t, {
        lockNext: true,
        nextLabel: i === TOPICS.length - 1 ? 'See my results →' : 'Next question →',
        onFirstCheck: (right, total) => { results[i] = { t, right, total }; },
        onNext: () => { i++; step(); window.scrollTo(0, 0); },
      });
    };
    const summary = () => {
      const right = results.reduce((s, r) => s + r.right, 0), total = results.reduce((s, r) => s + r.total, 0);
      const pct = Math.round(100 * right / total);
      const weak = results.filter((r) => r.right / r.total < 0.8);
      app.replaceChildren(h('div', { class: 'card summary' },
        h('h2', {}, 'Practice test results'),
        h('p', { class: 'big' }, `${pct}%`, h('span', { class: 'muted' }, ` (${right} of ${total} answers right on the first try)`)),
        h('table', { class: 'results' }, h('tbody', {}, results.map((r) => {
          const rp = Math.round(100 * r.right / r.total);
          return h('tr', {},
            h('td', {}, h('a', { href: `#/topic/${r.t.id}` }, r.t.title)),
            h('td', { class: 'meter-cell' }, h('span', { class: 'meter' }, h('span', { style: `width:${rp}%` }))),
            h('td', { class: 'num' }, `${r.right}/${r.total}`));
        }))),
        weak.length
          ? h('p', {}, 'Worth more practice: ', ...weak.flatMap((r, k) => [k ? ', ' : '', h('a', { href: `#/topic/${r.t.id}` }, r.t.short)]), '.')
          : h('p', {}, 'Every topic was 80% or better. You\'re ready!'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', type: 'button', onclick: renderTest }, 'Take another practice test'),
          h('a', { class: 'btn', href: '#/' }, 'Home'))));
    };
    step();
  }

  // ---------- advanced: variance ----------
  // Fit a line to small samples drawn alternately from two populations, then
  // compare how much the fitted lines vary. Populations, fits and the sample
  // on screen are kept in localStorage so a reload picks up where it left off.
  const VR = P.VARIANCE, VSTORE = 'linear-relations-variance';
  const VTOTAL = 2 * VR.rounds, VNAMES = ['A', 'B'];
  const VIEW = { xMin: 0, xMax: VR.xMax, yMin: 0, yMax: VR.yMax, yGrid: 1 };
  const ADVANCED = {
    title: 'Variance: how much does a line of best fit wobble?',
    idea: `A scatter plot usually shows a <b>sample</b> — a few points out of a much bigger <b>population</b>.
      A different sample gives a slightly different line of best fit. <b>Variance</b> measures how spread out the points are around the trend.
      When the variance is <b>large</b>, two samples can lean quite differently, so their lines of best fit <b>vary more</b>.
      You'll fit ${VTOTAL} lines, switching between distributions A and B, then see all of your lines together.`,
  };

  function loadVariance() {
    try {
      const s = JSON.parse(localStorage.getItem(VSTORE));
      if (s && Array.isArray(s.fits) && s.dists?.length === 2 && s.dists.every((d) => d.pts?.length === VR.n)) return s;
    } catch { /* fall through to fresh distributions */ }
    return null;
  }
  function saveVariance(s) {
    try { localStorage.setItem(VSTORE, JSON.stringify(s)); } catch { /* storage blocked: just not remembered */ }
  }
  function freshVariance() {
    try { localStorage.removeItem(VSTORE); } catch { /* ignore */ }
    const s = { dists: P.genVarianceDists(), fits: [], sample: null, flip: null };
    saveVariance(s);
    return s;
  }

  const varPlot = (width, height) => G.make({ xMin: 0, xMax: VR.xMax, yMin: 0, yMax: VR.yMax, xGrid: 1, yGrid: 1, xLabel: 2, yLabel: 2, width, height });
  const distTag = (d) => h('span', { class: `dist-tag k${d + 1}` }, `Distribution ${VNAMES[d]}`);

  function renderAdvanced() {
    let s = loadVariance() || freshVariance();
    const host = h('div', { class: 'card problem' });
    const restartBtn = (primary) => h('button', {
      class: primary ? 'btn primary' : 'btn', type: 'button',
      onclick() { s = freshVariance(); draw(); window.scrollTo(0, 0); },
    }, 'Restart with new distributions ↻');

    const fitStep = () => {
      const k = s.fits.length, d = k % 2, dist = s.dists[d];
      if (!s.sample || !s.flip) { s.sample = P.sampleIdx(VR.n, VR.sample); s.flip = P.genFlip(); saveVariance(s); }
      const flip = s.flip;
      const pts = s.sample.map((i) => P.flipPt(dist.pts[i], flip));
      const g = varPlot(460, 380);
      pts.forEach(([x, y]) => g.dot(x, y));
      const xs = pts.map((pt) => pt[0]);
      const mean = pts.reduce((t, pt) => t + pt[1], 0) / pts.length;
      const at = dragLine(g, VIEW, [{ x: Math.min(...xs), y: mean }, { x: Math.max(...xs), y: mean }], () => { save.disabled = false; });
      const save = h('button', {
        class: 'btn primary', type: 'button', disabled: true,
        onclick() {
          // The student fitted the flipped plot; store the line on the original axes.
          const { m, b } = P.unflipLine(at(1) - at(0), at(0), flip);
          s.fits.push({ d, sample: s.sample, flip, m: P.round(m, 4), b: P.round(b, 4) });
          s.sample = s.flip = null;
          saveVariance(s);
          draw();
        },
      }, k === VTOTAL - 1 ? 'Save line & see results →' : 'Save this line →');
      const done = [0, 1].map((j) => s.fits.filter((f) => f.d === j).length);
      host.replaceChildren(
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': VTOTAL, 'aria-valuenow': k },
          h('span', { style: `width:${100 * k / VTOTAL}%` })),
        h('p', { class: 'prompt' }, `Fit ${k + 1} of ${VTOTAL} · `, distTag(d),
          h('span', { class: 'muted' }, ` (A: ${done[0]} of ${VR.rounds} done · B: ${done[1]} of ${VR.rounds} done)`)),
        h('p', {}, `These ${VR.sample} points are a random sample from distribution ${VNAMES[d]}. `,
          h('b', {}, 'Drag the two orange handles'), ' to place your line of best fit, then save it.'),
        h('div', { class: 'graph-box' }, g.svg),
        h('div', { class: 'actions' }, save, restartBtn(false)),
      );
    };

    const results = () => {
      const stats = [0, 1].map((d) => {
        const ms = s.fits.filter((f) => f.d === d).map((f) => f.m);
        return { lo: Math.min(...ms), hi: Math.max(...ms), range: Math.max(...ms) - Math.min(...ms) };
      });
      const wide = s.dists[0].sd > s.dists[1].sd ? 0 : 1, tight = 1 - wide;
      const figs = [0, 1].map((d) => {
        const g = varPlot(420, 360);
        const pop = G.el('g', { class: `g-pop k${d + 1}` }, g.plot);
        s.dists[d].pts.forEach(([x, y]) => g.dot(x, y, 'g-pt', 2.6, pop));
        s.fits.filter((f) => f.d === d).forEach((f) => g.seg(0, f.b, VR.xMax, f.b + f.m * VR.xMax, `g-try k${d + 1}`));
        const { m, b } = s.dists[d].fit;
        g.seg(0, b, VR.xMax, b + m * VR.xMax, 'g-fit');
        const st = stats[d];
        return h('figure', { class: 'mini var-fig' },
          h('figcaption', {}, distTag(d), d === wide ? ' · more spread out' : ' · less spread out'),
          g.svg,
          h('p', { class: 'readout' }, `Slopes of your ${VR.rounds} lines: ${fmt(st.lo)} to ${fmt(st.hi)} `,
            h('span', { class: 'muted' }, `(a range of ${fmt(st.range)})`)));
      });
      const W = VNAMES[wide], T = VNAMES[tight];
      const asExpected = stats[wide].range > stats[tight].range;
      host.replaceChildren(
        h('h2', { class: 'var-h' }, 'All of your lines'),
        h('p', {}, `Each graph shows the whole distribution (all ${VR.n} points), your ${VR.rounds} lines on top, and the dashed line of best fit for the whole distribution.`),
        h('div', { class: 'var-pair' }, figs),
        h('div', { class: 'solution' },
          h('h4', {}, 'What happened?'),
          h('p', { html: `The points in distribution <b>${W}</b> are much more spread out around the trend — it has a <b>larger variance</b> than distribution <b>${T}</b>.
            Each sample of ${VR.sample} points from ${W} can lean a different way, so a line of best fit through one sample can be quite different from the next.` }),
          h('p', {
            html: asExpected
              ? `That's what your lines show: the slopes for ${W} ranged by <b>${fmt(stats[wide].range)}</b>, compared with only <b>${fmt(stats[tight].range)}</b> for ${T}. The lines for ${W} fan out much more.`
              : `This time your slopes for ${W} ranged by <b>${fmt(stats[wide].range)}</b> and for ${T} by <b>${fmt(stats[tight].range)}</b> — not the pattern we'd expect. With only ${VR.rounds} samples each, that can happen by chance. Try again with new distributions!`,
          }),
          h('p', {}, 'Takeaway: the more spread out the data, the less you should trust a line of best fit drawn from only a few points.')),
        h('div', { class: 'actions' }, restartBtn(true), h('a', { class: 'btn', href: '#/' }, 'Home')),
      );
    };

    const draw = () => (s.fits.length < VTOTAL ? fitStep : results)();
    app.replaceChildren(topicHeader(ADVANCED, 'Advanced'), host);
    draw();
  }

  // Built once so the strip keeps its scroll position; only the active chip changes.
  let navBuilt = false;
  function renderNav(active) {
    if (!navBuilt) {
      const link = (href, label, key) => h('a', { href, 'data-key': key }, label);
      nav.replaceChildren(link('#/', 'Home', 'home'), ...TOPICS.map((t) => link(`#/topic/${t.id}`, t.short, t.id)), link('#/test', 'Practice test', 'test'), link('#/advanced', 'Advanced', 'advanced'));
    }
    let current = null;
    for (const a of nav.children) {
      const on = a.dataset.key === active;
      a.classList.toggle('active', on);
      if (on) { a.setAttribute('aria-current', 'page'); current = a; } else a.removeAttribute('aria-current');
    }
    // Centre the active chip within the strip (scrolls the nav only, never the page).
    if (current && nav.scrollWidth > nav.clientWidth) {
      const left = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
      nav.scrollTo({ left: Math.max(0, left), behavior: navBuilt ? 'smooth' : 'auto' });
    }
    navBuilt = true;
  }

  function route() {
    const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
    if (view === 'topic' && byId[id]) { renderNav(id); renderTopic(byId[id]); }
    else if (view === 'test') { renderNav('test'); renderTest(); }
    else if (view === 'advanced') { renderNav('advanced'); renderAdvanced(); }
    else { renderNav('home'); renderHome(); }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
