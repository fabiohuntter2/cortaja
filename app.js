'use strict';
/* CortaJá — editor de vídeo para celular. Tudo roda no aparelho. */

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PPS = 56;            // pixels por segundo na linha do tempo
const FR = 0.02;           // janela de análise de áudio (s)
const SR = 16000;          // taxa do áudio analisado

const vids = [$('#vid'), $('#vid2')], tv = $('#tv'), cv = $('#cv'), ctx = cv.getContext('2d');
const tl = $('#tl'), tlc = $('#tlc');
/* Dois players alternados: enquanto um toca um trecho, o outro já fica parado no começo do próximo.
   Assim a passagem de um corte para o outro não espera o celular procurar o ponto do vídeo. */
let act = 0, video = vids[0], prepI = -1, waitSwap = false, blessed = false, srcUrl = null;
const other = () => vids[1 - act];
function prepare(i) {
  const n = other();
  if (i < 0 || i >= S.segs.length) { prepI = -1; return; }
  if (prepI === i) return;
  prepI = i; n.pause(); n.currentTime = S.segs[i].s;
}
const prepReady = i => prepI === i && !other().seeking && other().readyState >= 2;
function swap() { video.pause(); act = 1 - act; video = vids[act]; prepI = -1; }

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke-width="3"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  magic: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></svg>',
  limpo: '<svg viewBox="0 0 24 24"><path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z"/><path d="M17 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>',
  pausas: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4M9.5 2.5h5"/></svg>',
  legendas: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10.5a2 2 0 1 0 0 3M16.5 10.5a2 2 0 1 0 0 3"/></svg>',
  texto: '<svg viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  trans: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="7" height="12" rx="2"/><rect x="14.5" y="6" width="7" height="12" rx="2"/><path d="M12 3v18"/></svg>',
  zoom: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5M11 8v6M8 11h6"/></svg>',
  dividir: '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7H4v10h4M16 7h4v10h-4"/></svg>',
  excluir: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
};

const TOOLS = [
  ['limpo', 'Corte limpo'], ['pausas', 'Pausas'], ['legendas', 'Legendas'], ['texto', 'Texto'],
  ['trans', 'Transições'], ['zoom', 'Zoom'], ['dividir', 'Dividir'], ['excluir', 'Excluir'],
];
const FORMATS = { orig: ['Original', 0], '9:16': ['9:16 Reels', 9 / 16], '4:5': ['4:5 Feed', 4 / 5], '1:1': ['1:1', 1], '16:9': ['16:9', 16 / 9] };
const CAPSTYLES = {
  karaoke: { nome: 'Karaokê', n: 3 }, marcador: { nome: 'Marcador', n: 3 }, impacto: { nome: 'Impacto', n: 1 },
  elegante: { nome: 'Elegante', n: 4 }, classica: { nome: 'Clássica', n: 5 },
};
const COLORS = ['#ffe600', '#22d3a6', '#ff5a36', '#8b5cf6', '#ff3d81', '#38bdf8', '#ffffff', '#111111'];
const MODELS = {
  rapido: ['Rápida', 'onnx-community/whisper-tiny_timestamped'],
  bom: ['Boa', 'onnx-community/whisper-base_timestamped'],
  melhor: ['Melhor (mais lenta)', 'onnx-community/whisper-small_timestamped'],
};
const LANGS = { portuguese: 'Português', english: 'Inglês', spanish: 'Espanhol' };
const TRANS = { '': 'Nenhuma', flash: 'Flash', fade: 'Fade', punch: 'Punch' };

/* ---------- estado ---------- */
const S = {
  file: null, dur: 0, vw: 0, vh: 0,
  segs: [], words: null, texts: [],
  caps: { on: false, style: 'karaoke', size: 64, y: 0.72, color: '#ffe600', n: 0 },
  zoom: { on: false, amt: 0.14 },
  fmt: 'orig',
};
const SAVED = ['segs', 'words', 'texts', 'caps', 'zoom', 'fmt'];
let offs = [], total = 0, groups = [], zplan = [];
let curSeg = 0, curOut = 0, playing = false, exporting = false, dirty = true, pendingT = null;
let sel = -1, selText = null, hist = [], hi = -1;
let A = null, analysisP = null, thumbs = [], thumbN = 0, tileW = 30, segCanvases = [];
let cfg = { model: 'bom', lang: 'portuguese' };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('cortaja') || '{}')); } catch (e) { }
const saveCfg = () => { try { localStorage.setItem('cortaja', JSON.stringify(cfg)); } catch (e) { } };

/* ---------- utilidades de interface ---------- */
const fmtT = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT;
function toast(msg, ms = 2600) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, ms); }
function busy(title, sub = '', p = null, cancel = null) {
  $('#busy').hidden = false; $('#busyT').textContent = title; $('#busyS').textContent = sub;
  $('#busyB').style.width = p == null ? '100%' : Math.round(p * 100) + '%';
  $('#busyB').style.opacity = p == null ? .35 : 1;
  $('#busyX').hidden = !cancel; $('#busyX').onclick = cancel;
}
const idle = () => { $('#busy').hidden = true; };

/* ---------- mapeamento de tempo (vídeo original <-> vídeo editado) ---------- */
function outToSrc(o) {
  o = clamp(o, 0, total); let i = 0;
  while (i < S.segs.length - 1 && o >= offs[i + 1]) i++;
  const g = S.segs[i];
  return { i, t: Math.min(g.s + (o - offs[i]), g.e) };
}
function recalc() {
  offs = []; let o = 0;
  for (const g of S.segs) { offs.push(o); o += g.e - g.s; }
  total = o; curSeg = clamp(curSeg, 0, S.segs.length - 1); prepI = -1; waitSwap = false;
  if (sel >= S.segs.length) sel = -1;
  buildGroups(); buildZoom(); sizeCanvas(); buildTimeline(); updateTime(); dirty = true;
}

/* ---------- histórico ---------- */
const snap = () => JSON.stringify(Object.fromEntries(SAVED.map(k => [k, S[k]])));
function commit() {
  hist.length = hi + 1; hist.push(snap()); if (hist.length > 40) hist.shift();
  hi = hist.length - 1; recalc();
}
function restore(j) {
  if (j < 0 || j >= hist.length) return;
  pause(); Object.assign(S, JSON.parse(hist[j])); hi = j; sel = -1; recalc(); seekOut(Math.min(curOut, total)); closeSheet();
}

/* ---------- cortes ---------- */
function removeRanges(rs) {
  rs = rs.filter(r => r.e > r.s).sort((a, b) => a.s - b.s);
  let out = [];
  for (const g of S.segs) {
    let parts = [{ s: g.s, e: g.e, tr: g.tr }];
    for (const r of rs) {
      if (r.e <= g.s || r.s >= g.e) continue;
      const np = [];
      for (const p of parts) {
        if (r.e <= p.s || r.s >= p.e) { np.push(p); continue; }
        if (r.s > p.s) np.push({ s: p.s, e: r.s, tr: p.tr });
        if (r.e < p.e) np.push({ s: r.e, e: p.e, tr: '' });
      }
      parts = np;
    }
    out.push(...parts);
  }
  out = out.filter(p => p.e - p.s >= 0.1);
  if (!out.length) return false;
  S.segs = out; return true;
}
function splitHere() {
  const { i, t } = outToSrc(curOut), g = S.segs[i];
  if (t - g.s < 0.12 || g.e - t < 0.12) return toast('Mova a agulha para o meio de um trecho.');
  S.segs.splice(i, 1, { s: g.s, e: t, tr: g.tr }, { s: t, e: g.e, tr: '' });
  sel = i + 1; commit(); toast('Trecho dividido.');
}
function deleteSeg() {
  if (S.segs.length < 2) return toast('Divida o vídeo antes de excluir um trecho.');
  const i = sel >= 0 ? sel : outToSrc(curOut).i;
  S.segs.splice(i, 1); sel = -1; commit();
  seekOut(Math.min(offs[Math.min(i, S.segs.length - 1)], total)); toast('Trecho excluído.');
}

