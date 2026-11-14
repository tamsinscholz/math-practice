// Small SVG coordinate-plane builder. All colours come from CSS classes so
// graphs follow the light/dark theme.
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let clipId = 0;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function label(v) {
    const r = Math.round(v * 100) / 100;
    return (r < 0 ? '−' : '') + Math.abs(r);
  }

  // o: { xMin, xMax, yMin, yMax, xGrid, yGrid, xLabel, yLabel, xTitle, yTitle,
  //      width, height, centerAxes }
  function make(o) {
    const W = o.width || 400, H = o.height || 320;
    const m = { l: o.yTitle ? 58 : 34, r: 12, t: 12, b: o.xTitle ? 46 : 28 };
    if (o.centerAxes) { m.l = 12; m.b = 12; }
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = (x) => m.l + (x - o.xMin) / (o.xMax - o.xMin) * pw;
    const Y = (y) => m.t + (o.yMax - y) / (o.yMax - o.yMin) * ph;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'graph' });

    const xLabel = o.xLabel || o.xGrid, yLabel = o.yLabel || o.yGrid;
    const onStep = (v, s) => Math.abs(v / s - Math.round(v / s)) < 1e-6;
    const ax = o.centerAxes && o.yMin < 0 && o.yMax > 0 ? Y(0) : Y(o.yMin);
    const ay = o.centerAxes && o.xMin < 0 && o.xMax > 0 ? X(0) : X(o.xMin);

    const grid = el('g', { class: 'g-grid' }, svg);
    const labels = el('g', { class: 'g-label' }, svg);
    for (let i = Math.ceil(o.xMin / o.xGrid - 1e-9); i * o.xGrid <= o.xMax + 1e-9; i++) {
      const x = i * o.xGrid;
      el('line', { x1: X(x), x2: X(x), y1: m.t, y2: m.t + ph }, grid);
      if (onStep(x, xLabel) && !(o.centerAxes && x === 0)) {
        el('text', { x: X(x), y: ax + 14, 'text-anchor': 'middle' }, labels).textContent = label(x);
      }
    }
    for (let i = Math.ceil(o.yMin / o.yGrid - 1e-9); i * o.yGrid <= o.yMax + 1e-9; i++) {
      const y = i * o.yGrid;
      el('line', { x1: m.l, x2: m.l + pw, y1: Y(y), y2: Y(y) }, grid);
      if (onStep(y, yLabel) && !(o.centerAxes && y === 0)) {
        el('text', { x: ay - 5, y: Y(y) + 4, 'text-anchor': 'end' }, labels).textContent = label(y);
      }
    }
    const axes = el('g', { class: 'g-axis' }, svg);
    el('line', { x1: m.l, x2: m.l + pw, y1: ax, y2: ax }, axes);
    el('line', { x1: ay, x2: ay, y1: m.t, y2: m.t + ph }, axes);
    if (o.centerAxes) {
      el('text', { x: m.l + pw - 4, y: ax - 6, 'text-anchor': 'end', class: 'g-var' }, svg).textContent = 'x';
      el('text', { x: ay + 6, y: m.t + 12, class: 'g-var' }, svg).textContent = 'y';
    }
    if (o.xTitle) el('text', { x: m.l + pw / 2, y: H - 8, 'text-anchor': 'middle', class: 'g-title' }, svg).textContent = o.xTitle;
    if (o.yTitle) {
      el('text', { x: 0, y: 0, 'text-anchor': 'middle', class: 'g-title', transform: `translate(14 ${m.t + ph / 2}) rotate(-90)` }, svg).textContent = o.yTitle;
    }

    const id = 'clip' + ++clipId;
    el('rect', { x: m.l, y: m.t, width: pw, height: ph }, el('clipPath', { id }, el('defs', {}, svg)));
    const plot = el('g', { 'clip-path': `url(#${id})` }, svg);
    const over = el('g', {}, svg); // unclipped layer for points and handles

    const span = o.yMax - o.yMin;
    return {
      svg, X, Y, plot, over, el,
      box: { l: m.l, t: m.t, w: pw, h: ph },
      fn(f, cls, x0 = o.xMin, x1 = o.xMax, parent = plot) {
        let d = '', pen = false;
        for (let i = 0; i <= 240; i++) {
          const x = x0 + (x1 - x0) * i / 240, y = f(x);
          if (!Number.isFinite(y) || y > o.yMax + span || y < o.yMin - span) { pen = false; continue; }
          d += (pen ? 'L' : 'M') + X(x).toFixed(2) + ' ' + Y(y).toFixed(2);
          pen = true;
        }
        return el('path', { d, class: cls }, parent);
      },
      seg(x1, y1, x2, y2, cls, parent = plot) {
        return el('line', { x1: X(x1), y1: Y(y1), x2: X(x2), y2: Y(y2), class: cls }, parent);
      },
      dot(x, y, cls = 'g-pt', r = 4.5, parent = over) {
        return el('circle', { cx: X(x), cy: Y(y), r, class: cls }, parent);
      },
      // Pointer event → data coordinates.
      toData(evt) {
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX; pt.y = evt.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        return {
          x: o.xMin + (p.x - m.l) / pw * (o.xMax - o.xMin),
          y: o.yMax - (p.y - m.t) / ph * (o.yMax - o.yMin),
        };
      },
    };
  }

  root.Graph = { make, el };
})(window);
