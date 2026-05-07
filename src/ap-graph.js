// Action potential waveform canvas widget.
// Draws a realistic voltage-vs-time curve with phase annotations,
// animated in real time as the AP wave travels the axon.

const V_MIN = -90, V_MAX = 52, V_RANGE = V_MAX - V_MIN;

// Returns membrane voltage (mV) for normalised time t ∈ [0, 1] (= 0–8 ms).
function apVoltage(t) {
  const ms = t * 8;
  if (ms < 1.0) return -70 + (ms / 1.0) * 15;                     // slow ramp to threshold
  if (ms < 1.8) return -55 + ((ms - 1.0) / 0.8) * 95;             // rapid depolarisation
  if (ms < 3.2) return  40 - ((ms - 1.8) / 1.4) * 120;            // repolarisation
  if (ms < 5.0) return -80 + ((ms - 3.2) / 1.8) * 8;              // hyperpolarisation
  return -72 + ((ms - 5.0) / 3.0) * 2;                             // slow recovery
}

const PHASES = [
  { t: 0.00, x: 0.02, label: 'Resting',       col: '#4e5d6e' },
  { t: 0.11, x: 0.14, label: 'Depol.',         col: '#5e9bfc' },
  { t: 0.26, x: 0.30, label: 'Repol.',         col: '#56cfb2' },
  { t: 0.44, x: 0.47, label: 'Hyperpol.',      col: '#f47067' },
  { t: 0.63, x: 0.66, label: 'Refractory',     col: '#768390' },
];

export class APGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.t      = 0;       // 0-1: how far the trace has been drawn
    this._raf   = null;
    this.resize();
  }

  resize() {
    const dpr    = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth  : 240;
    const h = parent ? parent.clientHeight : 140;
    this.canvas.width        = Math.round(w * dpr);
    this.canvas.height       = Math.round(h * dpr);
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.draw();
  }

  // Map voltage → pixel Y
  _vy(v) {
    const { h, PL, PT, PB } = this._pad();
    return PT + (h - PT - PB) * (1 - (v - V_MIN) / V_RANGE);
  }

  _pad() {
    return { PL: 36, PR: 8, PT: 16, PB: 14 };
  }

  draw() {
    const { ctx, w, h, t } = this;
    const { PL, PR, PT, PB } = this._pad();
    const gw = w - PL - PR;
    const gh = h - PT - PB;

    ctx.clearRect(0, 0, w, h);

    // ── Background ─────────────────────────────────────
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // ── Grid lines ─────────────────────────────────────
    ctx.font = '9px "JetBrains Mono", monospace';
    for (const v of [-80, -70, -55, 0, 40]) {
      const y = PT + gh * (1 - (v - V_MIN) / V_RANGE);
      ctx.strokeStyle = v === PHASES[0].col ? '#1e2b3a' : '#1a2535';
      ctx.lineWidth = v === -70 ? 1.2 : 0.8;
      ctx.setLineDash(v === -70 ? [] : [3, 5]);
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + gw, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#4e5d6e';
      ctx.textBaseline = 'middle';
      ctx.fillText(v, 0, y);
    }

    // ── Waveform ───────────────────────────────────────
    const STEPS  = 500;
    const nDrawn = Math.round(STEPS * t);
    if (nDrawn < 2) return;

    const grad = ctx.createLinearGradient(PL, 0, PL + gw, 0);
    grad.addColorStop(0.00, '#4e5d6e');
    grad.addColorStop(0.10, '#5e9bfc');
    grad.addColorStop(0.22, '#7eb8ff');
    grad.addColorStop(0.38, '#56cfb2');
    grad.addColorStop(0.56, '#f47067');
    grad.addColorStop(1.00, '#4e5d6e');

    ctx.beginPath();
    ctx.lineWidth   = 2.2;
    ctx.strokeStyle = grad;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';

    for (let i = 0; i <= nDrawn; i++) {
      const ti = i / STEPS;
      const x  = PL + gw * ti;
      const y  = PT + gh * (1 - (apVoltage(ti) - V_MIN) / V_RANGE);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── Cursor ─────────────────────────────────────────
    if (t > 0.01 && t < 1) {
      const cx = PL + gw * t;
      const cy = PT + gh * (1 - (apVoltage(t) - V_MIN) / V_RANGE);

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9);
      glow.addColorStop(0, 'rgba(255,255,255,0.75)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fillStyle = glow; ctx.fill();

      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }

    // ── Phase labels ───────────────────────────────────
    ctx.font = '9px Inter, sans-serif';
    for (const p of PHASES) {
      if (t >= p.t + 0.05) {
        ctx.fillStyle = p.col;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(p.label, PL + gw * p.x, PT - 4);
      }
    }

    // ── Axis labels ────────────────────────────────────
    ctx.fillStyle = '#4e5d6e';
    ctx.font = '9px Inter, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('mV', 0, PT - 4);
    ctx.fillText('Time (ms) →', PL + gw * 0.34, h - 2);
  }

  play(durationMs = 3500, onProgress = null) {
    if (this._raf) cancelAnimationFrame(this._raf);
    this.t = 0;
    const t0 = performance.now();

    const tick = (now) => {
      this.t = Math.min(1, (now - t0) / durationMs);
      this.draw();
      if (onProgress) onProgress(this.t);
      if (this.t < 1) this._raf = requestAnimationFrame(tick);
      else            this._raf = null;
    };
    this._raf = requestAnimationFrame(tick);
  }

  reset() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this.t = 0;
    this.draw();
  }
}