/* ---------- análise de áudio ---------- */
function analyze() {
  A = null;
  analysisP = (async () => {
    try {
      const buf = await S.file.arrayBuffer();
      const oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, SR, SR);
      const ab = await oc.decodeAudioData(buf);
      const n = ab.length, pcm = new Float32Array(n), ch = ab.numberOfChannels;
      for (let c = 0; c < ch; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) pcm[i] += d[i] / ch; }
      const hop = Math.round(SR * FR), nf = Math.floor(n / hop), db = new Float32Array(nf), pk = new Float32Array(nf);
      let mx = 1e-6;
      for (let f = 0; f < nf; f++) {
        let s = 0; for (let i = f * hop, e = i + hop; i < e; i++) s += pcm[i] * pcm[i];
        const r = Math.sqrt(s / hop); pk[f] = r; if (r > mx) mx = r; db[f] = 20 * Math.log10(r + 1e-6);
      }
      for (let f = 0; f < nf; f++) pk[f] = Math.sqrt(pk[f] / mx);
      const sorted = Float32Array.from(db).sort();
      A = { pcm, db, pk, noise: sorted[Math.floor(nf * 0.15)] || -60, loud: sorted[Math.floor(nf * 0.95)] || -20 };
      redrawSegs();
    } catch (e) { console.warn('análise de áudio falhou', e); A = null; }
  })();
  return analysisP;
}
/* regiões com fala, em segundos do vídeo original */
function speechRegions(sens = 0.35) {
  const { db } = A, nf = db.length;
  const thr = Math.min(A.noise + (A.loud - A.noise) * sens, A.loud - 6);
  const sp = new Uint8Array(nf);
  for (let f = 0; f < nf; f++) sp[f] = db[f] > thr ? 1 : 0;
  const fill = Math.round(0.12 / FR), minB = Math.round(0.08 / FR);
  let run = 0;                                    // fecha buracos curtos
  for (let f = 0; f < nf; f++) { if (sp[f]) { if (run && run <= fill && f - run > 0) for (let k = f - run; k < f; k++) sp[k] = 1; run = 0; } else run++; }
  const out = []; let st = -1;
  for (let f = 0; f <= nf; f++) {
    const on = f < nf && sp[f];
    if (on && st < 0) st = f;
    if (!on && st >= 0) { if (f - st >= minB) out.push({ s: st * FR, e: f * FR }); st = -1; }
  }
  return out;
}
function pauseRanges(minPause, sens, pad) {
  const sp = speechRegions(sens), out = []; let prev = 0;
  for (const r of sp) {
    if (prev === 0 ? r.s > 0.15 : r.s - prev >= minPause) out.push({ s: prev === 0 ? 0 : prev + pad, e: r.s - pad });
    prev = r.e;
  }
  if (S.dur - prev > 0.3) out.push({ s: prev + pad, e: S.dur });
  return out.filter(r => r.e - r.s > 0.05);
}
/* quanto do vídeo editado atual essas faixas removeriam */
function overlapKept(rs) {
  let n = 0, secs = 0;
  for (const r of rs) { let o = 0; for (const g of S.segs) o += Math.max(0, Math.min(r.e, g.e) - Math.max(r.s, g.s)); if (o > 0.05) { n++; secs += o; } }
  return { n, secs };
}

/* ---------- transcrição (Whisper no aparelho) ---------- */
let wk = null;
function wkCall(msg, transfer, onProg) {
  return new Promise((res, rej) => {
    if (!wk) wk = new Worker('stt-worker.js', { type: 'module' });
    wk.onmessage = e => {
      const m = e.data;
      if (m.type === 'progress') onProg && onProg(m.p);
      else if (m.type === 'info') {
        console.log('voz:', m.device);
        if (m.fallback) { cfg.noGpu = true; saveCfg(); busy('Mudando para o modo compatível…', 'A placa de vídeo do aparelho falhou; seguindo pelo processador.'); }
      }
      else if (m.type === 'error') rej(new Error(m.error));
      else res(m);
    };
    wk.onerror = e => { wk = null; rej(new Error(e.message || 'Falha ao carregar o reconhecimento de voz')); };
    wk.postMessage(msg, transfer || []);
  });
}
async function ensureWords() {
  if (S.words) return true;
  busy('Analisando o áudio…'); await analysisP;
  if (!A) { idle(); toast('Não consegui ler o áudio deste vídeo.'); return false; }
  try {
    const files = {};
    busy('Preparando o reconhecimento de voz…', 'Na primeira vez baixa o modelo (fica salvo no aparelho).', 0);
    await wkCall({ type: 'load', model: MODELS[cfg.model][1], noGpu: !!cfg.noGpu }, null, p => {
      if (p && p.file && p.total) {
        files[p.file] = [p.loaded || 0, p.total];
        let l = 0, t = 0; for (const k in files) { l += files[k][0]; t += files[k][1]; }
        busy('Baixando o modelo de voz…', Math.round(l / 1e6) + ' de ' + Math.round(t / 1e6) + ' MB (só na primeira vez)', l / t);
      }
    });
    const regs = speechRegions(0.3), chunks = []; let cur = null;
    for (const r of regs) {
      let s = r.s;
      while (r.e - s > 28) { chunks.push({ s, e: s + 28 }); s += 28; }
      if (cur && r.e - cur.s <= 28) cur.e = r.e; else { if (cur) chunks.push(cur); cur = { s, e: r.e }; }
    }
    if (cur) chunks.push(cur);
    chunks.sort((a, b) => a.s - b.s);
    const words = [];
    for (let k = 0; k < chunks.length; k++) {
      busy('Transcrevendo a fala…', 'Trecho ' + (k + 1) + ' de ' + chunks.length, k / chunks.length);
      const a = Math.max(0, Math.floor((chunks[k].s - 0.15) * SR)), b = Math.min(A.pcm.length, Math.ceil((chunks[k].e + 0.15) * SR));
      const audio = A.pcm.slice(a, b), off = a / SR;
      const r = await wkCall({ type: 'run', audio, lang: cfg.lang }, [audio.buffer]);
      for (const c of r.chunks) {
        const text = (c.text || '').trim(); if (!text || !c.timestamp) continue;
        const t0 = c.timestamp[0] + off, t1 = (c.timestamp[1] == null ? c.timestamp[0] + 0.3 : c.timestamp[1]) + off;
        words.push({ t0, t1: Math.max(t1, t0 + 0.06), text });
      }
    }
    words.sort((x, y) => x.t0 - y.t0);
    idle();
    if (!words.length) { toast('Não encontrei fala neste vídeo.'); return false; }
    S.words = words; return true;
  } catch (e) {
    console.error(e); idle();
    const msg = String(e.message || e);
    const net = /fetch|network|load|download|404|cors/i.test(msg) && !/device is lost|ortrun/i.test(msg);
    toast(net ? 'Não consegui baixar o modelo de voz. Confira a internet (só precisa na primeira vez).'
              : 'Reconhecimento de voz falhou. Tente de novo ou escolha uma qualidade mais leve.', 5000);
    wk && wk.terminate(); wk = null;
    return false;
  }
}

/* ---------- corte limpo ---------- */
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const FILLERS = new Set(['ha', 'ah', 'ahn', 'hum', 'hmm', 'hm', 'uh', 'eh', 'er', 'ee', 'eee', 'aa', 'aaa', 'uhm', 'ahm']);
function retakeRanges() {
  const w = S.words.filter(x => !x.hide), n = w.map(x => norm(x.text)), rs = []; let rep = 0, fil = 0;
  for (let i = 0; i < w.length - 1; i++) {
    if (!n[i]) continue;
    if (FILLERS.has(n[i]) || (n[i] === 'e' && w[i].t1 - w[i].t0 > 0.55)) { rs.push({ s: w[i].t0 - 0.02, e: w[i].t1 + 0.02 }); fil++; continue; }
    if (n[i] === n[i + 1] && n[i].length >= 2) { rs.push({ s: w[i].t0 - 0.03, e: w[i + 1].t0 - 0.03 }); rep++; continue; }
    let hit = -1;
    for (let j = i + 2; j < Math.min(i + 16, w.length - 1); j++) {
      if (w[j].t0 - w[i].t0 > 14) break;
      if (n[j] !== n[i] || n[j + 1] !== n[i + 1]) continue;
      const three = j + 2 < w.length && i + 2 < j && n[j + 2] === n[i + 2];
      if (three || (j - i <= 6 && (n[i] + n[i + 1]).length >= 7)) { hit = j; break; }
    }
    if (hit > 0) { rs.push({ s: w[i].t0 - 0.03, e: w[hit].t0 - 0.03 }); rep++; i = hit - 1; }
  }
  return { rs, rep, fil };
}
async function cleanCut() {
  if (!await ensureWords()) return null;
  const before = total;
  const p = pauseRanges(0.35, 0.35, 0.08), r = retakeRanges();
  const np = overlapKept(p).n;
  if (!removeRanges([...p, ...r.rs])) { toast('Nada para cortar.'); return null; }
  // sobras curtas sem nenhuma palavra dentro (restos de um recomeço) também saem
  const kept = S.segs.filter(g => g.e - g.s >= 0.8 || S.words.some(w => { const m = (w.t0 + w.t1) / 2; return !w.hide && m >= g.s && m <= g.e; }));
  if (kept.length) S.segs = kept;
  return { pausas: np, rep: r.rep, fil: r.fil, before };
}

/* ---------- legendas ---------- */
function buildGroups() {
  groups = [];
  if (!S.words) return;
  const N = S.caps.n || CAPSTYLES[S.caps.style].n, maxC = N * 9, vis = [];
  for (const w of S.words) {
    if (!w.text || w.hide) continue;
    const mid = (w.t0 + w.t1) / 2, i = S.segs.findIndex(g => mid >= g.s && mid <= g.e);
    if (i < 0) continue;
    const g = S.segs[i], o0 = offs[i] + Math.max(w.t0, g.s) - g.s, o1 = offs[i] + Math.min(w.t1, g.e) - g.s;
    vis.push({ w, text: w.text, o0, o1: Math.max(o1, o0 + 0.04) });
  }
  let cur = null, chars = 0;
  for (const v of vis) {
    const prev = cur && cur.ws[cur.ws.length - 1];
    const brk = !cur || cur.ws.length >= N || chars + v.text.length > maxC && cur.ws.length > 0 || v.o0 - prev.o1 > 0.5 ||
      /[.!?…]$/.test(prev.text) || (/[,;:]$/.test(prev.text) && cur.ws.length >= 2);
    if (brk) { cur = { ws: [], o0: v.o0, o1: v.o1 }; groups.push(cur); chars = 0; }
    cur.ws.push(v); cur.o1 = v.o1; chars += v.text.length + 1;
  }
  for (let k = 0; k < groups.length; k++) {
    const nx = groups[k + 1];
    groups[k].o1 = nx && nx.o0 - groups[k].o1 < 0.45 ? nx.o0 : groups[k].o1 + 0.2;
  }
}
let gi = 0;
function groupAt(o) {
  if (!groups.length) return null;
  if (gi >= groups.length || o < groups[gi].o0) gi = 0;
  while (gi < groups.length - 1 && o >= groups[gi].o1) gi++;
  const g = groups[gi];
  return o >= g.o0 && o < g.o1 ? g : null;
}
const lum = c => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
const SANS = 'Montserrat, system-ui, sans-serif', SERIF = '"Playfair Display", Georgia, serif';

function drawCaps(c, W, H, o) {
  if (!S.caps.on) return;
  const g = groupAt(o); if (!g) return;
  const st = S.caps.style, u = W / 1080, col = S.caps.color;
  const fs = S.caps.size * u * (st === 'impacto' ? 1.5 : 1);
  const up = st === 'karaoke' || st === 'marcador' || st === 'impacto';
  const its = g.ws.map(x => ({ t: up ? x.text.toUpperCase() : x.text, o0: x.o0 }));
  let ai = 0; for (let k = 0; k < its.length; k++) if (o >= its[k].o0) ai = k;
  const fontOf = line => st === 'elegante' && line === 1 ? `italic 700 ${fs * 1.12}px ${SERIF}` : `${st === 'classica' ? 600 : 800} ${fs}px ${SANS}`;
  const sp = fs * 0.27, maxW = W * 0.88;
  // quebra em linhas
  let lines = [[]];
  if (st === 'elegante' && its.length >= 2) { const cut = Math.floor(its.length / 2); lines = [its.slice(0, cut), its.slice(cut)]; }
  else {
    c.font = fontOf(0); let w = 0;
    for (const it of its) {
      const tw = c.measureText(it.t).width;
      if (w + tw > maxW && lines[lines.length - 1].length) { lines.push([]); w = 0; }
      lines[lines.length - 1].push(it); w += tw + sp;
    }
  }
  const lh = fs * 1.2, cy = H * S.caps.y;
  c.save(); c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round';
  if (st === 'impacto') { const a = Math.min(1, (o - g.o0) / 0.12), k = 0.82 + 0.18 * a; c.translate(W / 2, cy); c.scale(k, k); c.translate(-W / 2, -cy); }
  let idx = 0;
  lines.forEach((ln, li) => {
    c.font = fontOf(li);
    const ws = ln.map(it => c.measureText(it.t).width);
    const lw = ws.reduce((a, b) => a + b, 0) + sp * (ln.length - 1);
    let x = (W - lw) / 2; const y = cy + (li - (lines.length - 1) / 2) * lh;
    if (st === 'classica') { c.fillStyle = 'rgba(0,0,0,.62)'; rr(c, x - fs * .35, y - lh / 2, lw + fs * .7, lh, fs * .22); c.fill(); }
    ln.forEach((it, k) => {
      const act = idx === ai;
      if (st === 'marcador' && act) { c.fillStyle = col; rr(c, x - fs * .14, y - fs * .58, ws[k] + fs * .28, fs * 1.16, fs * .2); c.fill(); }
      if (st === 'karaoke' || st === 'impacto' || (st === 'marcador' && !act)) { c.strokeStyle = '#000'; c.lineWidth = fs * 0.2; c.strokeText(it.t, x, y); }
      if (st === 'elegante') { c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = fs * .22; c.shadowOffsetY = fs * .04; }
      c.fillStyle = st === 'marcador' ? (act ? (lum(col) > .6 ? '#111' : '#fff') : '#fff')
        : st === 'elegante' ? (li === 1 ? col : '#fff')
          : st === 'classica' ? '#fff' : (act ? col : '#fff');
      c.fillText(it.t, x, y);
      x += ws[k] + sp; idx++;
    });
  });
  c.restore();
}

/* ---------- textos ---------- */
function drawTexts(c, W, H, o) {
  const u = W / 1080;
  for (const t of S.texts) {
    t._box = null;
    if (o < t.t0 || o >= t.t1) continue;
    const fs = t.size * u, lines = t.text.split('\n'), lh = fs * 1.28;
    c.save(); c.font = `800 ${fs}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const a = Math.min(1, (o - t.t0) / 0.15), cx = t.x * W, cy = t.y * H;
    c.globalAlpha = a; c.translate(cx, cy); c.scale(0.9 + 0.1 * a, 0.9 + 0.1 * a); c.translate(-cx, -cy);
    let bw = 0;
    lines.forEach((ln, k) => {
      const y = cy + (k - (lines.length - 1) / 2) * lh, w = c.measureText(ln).width; bw = Math.max(bw, w);
      if (t.style === 'faixa') { c.fillStyle = t.color; rr(c, cx - w / 2 - fs * .3, y - lh / 2 + fs * .03, w + fs * .6, lh - fs * .06, fs * .18); c.fill(); c.fillStyle = lum(t.color) > .6 ? '#111' : '#fff'; }
      else if (t.style === 'contorno') { c.strokeStyle = t.color; c.lineWidth = fs * .22; c.strokeText(ln, cx, y); c.fillStyle = lum(t.color) > .6 ? '#111' : '#fff'; }
      else { c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = fs * .25; c.fillStyle = t.color; }
      c.fillText(ln, cx, y);
    });
    c.restore();
    const bh = lines.length * lh;
    t._box = [cx - bw / 2 - fs * .4, cy - bh / 2, bw + fs * .8, bh];
    if (selText === t.id && !exporting) { c.save(); c.strokeStyle = '#fff'; c.lineWidth = 2 * u + 1; c.setLineDash([8 * u + 2, 6 * u + 2]); c.strokeRect(...t._box); c.restore(); }
  }
}

/* ---------- zoom dinâmico ---------- */
function buildZoom() {
  zplan = [];
  if (!S.zoom.on) return;
  const pieces = [];
  S.segs.forEach((g, i) => {
    const len = g.e - g.s, n = len > 7 ? Math.ceil(len / 4.5) : 1;
    for (let k = 0; k < n; k++) pieces.push({ o0: offs[i] + len * k / n, o1: offs[i] + len * (k + 1) / n });
  });
  const pat = ['none', 'in', 'none', 'slow']; let k = 0;
  for (const p of pieces) {
    const last = zplan[zplan.length - 1];
    if (last && p.o1 - p.o0 < 1.2) { last.o1 = p.o1; continue; }
    zplan.push({ ...p, type: pat[k++ % 4] });
  }
}
function zoomAt(o) {
  if (!S.zoom.on || !zplan.length) return 1;
  const p = zplan.find(p => o >= p.o0 && o < p.o1) || zplan[zplan.length - 1], z = S.zoom.amt;
  if (p.type === 'in') return 1 + z * (0.5 + 0.5 * Math.min(1, (o - p.o0) / 0.15));
  if (p.type === 'slow') return 1 + z * Math.min(1, (o - p.o0) / Math.max(0.5, p.o1 - p.o0));
  return 1;
}

/* ---------- desenho do quadro ---------- */
function sizeCanvas(long = 960) {
  if (!S.vw) return;
  const a = FORMATS[S.fmt][1] || S.vw / S.vh;
  let W, H;
  if (a < 1) { H = long; W = Math.round(long * a / 2) * 2; } else { W = long; H = Math.round(long / a / 2) * 2; }
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  fitCanvas();
}
function fitCanvas() {
  const st = $('#stage'), sw = st.clientWidth - 20, sh = st.clientHeight - 8;
  if (sw <= 0 || sh <= 0) return;
  const k = Math.min(sw / cv.width, sh / cv.height), w = cv.width * k, h = cv.height * k;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.style.left = (st.clientWidth - w) / 2 + 'px'; cv.style.top = (st.clientHeight - h) / 2 + 'px';
  $('#bMagic').style.left = Math.max(8, (st.clientWidth - w) / 2 + 8) + 'px';
}
function draw(paint) {
  const W = cv.width, H = cv.height, o = curOut;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  let ov = null;
  if (paint || video.readyState >= 2) {
    let z = zoomAt(o);
    const g = S.segs[curSeg], d = o - offs[curSeg], tr = g && curSeg > 0 ? g.tr : '';
    if (tr === 'punch' && d < 0.28) z *= 1 + 0.2 * Math.pow(1 - d / 0.28, 2);
    if (tr === 'flash' && d < 0.28) ov = ['#fff', 0.9 * (1 - d / 0.28)];
    if (tr === 'fade' && d < 0.3) ov = ['#000', 1 - d / 0.3];
    const nx = S.segs[curSeg + 1];
    if (nx && nx.tr === 'fade') { const rest = (g.e - g.s) - d; if (rest < 0.25) ov = ['#000', 1 - rest / 0.25]; }
    const s0 = Math.max(W / S.vw, H / S.vh), x0 = (W - S.vw * s0) / 2, y0 = (H - S.vh * s0) / 2, cx = W / 2, cy = H * 0.42;
    const dx = cx - (cx - x0) * z, dy = cy - (cy - y0) * z, dw = S.vw * s0 * z, dh = S.vh * s0 * z;
    if (paint) paint(ctx, dx, dy, dw, dh); else ctx.drawImage(video, dx, dy, dw, dh);
  }
  if (ov) { ctx.globalAlpha = clamp(ov[1], 0, 1); ctx.fillStyle = ov[0]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawCaps(ctx, W, H, o);
  drawTexts(ctx, W, H, o);
}

/* ---------- reprodução ---------- */
let actx, gOut, gRec, dest;
function audioInit() {
  try {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      gOut = actx.createGain(); gRec = actx.createGain(); dest = actx.createMediaStreamDestination();
      gOut.connect(actx.destination); gRec.connect(dest);
      for (const v of vids) { const src = actx.createMediaElementSource(v); src.connect(gOut); src.connect(gRec); }
    }
    if (actx.state !== 'running') actx.resume();
  } catch (e) { console.warn(e); }
}
function setPlayIcon() { $('#bPlay').innerHTML = playing ? ICON.pause : ICON.play; }
function play() {
  if (!S.file || exporting) return;
  audioInit();
  if (curOut >= total - 0.05) seekOut(0);
  if (pendingT != null) { video.currentTime = pendingT; pendingT = null; }
  playing = true; waitSwap = false; setPlayIcon();
  video.play().catch(e => { playing = false; setPlayIcon(); toast('Não consegui reproduzir (' + (e && e.name || 'erro') + '). Toque de novo.'); });
  if (!blessed) {            // libera o segundo player dentro do toque do usuário
    blessed = true; const n = other(); n.muted = true;
    n.play().then(() => { n.pause(); n.muted = false; prepI = -1; if (playing) prepare(curSeg + 1); }).catch(() => { n.muted = false; });
  } else prepare(curSeg + 1);
}
function pause() { if (playing) { playing = false; waitSwap = false; vids.forEach(v => v.pause()); setPlayIcon(); } }
function seekOut(o, fromScroll) {
  o = clamp(o, 0, total);
  const r = outToSrc(o); curSeg = r.i; curOut = o; waitSwap = false;
  if (video.seeking) pendingT = r.t; else { pendingT = null; video.currentTime = r.t; }
  if (!fromScroll) tl.scrollLeft = o * PPS;
  updateTime(); dirty = true;
}
function updateTime() { $('#tCur').textContent = fmtT(curOut); $('#tTot').textContent = fmtT(total); $('#bUndo').disabled = hi <= 0; $('#bRedo').disabled = hi >= hist.length - 1; }
vids.forEach(v => {
  v.addEventListener('seeked', () => { if (v === video && pendingT != null && !playing && !exporting) { const t = pendingT; pendingT = null; video.currentTime = t; } dirty = true; });
  v.addEventListener('loadeddata', () => dirty = true);
});

function loop() {
  requestAnimationFrame(loop);
  if (!S.file || exporting) return;
  if (playing) {
    const g = S.segs[curSeg], t = video.currentTime;
    if (!waitSwap && !video.seeking) {
      if (t >= g.e - 0.03 || video.ended) {
        if (curSeg < S.segs.length - 1) { video.pause(); waitSwap = true; }
        else { pause(); curOut = total; }
      } else if (t < g.s - 0.05) video.currentTime = g.s;
      else curOut = offs[curSeg] + Math.max(0, t - g.s);
    }
    if (waitSwap) {
      const nx = curSeg + 1;
      if (prepReady(nx)) { swap(); curSeg = nx; curOut = offs[nx]; waitSwap = false; video.play().catch(() => { }); prepare(nx + 1); }
      else if (prepI !== nx) prepare(nx);
    }
    tl.scrollLeft = curOut * PPS; updateTime(); draw();
  } else if (dirty) { dirty = false; draw(); }
}

/* ---------- linha do tempo ---------- */
function buildTimeline() {
  tlc.style.width = Math.max(1, total * PPS) + 'px';
  tlc.innerHTML = ''; segCanvases = [];
  const dpr = Math.min(2, devicePixelRatio || 1), frag = document.createDocumentFragment();
  for (const t of S.texts) {
    const el = document.createElement('div'); el.className = 'tbar'; el.dataset.id = t.id; el.textContent = t.text.replace(/\n/g, ' ');
    el.style.left = t.t0 * PPS + 'px'; el.style.width = Math.max(14, (Math.min(t.t1, total) - t.t0) * PPS) + 'px'; frag.appendChild(el);
  }
  if (S.caps.on) for (const g of groups) {
    const el = document.createElement('div'); el.className = 'cap'; el.textContent = g.ws.map(x => x.text).join(' ');
    el.style.left = g.o0 * PPS + 'px'; el.style.width = Math.max(4, (g.o1 - g.o0) * PPS - 2) + 'px'; frag.appendChild(el);
  }
  S.segs.forEach((g, i) => {
    const el = document.createElement('div'); el.className = 'seg' + (i === sel ? ' sel' : ''); el.dataset.i = i;
    const w = (g.e - g.s) * PPS; el.style.left = offs[i] * PPS + 1 + 'px'; el.style.width = Math.max(2, w - 2) + 'px';
    for (let x = 0; x < w; x += 512) {
      const cw = Math.min(512, w - x), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cw * dpr)); c.height = Math.round(62 * dpr); c.style.width = cw + 'px';
      c._d = { g, x, cw, dpr }; el.appendChild(c); segCanvases.push(c);
    }
    frag.appendChild(el);
    if (i > 0 && g.tr) { const m = document.createElement('div'); m.className = 'trm'; m.style.left = offs[i] * PPS + 'px'; frag.appendChild(m); }
  });
  tlc.appendChild(frag); redrawSegs();
  if (!playing) tl.scrollLeft = curOut * PPS;
}
let redrawT = 0;
function redrawSegs() { cancelAnimationFrame(redrawT); redrawT = requestAnimationFrame(() => segCanvases.forEach(drawSegChunk)); }
function drawSegChunk(c) {
  const { g, x, cw, dpr } = c._d, k = c.getContext('2d');
  k.setTransform(dpr, 0, 0, dpr, 0, 0); k.fillStyle = '#222733'; k.fillRect(0, 0, cw, 62);
  if (thumbN) for (let tx = -(x % tileW); tx < cw; tx += tileW) {
    const time = g.s + (x + tx + tileW / 2) / PPS, th = thumbs[clamp(Math.floor(time / S.dur * thumbN), 0, thumbN - 1)];
    if (th) k.drawImage(th, tx, 0, tileW, 44);
  }
  k.fillStyle = '#0f1218'; k.fillRect(0, 44, cw, 18);
  if (A) {
    k.fillStyle = '#cfd5e6';
    for (let px = 0; px < cw; px += 2) {
      const f = Math.floor((g.s + (x + px) / PPS) / FR), v = A.pk[f] || 0, h = Math.max(1, v * 15);
      k.fillRect(px, 53 - h / 2, 1.2, h);
    }
  }
}
async function makeThumbs() {
  thumbs = []; thumbN = clamp(Math.round(S.dur / 2), 6, 70);
  tileW = clamp(Math.round(44 * S.vw / S.vh), 22, 90);
  const file = S.file, n = thumbN;
  for (let k = 0; k < n; k++) {
    if (S.file !== file) return;
    await new Promise(res => {
      const done = () => { tv.removeEventListener('seeked', done); res(); };
      tv.addEventListener('seeked', done); tv.currentTime = Math.min(S.dur - 0.05, (k + 0.5) * S.dur / n); setTimeout(done, 2500);
    });
    const c = document.createElement('canvas'); c.width = tileW * 2; c.height = 88;
    try { c.getContext('2d').drawImage(tv, 0, 0, c.width, c.height); thumbs[k] = c; } catch (e) { }
    if (k % 3 === 0 || k === n - 1) redrawSegs();
  }
  if (S.file === file) { tv.removeAttribute('src'); tv.load(); }
}
tl.addEventListener('scroll', () => {
  if (playing || exporting || !S.file) return;
  const o = tl.scrollLeft / PPS;
  if (Math.abs(o - curOut) > 0.008) seekOut(o, true);
}, { passive: true });
tl.addEventListener('pointerdown', () => pause());
tlc.addEventListener('click', e => {
  const tb = e.target.closest('.tbar'); if (tb) return openText(tb.dataset.id);
  if (e.target.closest('.cap')) return openCaps('edit');
  const sg = e.target.closest('.seg'); if (!sg) return;
  sel = sel === +sg.dataset.i ? -1 : +sg.dataset.i;
  tlc.querySelectorAll('.seg').forEach(el => el.classList.toggle('sel', +el.dataset.i === sel));
});

/* ---------- toque no vídeo (arrastar textos / tocar para reproduzir) ---------- */
let drag = null;
const cvPos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
cv.addEventListener('pointerdown', e => {
  if (exporting) return;
  const [x, y] = cvPos(e);
  const t = [...S.texts].reverse().find(t => t._box && x >= t._box[0] && x <= t._box[0] + t._box[2] && y >= t._box[1] && y <= t._box[1] + t._box[3]);
  drag = { t, x, y, ox: t && t.x, oy: t && t.y, moved: false };
  if (t) { selText = t.id; dirty = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { } }
});
cv.addEventListener('pointermove', e => {
  if (!drag || !drag.t) return;
  const [x, y] = cvPos(e);
  if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 8) drag.moved = true;
  if (drag.moved) { drag.t.x = clamp(drag.ox + (x - drag.x) / cv.width, 0.05, 0.95); drag.t.y = clamp(drag.oy + (y - drag.y) / cv.height, 0.04, 0.96); dirty = true; }
});
cv.addEventListener('pointerup', () => {
  if (!drag) return; const d = drag; drag = null;
  if (d.t) { if (d.moved) commit(); else openText(d.t.id); }
  else playing ? pause() : play();
});
cv.addEventListener('pointercancel', () => drag = null);

/* ---------- painéis ---------- */
let sheetClose = null;
function sheet(title, html, mount) {
  if (sheetClose) { const f = sheetClose; sheetClose = null; f(); }
  $('#shTitle').textContent = title; $('#shBody').innerHTML = html; $('#sheet').hidden = false;
  if (mount) mount($('#shBody'));
}
function closeSheet() { $('#sheet').hidden = true; if (sheetClose) { const f = sheetClose; sheetClose = null; f(); } if (selText) { selText = null; dirty = true; } }
$('#shClose').onclick = closeSheet;
const on = (root, sel, ev, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener(ev, e => fn(el, e)));
const range = (id, label, min, max, step, val, unit = '') =>
  `<label class="fld"><span>${label}<b id="${id}V">${val}${unit}</b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
const sws = cur => `<div class="row">${COLORS.map(c => `<button class="sw${c === cur ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>`;

function openPausas() {
  pause();
  sheet('Remover pausas', `<p>Corta os silêncios entre as falas, direto pelo som.</p>
    ${range('pMin', 'Cortar pausas maiores que', 0.2, 1.5, 0.05, 0.5, ' s')}
    ${range('pSens', 'Sensibilidade (ruído de fundo)', 0.15, 0.6, 0.05, 0.35)}
    <p class="note" id="pInfo">Analisando o áudio…</p>
    <button class="btn wide" id="pGo">Remover pausas</button>`, async b => {
    await analysisP;
    if (!A) { b.querySelector('#pInfo').textContent = 'Não consegui ler o áudio deste vídeo.'; b.querySelector('#pGo').disabled = true; return; }
    let rs = [];
    const upd = () => {
      const m = +b.querySelector('#pMin').value, s = +b.querySelector('#pSens').value;
      b.querySelector('#pMinV').textContent = m.toFixed(2) + ' s'; b.querySelector('#pSensV').textContent = s.toFixed(2);
      rs = pauseRanges(m, s, 0.1); const k = overlapKept(rs);
      b.querySelector('#pInfo').textContent = k.n ? `Vai cortar ${k.n} pausas: ${fmtT(total)} → ${fmtT(total - k.secs)}` : 'Nenhuma pausa encontrada com esses ajustes.';
    };
    on(b, 'input', 'input', upd); upd();
    b.querySelector('#pGo').onclick = () => {
      const k = overlapKept(rs); if (!k.n) return toast('Nada para cortar.');
      const before = total; if (!removeRanges(rs)) return;
      commit(); seekOut(0); closeSheet(); toast(`${k.n} pausas removidas: ${fmtT(before)} → ${fmtT(total)}`);
    };
  });
}

function openLimpo() {
  pause();
  sheet('Corte limpo', `<p>Ouve a sua fala e tira sozinho as pausas, as palavras repetidas e as frases que você recomeçou. O vídeo fica direto ao ponto.</p>
    <p>Usa reconhecimento de voz no próprio aparelho. Pode levar um ou dois minutos.</p>
    <button class="btn wide" id="lGo">Aplicar corte limpo</button>`, b => {
    b.querySelector('#lGo').onclick = async () => {
      const r = await cleanCut(); if (!r) return;
      commit(); seekOut(0);
      sheet('Corte limpo', `<div class="box"><span class="ok">Aplicado</span><span>${fmtT(r.before)} → ${fmtT(total)}</span></div>
        <p class="note">Removi ${r.pausas} pausas, ${r.rep} repetições ou recomeços e ${r.fil} vícios de fala.</p>
        <p>Não gostou de algum corte? Use o botão desfazer.</p>`);
    };
  });
}

function sttOptions() {
  return `<div class="row nw">
    <label class="fld grow">Idioma<select id="oLang">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === cfg.lang ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="fld grow">Qualidade<select id="oModel">${Object.entries(MODELS).map(([k, v]) => `<option value="${k}"${k === cfg.model ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></label></div>`;
}
function bindStt(b) {
  on(b, '#oLang', 'change', el => { cfg.lang = el.value; saveCfg(); });
  on(b, '#oModel', 'change', el => { cfg.model = el.value; saveCfg(); });
}
const STY_HTML = {
  karaoke: 'SUA <span style="color:#ffe600">LEGENDA</span>',
  marcador: 'SUA <span style="background:#8b5cf6;border-radius:5px;padding:0 5px">LEGENDA</span>',
  impacto: '<span style="font-size:25px">LEGENDA</span>',
  elegante: 'sua<br><i style="font-family:Georgia,serif;color:#ff5a36">legenda</i>',
  classica: '<span style="background:#000a;border-radius:5px;padding:3px 7px;font-weight:600;font-size:14px">Sua legenda</span>',
};
function openCaps(tab = 'style') {
  pause();
  if (!S.words) {
    return sheet('Legendas', `<p>Gera as legendas sozinho, sincronizadas palavra por palavra com a sua fala.</p>${sttOptions()}
      <button class="btn wide" id="cGo">Gerar legendas automáticas</button>`, b => {
      bindStt(b);
      b.querySelector('#cGo').onclick = async () => { if (!await ensureWords()) return; S.caps.on = true; commit(); openCaps(); toast('Legendas prontas.'); };
    });
  }
  const tabs = `<div class="tabs">${[['style', 'Estilos'], ['custom', 'Personalizar'], ['edit', 'Editar texto']].map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'style') body = `<div class="grid2">${Object.entries(CAPSTYLES).map(([k, v]) => `<button class="sty${S.caps.on && S.caps.style === k ? ' on' : ''}" data-sty="${k}"><span>${STY_HTML[k]}</span><small>${v.nome}</small></button>`).join('')}
      <button class="sty${S.caps.on ? '' : ' on'}" data-sty=""><span style="font-size:13px;font-weight:600;color:#8b92a5">Sem legenda</span></button></div>`;
  if (tab === 'custom') body = `${range('cSize', 'Tamanho', 36, 110, 2, S.caps.size)}${range('cY', 'Altura na tela', 0.12, 0.92, 0.01, S.caps.y)}
      ${range('cN', 'Palavras por vez (0 = automático)', 0, 7, 1, S.caps.n)}<label class="fld">Cor de destaque${sws(S.caps.color)}</label>
      <button class="btn ghost wide" id="cRedo">Refazer transcrição</button>`;
  if (tab === 'edit') body = groups.length ? groups.map((g, k) => `<div class="capl"><button data-go="${k}">${fmtT(g.o0)}</button><input type="text" data-g="${k}" value="${esc(g.ws.map(x => x.text).join(' '))}"></div>`).join('')
    : '<p>Nenhuma legenda no trecho mantido.</p>';
  sheet('Legendas', tabs + body, b => {
    on(b, '[data-tab]', 'click', el => openCaps(el.dataset.tab));
    on(b, '[data-sty]', 'click', el => { if (el.dataset.sty) { S.caps.on = true; S.caps.style = el.dataset.sty; } else S.caps.on = false; commit(); openCaps('style'); });
    on(b, '#cSize,#cY,#cN', 'input', el => {
      S.caps[{ cSize: 'size', cY: 'y', cN: 'n' }[el.id]] = +el.value; b.querySelector('#' + el.id + 'V').textContent = el.value;
      if (el.id === 'cN') buildGroups(); dirty = true;
    });
    on(b, '#cSize,#cY,#cN', 'change', () => commit());
    on(b, '.sw', 'click', el => { S.caps.color = el.dataset.c; commit(); openCaps('custom'); });
    on(b, '#cRedo', 'click', () => { S.words = null; S.caps.on = false; commit(); openCaps(); });
    on(b, '[data-go]', 'click', el => seekOut(groups[+el.dataset.go].o0 + 0.02));
    on(b, '[data-g]', 'focus', el => seekOut(groups[+el.dataset.g].o0 + 0.02));
    on(b, '[data-g]', 'change', el => {
      const g = groups[+el.dataset.g], ws = g.ws.map(x => x.w), val = el.value.trim(), tk = val.split(/\s+/);
      if (!val) ws.forEach(w => w.hide = true);
      else if (tk.length === ws.length) ws.forEach((w, k) => w.text = tk[k]);
      else { ws[0].text = val; ws[0].t1 = ws[ws.length - 1].t1; ws.slice(1).forEach(w => w.hide = true); }
      const sc = b.scrollTop; commit(); openCaps('edit'); $('#shBody').scrollTop = sc;
    });
  });
}

function openText(id) {
  pause();
  let t = S.texts.find(t => t.id === id);
  if (!t) {
    const t0 = Math.min(curOut, Math.max(0, total - 0.5));
    t = { id: 't' + Date.now(), text: 'SEU TEXTO', t0, t1: Math.min(total, t0 + 3), x: 0.5, y: 0.18, size: 64, style: 'faixa', color: '#ff5a36' };
    S.texts.push(t); commit();
  }
  selText = t.id; dirty = true;
  if (curOut < t.t0 || curOut >= t.t1) seekOut(t.t0 + 0.2);
  sheet('Texto', `<textarea id="xT" rows="2">${esc(t.text)}</textarea>
    <div class="row">${[['faixa', 'Faixa'], ['limpo', 'Limpo'], ['contorno', 'Contorno']].map(([k, v]) => `<button class="chip${t.style === k ? ' on' : ''}" data-st="${k}">${v}</button>`).join('')}</div>
    ${sws(t.color)}${range('xS', 'Tamanho', 30, 150, 2, t.size)}
    <p class="note" id="xI"></p>
    <div class="row"><button class="chip" id="xA">Começa na agulha</button><button class="chip" id="xB">Termina na agulha</button><button class="chip" id="xAll">Vídeo todo</button></div>
    <p>Arraste o texto na tela para mudar a posição.</p>
    <button class="btn danger wide" id="xDel">Excluir texto</button>`, b => {
    const info = () => b.querySelector('#xI').textContent = `Aparece de ${fmtT(t.t0)} até ${fmtT(Math.min(t.t1, total))}`; info();
    const ta = b.querySelector('#xT');
    ta.oninput = () => { t.text = ta.value; dirty = true; }; ta.onchange = () => commit();
    on(b, '[data-st]', 'click', el => { t.style = el.dataset.st; commit(); openText(t.id); });
    on(b, '.sw', 'click', el => { t.color = el.dataset.c; commit(); openText(t.id); });
    on(b, '#xS', 'input', el => { t.size = +el.value; b.querySelector('#xSV').textContent = el.value; dirty = true; });
    on(b, '#xS', 'change', () => commit());
    b.querySelector('#xA').onclick = () => { if (curOut >= t.t1 - 0.2) t.t1 = Math.min(total, curOut + 3); t.t0 = Math.min(curOut, t.t1 - 0.2); commit(); info(); };
    b.querySelector('#xB').onclick = () => { if (curOut <= t.t0 + 0.2) return toast('Mova a agulha para depois do começo.'); t.t1 = curOut; commit(); info(); };
    b.querySelector('#xAll').onclick = () => { t.t0 = 0; t.t1 = total + 999; commit(); info(); };
    b.querySelector('#xDel').onclick = () => { S.texts = S.texts.filter(x => x !== t); selText = null; commit(); closeSheet(); };
  });
}

function openTrans() {
  pause();
  const cuts = S.segs.length - 1, used = S.segs.filter((g, i) => i > 0 && g.tr).length;
  let pick = 'flash';
  sheet('Transições', cuts ? `<p>Este vídeo tem ${cuts} cortes, ${used} com transição.</p>
    <div class="row">${Object.entries(TRANS).map(([k, v]) => `<button class="chip${k === pick ? ' on' : ''}" data-tr="${k}">${v}</button>`).join('')}</div>
    <button class="btn wide" id="trOne">Aplicar no corte mais perto da agulha</button>
    <button class="btn ghost wide" id="trAll">Aplicar em todos os cortes</button>`
    : '<p>As transições entram nos cortes. Use Dividir, Pausas ou Corte limpo para criar cortes primeiro.</p>', b => {
    on(b, '[data-tr]', 'click', el => { pick = el.dataset.tr; b.querySelectorAll('[data-tr]').forEach(x => x.classList.toggle('on', x === el)); });
    on(b, '#trOne', 'click', () => {
      let bi = 1; for (let i = 1; i < S.segs.length; i++) if (Math.abs(offs[i] - curOut) < Math.abs(offs[bi] - curOut)) bi = i;
      S.segs[bi].tr = pick; commit(); seekOut(Math.max(0, offs[bi] - 0.8)); openTrans(); play();
    });
    on(b, '#trAll', 'click', () => { S.segs.forEach((g, i) => { if (i) g.tr = pick; }); commit(); openTrans(); toast(pick ? 'Transição aplicada em todos os cortes.' : 'Transições removidas.'); });
  });
}

function openZoom() {
  pause();
  const nin = zplan.filter(p => p.type === 'in').length, ns = zplan.filter(p => p.type === 'slow').length;
  sheet('Zoom dinâmico', `<p>Aplica zoom automático ao longo do vídeo para dar ritmo.</p>
    <div class="box">${S.zoom.on ? '<span class="ok">Aplicado</span><button class="btn danger" id="zT">Remover</button>' : '<span>Não aplicado</span><button class="btn" id="zT">Aplicar</button>'}</div>
    ${S.zoom.on ? `<p class="note">Zoom in em ${nin} trechos e zoom lento em ${ns} trechos de ênfase.</p>${range('zA', 'Intensidade', 0.06, 0.35, 0.01, S.zoom.amt)}` : ''}`, b => {
    b.querySelector('#zT').onclick = () => { S.zoom.on = !S.zoom.on; commit(); openZoom(); };
    on(b, '#zA', 'input', el => { S.zoom.amt = +el.value; b.querySelector('#zAV').textContent = el.value; dirty = true; });
    on(b, '#zA', 'change', () => commit());
  });
}

function openFmt() {
  sheet('Formato', `<div class="row">${Object.entries(FORMATS).map(([k, v]) => `<button class="chip${S.fmt === k ? ' on' : ''}" data-f="${k}">${v[0]}</button>`).join('')}</div>
    <p>O vídeo preenche o quadro; o que sobrar nas bordas é cortado.</p>`, b => on(b, '[data-f]', 'click', el => { S.fmt = el.dataset.f; commit(); openFmt(); }));
}

function openMagic() {
  pause();
  sheet('Edição automática', `<p>Um toque e o vídeo sai editado. Escolha o que aplicar:</p>
    <label class="tog">Corte limpo (pausas e repetições)<input type="checkbox" id="mL" checked></label>
    <label class="tog">Legendas automáticas<input type="checkbox" id="mC" checked></label>
    <label class="tog">Zoom dinâmico<input type="checkbox" id="mZ" checked></label>
    ${sttOptions()}
    <button class="btn wide" id="mGo">Editar meu vídeo</button>`, b => {
    bindStt(b);
    b.querySelector('#mGo').onclick = async () => {
      const L = b.querySelector('#mL').checked, C = b.querySelector('#mC').checked, Z = b.querySelector('#mZ').checked, before = total;
      if (L || C) { if (!await ensureWords()) return; }
      if (L) await cleanCut();
      if (C) S.caps.on = true;
      if (Z) S.zoom.on = true;
      commit(); seekOut(0); closeSheet(); toast(`Pronto: ${fmtT(before)} → ${fmtT(total)}. Toque no vídeo para assistir.`, 4000);
    };
  });
}

/* ---------- exportação ---------- */
function pickMime() {
  const c = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
const seekSrc = t => new Promise(res => {
  let fin = false; const done = () => { if (fin) return; fin = true; video.removeEventListener('seeked', done); res(); };
  video.addEventListener('seeked', done); video.currentTime = t; setTimeout(done, 3000);
});
function openExport() {
  pause();
  const fast = canFast();
  if (!fast && (!window.MediaRecorder || !cv.captureStream)) return toast('Este navegador não consegue exportar. Use o Chrome (Android) ou o Safari atualizado.', 5000);
  const webm = !fast && !pickMime().startsWith('video/mp4');
  sheet('Exportar', `<p>O vídeo final tem ${fmtT(total)}. ${fast ? 'Exportação rápida ligada: deve levar bem menos que isso.' : 'A exportação leva mais ou menos esse tempo.'} Deixe o app aberto e a tela ligada.</p>
    ${webm ? '<p class="note">Este navegador grava em WebM. Para sair em MP4 (aceito pelo Instagram), use o Chrome atualizado ou o Safari.</p>' : ''}
    <div class="row"><button class="chip on" data-q="1920">Alta (1080p)</button><button class="chip" data-q="1280">Leve (720p)</button></div>
    <button class="btn wide" id="eGo">Exportar vídeo</button>`, b => {
    let q = 1920;
    on(b, '[data-q]', 'click', el => { q = +el.dataset.q; b.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === el)); });
    b.querySelector('#eGo').onclick = () => exportVideo(q);
  });
}
let exCancel = false, exPaused = false;
document.addEventListener('visibilitychange', () => {
  if (!exporting) return;
  if (document.hidden) { exPaused = !video.paused; video.pause(); } else if (exPaused) { exPaused = false; video.play(); }
});
const canFast = () => window.isSecureContext && 'VideoEncoder' in window && 'AudioEncoder' in window && 'VideoDecoder' in window;
async function exportVideo(q) {
  closeSheet(); pause();
  if (canFast()) {
    try { const r = await exportFast(q); if (r) showResult(r, 'mp4'); return; }
    catch (e) {
      console.warn('exportação rápida falhou', e); idle(); exporting = false; sizeCanvas(); seekOut(0);
      if (exCancel) return toast('Exportação cancelada.');
      toast('Exportação rápida não funcionou neste vídeo; usando o modo normal.', 3500);
    }
  }
  return exportRealtime(q);
}

/* Exportação rápida: decodifica os quadros direto do arquivo e codifica em MP4 (WebCodecs), sem tocar o vídeo. */
const MB_URL = 'https://cdn.jsdelivr.net/npm/mediabunny@1.50.9/dist/bundles/mediabunny.min.mjs';
let MBp = null;
async function exportFast(q) {
  exporting = true; exCancel = false; selText = null;
  busy('Preparando a exportação…', '', null, () => exCancel = true);
  const MB = await (MBp = MBp || import(MB_URL).catch(e => { MBp = null; throw e; }));
  const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(S.file) });
  const vt = await input.getPrimaryVideoTrack();
  if (!vt || !(await vt.canDecode())) throw new Error('decodificação não suportada');
  sizeCanvas(q);
  const W = cv.width, H = cv.height, br = q >= 1920 ? 10e6 : 5e6;
  if (MB.canEncodeVideo && !(await MB.canEncodeVideo('avc', { width: W, height: H, bitrate: br }))) throw new Error('codificação H.264 não suportada');

  // áudio: monta a trilha final já cortada, com micro-fades nos cortes para não estalar
  let abOut = [], acodec = null;
  try {
    const src = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(await S.file.arrayBuffer());
    const ch = Math.min(2, src.numberOfChannels), sr = src.sampleRate;
    acodec = await MB.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: ch, sampleRate: sr });
    if (acodec) {
      const fade = Math.round(sr * 0.006);
      for (const g of S.segs) {
        const a = Math.round(g.s * sr), n = Math.max(1, Math.round((g.e - g.s) * sr));
        const buf = new AudioBuffer({ length: n, numberOfChannels: ch, sampleRate: sr });
        for (let c = 0; c < ch; c++) {
          const d = buf.getChannelData(c); d.set(src.getChannelData(c).subarray(a, a + n));
          for (let k = 0; k < fade && k < n; k++) { const f = k / fade; d[k] *= f; d[n - 1 - k] *= f; }
        }
        abOut.push(buf);
      }
    }
  } catch (e) { console.warn('vídeo sem áudio legível', e); abOut = []; }

  const output = new MB.Output({ format: new MB.Mp4OutputFormat(), target: new MB.BufferTarget() });
  const vs = new MB.CanvasSource(cv, { codec: 'avc', bitrate: br, keyFrameInterval: 2 });
  output.addVideoTrack(vs, { frameRate: 30 });
  let as = null;
  if (abOut.length) { as = new MB.AudioBufferSource({ codec: acodec, bitrate: 160000 }); output.addAudioTrack(as); }
  await output.start();
  let wl = null; try { wl = await navigator.wakeLock.request('screen'); } catch (e) { }
  try {
    if (as) { for (const b of abOut) await as.add(b); as.close(); }
    abOut = null;
    const sink = new MB.VideoSampleSink(vt), t0 = performance.now();
    let last = -1, shown = 0;
    for (let i = 0; i < S.segs.length && !exCancel; i++) {
      const g = S.segs[i];
      for await (const smp of sink.samples(g.s, g.e)) {
        try {
          if (exCancel) break;
          const ot = offs[i] + Math.max(0, smp.timestamp - g.s);
          if (smp.timestamp >= g.e || ot > total) continue;
          if (last >= 0 && ot - last < 1 / 30 - 0.004) continue;      // no máximo 30 quadros por segundo
          curSeg = i; curOut = ot; last = ot;
          draw((c, x, y, w, h) => smp.draw(c, x, y, w, h));
          await vs.add(ot, 1 / 30);
          const now = performance.now();
          if (now - shown > 200) {
            shown = now; const el = (now - t0) / 1000, rate = ot / Math.max(el, 0.01);
            busy('Exportando…', fmtT(ot) + ' de ' + fmtT(total) + (el > 2 ? ` · ${rate.toFixed(1)}× mais rápido que o vídeo` : ''), ot / total, () => exCancel = true);
          }
        } finally { smp.close(); }
      }
    }
    vs.close();
    if (exCancel) { await output.cancel(); return null; }
    busy('Finalizando o arquivo…', '', 1);
    await output.finalize();
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  } catch (e) { try { await output.cancel(); } catch (_) { } throw e; }
  finally {
    try { wl && wl.release(); } catch (e) { }
    exporting = false; idle(); sizeCanvas(); seekOut(0);
    if (exCancel) toast('Exportação cancelada.');
  }
}

async function exportRealtime(q) {
  audioInit();
  if (!dest) return toast('Não consegui preparar o áudio para exportar.');
  try { await actx.resume(); } catch (e) { }
  const mime = pickMime();
  exporting = true; exCancel = false; selText = null; prepI = -1; waitSwap = false;
  sizeCanvas(q);
  let wl = null; try { wl = await navigator.wakeLock.request('screen'); } catch (e) { }
  const stream = cv.captureStream(30), at = dest.stream.getAudioTracks()[0]; if (at) stream.addTrack(at);
  const parts = []; let rec, started = false, err = null;
  try {
    rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: q >= 1920 ? 10e6 : 5e6, audioBitsPerSecond: 160000 });
    rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
    const stopped = new Promise(r => rec.onstop = r);
    gOut.gain.value = 0;
    busy('Exportando…', '', 0, () => exCancel = true);
    for (let i = 0; i < S.segs.length && !exCancel; i++) {
      const g = S.segs[i];
      if (i === 0) await seekSrc(g.s);
      else {                                   // o outro player já foi posicionado durante o trecho anterior
        const t0 = performance.now();
        while (!prepReady(i) && performance.now() - t0 < 5000) { if (prepI !== i) prepare(i); await new Promise(r => setTimeout(r, 15)); }
        swap();
      }
      curSeg = i; curOut = offs[i]; draw();
      await video.play();
      if (!started) { rec.start(); started = true; } else rec.resume();
      prepare(i + 1);
      await new Promise(res => {
        const tick = () => {
          if (exCancel || video.ended || video.currentTime >= g.e - 0.012) return res();
          curOut = offs[i] + Math.max(0, video.currentTime - g.s); draw();
          busy('Exportando…', fmtT(curOut) + ' de ' + fmtT(total), curOut / total, () => exCancel = true);
          requestAnimationFrame(tick);
        }; tick();
      });
      if (rec.state === 'recording') rec.pause();
      video.pause();
    }
    if (started) { if (rec.state === 'paused') rec.resume(); rec.stop(); await stopped; }
  } catch (e) { err = e; console.error(e); try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) { } }
  vids.forEach(v => v.pause()); gOut.gain.value = 1; exporting = false; idle();
  try { wl && wl.release(); } catch (e) { }
  stream.getVideoTracks().forEach(t => t.stop());
  sizeCanvas(); seekOut(0);
  if (err) return toast('A exportação falhou: ' + (err.message || err), 5000);
  if (exCancel || !parts.length) return toast('Exportação cancelada.');
  const type = (rec.mimeType || mime || 'video/webm').split(';')[0], ext = type.includes('mp4') ? 'mp4' : 'webm';
  showResult(new Blob(parts, { type }), ext);
}
function showResult(blob, ext) {
  const type = blob.type, url = URL.createObjectURL(blob), name = 'cortaja-' + Date.now() + '.' + ext;
  const file = new File([blob], name, { type });
  const canShare = navigator.canShare && navigator.canShare({ files: [file] });
  sheet('Vídeo pronto', `<video id="resV" src="${url}" controls playsinline></video>
    <p class="note">${(blob.size / 1e6).toFixed(1)} MB · ${ext.toUpperCase()}</p>
    <a class="btn wide" href="${url}" download="${name}">Salvar no aparelho</a>
    ${canShare ? '<button class="btn ghost wide" id="rShare">Compartilhar</button>' : ''}`, b => {
    on(b, '#rShare', 'click', () => navigator.share({ files: [file] }).catch(() => { }));
    sheetClose = () => setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}

/* ---------- abrir vídeo ---------- */
async function loadVideo(file) {
  busy('Abrindo o vídeo…');
  vids.forEach(v => v.pause()); act = 0; video = vids[0]; prepI = -1; waitSwap = false;
  if (srcUrl) URL.revokeObjectURL(srcUrl);
  const url = srcUrl = URL.createObjectURL(file);
  try {
    await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('formato')); video.src = url; });
  } catch (e) { idle(); return toast('Não consegui abrir este vídeo. Tente outro arquivo (MP4 ou MOV).', 5000); }
  vids[1].src = url; tv.src = url;
  S.file = file; S.dur = video.duration; S.vw = video.videoWidth; S.vh = video.videoHeight;
  if (!isFinite(S.dur) || !S.vw) { idle(); return toast('Este arquivo não tem vídeo legível.', 5000); }
  S.segs = [{ s: 0, e: S.dur, tr: '' }]; S.words = null; S.texts = []; S.caps.on = false; S.zoom.on = false; S.fmt = 'orig';
  hist = []; hi = -1; sel = -1; curSeg = 0; curOut = 0; thumbs = []; thumbN = 0; playing = false;
  $('#home').hidden = true; $('#editor').hidden = false; closeSheet();
  commit(); seekOut(0); idle();
  try { await document.fonts.load('800 40px Montserrat'); await document.fonts.load('italic 700 40px "Playfair Display"'); } catch (e) { }
  dirty = true;
  analyze(); makeThumbs();
}

/* ---------- ligações ---------- */
$('#bPlay').innerHTML = ICON.play; $('#bUndo').innerHTML = ICON.undo; $('#bRedo').innerHTML = ICON.redo;
$('#bHome').innerHTML = ICON.home; $('#shClose').innerHTML = ICON.close; $('#bMagic').innerHTML = ICON.magic;
$('#tools').innerHTML = TOOLS.map(([k, n]) => `<button data-tool="${k}">${ICON[k]}<span>${n}</span></button>`).join('');
const ACT = { limpo: openLimpo, pausas: openPausas, legendas: () => openCaps(), texto: () => openText(), trans: openTrans, zoom: openZoom, dividir: splitHere, excluir: deleteSeg };
$('#tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b && !exporting) ACT[b.dataset.tool](); });
$('#bPlay').onclick = () => playing ? pause() : play();
$('#bUndo').onclick = () => restore(hi - 1);
$('#bRedo').onclick = () => restore(hi + 1);
$('#bMagic').onclick = openMagic;
$('#bFmt').onclick = openFmt;
$('#bExport').onclick = openExport;
$('#bHome').onclick = () => { if (confirm('Trocar de vídeo? A edição atual será perdida.')) { pause(); $('#file').value = ''; $('#file').click(); } };
$('#file').onchange = e => { const f = e.target.files[0]; if (f) loadVideo(f); };
window.addEventListener('resize', () => { fitCanvas(); dirty = true; });
requestAnimationFrame(loop);

// modo de teste: index.html?v=arquivo.mp4 abre um vídeo da própria pasta
const demo = new URLSearchParams(location.search).get('v');
if (demo) fetch(demo).then(r => r.blob()).then(b => loadVideo(new File([b], demo, { type: b.type || 'video/mp4' })));

// instalação como app (só funciona em https ou localhost)
if ('serviceWorker' in navigator && window.isSecureContext && location.hostname !== 'localhost') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
