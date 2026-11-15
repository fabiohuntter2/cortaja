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
  moldura: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
  ia: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M12 7.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="currentColor"/></svg>',
  imagem: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  motion: '<svg viewBox="0 0 24 24"><path d="M4 17c3-8 6-8 8-4s5 4 8-4"/><circle cx="19" cy="6" r="1.6" fill="currentColor"/><path d="M3 21h18"/></svg>',
  tarja: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h12l2 3H3z" fill="currentColor"/><path d="M6 11h7"/></svg>',
  marca: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><rect x="12.5" y="6.5" width="6" height="4" rx="1"/></svg>',
  excluir: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
};

const TOOLS = [
  ['ia', 'IA'], ['limpo', 'Corte limpo'], ['legendas', 'Legendas'], ['motion', 'Motion'], ['imagem', 'Imagem'], ['moldura', 'Moldura'], ['tarja', 'Tarjas'], ['texto', 'Texto'],
  ['trans', 'Transições'], ['marca', 'Marca'], ['zoom', 'Zoom'], ['pausas', 'Pausas'], ['dividir', 'Dividir'], ['excluir', 'Excluir'],
];
const FORMATS = { orig: ['Original', 0], '9:16': ['9:16 Reels', 9 / 16], '4:5': ['4:5 Feed', 4 / 5], '1:1': ['1:1', 1], '16:9': ['16:9', 16 / 9] };
const CAPSTYLES = {
  karaoke: { nome: 'Karaokê', n: 3 }, marcador: { nome: 'Marcador', n: 3 }, impacto: { nome: 'Impacto', n: 1 },
  elegante: { nome: 'Elegante', n: 4 }, classica: { nome: 'Clássica', n: 5 },
};
const COLORS = ['#e11d2a', '#ffe600', '#22d3a6', '#ff5a36', '#8b5cf6', '#ff3d81', '#38bdf8', '#ffffff', '#111111'];
const MODELS = {
  rapido: ['Rápida', 'onnx-community/whisper-tiny_timestamped'],
  bom: ['Boa', 'onnx-community/whisper-base_timestamped'],
  melhor: ['Melhor (mais lenta)', 'onnx-community/whisper-small_timestamped'],
};
const LANGS = { portuguese: 'Português', english: 'Inglês', spanish: 'Espanhol' };
const TRANS = {
  '': 'Nenhuma', punch: 'Punch', zoom: 'Zoom', zoomout: 'Zoom out', whip: 'Chicote →', whipv: 'Chicote ↑',
  spin: 'Giro', shake: 'Tremor', glitch: 'Glitch', blur: 'Desfoque', flash: 'Flash', fade: 'Fade',
};
// transições automáticas: maioria discreta, com uma mais marcante de vez em quando
const AUTO_TR = ['punch', 'zoom', 'punch', 'whip', 'zoom', 'punch', 'glitch', 'zoom', 'punch', 'whipv', 'zoom', 'spin', 'punch', 'shake', 'zoom', 'blur'];
function autoTransitions() {
  let k = 0;
  S.segs.forEach((g, i) => { if (i) g.tr = AUTO_TR[k++ % AUTO_TR.length]; });
}

/* ---------- estado ---------- */
const S = {
  file: null, dur: 0, vw: 0, vh: 0,
  segs: [], words: null, texts: [],
  caps: { on: false, style: 'karaoke', size: 64, y: 0.82, color: '#ffe600', n: 0 },
  zoom: { on: false, amt: 0.14 },
  fmt: 'orig',
  frame: { on: false, style: 'jornal', color: '#e11d2a', text: '', tag: 'URGENTE' },
};
const SAVED = ['segs', 'words', 'texts', 'caps', 'zoom', 'fmt', 'frame'];
let offs = [], total = 0, groups = [], zplan = [], visW = [];
let curSeg = 0, curOut = 0, playing = false, exporting = false, dirty = true, pendingT = null;
let sel = -1, selText = null, hist = [], hi = -1;
let A = null, analysisP = null, thumbs = [], thumbN = 0, tileW = 30, segCanvases = [];
let cfg = { model: 'bom', lang: 'portuguese', logo: { on: true, pos: 'tr', size: 0.3 } };
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
  hi = hist.length - 1; recalc(); saveProject();
}
/* ---------- projeto salvo (continua de onde parou se o app fechar ou der erro) ---------- */
const PROJ = 'cortaja-proj';
let saveT = 0;
function saveProject() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    if (!S.file || !hist[hi]) return;
    try { localStorage.setItem(PROJ, JSON.stringify({ v: 1, at: Date.now(), name: S.file.name, opfs: curOpfs, dur: S.dur, pos: curOut, state: hist[hi] })); }
    catch (e) { console.warn('não salvou', e); }
  }, 400);
}
const savedProject = () => { try { const p = JSON.parse(localStorage.getItem(PROJ) || 'null'); return p && p.v === 1 && p.state ? p : null; } catch (e) { return null; } };
let resumeState = null;
async function resumeProject() {
  const p = savedProject(); if (!p) return;
  if (p.opfs && navigator.storage && navigator.storage.getDirectory) {
    try {
      const fh = await (await navigator.storage.getDirectory()).getFileHandle(p.opfs);
      const f = await fh.getFile();
      p._fromStore = true;
      return loadVideo(new File([f], p.name, { type: f.type || 'video/mp4' }), p);
    } catch (e) { }
  }
  // a cópia não existe mais: pede o mesmo vídeo de novo e aplica a edição salva
  resumeState = p;
  sheetHome(`O app precisa do vídeo <b>${esc(p.name)}</b> de novo para continuar. Escolha o mesmo arquivo.`);
  $('#file').value = ''; $('#file').click();
}
function sheetHome(msg) { toast(msg.replace(/<[^>]+>/g, ''), 6000); }
function showResume() {
  const p = savedProject(), box = $('#resume');
  if (!box) return;
  if (!p) { box.hidden = true; return; }
  const d = new Date(p.at), quando = d.toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR') ? 'hoje às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  box.hidden = false;
  box.innerHTML = `<button class="btn big" id="bResume">Continuar edição</button>
    <p class="sub" style="margin:8px 0 0">${esc(p.name)} · salva ${quando}</p>
    <button class="chip" id="bDiscard" style="margin-top:8px">Descartar edição salva</button>`;
  $('#bResume').onclick = resumeProject;
  $('#bDiscard').onclick = () => { if (confirm('Apagar a edição salva?')) { localStorage.removeItem(PROJ); showResume(); } };
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
    if (wk) { wk.terminate(); wk = null; }       // tira o modelo de voz da memória antes de editar/exportar
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
  groups = []; visW = [];
  if (!S.words) return;
  const N = S.caps.n || CAPSTYLES[S.caps.style].n, maxC = N * 9, vis = [];
  for (const w of S.words) {
    if (!w.text || w.hide) continue;
    const mid = (w.t0 + w.t1) / 2, i = S.segs.findIndex(g => mid >= g.s && mid <= g.e);
    if (i < 0) continue;
    const g = S.segs[i], o0 = offs[i] + Math.max(w.t0, g.s) - g.s, o1 = offs[i] + Math.min(w.t1, g.e) - g.s;
    vis.push({ w, text: w.text, o0, o1: Math.max(o1, o0 + 0.04) });
  }
  visW = vis;
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

let capBox = null, capDrag = false;
function drawCaps(c, W, H, o) {
  capBox = null;
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
  capBox = [W * 0.04, cy - lines.length * lh / 2 - fs * .3, W * 0.92, lines.length * lh + fs * .6];
  if (capDrag && !exporting) { c.save(); c.strokeStyle = '#fff'; c.lineWidth = 2 * u + 1; c.setLineDash([8 * u + 2, 6 * u + 2]); c.strokeRect(...capBox); c.restore(); }
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
    if (t.kind === 'lt') { drawLT(c, W, H, o, t); continue; }
    if (t.kind === 'fx') { drawFX(c, W, H, o, t); continue; }
    if (t.kind === 'img') continue;
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

/* ---------- motion (estilo notícia preto e vermelho; textos sempre tirados da fala) ---------- */
const MX = { red: '#FF4A3A', red2: '#E83426', salmon: '#F69680', white: '#F5F2EE', gray: '#C8BEBA', card: '#1E1817', bg: '#0A0909' };
const FXS = {
  titulo: ['Título numerado', 'Número "01 / 05", título grande e subtítulo em itálico no topo'],
  doodle: ['Palavra rabiscada', 'Uma palavra de impacto com rabisco à mão "fervendo"'],
  mural: ['Mural de manchetes', 'Até 4 etiquetas inclinadas que entram quando são ditas'],
  vidro: ['Texto 3D', 'Frase-síntese em letras 3D vermelhas com brilho'],
  anel: ['Zoom com anel', 'Anel vermelho que se expande e empurra o zoom na frase de virada'],
  cam: ['Câmera em card', 'O vídeo vira um card "CAM · 01" sobre fundo escuro com brilho vermelho'],
  contador: ['Contador', 'Número subindo do zero até o valor falado (R$, %, mil, milhões)'],
  grafico: ['Gráfico', 'Barras crescendo a cada número falado, com o valor em destaque'],
  cta: ['Card de chamada', 'Card de vidro com título, botão "Saiba Mais", selos e cronômetro regressivo'],
  lista: ['Lista com checks', 'Card "Você vai aprender" com itens sendo marcados um a um'],
  tilt: ['Vídeo 3D inclinado', 'O vídeo inclina num card com anel girando e etiquetas flutuando'],
};
const STOP = new Set('a o as os um uma uns umas de da do das dos em na no nas nos por para pra com sem que e é ou se mas mais muito muita já não sim eu tu ele ela nós vós eles elas me te lhe isso isto esse essa este esta aquele aquela aqui ali lá então tá né foi ser ter tem vai vou ao aos à às pelo pela pelos pelas seu sua seus suas meu minha nosso nossa também como quando onde porque porquê qual quais quem'.split(' '));
const clean = w => w.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%]+$/gu, '');
const easeBack = p => { p = clamp(p, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const smooth = p => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wordsIn = (a, b) => visW.filter(v => v.o0 >= a - 0.05 && v.o0 < b);
function fitFont(c, txt, weight, size, maxW, fam = SANS) {
  let f = size; c.font = `${weight} ${f}px ${fam}`;
  while (f > 20 && c.measureText(txt).width > maxW) { f -= 2; c.font = `${weight} ${f}px ${fam}`; }
  return f;
}
const logoOff = (W, H) => { const L = cfg.logo; return L && L.on && marcaImg.naturalWidth ? Math.min(W, H) * (L.size * MARCA.fh / MARCA.fw + 0.02) : 0; };
function fxFade(o, t, inD = 0.25, outD = 0.3) { return clamp(Math.min((o - t.t0) / inD, (t.t1 - o) / outD), 0, 1); }

/* zoom de empurrão do efeito "anel" */
function fxZoom(o) {
  let z = 1;
  for (const t of S.texts) if (t.kind === 'fx' && t.fx === 'anel' && o >= t.t0 && o < t.t0 + 1.4) {
    const p = (o - t.t0) / 1.4; z *= 1 + 0.45 * Math.sin(Math.PI * smooth(p));
  }
  return z;
}
/* layout "câmera em card": encolhe o quadro já desenhado para dentro de um card */
let camCv = null;
function camLayout(W, H, o) {
  const t = S.texts.find(t => t.kind === 'fx' && t.fx === 'cam' && o >= t.t0 && o < t.t1); if (!t) return;
  const k = Math.min(W, H) / 1080, d = o - t.t0, r = t.t1 - o;
  const pin = smooth(d / 0.45), pout = smooth(r / 0.45), m = Math.min(pin, pout), pop = d < 0.6 ? easeBack(d / 0.6) : 1;
  const top = 330 * k + logoOff(W, H), cw0 = 800 * k, ch = Math.min(H - top - 60 * k, cw0 * H / W), cw = Math.min(cw0, ch * W / H), cx = (W - cw) / 2, cy = top;
  const sc = 0.86 + 0.14 * pop;
  const x = cx + (cw - cw * sc) / 2, y = cy + (ch - ch * sc) / 2, w = cw * sc, h = ch * sc;
  const X = x * m, Y = y * m, Wd = W + (w - W) * m, Hd = H + (h - H) * m;
  if (!camCv) camCv = document.createElement('canvas');
  if (camCv.width !== W || camCv.height !== H) { camCv.width = W; camCv.height = H; }
  const cc = camCv.getContext('2d'); cc.drawImage(cv, 0, 0);
  ctx.save();
  ctx.fillStyle = MX.bg; ctx.fillRect(0, 0, W, H);
  for (const [gx, gy, gr] of [[0, H * .5, W * .9], [W * .6, H, W * 1.1]]) {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr); g.addColorStop(0, 'rgba(185,28,20,.55)'); g.addColorStop(1, 'rgba(185,28,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const rad = 40 * k * m;
  ctx.save(); rr(ctx, X, Y, Wd, Hd, rad); ctx.clip();
  // mantém o vídeo inteiro no card (corta só o excesso de proporção)
  const s2 = Math.max(Wd / W, Hd / H), sw = Wd / s2, sh = Hd / s2;
  ctx.drawImage(camCv, (W - sw) / 2, (H - sh) * 0.4, sw, sh, X, Y, Wd, Hd); ctx.restore();
  ctx.strokeStyle = MX.red; ctx.lineWidth = 3 * k + 1; ctx.shadowColor = MX.red; ctx.shadowBlur = 24 * k * m;
  rr(ctx, X, Y, Wd, Hd, rad); ctx.globalAlpha = m; ctx.stroke(); ctx.shadowBlur = 0;
  // etiqueta CAM · 01
  const px = X + 26 * k, py = Y + 26 * k; ctx.font = `700 ${28 * k}px ui-monospace, monospace`;
  const lbl = t.text || 'CAM · 01', lw = ctx.measureText(lbl).width + 70 * k;
  ctx.fillStyle = 'rgba(10,9,9,.8)'; rr(ctx, px, py, lw, 50 * k, 25 * k); ctx.fill();
  if (Math.floor(o * 1.6) % 2 === 0) { ctx.fillStyle = MX.red; ctx.beginPath(); ctx.arc(px + 26 * k, py + 25 * k, 9 * k, 0, 7); ctx.fill(); }
  ctx.fillStyle = MX.white; ctx.textBaseline = 'middle'; ctx.fillText(lbl, px + 46 * k, py + 26 * k);
  ctx.restore();
}

function drawFX(c, W, H, o, t) {
  const k = Math.min(W, H) / 1080, d = o - t.t0, a = fxFade(o, t), up = s2 => (s2 || '').toUpperCase();
  c.save(); c.textBaseline = 'alphabetic'; c.textAlign = 'center';
  let box = null;
  if (t.fx === 'titulo') {
    const off = logoOff(W, H);
    c.translate(0, off);
    const g = c.createLinearGradient(0, -off, 0, 380 * k); g.addColorStop(0, `rgba(10,9,9,${.8 * a})`); g.addColorStop(1, 'rgba(10,9,9,0)');
    c.fillStyle = g; c.fillRect(0, -off, W, 380 * k + off);
    c.globalAlpha = a;
    c.font = `700 ${28 * k}px ui-monospace, monospace`; c.fillStyle = MX.red;
    if ('letterSpacing' in c) c.letterSpacing = `${6 * k}px`;
    const pad = n => String(n).padStart(2, '0');
    c.fillText(`${pad(t.n || 1)}  /  ${pad(t.N || 1)}`, W / 2, 78 * k);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    const sc = 0.92 + 0.08 * easeBack(d / 0.5);
    c.save(); c.translate(W / 2, 190 * k); c.scale(sc, sc);
    const f = fitFont(c, up(t.text), 900, 104 * k, 980 * k); c.fillStyle = MX.white; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 12 * k;
    c.fillText(up(t.text), 0, 0); c.restore();
    if (t.sub) { c.globalAlpha = a * clamp((d - 0.2) / 0.3, 0, 1); fitFont(c, t.sub, 'italic 700', 50 * k, 960 * k, SERIF); c.fillStyle = MX.salmon; c.fillText(t.sub, W / 2, 268 * k); }
    box = [40 * k, 40 * k + off, W - 80 * k, 250 * k];
  } else if (t.fx === 'doodle') {
    const y = t.y * H, sc = easeBack(d / 0.35);
    c.globalAlpha = a; c.save(); c.translate(t.x * W, y); c.scale(sc, sc);
    const f = fitFont(c, up(t.text), 'italic 900', 150 * k, 900 * k), tw = c.measureText(up(t.text)).width;
    c.fillStyle = MX.white; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 16 * k; c.fillText(up(t.text), 0, f * 0.35); c.shadowBlur = 0;
    // rabisco redesenhado 8x por segundo (efeito "fervendo")
    const seed = Math.floor(o * 8), rx = tw / 2 + 50 * k, ry = f * 0.85;
    c.strokeStyle = MX.salmon; c.lineWidth = 8 * k; c.lineCap = 'round'; c.lineJoin = 'round';
    const draw = Math.min(1, d / 0.5);
    c.beginPath();
    for (let i = 0; i <= 44 * draw; i++) {
      const an = -Math.PI * .6 + i / 40 * Math.PI * 2, j = 1 + (rnd(seed * 50 + i) - .5) * .08;
      c.lineTo(Math.cos(an) * rx * j, Math.sin(an) * ry * j);
    }
    c.stroke();
    for (let i = 0; i < 3; i++) {
      const an = -Math.PI * (.62 + i * .12), r1 = rx + 20 * k, r2 = rx + (60 + rnd(seed + i) * 20) * k;
      c.beginPath(); c.moveTo(Math.cos(an) * r1, Math.sin(an) * r1 * .8); c.lineTo(Math.cos(an) * r2, Math.sin(an) * r2 * .8); c.stroke();
    }
    c.beginPath();
    for (let i = 0; i <= 20; i++) { const x = -tw / 2 + tw * i / 20; c.lineTo(x, ry + 26 * k + Math.sin(i * 1.4 + seed) * 9 * k); }
    c.stroke(); c.restore();
    box = [t.x * W - rx, y - ry, rx * 2, ry * 2 + 40 * k];
  } else if (t.fx === 'mural') {
    const tags = (t.items && t.items.length ? t.items : (t.text || '').split('|').map(x => ({ text: x.trim() }))).filter(x => x.text).slice(0, 4);
    const cols = [[MX.white, '#111'], [MX.red2, '#fff'], [MX.card, MX.white], [MX.salmon, '#1a0a08']];
    tags.forEach((tg, i) => {
      const at = tg.o != null ? tg.o : t.t0 + i * 0.5, p = (o - at) / 0.35;
      if (o < at) return;
      const e = easeBack(p), y = t.y * H + i * 118 * k, side = i % 2 ? 1 : -1, rot = (i % 2 ? 3 : -3) * Math.PI / 180;
      c.save(); c.globalAlpha = a * clamp(p * 2, 0, 1);
      c.translate(W / 2 + side * 60 * k + side * (1 - e) * 500 * k, y); c.rotate(rot); const sc = 1.25 - 0.25 * e; c.scale(sc, sc);
      const f = fitFont(c, up(tg.text), 900, 60 * k, 820 * k), tw = c.measureText(up(tg.text)).width;
      c.fillStyle = cols[i][0]; c.fillRect(-tw / 2 - 28 * k, -f * .85, tw + 56 * k, f * 1.3);
      c.fillStyle = cols[i][1]; c.textBaseline = 'middle'; c.fillText(up(tg.text), 0, -f * .2);
      c.restore();
    });
    box = [80 * k, t.y * H - 60 * k, W - 160 * k, 118 * k * Math.max(1, tags.length)];
  } else if (t.fx === 'vidro') {
    const y = t.y * H, sc = 0.7 + 0.3 * easeBack(d / 0.45), lines = [up(t.text), up(t.sub)].filter(Boolean);
    c.globalAlpha = a; c.save(); c.translate(t.x * W, y); c.scale(sc, sc);
    lines.forEach((ln, li) => {
      const f = fitFont(c, ln, 900, (li ? 96 : 130) * k, 960 * k), yy = li * f * 1.1 + (li ? 30 * k : 0);
      for (let L = 14; L > 0; L--) { c.fillStyle = `rgb(${40 + L * 3},${8 + L},${6 + L})`; c.fillText(ln, L * 1.3 * k, yy + L * 1.7 * k); }
      const g = c.createLinearGradient(0, yy - f * .8, 0, yy + f * .1);
      g.addColorStop(0, MX.salmon); g.addColorStop(.5, MX.red); g.addColorStop(1, '#8e130c');
      c.shadowColor = 'rgba(255,74,58,.6)'; c.shadowBlur = 30 * k; c.fillStyle = g; c.fillText(ln, 0, yy); c.shadowBlur = 0;
      c.save(); c.beginPath(); c.rect(-W, yy - f * .8, W * 2, f * .22); c.clip(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillText(ln, 0, yy); c.restore();
    });
    c.restore();
    box = [80 * k, y - 140 * k, W - 160 * k, 280 * k];
  } else if (t.fx === 'anel') {
    const p = clamp(d / 0.9, 0, 1), R = 170 * k + (1600 * k - 170 * k) * easeOut(p), cx = W / 2, cy = H * 0.42;
    if (p < 1) { c.globalAlpha = (1 - p) * a; c.strokeStyle = MX.red; c.lineWidth = 16 * k; c.shadowColor = MX.red; c.shadowBlur = 40 * k; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.shadowBlur = 0; }
    if (t.text) {
      const q = clamp((d - 0.35) / 0.3, 0, 1); c.globalAlpha = a * q;
      c.save(); c.translate(W / 2, t.y * H); const s3 = 0.9 + 0.1 * easeBack(q); c.scale(s3, s3);
      fitFont(c, up(t.text), 900, 92 * k, 960 * k); c.fillStyle = MX.white; c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 18 * k; c.fillText(up(t.text), 0, 0); c.restore();
    }
    box = [80 * k, t.y * H - 90 * k, W - 160 * k, 120 * k];
  } else if (t.fx === 'contador') box = drawCounter(c, W, H, o, t, k, a);
  else if (t.fx === 'grafico') box = drawChart(c, W, H, o, t, k, a);
  else if (t.fx === 'cta') box = drawCTA(c, W, H, o, t, k, a);
  else if (t.fx === 'lista') box = drawList(c, W, H, o, t, k, a);
  else if (t.fx === 'cam') {
    box = null;
  }
  c.restore();
  t._box = box;
  if (box && selText === t.id && !exporting) { c.save(); c.strokeStyle = '#fff'; c.lineWidth = 2 * k + 1; c.setLineDash([8 * k + 2, 6 * k + 2]); c.strokeRect(...box); c.restore(); }
}

/* escolhas automáticas a partir da fala */
function blocksFromSpeech() {
  const B = []; let cur = null;
  for (let i = 0; i < visW.length; i++) {
    const v = visW[i], prev = visW[i - 1], gap = prev ? v.o0 - prev.o1 : 9;
    const end = /[.!?…]$/.test(prev ? prev.text : '');
    if (!cur || (cur.ws.length && v.o0 - cur.o0 > 6 && (gap > 0.45 || end)) || v.o0 - (cur ? cur.o0 : 0) > 14) { cur = { ws: [], o0: v.o0 }; B.push(cur); }
    cur.ws.push(v); cur.o1 = v.o1;
  }
  // junta blocos muito curtos com o anterior
  for (let i = B.length - 1; i > 0; i--) if (B[i].o1 - B[i].o0 < 3) { B[i - 1].ws.push(...B[i].ws); B[i - 1].o1 = B[i].o1; B.splice(i, 1); }
  return B;
}
const firstPhrase = (ws, n) => { const out = []; for (const w of ws) { out.push(clean(w.text)); if (out.length >= n || /[.!?,;:…]$/.test(w.text)) break; } return out.filter(Boolean).join(' '); };
const keyWords = ws => ws.filter(w => { const c2 = clean(w.text).toLowerCase(); return c2.length >= 5 && !STOP.has(c2); });
function autoMotion() {
  if (!visW.length) return false;
  S.texts = S.texts.filter(t => t.kind !== 'fx');
  const B = blocksFromSpeech(), N = Math.min(B.length, 9), add = t => S.texts.push({ id: 'f' + Math.random().toString(36).slice(2, 9), kind: 'fx', x: 0.5, y: 0.66, ...t });
  const cycle = ['doodle', 'mural', 'vidro', 'anel'];
  add({ fx: 'cam', text: 'CAM · 01', t0: 0, t1: Math.min(total, Math.max(3.5, B[0] ? B[0].o1 * 0.5 : 4)) });
  B.slice(0, N).forEach((b, i) => {
    const ttl = firstPhrase(b.ws, 4), rest = b.ws.slice(ttl.split(' ').length);
    add({ fx: 'titulo', text: ttl, sub: firstPhrase(rest, 5), n: i + 1, N, t0: b.o0, t1: Math.min(b.o0 + 3.2, b.o1), y: 0.1 });
    const kw = keyWords(b.ws).filter(w => w.o0 > b.o0 + 3.3), kind = cycle[i % cycle.length];
    if (!kw.length) return;
    if (kind === 'doodle') { const w = kw.reduce((m2, w2) => clean(w2.text).length > clean(m2.text).length ? w2 : m2); add({ fx: 'doodle', text: clean(w.text), t0: w.o0, t1: Math.min(b.o1, w.o0 + 1.8) }); }
    else if (kind === 'mural') { const seen = new Set(), items = []; for (const w of kw) { const c2 = clean(w.text); if (!seen.has(c2.toLowerCase())) { seen.add(c2.toLowerCase()); items.push({ text: c2, o: w.o0 }); } if (items.length === 4) break; }
      add({ fx: 'mural', items, text: items.map(x => x.text).join(' | '), t0: items[0].o, t1: Math.min(b.o1, items[items.length - 1].o + 2), y: 0.62 }); }
    else if (kind === 'vidro') {
      const sents = []; let cs = [];
      for (const w of b.ws) { cs.push(w); if (/[.!?…]$/.test(w.text)) { sents.push(cs); cs = []; } }
      if (cs.length) sents.push(cs);
      const cand = sents.filter(x => x.length >= 2 && x[0].o0 > b.o0 + 3.3).sort((p2, q2) => p2.length - q2.length)[0] || sents[sents.length - 1];
      const ws2 = cand.slice(0, 6), ci = ws2.findIndex(w => /,$/.test(w.text)), cut = ci >= 0 && ci < ws2.length - 1 ? ci + 1 : Math.min(2, ws2.length);
      add({ fx: 'vidro', text: ws2.slice(0, cut).map(w => clean(w.text)).join(' '), sub: ws2.slice(cut).map(w => clean(w.text)).join(' '),
        t0: Math.max(ws2[0].o0, b.o0 + 3.3), t1: Math.min(total, ws2[ws2.length - 1].o1 + 1.5), y: 0.7 }); }
    else { const w = kw[0], idx = b.ws.indexOf(w); add({ fx: 'anel', text: b.ws.slice(idx, idx + 3).map(x => clean(x.text)).join(' '), t0: w.o0, t1: Math.min(b.o1, w.o0 + 2.2), y: 0.68 }); }
  });
  autoNumbers();
  return true;
}

function openMotion(id) {
  pause();
  const t = id && S.texts.find(t => t.id === id);
  if (!t) {
    const n = S.texts.filter(x => x.kind === 'fx').length;
    sheet('Motion', `<p>Efeitos no estilo de notícia preto e vermelho. Os textos vêm da sua fala (dá para editar).</p>
      <button class="btn wide" id="mxAuto">Estilo notícia automático</button>
      <button class="btn ghost wide" id="mxNum">Só números e gráficos da fala</button>
      ${S.words ? '' : '<p class="note">Para o automático, gere as legendas primeiro (Legendas → Gerar). Ele precisa saber o que foi falado.</p>'}
      <p class="note">Ou adicione um efeito no ponto da agulha:</p>
      <div class="grid2">${Object.entries(FXS).map(([k2, v]) => `<button class="sty" data-fxa="${k2}"><span style="font-size:13px">${v[0]}</span><small>${v[1]}</small></button>`).join('')}</div>
      ${n ? `<button class="btn danger wide" id="mxClr">Remover os ${n} efeitos</button>` : ''}`, b => {
      b.querySelector('#mxAuto').onclick = () => {
        if (!S.words) return toast('Gere as legendas primeiro: o automático usa as palavras da fala.', 4500);
        if (!autoMotion()) return toast('Não encontrei fala suficiente para montar os efeitos.', 4000);
        commit(); closeSheet(); seekOut(0); toast(`Pronto: ${S.texts.filter(x => x.kind === 'fx').length} efeitos montados com a sua fala. Toque ▶ para ver.`, 4500);
      };
      b.querySelector('#mxNum').onclick = () => {
        if (!S.words) return toast('Gere as legendas primeiro: o app precisa saber os números falados.', 4500);
        S.texts = S.texts.filter(x => !(x.kind === 'fx' && (x.fx === 'contador' || x.fx === 'grafico')));
        const n = autoNumbers(); if (!n) return toast('Não encontrei números na fala.', 4000);
        commit(); closeSheet(); toast(`${n} ${n > 1 ? 'contadores/gráficos montados' : 'contador/gráfico montado'} com os números que você falou.`, 4500);
      };
      on(b, '[data-fxa]', 'click', el => {
        const fx = el.dataset.fxa, t0 = Math.min(curOut, Math.max(0, total - 0.5)), ws = wordsIn(t0, t0 + 3).map(w => clean(w.text)).filter(Boolean);
        const kw = ws.filter(w => w.length >= 5 && !STOP.has(w.toLowerCase()));
        const nums = spokenNumbers().filter(n2 => n2.o0 >= t0 - 0.3 && n2.o0 < t0 + 8);
        const nt = { id: 'f' + Date.now(), kind: 'fx', fx, x: 0.5, y: { titulo: 0.1, mural: 0.62, vidro: 0.7, anel: 0.68, doodle: 0.66, cam: 0.5 }[fx], t0,
          t1: Math.min(total, t0 + ({ cam: 5, titulo: 3.2, mural: 3.5 }[fx] || 2.2)), n: 1, N: 1,
          text: fx === 'cam' ? 'CAM · 01' : fx === 'doodle' ? (kw.sort((p2, q2) => q2.length - p2.length)[0] || ws[0] || 'IMPACTO') : fx === 'mural' ? (kw.slice(0, 4).join(' | ') || 'MANCHETE') : ws.slice(0, fx === 'titulo' ? 4 : 3).join(' ') || 'SEU TEXTO',
          sub: fx === 'titulo' ? ws.slice(4, 9).join(' ') : '' };
        if (fx === 'cta') Object.assign(nt, { text: 'Aula gratuita', chip: 'Acesso liberado', btn: 'Saiba Mais', badge: 'Corre!', timer: 600, timerLbl: 'Restam', y: 0.8, c1: cfg.ctaColor || OR, t1: Math.min(total, t0 + 5) });
        if (fx === 'lista') Object.assign(nt, { text: 'Você vai aprender', sub: 'Primeiro item | Segundo item | Terceiro item', y: 0.78, c1: cfg.ctaColor || OR, t1: Math.min(total, t0 + 4.5) });
        if (fx === 'tilt') Object.assign(nt, { text: 'Legendas | Zoom | Edição dinâmica', c1: cfg.ctaColor || OR, t1: Math.min(total, t0 + 4) });
        if (fx === 'contador' || fx === 'grafico') { nt.text = fx === 'contador' ? (nums[0] ? nums[0].shown : '100') : (nums.length >= 2 ? nums.slice(0, 5).map(n2 => n2.shown).join(' | ') : '10 | 25 | 40'); nt.sub = nums[0] ? nums[0].label : ''; nt.y = 0.68; }
        S.texts.push(nt); commit(); openMotion(nt.id);
      });
      const clr = b.querySelector('#mxClr'); if (clr) clr.onclick = () => { S.texts = S.texts.filter(x => x.kind !== 'fx'); selText = null; commit(); openMotion(); };
    });
    return;
  }
  selText = t.id; dirty = true;
  if (curOut < t.t0 + 0.3 || curOut >= t.t1) seekOut(Math.min(t.t0 + (t.fx === 'titulo' ? 0.8 : 0.6), t.t1 - 0.05));
  const hasSub = ['titulo', 'vidro', 'contador', 'grafico', 'lista'].includes(t.fx), orange = ['cta', 'lista', 'tilt'].includes(t.fx);
  sheet(FXS[t.fx][0], `<p class="note">${FXS[t.fx][1]}</p>
    <input type="text" id="mxT" value="${esc(t.fx === 'grafico' && t.items ? t.items.map(x => x.text).join(' | ') : t.text || '')}" placeholder="${t.fx === 'mural' || t.fx === 'tilt' ? 'Etiquetas separadas por |' : t.fx === 'cta' ? 'Título (ex.: Aula gratuita)' : t.fx === 'lista' ? 'Título (ex.: Você vai aprender)' : t.fx === 'contador' ? 'Número (ex.: R$ 176 MI, 30%, 1.500)' : t.fx === 'grafico' ? 'Valores separados por | (ex.: 10 | 25 | 40)' : 'Texto'}">
    ${hasSub ? `<input type="text" id="mxS" value="${esc(t.sub || '')}" placeholder="${t.fx === 'lista' ? 'Itens separados por |' : t.fx === 'titulo' ? 'Subtítulo (opcional)' : t.fx === 'contador' || t.fx === 'grafico' ? 'Rótulo (ex.: moradores, investimento)' : 'Segunda linha (opcional)'}">` : ''}
    ${t.fx === 'titulo' ? `<div class="row"><label class="fld grow">Número<input type="number" id="mxN" min="1" max="99" value="${t.n || 1}"></label><label class="fld grow">De<input type="number" id="mxNN" min="1" max="99" value="${t.N || 1}"></label></div>` : ''}
    ${t.fx === 'cta' ? `<input type="text" id="mxC" value="${esc(t.chip || '')}" placeholder="Selo de cima (ex.: Acesso liberado)">
      <input type="text" id="mxBt" value="${esc(t.btn || '')}" placeholder="Texto do botão (ex.: Saiba Mais)">
      <input type="text" id="mxBd" value="${esc(t.badge || '')}" placeholder="Aviso no canto (ex.: Corre!) — opcional">
      <div class="row"><label class="fld grow">Cronômetro (minutos, 0 = sem)<input type="number" id="mxTm" min="0" max="99" value="${Math.round((t.timer || 0) / 60)}"></label></div>` : ''}
    ${orange ? `<p class="note">Cor</p><div class="row">${COLORS.concat([OR]).map(cl => `<button class="sw${cl === t.c1 ? ' on' : ''}" data-mc="${cl}" style="background:${cl}"></button>`).join('')}</div>` : ''}
    ${t.fx !== 'titulo' && t.fx !== 'cam' && t.fx !== 'tilt' ? '<p class="note">Dica: arraste o efeito no vídeo para mudar a altura.</p>' : ''}
    <p class="note" id="mxI"></p>
    <div class="row"><button class="chip" id="mxA">Começa na agulha</button><button class="chip" id="mxB">Termina na agulha</button></div>
    <button class="btn ghost wide" id="mxBack">Outros efeitos</button>
    <button class="btn danger wide" id="mxDel">Excluir efeito</button>`, b => {
    const info = () => b.querySelector('#mxI').textContent = `Aparece de ${fmtT(t.t0)} até ${fmtT(Math.min(t.t1, total))}`; info();
    const iT = b.querySelector('#mxT'), iS = b.querySelector('#mxS');
    iT.oninput = () => { t.text = iT.value; if (t.fx === 'mural' || t.fx === 'grafico') t.items = null; dirty = true; }; iT.onchange = () => commit();
    if (iS) { iS.oninput = () => { t.sub = iS.value; dirty = true; }; iS.onchange = () => commit(); }
    on(b, '#mxN', 'change', el => { t.n = +el.value || 1; commit(); });
    for (const [id2, key] of [['#mxC', 'chip'], ['#mxBt', 'btn'], ['#mxBd', 'badge']]) { const el = b.querySelector(id2); if (el) { el.oninput = () => { t[key] = el.value; dirty = true; }; el.onchange = () => commit(); } }
    on(b, '#mxTm', 'change', el => { t.timer = Math.max(0, +el.value || 0) * 60; commit(); });
    on(b, '[data-mc]', 'click', el => { t.c1 = el.dataset.mc; cfg.ctaColor = t.c1; saveCfg(); commit(); openMotion(t.id); });
    on(b, '#mxNN', 'change', el => { t.N = +el.value || 1; commit(); });
    b.querySelector('#mxA').onclick = () => { if (curOut >= t.t1 - 0.2) t.t1 = Math.min(total, curOut + 2.5); t.t0 = Math.min(curOut, t.t1 - 0.2); if (t.items) t.items = null; commit(); info(); };
    b.querySelector('#mxB').onclick = () => { if (curOut <= t.t0 + 0.2) return toast('Mova a agulha para depois do começo.'); t.t1 = curOut; commit(); info(); };
    b.querySelector('#mxBack').onclick = () => { selText = null; openMotion(); };
    b.querySelector('#mxDel').onclick = () => { S.texts = S.texts.filter(x => x !== t); selText = null; commit(); closeSheet(); };
  });
}

/* ---------- números falados → contador e gráfico ---------- */
const NUM_WORDS = { dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300, quinhentos: 500 };
const fmtNum = (v, dec) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
function parseShown(s) {           // "R$ 176,5 MI" → { pre: 'R$ ', v: 176.5, dec: 1, suf: ' MI' }
  const m = String(s || '').match(/^(.*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(.*)$/);
  if (!m) return null;
  return { pre: m[1], v: parseFloat(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : '')), dec: m[3] ? m[3].length : 0, suf: m[4] };
}
/* acha números na fala: dígitos (176, 1.500, 2,5, 30%) e alguns por extenso, com "mil/milhões", "%", "R$/reais" */
function spokenNumbers() {
  const out = [];
  for (let i = 0; i < visW.length; i++) {
    const raw = visW[i].text, w = clean(raw), lw = w.toLowerCase();
    let v = null, dec = 0, pre = '', suf = '', used = 1;
    const dm = raw.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?/);
    if (dm) { v = parseFloat(dm[1].replace(/\./g, '') + (dm[2] ? '.' + dm[2] : '')); dec = dm[2] ? dm[2].length : 0; if (/%/.test(raw)) suf = '%'; if (/R\$/.test(raw)) pre = 'R$ '; }
    else if (NUM_WORDS[lw] && i + 1 < visW.length && /^(mil|milh|bilh|por|reais|anos|pessoas|casas|famílias|vezes|dias|meses|metros|quilômetros|km)/i.test(clean(visW[i + 1].text))) v = NUM_WORDS[lw];
    if (v == null || !isFinite(v)) continue;
    const year = !pre && !suf && !dec && v >= 1900 && v <= 2100 && !/\./.test(raw);
    const prev = i ? clean(visW[i - 1].text) : '';
    if (/^R\$$/i.test(visW[i - 1] ? visW[i - 1].text.trim() : '') || /^R\$/.test(prev)) pre = 'R$ ';
    for (let j = i + 1; j < Math.min(visW.length, i + 4); j++) {
      const n = clean(visW[j].text).toLowerCase();
      if (/^mil$/.test(n)) { suf = ' MIL' + suf; used = j - i + 1; }
      else if (/^milh/.test(n)) { suf = ' MI' + suf; used = j - i + 1; }
      else if (/^bilh/.test(n)) { suf = ' BI' + suf; used = j - i + 1; }
      else if (n === 'por' && visW[j + 1] && /^cento/i.test(clean(visW[j + 1].text))) { suf += '%'; used = j - i + 2; break; }
      else if (/^reais/.test(n)) { pre = 'R$ '; used = j - i + 1; break; }
      else if (n === 'de' && /^reais/i.test(clean((visW[j + 1] || {}).text || ''))) { pre = 'R$ '; used = j - i + 2; break; }
      else break;
    }
    const ctx2 = []; for (const x of visW.slice(i + used, i + used + 4)) { const c2 = clean(x.text); if (!c2 || /\d/.test(c2)) break; if (!STOP.has(c2.toLowerCase())) ctx2.push(c2); if (ctx2.length === 2 || /[.,;:!?]$/.test(x.text)) break; }
    out.push({ v, dec, pre, suf, year, o0: visW[i].o0, o1: visW[i + used - 1].o1, label: ctx2.join(' '), shown: year ? String(v) : pre + fmtNum(v, dec) + suf });
    i += used - 1;
  }
  return out;
}
/* agrupa números próximos: 2 ou mais em ~8 s viram gráfico; sozinho vira contador */
function autoNumbers() {
  // ano seguido de um valor ("em 2022 eram 300") vira um par: rótulo = ano, valor = número
  const raw = spokenNumbers().filter(n => !(n.v < 2 && !n.suf && !n.pre)), N = [];
  for (let i = 0; i < raw.length; i++) {
    const n = raw[i], nx = raw[i + 1];
    if (n.year && nx && !nx.year && nx.o0 - n.o1 < 1.6) { N.push({ ...nx, tag: n.shown, o0: n.o0 }); i++; }
    else if (!n.year) N.push(n);
  }
  if (!N.length) return 0;
  const unit = n => n.pre + n.suf;
  const add = t => S.texts.push({ id: 'f' + Math.random().toString(36).slice(2, 9), kind: 'fx', x: 0.5, ...t });
  let made = 0;
  for (let i = 0; i < N.length;) {
    let j = i + 1;
    while (j < N.length && j - i < 5 && N[j].o0 - N[j - 1].o1 < 6 && unit(N[j]) === unit(N[i])) {
      const a2 = !!N[j - 1].tag, b2 = !!N[j].tag;
      if (a2 !== b2 && !(a2 && N[j].o0 - N[j - 1].o1 < 3)) break;    // não mistura série de anos com número solto
      if (a2 && !b2) { const pw = visW.find(v => v.o1 <= N[j].o0 && v.o1 > N[j].o0 - 1.2 && /^(hoje|agora|atualmente)$/i.test(clean(v.text))); N[j].tag = pw ? clean(pw.text).toUpperCase() : N[j].shown; }
      j++;
    }
    const grp = N.slice(i, j), t0 = grp[0].o0 - 0.15, last = grp[grp.length - 1];
    // números ganham prioridade: tira efeitos de texto que coincidem
    S.texts = S.texts.filter(t => !(t.kind === 'fx' && ['doodle', 'mural', 'vidro', 'anel'].includes(t.fx) && t.t0 < last.o1 + 2.5 && t.t1 > t0));
    if (grp.length >= 2) add({ fx: 'grafico', t0, t1: Math.min(total, last.o1 + 3), y: 0.68, text: last.shown, sub: last.label || grp[0].label,
      items: grp.map(n => ({ text: n.tag || n.shown, val: n.shown, v: n.v, o: n.o0 })) });
    else add({ fx: 'contador', t0, t1: Math.min(total, last.o1 + 2.6), y: 0.68, text: last.shown, sub: last.label });
    made++; i = j;
  }
  // um número não fica por cima do outro
  const nf = S.texts.filter(t => t.kind === 'fx' && (t.fx === 'contador' || t.fx === 'grafico')).sort((p2, q2) => p2.t0 - q2.t0);
  for (let i = 0; i < nf.length - 1; i++) if (nf[i].t1 > nf[i + 1].t0) nf[i].t1 = Math.max(nf[i].t0 + 1, nf[i + 1].t0);
  return made;
}
function drawCounter(c, W, H, o, t, k, a) {
  const P = parseShown(t.text) || { pre: '', v: 0, dec: 0, suf: t.text || '' };
  const d = o - t.t0, p = easeOut(d / 1.3), pop = easeBack(d / 0.4), y = t.y * H;
  const cur = P.pre + fmtNum(P.v * p, p < 1 ? (P.v >= 100 ? 0 : P.dec) : P.dec) + P.suf;
  // cantos de mira na tela
  c.globalAlpha = a * 0.9; c.strokeStyle = MX.red; c.lineWidth = 6 * k; c.lineCap = 'round';
  const m = 70 * k + (1 - pop) * 40 * k, L = 70 * k;
  for (const [x, y2, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { c.beginPath(); c.moveTo(x, y2 + dy * L); c.lineTo(x, y2); c.lineTo(x + dx * L, y2); c.stroke(); }
  c.globalAlpha = a;
  c.save(); c.translate(W / 2, y); const sc = 0.85 + 0.15 * pop; c.scale(sc, sc);
  const f = fitFont(c, P.pre + fmtNum(P.v, P.dec) + P.suf, 900, 150 * k, 820 * k), bw = Math.max(c.measureText(P.pre + fmtNum(P.v, P.dec) + P.suf).width + 120 * k, 520 * k), bh = f * 1.25 + (t.sub ? 70 * k : 30 * k);
  c.fillStyle = 'rgba(30,24,23,.93)'; c.shadowColor = MX.red; c.shadowBlur = 40 * k; rr(c, -bw / 2, -bh / 2, bw, bh, 28 * k); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = MX.red; c.lineWidth = 4 * k; rr(c, -bw / 2, -bh / 2, bw, bh, 28 * k); c.stroke();
  if (t.sub) { c.font = `700 ${30 * k}px ui-monospace, monospace`; c.fillStyle = MX.red; if ('letterSpacing' in c) c.letterSpacing = `${5 * k}px`; c.fillText(t.sub.toUpperCase(), 0, -bh / 2 + 52 * k); if ('letterSpacing' in c) c.letterSpacing = '0px'; }
  c.font = `900 ${f}px ${SANS}`; c.fillStyle = MX.white; c.shadowColor = 'rgba(255,74,58,.55)'; c.shadowBlur = 24 * k;
  c.fillText(cur, 0, (t.sub ? 34 * k : 0) + f * 0.36);
  c.restore();
  return [W / 2 - bw / 2, y - bh / 2, bw, bh];
}
function drawChart(c, W, H, o, t, k, a) {
  let items = t.items && t.items.length ? t.items : String(t.text || '').split('|').map(x => ({ text: x.trim() })).filter(x => x.text);
  items = items.slice(0, 5).map((it, i) => ({ ...it, v: it.v != null ? it.v : (parseShown(it.text) || { v: i + 1 }).v, o: it.o != null ? it.o : t.t0 + 0.3 + i * 0.45 }));
  if (!items.length) return null;
  const years = items.every(it => !it.val && it.v >= 1900 && it.v <= 2100 && !/[%$]/.test(it.text));
  const max = Math.max(...items.map(it => Math.abs(it.v))) || 1;
  const cw = 880 * k, ch = 440 * k, x0 = (W - cw) / 2, y0 = t.y * H - ch / 2, d = o - t.t0, pop = easeBack(d / 0.4);
  c.save(); c.globalAlpha = a; c.translate(W / 2, t.y * H); const sc = 0.9 + 0.1 * pop; c.scale(sc, sc); c.translate(-W / 2, -t.y * H);
  c.fillStyle = 'rgba(30,24,23,.93)'; c.shadowColor = 'rgba(255,74,58,.5)'; c.shadowBlur = 36 * k; rr(c, x0, y0, cw, ch, 30 * k); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255,74,58,.6)'; c.lineWidth = 3 * k; rr(c, x0, y0, cw, ch, 30 * k); c.stroke();
  // número grande: o último já dito
  let lastIdx = 0; items.forEach((it, i) => { if (o >= it.o) lastIdx = i; });
  const big = items[lastIdx], bigT = big.val || big.text, P = parseShown(bigT), bp = easeOut((o - big.o) / 0.9);
  c.textAlign = 'left'; c.font = `900 ${84 * k}px ${SANS}`; c.fillStyle = MX.white;
  c.fillText(P && !years ? P.pre + fmtNum(P.v * clamp(bp, 0, 1), bp < 1 && P.v >= 100 ? 0 : P.dec) + P.suf : bigT, x0 + 44 * k, y0 + 108 * k);
  if (t.sub) { c.font = `700 ${28 * k}px ui-monospace, monospace`; c.fillStyle = MX.red; if ('letterSpacing' in c) c.letterSpacing = `${4 * k}px`; c.fillText(t.sub.toUpperCase(), x0 + 46 * k, y0 + 156 * k); if ('letterSpacing' in c) c.letterSpacing = '0px'; }
  // barras crescendo quando cada número é dito (anos = etapas, não valores)
  const n = items.length, gap = 28 * k, bx0 = x0 + 44 * k, bwid = (cw - 88 * k - gap * (n - 1)) / n, base = y0 + ch - 70 * k, hmax = ch - 250 * k;
  items.forEach((it, i) => {
    const g2 = easeBack((o - it.o) / 0.6); if (o < it.o) return;
    const hgt = (years ? (i + 1) / n : Math.max(0.08, Math.abs(it.v) / max)) * hmax * clamp(g2, 0, 1.08);
    const x = bx0 + i * (bwid + gap), gr = c.createLinearGradient(0, base - hgt, 0, base);
    gr.addColorStop(0, MX.salmon); gr.addColorStop(1, MX.red2);
    c.fillStyle = gr; rr(c, x, base - hgt, bwid, hgt, 10 * k); c.fill();
    c.font = `700 ${Math.min(30 * k, bwid / 4)}px ui-monospace, monospace`; c.fillStyle = MX.gray; c.textAlign = 'center';
    c.fillText(it.text, x + bwid / 2, base + 44 * k);
    if (it.val && g2 > 0.6) { c.fillStyle = MX.white; c.font = `800 ${Math.min(30 * k, bwid / 3.5)}px ${SANS}`; c.fillText(it.val, x + bwid / 2, base - hgt - 14 * k); }
  });
  c.restore();
  return [x0, y0, cw, ch];
}

/* ---------- imagens / B-roll ---------- */
const IMG_MODES = { topo: 'Metade de cima', cheia: 'Tela cheia', janela: 'Janela' };
const imgCache = {};
const imgEl = t => { let im = imgCache[t.id]; if (!im || im._src !== t.src) { im = new Image(); im._src = t.src; im.onload = () => { dirty = true; }; im.src = t.src; imgCache[t.id] = im; } return im; };
function shrinkImage(file) {          // reduz para caber no salvamento automático
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1080 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagem')); };
    im.src = url;
  });
}
function drawImgs(W, H, o) {
  const k = Math.min(W, H) / 1080;
  for (const t of S.texts) {
    if (t.kind !== 'img') continue;
    t._box = null;
    if (o < t.t0 || o >= t.t1) continue;
    const im = imgEl(t); if (!im.naturalWidth) continue;
    const d = o - t.t0, pin = smooth(d / 0.4), pout = smooth((t.t1 - o) / 0.35), m = Math.min(pin, pout);
    const kb = 1.04 + 0.08 * clamp(d / Math.max(1, t.t1 - t.t0), 0, 1);       // zoom lento (Ken Burns)
    let x, y, w, h, rad = 0;
    if (t.mode === 'cheia') { x = 0; y = 0; w = W; h = H; }
    else if (t.mode === 'janela') { w = W * t.size; h = w * 0.62; x = t.x * W - w / 2; y = t.y * H - h / 2; rad = 28 * k; }
    else { x = 0; y = 0; w = W; h = H * 0.46; }
    ctx.save();
    ctx.globalAlpha = t.mode === 'cheia' ? m : 1;
    const oy = t.mode === 'topo' ? -(1 - m) * h : t.mode === 'janela' ? (1 - m) * 60 * k : 0;
    const sc = t.mode === 'janela' ? 0.85 + 0.15 * easeBack(d / 0.45) : 1;
    ctx.translate(x + w / 2, y + h / 2 + oy); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
    if (t.mode === 'janela') { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30 * k; ctx.fillStyle = '#000'; rr(ctx, x, y, w, h, rad); ctx.fill(); ctx.shadowBlur = 0; }
    ctx.save(); rr(ctx, x, y, w, h, rad); ctx.clip();
    const s0 = Math.max(w / im.naturalWidth, h / im.naturalHeight) * kb, iw = im.naturalWidth * s0, ih = im.naturalHeight * s0;
    ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    if (t.mode === 'topo') { const g = ctx.createLinearGradient(0, y + h - 90 * k, 0, y + h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    if (t.mode !== 'cheia') { ctx.strokeStyle = t.c1 || '#ff7a1a'; ctx.lineWidth = 4 * k; ctx.shadowColor = t.c1 || '#ff7a1a'; ctx.shadowBlur = 18 * k;
      if (t.mode === 'janela') { rr(ctx, x, y, w, h, rad); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(0, y + h); ctx.lineTo(W, y + h); ctx.stroke(); } }
    ctx.restore();
    t._box = t.mode === 'janela' ? [x, y, w, h] : [0, y, W, h];
    if (selText === t.id && !exporting) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * k + 1; ctx.setLineDash([8 * k + 2, 6 * k + 2]); ctx.strokeRect(...t._box); ctx.restore(); }
  }
}
let imgPick = null;
function pickImage(cb) {
  let inp = document.getElementById('imgFile');
  if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'imgFile'; inp.hidden = true; document.body.appendChild(inp);
    inp.onchange = async () => { const f = inp.files[0]; inp.value = ''; if (!f || !imgPick) return; busy('Preparando a imagem…'); try { const src = await shrinkImage(f); idle(); imgPick(src); } catch (e) { idle(); toast('Não consegui abrir essa imagem.'); } }; }
  imgPick = cb; inp.click();
}
function openImg(id) {
  pause();
  let t = id && S.texts.find(t => t.id === id);
  if (!t) {
    return pickImage(src => {
      const t0 = Math.min(curOut, Math.max(0, total - 0.5));
      const nt = { id: 'i' + Date.now(), kind: 'img', src, mode: cfg.imgMode || 'topo', size: 0.5, x: 0.72, y: 0.3, c1: cfg.imgColor || '#ff7a1a', t0, t1: Math.min(total, t0 + 4), text: 'Imagem' };
      S.texts.push(nt); commit(); openImg(nt.id);
    });
  }
  selText = t.id; dirty = true;
  if (curOut < t.t0 + 0.3 || curOut >= t.t1) seekOut(Math.min(t.t0 + 0.6, t.t1 - 0.05));
  sheet('Imagem', `<p class="note">Imagem por cima do vídeo (B-roll), com zoom lento.</p>
    <div class="row">${Object.entries(IMG_MODES).map(([k2, v]) => `<button class="chip${t.mode === k2 ? ' on' : ''}" data-im="${k2}">${v}</button>`).join('')}</div>
    ${t.mode === 'janela' ? `${range('imS', 'Tamanho', 0.3, 0.9, 0.01, t.size)}<p class="note">Arraste a janela no vídeo para mudar de lugar.</p>` : ''}
    ${t.mode !== 'cheia' ? `<p class="note">Cor da borda</p><div class="row">${COLORS.map(cl => `<button class="sw${cl === t.c1 ? ' on' : ''}" data-ic="${cl}" style="background:${cl}"></button>`).join('')}</div>` : ''}
    <p class="note" id="imI"></p>
    <div class="row"><button class="chip" id="imA">Começa na agulha</button><button class="chip" id="imB">Termina na agulha</button></div>
    <button class="btn ghost wide" id="imSw">Trocar imagem</button>
    <button class="btn ghost wide" id="imNew">Adicionar outra imagem</button>
    <button class="btn danger wide" id="imDel">Excluir imagem</button>`, b => {
    const info = () => b.querySelector('#imI').textContent = `Aparece de ${fmtT(t.t0)} até ${fmtT(Math.min(t.t1, total))}`; info();
    on(b, '[data-im]', 'click', el => { t.mode = el.dataset.im; cfg.imgMode = t.mode; saveCfg(); commit(); openImg(t.id); });
    on(b, '[data-ic]', 'click', el => { t.c1 = el.dataset.ic; cfg.imgColor = t.c1; saveCfg(); commit(); openImg(t.id); });
    on(b, '#imS', 'input', el => { t.size = +el.value; b.querySelector('#imSV').textContent = el.value; dirty = true; });
    on(b, '#imS', 'change', () => commit());
    b.querySelector('#imA').onclick = () => { if (curOut >= t.t1 - 0.2) t.t1 = Math.min(total, curOut + 4); t.t0 = Math.min(curOut, t.t1 - 0.2); commit(); info(); };
    b.querySelector('#imB').onclick = () => { if (curOut <= t.t0 + 0.2) return toast('Mova a agulha para depois do começo.'); t.t1 = curOut; commit(); info(); };
    b.querySelector('#imSw').onclick = () => pickImage(src => { t.src = src; commit(); dirty = true; openImg(t.id); });
    b.querySelector('#imNew').onclick = () => { selText = null; openImg(); };
    b.querySelector('#imDel').onclick = () => { S.texts = S.texts.filter(x => x !== t); delete imgCache[t.id]; selText = null; commit(); closeSheet(); };
  });
}

/* ---------- card de chamada (CTA), lista com checks e vídeo em card 3D ---------- */
const OR = '#ff7a1a';
function glassCard(c, x, y, w, h, k, col) {
  c.save();
  c.shadowColor = col; c.shadowBlur = 40 * k; c.fillStyle = 'rgba(18,13,11,.78)'; rr(c, x, y, w, h, 30 * k); c.fill(); c.shadowBlur = 0;
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, col); g.addColorStop(.5, 'rgba(255,255,255,.08)'); g.addColorStop(1, col);
  c.strokeStyle = g; c.lineWidth = 3 * k; rr(c, x, y, w, h, 30 * k); c.stroke();
  const hl = c.createLinearGradient(0, y, 0, y + h * .5); hl.addColorStop(0, 'rgba(255,255,255,.07)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hl; rr(c, x, y, w, h, 30 * k); c.fill();
  c.restore();
}
function chip(c, x, y, txt, k, col, solid) {
  c.font = `800 ${22 * k}px ${SANS}`; const w = c.measureText(txt).width + 34 * k, h = 38 * k;
  c.fillStyle = solid ? col : 'rgba(255,122,26,.16)'; rr(c, x, y, w, h, h / 2); c.fill();
  c.fillStyle = solid ? '#fff' : col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, x + 17 * k, y + h / 2 + 1);
  return w;
}
function twoTone(c, x, y, txt, f, k, col) {   // última palavra em degradê
  const ws = String(txt || '').trim().split(/\s+/), lastW = ws.length > 1 ? ws.pop() : '', first = ws.join(' ') + (lastW ? ' ' : '');
  c.font = `800 ${f}px ${SANS}`; c.textAlign = 'left'; c.fillStyle = '#fff'; c.fillText(first, x, y);
  if (lastW) { const fx = x + c.measureText(first).width, g = c.createLinearGradient(fx, 0, fx + c.measureText(lastW).width, 0); g.addColorStop(0, col); g.addColorStop(1, '#ffb347'); c.fillStyle = g; c.fillText(lastW, fx, y); }
}
function drawCTA(c, W, H, o, t, k, a) {
  const col = t.c1 || OR, d = o - t.t0, e = easeBack(d / 0.5), cw = 900 * k, ch = 300 * k, x = (W - cw) / 2, y = t.y * H - ch / 2 + (1 - e) * 80 * k;
  c.globalAlpha = a; glassCard(c, x, y, cw, ch, k, col);
  c.textBaseline = 'middle';
  if (t.chip) chip(c, x + 40 * k, y + 32 * k, '✓ ' + t.chip.toUpperCase(), k, col, false);
  twoTone(c, x + 40 * k, y + 120 * k, t.text || 'Aula gratuita', fitFont(c, t.text || 'Aula gratuita', 800, 62 * k, 520 * k), k, col);
  // botão
  const bl = (t.btn || 'Saiba Mais') + '  →'; c.font = `800 ${36 * k}px ${SANS}`; const bw = c.measureText(bl).width + 70 * k, bh = 78 * k, bx = x + 40 * k, by = y + 170 * k;
  const pulse = 1 + 0.03 * Math.sin(o * 5);
  c.save(); c.translate(bx + bw / 2, by + bh / 2); c.scale(pulse, pulse);
  const bg = c.createLinearGradient(-bw / 2, 0, bw / 2, 0); bg.addColorStop(0, col); bg.addColorStop(1, '#ff4d00');
  c.shadowColor = col; c.shadowBlur = 24 * k; c.fillStyle = bg; rr(c, -bw / 2, -bh / 2, bw, bh, 20 * k); c.fill(); c.shadowBlur = 0;
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(bl, 0, 2 * k); c.restore();
  // cronômetro regressivo
  if (t.timer > 0) {
    const rem = Math.max(0, t.timer - Math.max(0, d)), cx = x + cw - 140 * k, cy = y + ch / 2 + 14 * k, R = 82 * k;
    c.lineWidth = 9 * k; c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 16 * k; c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (rem / t.timer)); c.stroke(); c.shadowBlur = 0;
    const mm = String(Math.floor(rem / 60)).padStart(2, '0'), ss = String(Math.floor(rem % 60)).padStart(2, '0');
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `900 ${44 * k}px ${SANS}`; c.fillText(`${mm}:${ss}`, cx, cy);
    c.fillStyle = col; c.font = `700 ${22 * k}px ${SANS}`; c.fillText(t.timerLbl || 'Restam', cx, cy + R + 34 * k);
  }
  if (t.badge) { c.font = `800 ${24 * k}px ${SANS}`; const bwd = c.measureText('⚠ ' + t.badge).width + 34 * k; c.fillStyle = 'rgba(18,13,11,.9)'; rr(c, x + cw - bwd - 24 * k, y - 22 * k, bwd, 44 * k, 22 * k); c.fill(); c.strokeStyle = col; c.lineWidth = 2 * k; c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText('⚠ ' + t.badge, x + cw - bwd - 7 * k, y + 1); }
  return [x, y, cw, ch];
}
function drawList(c, W, H, o, t, k, a) {
  const col = t.c1 || OR, items = String(t.sub || '').split('|').map(s2 => s2.trim()).filter(Boolean).slice(0, 5);
  const d = o - t.t0, e = easeBack(d / 0.5), rowH = 66 * k, cw = 900 * k, ch = 110 * k + items.length * rowH + 20 * k, x = (W - cw) / 2, y = t.y * H - ch / 2 + (1 - e) * 80 * k;
  c.globalAlpha = a; glassCard(c, x, y, cw, ch, k, col); c.textBaseline = 'middle';
  // pino
  c.fillStyle = col; c.beginPath(); c.arc(x + 54 * k, y + 52 * k, 13 * k, Math.PI, 0); c.lineTo(x + 54 * k, y + 78 * k); c.closePath(); c.fill(); c.fillStyle = '#1a0f0a'; c.beginPath(); c.arc(x + 54 * k, y + 52 * k, 5 * k, 0, 7); c.fill();
  twoTone(c, x + 84 * k, y + 58 * k, t.text || 'Você vai aprender', fitFont(c, t.text || 'Você vai aprender', 800, 44 * k, cw - 140 * k), k, col);
  items.forEach((it, i) => {
    const at = (t.times && t.times[i] != null) ? t.times[i] : t.t0 + 0.7 + i * 0.7, p = (o - at) / 0.35; if (o < at) return;
    const yy = y + 110 * k + i * rowH + rowH / 2, cx = x + 58 * k;
    c.globalAlpha = a * clamp(p * 2, 0, 1);
    c.fillStyle = 'rgba(255,255,255,.05)'; rr(c, x + 24 * k, yy - rowH / 2 + 6 * k, cw - 48 * k, rowH - 12 * k, 14 * k); c.fill();
    c.strokeStyle = col; c.lineWidth = 4 * k; c.beginPath(); c.arc(cx, yy, 17 * k, 0, 7); c.stroke();
    const q = clamp(p, 0, 1); c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 8 * k, yy); c.lineTo(cx - 8 * k + 6 * k * Math.min(1, q * 2), yy + 6 * k * Math.min(1, q * 2));
    if (q > 0.5) c.lineTo(cx - 2 * k + 12 * k * (q - .5) * 2, yy + 6 * k - 14 * k * (q - .5) * 2); c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `700 ${36 * k}px ${SANS}`; c.fillText(it, cx + 40 * k, yy + 2);
  });
  return [x, y, cw, ch];
}
/* vídeo inclinado em card 3D com anel girando */
let tiltCv = null;
function tiltLayout(W, H, o) {
  const t = S.texts.find(t => t.kind === 'fx' && t.fx === 'tilt' && o >= t.t0 && o < t.t1); if (!t) return;
  const k = Math.min(W, H) / 1080, col = t.c1 || OR, d = o - t.t0, m = Math.min(smooth(d / 0.6), smooth((t.t1 - o) / 0.5));
  if (!tiltCv) tiltCv = document.createElement('canvas');
  if (tiltCv.width !== W || tiltCv.height !== H) { tiltCv.width = W; tiltCv.height = H; }
  tiltCv.getContext('2d').drawImage(cv, 0, 0);
  ctx.save();
  ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, W, H);
  const gl = ctx.createRadialGradient(W / 2, H * .4, 0, W / 2, H * .4, W * .9); gl.addColorStop(0, 'rgba(255,122,26,.28)'); gl.addColorStop(1, 'rgba(255,122,26,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  const cw = W * (1 - 0.2 * m), ch = H * (1 - 0.2 * m), sk = 0.09 * m, rot = -0.05 * m;
  ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.transform(1, -sk * 0.5, sk, 1, 0, 0);
  ctx.save(); rr(ctx, -cw / 2, -ch / 2, cw, ch, 36 * k * m); ctx.clip(); ctx.drawImage(tiltCv, -cw / 2, -ch / 2, cw, ch); ctx.restore();
  ctx.strokeStyle = col; ctx.lineWidth = 4 * k; ctx.shadowColor = col; ctx.shadowBlur = 30 * k * m; ctx.globalAlpha = m; rr(ctx, -cw / 2, -ch / 2, cw, ch, 36 * k * m); ctx.stroke();
  ctx.restore();
  // anel girando com ícones
  ctx.save(); ctx.globalAlpha = m;
  const cx = W / 2, cy = H * 0.36, R = W * 0.4;
  ctx.strokeStyle = col; ctx.lineWidth = 5 * k; ctx.shadowColor = col; ctx.shadowBlur = 24 * k;
  ctx.beginPath(); ctx.arc(cx, cy, R, o * 0.6, o * 0.6 + Math.PI * 1.4); ctx.stroke();
  ctx.lineWidth = 2 * k; ctx.globalAlpha = m * .5; ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, -o * 0.4, -o * 0.4 + Math.PI * 1.7); ctx.stroke();
  ctx.globalAlpha = m; ctx.shadowBlur = 12 * k;
  for (let i = 0; i < 6; i++) { const an = o * 0.35 + i * Math.PI / 3, ix = cx + Math.cos(an) * R, iy = cy + Math.sin(an) * R; ctx.fillStyle = '#120c09'; ctx.beginPath(); ctx.arc(ix, iy, 26 * k, 0, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3 * k; ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ix, iy, 8 * k, 0, 7); ctx.fill(); }
  ctx.shadowBlur = 0;
  // etiquetas flutuando
  const tags = String(t.text || '').split('|').map(s2 => s2.trim()).filter(Boolean).slice(0, 4);
  tags.forEach((tg, i) => {
    const p = clamp((d - 0.5 - i * 0.35) / 0.4, 0, 1); if (!p) return;
    ctx.globalAlpha = m * p; const yy = H * 0.7 + i * 74 * k + Math.sin(o * 2 + i) * 6 * k, xx = (i % 2 ? W * 0.52 : W * 0.12) + (1 - easeBack(p)) * 40 * k;
    ctx.font = `800 ${30 * k}px ${SANS}`; const tw = ctx.measureText(tg).width + 48 * k;
    ctx.fillStyle = 'rgba(18,13,11,.88)'; rr(ctx, xx, yy, tw, 58 * k, 29 * k); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2 * k; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(tg, xx + 24 * k, yy + 30 * k);
  });
  ctx.restore();
}

/* ---------- IA: editar por comandos (Claude) ---------- */
const AI_MODELS = { 'claude-sonnet-5-5': 'Sonnet (equilibrado)', 'claude-haiku-5-5': 'Haiku (mais rápido e barato)', 'claude-opus-5-5': 'Opus (mais caprichado)' };
let aiHist = [];          // conversa desta edição (para pedidos como "muda a cor")
const r2 = v => Math.round(v * 10) / 10;
function aiContext() {
  const tr = visW.length ? visW.map((v, i) => `${i}@${r2(v.o0)} ${v.text}`).join(' ') : '(sem transcrição: as legendas ainda não foram geradas)';
  const items = S.texts.map(t => ({ id: t.id, tipo: t.kind === 'fx' ? 'efeito:' + t.fx : t.kind === 'lt' ? 'tarja' : t.kind === 'img' ? 'imagem:' + t.mode : 'texto', texto: t.text, linha2: t.sub, inicio: r2(t.t0), fim: r2(Math.min(t.t1, total)) }));
  return `DURAÇÃO DO VÍDEO EDITADO: ${r2(total)} s
ESTADO ATUAL: ${JSON.stringify({ legendas: S.caps.on ? { estilo: S.caps.style, altura: S.caps.y, cor: S.caps.color } : 'desligadas', moldura: S.frame.on ? { estilo: S.frame.style, cor: S.frame.color, texto: S.frame.text, selo: S.frame.tag } : 'desligada', zoom: S.zoom.on, marca: cfg.logo.on ? cfg.logo.pos : 'desligada', cortes: S.segs.length, itens: items })}
TRANSCRIÇÃO (índice@segundo palavra): ${tr}`;
}
const AI_SYS = `Você é o editor de vídeo do app CortaJá (vídeos verticais de fala, TV Huntter News, criado por Fabio Huntter). O usuário pede mudanças em português e você responde chamando a ferramenta "editar" com a lista de ações e uma resposta curta em português do Brasil.
Regras:
- Tempos em segundos do vídeo editado (os da transcrição). Coloque cada elemento no momento em que o assunto é falado.
- Textos de efeitos, títulos, números e tarjas devem vir da fala; não invente fatos, números ou nomes que não foram ditos ou dados pelo usuário.
- Para mexer num item que já existe, use "remover" com o id e crie de novo, ou use "alterar" com o id.
- Se o pedido não puder ser feito com as ações disponíveis, explique na resposta e não invente ação.
- Sem transcrição, você ainda pode aplicar moldura, marca, zoom, transições e itens com texto que o usuário der.
Cores aceitas: qualquer #rrggbb.`;
const AI_TOOL = {
  name: 'editar',
  description: 'Aplica edições no vídeo aberto no CortaJá.',
  input_schema: {
    type: 'object', required: ['acoes', 'resposta'],
    properties: {
      resposta: { type: 'string', description: 'Mensagem curta para o usuário dizendo o que foi feito.' },
      acoes: {
        type: 'array', items: {
          type: 'object', required: ['tipo'],
          properties: {
            tipo: { type: 'string', enum: ['legendas', 'corrigir_palavras', 'moldura', 'tarja', 'texto', 'efeito', 'transicoes', 'zoom', 'marca', 'alterar', 'remover', 'estilo_noticia_auto', 'numeros_auto', 'corte_limpo'] },
            ligar: { type: 'boolean', description: 'legendas/moldura/zoom/marca: ligar ou desligar' },
            estilo: { type: 'string', description: 'legendas: karaoke|marcador|impacto|elegante|classica. moldura: jornal|social|vlog|criativo|neon|cinema|polaroid. transicoes: auto|nenhuma|punch|zoom|zoomout|whip|whipv|spin|shake|glitch|blur|flash|fade. texto: faixa|limpo|contorno. tarja (modelo): barra|duas|jornal|pilula|linha|caixa' },
            efeito: { type: 'string', enum: ['titulo', 'doodle', 'mural', 'vidro', 'anel', 'cam', 'contador', 'grafico', 'cta', 'lista', 'tilt'], description: 'titulo=título numerado no topo; doodle=palavra rabiscada; mural=até 4 etiquetas (texto separado por |); vidro=texto 3D; anel=zoom com anel + frase; cam=vídeo em card CAM 01; contador=número subindo (ex.: "R$ 176 MI", "35%"); grafico=barras (texto "10 | 25 | 40"); cta=card de chamada com botão/cronômetro; lista=card com itens marcados (itens em linha2 separados por |); tilt=vídeo 3D inclinado com etiquetas (texto separado por |)' },
            texto: { type: 'string' }, linha2: { type: 'string', description: 'subtítulo / segunda linha / itens da lista / rótulo do contador' },
            inicio: { type: 'number' }, fim: { type: 'number' },
            cor: { type: 'string' }, cor2: { type: 'string', description: 'tarja: cor do fundo' },
            posicao: { type: 'string', description: 'tarja: be|bc|bd|ce|cd|le|ld (embaixo esq/centro/dir, em cima esq/dir, lado esq/dir). marca: tl|tr. legendas: em_cima|meio|embaixo' },
            altura: { type: 'number', description: '0 a 1, posição vertical (0 topo, 1 base) para texto/efeito/legendas' },
            selo: { type: 'string', description: 'moldura jornal: selo (ex. URGENTE); cta: selo de cima' },
            botao: { type: 'string' }, aviso: { type: 'string' }, cronometro_min: { type: 'number' },
            numero: { type: 'integer' }, total: { type: 'integer' },
            id: { type: 'string', description: 'alterar/remover: id do item' },
            alvo: { type: 'string', enum: ['efeitos', 'tarjas', 'textos', 'imagens', 'tudo'], description: 'remover em lote' },
            correcoes: { type: 'array', items: { type: 'object', required: ['indice', 'texto'], properties: { indice: { type: 'integer' }, texto: { type: 'string', description: 'novo texto da palavra; vazio para esconder' } } } },
          },
        },
      },
    },
  },
};
async function aiCall(pedido) {
  const key = cfg.aiKey; if (!key) throw new Error('sem chave');
  const msgs = [...aiHist.slice(-6), { role: 'user', content: aiContext() + '\n\nPEDIDO: ' + pedido }];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: cfg.aiModel || 'claude-sonnet-5-5', max_tokens: 4000, system: AI_SYS, tools: [AI_TOOL], tool_choice: { type: 'tool', name: 'editar' }, messages: msgs }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (j.error && j.error.message) || r.statusText;
    if (r.status === 401) throw new Error('A chave de API não foi aceita. Confira se copiou inteira.');
    if (r.status === 429) throw new Error('Muitos pedidos seguidos ou limite da conta atingido. Espere um pouco.');
    if (/credit|balance|billing/i.test(m)) throw new Error('A conta da API está sem créditos. Adicione créditos no site da Anthropic.');
    throw new Error(m);
  }
  const tu = (j.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('A IA não devolveu edições.');
  aiHist.push({ role: 'user', content: 'PEDIDO: ' + pedido }, { role: 'assistant', content: tu.input.resposta || 'Feito.' });
  return tu.input;
}
const clampT = v => clamp(+v || 0, 0, total);
async function aiApply(res) {
  const acts = res.acoes || [], feitos = [];
  const tm = (a, def) => { const t0 = clampT(a.inicio != null ? a.inicio : curOut); return [t0, Math.max(t0 + 0.3, clampT(a.fim != null ? a.fim : t0 + def))]; };
  for (const a of acts) {
    try {
      if (a.tipo === 'legendas') {
        if (a.ligar === false) S.caps.on = false;
        else { if (!S.words) { feitos.push('legendas: precisa gerar a transcrição primeiro (Legendas → Gerar)'); continue; } S.caps.on = true; }
        if (a.estilo && CAPSTYLES[a.estilo]) S.caps.style = a.estilo;
        if (a.cor) S.caps.color = a.cor;
        if (a.posicao) S.caps.y = { em_cima: 0.16, meio: 0.5, embaixo: 0.84 }[a.posicao] || S.caps.y;
        if (a.altura != null) S.caps.y = clamp(+a.altura, 0.08, 0.94);
      } else if (a.tipo === 'corrigir_palavras') {
        let n = 0; for (const c2 of a.correcoes || []) { const v = visW[c2.indice]; if (v) { if (c2.texto) v.w.text = c2.texto; else v.w.hide = true; n++; } }
        feitos.push(`${n} palavra(s) corrigida(s)`);
      } else if (a.tipo === 'moldura') {
        if (a.ligar === false) S.frame.on = false;
        else { S.frame.on = true; if (a.estilo && FRAMES[a.estilo]) S.frame.style = a.estilo; if (a.cor) S.frame.color = a.cor; if (a.texto != null) S.frame.text = a.texto; if (a.selo) S.frame.tag = a.selo; }
      } else if (a.tipo === 'tarja') {
        const [t0, t1] = tm(a, 5), P = LT_POS[a.posicao] || LT_POS[cfg.ltPos || 'be'];
        S.texts.push({ id: 'l' + Date.now() + Math.random().toString(36).slice(2, 5), kind: 'lt', text: a.texto || '', sub: a.linha2 || '', t0, t1, shape: LT_SHAPES[a.estilo] ? a.estilo : (cfg.ltShape || 'barra'), c1: a.cor || cfg.ltC1 || '#ff5a36', c2: a.cor2 || cfg.ltC2 || '#111111', size: 1, x: P[1], y: P[2], align: P[3] });
      } else if (a.tipo === 'texto') {
        const [t0, t1] = tm(a, 3);
        S.texts.push({ id: 't' + Date.now() + Math.random().toString(36).slice(2, 5), text: a.texto || '', t0, t1, x: 0.5, y: a.altura != null ? clamp(+a.altura, 0.05, 0.95) : 0.18, size: 64, style: ['faixa', 'limpo', 'contorno'].includes(a.estilo) ? a.estilo : 'faixa', color: a.cor || '#ff5a36' });
      } else if (a.tipo === 'efeito') {
        const fx = a.efeito; if (!FXS[fx]) continue;
        const [t0, t1] = tm(a, { cam: 5, titulo: 3.2, mural: 3.5, cta: 5, lista: 4.5, tilt: 4, grafico: 4, contador: 3 }[fx] || 2.2);
        const t = { id: 'f' + Date.now() + Math.random().toString(36).slice(2, 5), kind: 'fx', fx, x: 0.5, t0, t1, text: a.texto || '', sub: a.linha2 || '', n: a.numero || 1, N: a.total || 1,
          y: a.altura != null ? clamp(+a.altura, 0.05, 0.95) : ({ titulo: 0.1, mural: 0.62, vidro: 0.7, anel: 0.68, doodle: 0.66, cam: 0.5, contador: 0.68, grafico: 0.68, cta: 0.8, lista: 0.78 }[fx] || 0.6) };
        if (fx === 'cta') Object.assign(t, { chip: a.selo || '', btn: a.botao || 'Saiba Mais', badge: a.aviso || '', timer: Math.max(0, +a.cronometro_min || 0) * 60, timerLbl: 'Restam', text: a.texto || 'Aula gratuita' });
        if (['cta', 'lista', 'tilt'].includes(fx)) t.c1 = a.cor || cfg.ctaColor || OR;
        if (fx === 'cam' && !t.text) t.text = 'CAM · 01';
        S.texts.push(t);
      } else if (a.tipo === 'transicoes') {
        if (a.estilo === 'auto') autoTransitions();
        else S.segs.forEach((g, i) => { if (i) g.tr = a.estilo === 'nenhuma' ? '' : (TRANS[a.estilo] != null ? a.estilo : g.tr); });
      } else if (a.tipo === 'zoom') S.zoom.on = a.ligar !== false;
      else if (a.tipo === 'marca') { cfg.logo.on = a.ligar !== false; if (a.posicao === 'tl' || a.posicao === 'tr') cfg.logo.pos = a.posicao; saveCfg(); }
      else if (a.tipo === 'alterar') {
        const t = S.texts.find(x => x.id === a.id); if (!t) continue;
        if (a.texto != null) { t.text = a.texto; if (t.items) t.items = null; }
        if (a.linha2 != null) t.sub = a.linha2;
        if (a.inicio != null) t.t0 = clampT(a.inicio); if (a.fim != null) t.t1 = Math.max(t.t0 + 0.3, clampT(a.fim));
        if (a.cor) { if (t.kind === 'lt' || t.kind === 'img' || ['cta', 'lista', 'tilt'].includes(t.fx)) t.c1 = a.cor; else t.color = a.cor; }
        if (a.cor2 && t.kind === 'lt') t.c2 = a.cor2;
        if (a.estilo && t.kind === 'lt' && LT_SHAPES[a.estilo]) t.shape = a.estilo;
        if (a.posicao && t.kind === 'lt' && LT_POS[a.posicao]) { const P = LT_POS[a.posicao]; t.x = P[1]; t.y = P[2]; t.align = P[3]; }
        if (a.altura != null) t.y = clamp(+a.altura, 0.05, 0.95);
        if (a.selo != null) t.chip = a.selo; if (a.botao != null) t.btn = a.botao; if (a.aviso != null) t.badge = a.aviso;
        if (a.cronometro_min != null) t.timer = Math.max(0, +a.cronometro_min) * 60;
      } else if (a.tipo === 'remover') {
        if (a.id) S.texts = S.texts.filter(x => x.id !== a.id);
        else if (a.alvo) { const k2 = { efeitos: 'fx', tarjas: 'lt', imagens: 'img' }[a.alvo]; S.texts = a.alvo === 'tudo' ? [] : S.texts.filter(x => a.alvo === 'textos' ? x.kind : x.kind !== k2); }
      } else if (a.tipo === 'estilo_noticia_auto') { if (!autoMotion()) feitos.push('estilo notícia: precisa da transcrição'); }
      else if (a.tipo === 'numeros_auto') { S.texts = S.texts.filter(x => !(x.kind === 'fx' && (x.fx === 'contador' || x.fx === 'grafico'))); autoNumbers(); }
      else if (a.tipo === 'corte_limpo') { const r3 = await cleanCut(); if (r3) recalc(); }
    } catch (e) { console.warn('ação da IA falhou', a, e); }
  }
  selText = null; commit(); dirty = true; seekOut(Math.min(curOut, total));
  return feitos;
}
function openAI() {
  pause();
  if (!cfg.aiKey) return openAIKey();
  const log = aiHist.filter(m => m.role === 'assistant').length ? aiHist.slice(-8).map(m => `<p class="${m.role === 'user' ? 'aiU' : 'aiA'}">${esc(String(m.content).replace(/^PEDIDO: /, ''))}</p>`).join('') : '';
  sheet('Pedir para a IA', `<div id="aiLog">${log || `<p class="note">Escreva o que quer no vídeo. Exemplos:</p>
      <div class="row">${['Coloca moldura jornalística e uma tarja com meu nome no começo', 'Corrige os erros das legendas', 'Contador quando eu falar de dinheiro', 'Card de chamada no final com cronômetro de 10 minutos'].map(x => `<button class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>`}</div>
    <textarea id="aiQ" rows="3" placeholder="Ex.: coloca legendas amarelas embaixo e um título em cada assunto"></textarea>
    <button class="btn wide" id="aiGo">Enviar para a IA</button>
    ${S.words ? '' : '<p class="note">Dica: gere as legendas antes. Com a transcrição a IA sabe o que você falou e em que momento.</p>'}
    <p class="note">Só o texto da fala e o seu pedido vão para a IA; o vídeo fica no celular. Desfaça com ↶ se não gostar.</p>
    <div class="row"><button class="chip" id="aiCfg">Chave e modelo</button>${aiHist.length ? '<button class="chip" id="aiNew">Nova conversa</button>' : ''}</div>`, b => {
    const q = b.querySelector('#aiQ');
    on(b, '[data-ex]', 'click', el => { q.value = el.dataset.ex; q.focus(); });
    b.querySelector('#aiCfg').onclick = openAIKey;
    const nw = b.querySelector('#aiNew'); if (nw) nw.onclick = () => { aiHist = []; openAI(); };
    b.querySelector('#aiGo').onclick = async () => {
      const pedido = q.value.trim(); if (!pedido) return q.focus();
      busy('A IA está editando…', 'Lendo a sua fala e montando as edições');
      try {
        const res = await within(aiCall(pedido), 90000);
        const avisos = await aiApply(res);
        idle(); openAI();
        toast((res.resposta || 'Feito.') + (avisos.length ? ' (' + avisos.join('; ') + ')' : ''), 6000);
      } catch (e) {
        idle();
        const m = String(e && e.message || e);
        toast(m === 'travou' ? 'A IA demorou demais para responder. Tente de novo.' : /Failed to fetch|NetworkError|network/i.test(m) ? 'Sem internet ou a API não respondeu.' : 'IA: ' + m, 7000);
      }
    };
  });
}
function openAIKey() {
  sheet('IA: chave e modelo', `<p>Para a IA editar, o app precisa de uma <b>chave de API do Claude</b> (Anthropic). Ela fica guardada só neste celular.</p>
    <p class="note">Crie em console.anthropic.com → API Keys. O uso é cobrado pela Anthropic conforme a quantidade de texto.</p>
    <input type="password" id="akK" placeholder="sk-ant-..." value="${esc(cfg.aiKey || '')}" autocomplete="off">
    <label class="fld">Modelo<select id="akM">${Object.entries(AI_MODELS).map(([k2, v]) => `<option value="${k2}"${(cfg.aiModel || 'claude-sonnet-5-5') === k2 ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <button class="btn wide" id="akOk">Salvar</button>
    ${cfg.aiKey ? '<button class="btn danger wide" id="akDel">Apagar a chave deste celular</button>' : ''}`, b => {
    b.querySelector('#akOk').onclick = () => { const k2 = b.querySelector('#akK').value.trim(); if (!/^sk-ant-/.test(k2)) return toast('A chave do Claude começa com "sk-ant-".'); cfg.aiKey = k2; cfg.aiModel = b.querySelector('#akM').value; saveCfg(); toast('Chave salva.'); openAI(); };
    const del = b.querySelector('#akDel'); if (del) del.onclick = () => { delete cfg.aiKey; saveCfg(); toast('Chave apagada.'); closeSheet(); };
  });
}

/* ---------- molduras ---------- */
const FRAMES = {
  jornal: ['Jornalístico', 'Faixa de notícias correndo embaixo + selo "AO VIVO"'],
  social: ['Redes sociais', 'Borda em degradê, @ do perfil e ícones de curtir'],
  vlog: ['Vlog', 'Visor de câmera: cantos, REC piscando e tempo'],
  criativo: ['Criativo', 'Borda colorida que muda de cor e formas flutuando'],
  neon: ['Animado (neon)', 'Contorno brilhante com luz correndo em volta'],
  cinema: ['Cinema', 'Faixas pretas de filme em cima e embaixo'],
  polaroid: ['Polaroid', 'Borda branca de foto com legenda escrita à mão'],
};
const FR_TEXT = { jornal: 'Acompanhe a TV Huntter News • (98) 99981-0660', social: '@tvhuntternews', vlog: '', criativo: '', neon: '', cinema: 'TV HUNTTER NEWS', polaroid: 'TV Huntter News' };
function frameInset(W, H) {
  const F = S.frame; if (!F || !F.on) return 0;
  const k = Math.min(W, H) / 1080;
  return ({ social: 26, criativo: 24, neon: 30, polaroid: 40, vlog: 40, cinema: 0, jornal: 0 }[F.style] || 0) * k;
}
function holeRect(c, W, H, b, r) {         // pinta a borda: retângulo cheio menos o "buraco" arredondado
  c.beginPath(); c.rect(0, 0, W, H);
  if (c.roundRect) c.roundRect(b, b, W - 2 * b, H - 2 * b, r); else c.rect(b, b, W - 2 * b, H - 2 * b);
  c.fill('evenodd');
}
function heart(c, x, y, r) {
  c.beginPath(); c.moveTo(x, y + r * .9);
  c.bezierCurveTo(x - r * 1.6, y - r * .1, x - r * .7, y - r * 1.3, x, y - r * .45);
  c.bezierCurveTo(x + r * .7, y - r * 1.3, x + r * 1.6, y - r * .1, x, y + r * .9); c.fill();
}
function drawFrame(c, W, H, o) {
  const F = S.frame; if (!F || !F.on) return;
  const k = Math.min(W, H) / 1080, A = F.color, txt = F.text || FR_TEXT[F.style] || '';
  c.save(); c.textBaseline = 'middle';
  if (F.style === 'jornal') {
    const bh = 92 * k, by = H - bh - 46 * k, tagW = Math.max(200 * k, (c.font = `900 ${40 * k}px ${SANS}`, c.measureText((F.tag || 'URGENTE').toUpperCase()).width + 56 * k));
    c.fillStyle = A; c.fillRect(0, by - 8 * k, W, 8 * k);
    c.fillStyle = 'rgba(10,12,18,.92)'; c.fillRect(0, by, W, bh);
    // texto correndo
    c.save(); c.beginPath(); c.rect(tagW, by, W - tagW, bh); c.clip();
    c.font = `700 ${38 * k}px ${SANS}`; c.fillStyle = '#fff';
    const item = txt + '     •     ', iw = c.measureText(item).width, sp = 150 * k;
    let x = tagW + W - ((o * sp) % (iw)) - W; while (x < W) { c.fillText(item, x, by + bh / 2); x += iw; }
    c.restore();
    c.fillStyle = A; c.beginPath(); c.moveTo(0, by); c.lineTo(tagW, by); c.lineTo(tagW - 24 * k, by + bh); c.lineTo(0, by + bh); c.fill();
    c.font = `900 ${40 * k}px ${SANS}`; c.fillStyle = ink(A); c.fillText((F.tag || 'URGENTE').toUpperCase(), 24 * k, by + bh / 2);
    // selo AO VIVO
    const left = !(cfg.logo && cfg.logo.on && cfg.logo.pos === 'tl'), pw = 230 * k, ph = 62 * k, px = left ? 40 * k : W - pw - 40 * k, py = 44 * k;
    c.fillStyle = 'rgba(10,12,18,.85)'; rr(c, px, py, pw, ph, 12 * k); c.fill();
    c.fillStyle = '#ff2d2d'; c.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(o * 3)); c.beginPath(); c.arc(px + 34 * k, py + ph / 2, 13 * k, 0, 7); c.fill(); c.globalAlpha = 1;
    c.font = `900 ${32 * k}px ${SANS}`; c.fillStyle = '#fff'; c.fillText('AO VIVO', px + 60 * k, py + ph / 2 + 1);
  } else if (F.style === 'social') {
    const b = 26 * k, g = c.createLinearGradient(0, 0, W, H), t = o * 0.15;
    g.addColorStop(0, A); g.addColorStop((Math.sin(t) + 1) / 4 + 0.25, '#ff2d95'); g.addColorStop(1, '#ffb020');
    c.fillStyle = g; holeRect(c, W, H, b, 46 * k);
    // @perfil
    c.font = `800 ${36 * k}px ${SANS}`; const tw = c.measureText(txt).width, ph = 72 * k, pw = tw + ph + 40 * k, px = 50 * k, py = H - ph - 70 * k;
    c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, px, py, pw, ph, ph / 2); c.fill();
    c.fillStyle = g; c.beginPath(); c.arc(px + ph / 2, py + ph / 2, ph / 2 - 8 * k, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillText(txt, px + ph + 10 * k, py + ph / 2 + 1);
    // ícones na lateral
    const ix = W - 90 * k, iy = H * 0.62, beat = 1 + 0.18 * Math.max(0, Math.sin(o * 4)) ** 8;
    c.fillStyle = '#ff2d55'; heart(c, ix, iy, 30 * k * beat);
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ix, iy + 110 * k, 30 * k, 26 * k, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(ix - 18 * k, iy + 128 * k); c.lineTo(ix - 30 * k, iy + 148 * k); c.lineTo(ix - 2 * k, iy + 134 * k); c.fill();
    c.beginPath(); c.moveTo(ix - 28 * k, iy + 240 * k); c.lineTo(ix + 30 * k, iy + 212 * k); c.lineTo(ix + 10 * k, iy + 270 * k); c.lineTo(ix + 2 * k, iy + 246 * k); c.closePath(); c.fill();
  } else if (F.style === 'vlog') {
    const m = 40 * k, L = 90 * k; c.strokeStyle = '#fff'; c.lineWidth = 7 * k; c.lineCap = 'round';
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 8 * k;
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { c.beginPath(); c.moveTo(x, y + dy * L); c.lineTo(x, y); c.lineTo(x + dx * L, y); c.stroke(); }
    c.lineWidth = 3 * k; c.globalAlpha = .6; c.beginPath(); c.moveTo(W / 2 - 30 * k, H / 2); c.lineTo(W / 2 + 30 * k, H / 2); c.moveTo(W / 2, H / 2 - 30 * k); c.lineTo(W / 2, H / 2 + 30 * k); c.stroke(); c.globalAlpha = 1;
    const ry = m + 60 * k;
    if (Math.floor(o * 1.5) % 2 === 0) { c.fillStyle = '#ff2d2d'; c.beginPath(); c.arc(m + 50 * k, ry, 15 * k, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.font = `800 ${36 * k}px ${SANS}`; c.fillText('REC', m + 76 * k, ry + 1);
    const tc = new Date(o * 1000).toISOString().slice(11, 19);
    c.font = `700 ${34 * k}px ui-monospace, monospace`; c.fillText(tc, m + 50 * k, H - m - 56 * k);
    if (txt) { c.textAlign = 'right'; c.font = `700 ${32 * k}px ${SANS}`; c.fillText(txt, W - m - 40 * k, H - m - 56 * k); }
  } else if (F.style === 'criativo') {
    const b = 24 * k, hue = (o * 40) % 360, g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsl(${hue},95%,60%)`); g.addColorStop(.5, A); g.addColorStop(1, `hsl(${(hue + 160) % 360},95%,60%)`);
    c.fillStyle = g; holeRect(c, W, H, b, 40 * k);
    const shapes = [[.12, .16, 0], [.88, .3, 1], [.1, .78, 2], [.86, .86, 0], [.5, .07, 1]];
    shapes.forEach(([fx, fy, t], i) => {
      const x = fx * W, y = fy * H + Math.sin(o * 1.6 + i) * 18 * k, r = 26 * k, rot = o * (i % 2 ? .8 : -.8);
      c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = .9; c.fillStyle = i % 2 ? A : `hsl(${(hue + i * 70) % 360},95%,62%)`;
      if (t === 0) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }
      else if (t === 1) { c.beginPath(); for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5, rr2 = j % 2 ? r * .45 : r; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } c.fill(); }
      else { c.strokeStyle = c.fillStyle; c.lineWidth = 8 * k; c.lineCap = 'round'; c.beginPath(); for (let j = -2; j <= 2; j++) c.lineTo(j * 16 * k, (j % 2 ? 1 : -1) * 12 * k); c.stroke(); }
      c.restore();
    });
  } else if (F.style === 'neon') {
    const m = 30 * k, per = 2 * (W + H - 4 * m), pulse = 0.7 + 0.3 * Math.sin(o * 3);
    c.strokeStyle = A; c.lineWidth = 8 * k; c.shadowColor = A; c.shadowBlur = 30 * k * pulse;
    rr(c, m, m, W - 2 * m, H - 2 * m, 36 * k); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 6 * k; c.shadowBlur = 24 * k; c.setLineDash([per * 0.12, per * 0.88]); c.lineDashOffset = -o * per * 0.25;
    rr(c, m, m, W - 2 * m, H - 2 * m, 36 * k); c.stroke();
  } else if (F.style === 'cinema') {
    const bh = H * 0.09; c.fillStyle = '#000'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
    if (txt) { c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `600 ${30 * k}px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = `${8 * k}px`; c.globalAlpha = .85; c.fillText(txt.toUpperCase(), W / 2, H - bh / 2); }
  } else if (F.style === 'polaroid') {
    const b = 40 * k, bb = 150 * k;
    c.fillStyle = '#fbfaf6'; c.beginPath(); c.rect(0, 0, W, H); c.rect(b, b, W - 2 * b, H - b - bb); c.fill('evenodd');
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(b, b, W - 2 * b, 6 * k);
    if (txt) { c.fillStyle = '#222'; c.textAlign = 'center'; c.font = `italic 700 ${54 * k}px ${SERIF}`; c.fillText(txt, W / 2, H - bb / 2); }
    c.fillStyle = A; c.globalAlpha = .7; c.save(); c.translate(W / 2, b * .4); c.rotate(-.04); c.fillRect(-90 * k, -22 * k, 180 * k, 44 * k); c.restore();
  }
  c.restore();
}
function openFrame() {
  pause();
  const F = S.frame, txt = F.text || FR_TEXT[F.style] || '';
  const hasText = ['jornal', 'social', 'vlog', 'cinema', 'polaroid'].includes(F.style);
  sheet('Moldura', `<div class="box">${F.on ? '<span class="ok">Ligada</span><button class="btn danger" id="frT">Desligar</button>' : '<span>Desligada</span><button class="btn" id="frT">Ligar</button>'}</div>
    <div class="row">${Object.entries(FRAMES).map(([k2, v]) => `<button class="chip${F.style === k2 && F.on ? ' on' : ''}" data-fr="${k2}">${v[0]}</button>`).join('')}</div>
    <p class="note">${FRAMES[F.style][1]}</p>
    ${F.style === 'jornal' ? `<input type="text" id="frG" value="${esc(F.tag || '')}" placeholder="Selo (ex.: URGENTE, AGORA)">` : ''}
    ${hasText ? `<input type="text" id="frX" value="${esc(txt)}" placeholder="${F.style === 'jornal' ? 'Texto que corre na faixa' : F.style === 'social' ? '@perfil' : 'Texto'}">` : ''}
    <p class="note">Cor</p>
    <div class="row">${COLORS.map(cl => `<button class="sw${cl === F.color ? ' on' : ''}" data-frc="${cl}" style="background:${cl}"></button>`).join('')}</div>`, b => {
    const keep = () => { cfg.frStyle = F.style; cfg.frColor = F.color; saveCfg(); };
    b.querySelector('#frT').onclick = () => { F.on = !F.on; commit(); dirty = true; openFrame(); };
    on(b, '[data-fr]', 'click', el => { F.style = el.dataset.fr; F.on = true; F.text = ''; keep(); commit(); dirty = true; if (!playing) seekOut(curOut); openFrame(); });
    on(b, '[data-frc]', 'click', el => { F.color = el.dataset.frc; keep(); commit(); dirty = true; openFrame(); });
    const ix = b.querySelector('#frX'), ig = b.querySelector('#frG');
    if (ix) { ix.oninput = () => { F.text = ix.value; dirty = true; }; ix.onchange = () => commit(); }
    if (ig) { ig.oninput = () => { F.tag = ig.value; dirty = true; }; ig.onchange = () => commit(); }
  });
}

/* ---------- tarjas (lower thirds) ---------- */
const LT_SHAPES = { barra: 'Barra', duas: 'Duas faixas', jornal: 'Jornal', pilula: 'Pílula', linha: 'Linha', caixa: 'Caixa' };
const LT_BG = ['#111111', '#ffffff', '#1e293b', '#0b3d91', '#7f1d1d', '#14532d'];
const LT_POS = {           // [x, y, alinhamento]
  be: ['Embaixo esq.', 0.05, 0.8, 'l'], bc: ['Embaixo centro', 0.5, 0.8, 'c'], bd: ['Embaixo dir.', 0.95, 0.8, 'r'],
  ce: ['Em cima esq.', 0.05, 0.2, 'l'], cd: ['Em cima dir.', 0.95, 0.2, 'r'],
  le: ['Lado esquerdo', 0.03, 0.5, 'l'], ld: ['Lado direito', 0.97, 0.5, 'r'],
};
const ink = col => lum(col) > .6 ? '#111' : '#fff';
function drawLT(c, W, H, o, t) {
  const u = W / 1080 * t.size, side = t.align;
  const fT = 50 * u, fS = 32 * u, pad = 26 * u;
  c.save();
  c.font = t.shape === 'jornal' ? `900 italic ${fT}px ${SANS}` : `800 ${fT}px ${SANS}`;
  const wT = c.measureText(t.shape === 'jornal' ? t.text.toUpperCase() : t.text).width;
  c.font = `600 ${fS}px ${SANS}`; const wS = t.sub ? c.measureText(t.sub).width : 0;
  const hT = fT * 1.55, hS = t.sub ? fS * 1.6 : 0;
  const w = Math.max(wT, wS) + pad * 2 + (t.shape === 'barra' || t.shape === 'caixa' ? 14 * u : 0) + (t.shape === 'pilula' ? hT * 0.7 : 0) + (t.shape === 'jornal' ? hT * 0.6 : 0);
  const h = hT + hS + (t.shape === 'linha' ? 10 * u : 0);
  const x0 = side === 'l' ? t.x * W : side === 'r' ? t.x * W - w : t.x * W - w / 2, y0 = t.y * H - h / 2;
  // entrada (revela do lado de onde vem) e saída
  const pin = easeOut((o - t.t0) / 0.45), pout = easeOut((t.t1 - o) / 0.3), r = Math.min(pin, pout);
  c.globalAlpha = clamp(r * 1.6, 0, 1);
  c.beginPath();
  if (side === 'r') c.rect(x0 + w * (1 - r), y0 - 4 * u, w * r + 2, h + 8 * u);
  else if (side === 'c') c.rect(x0 + w * (1 - r) / 2, y0 - 4 * u, w * r + 2, h + 8 * u);
  else c.rect(x0 - 2, y0 - 4 * u, w * r + 2, h + 8 * u);
  c.clip();
  c.textBaseline = 'middle';
  const A = t.c1, B = t.c2, tx = (x, y, s, f, col, al = 'left') => { c.font = f; c.fillStyle = col; c.textAlign = al; c.fillText(s, x, y); };
  const FT = `800 ${fT}px ${SANS}`, FS = `600 ${fS}px ${SANS}`, yT = y0 + hT / 2, yS = y0 + hT + hS / 2;
  if (t.shape === 'barra') {
    c.fillStyle = A; c.fillRect(x0, y0, 14 * u, h);
    c.fillStyle = B; c.fillRect(x0 + 14 * u, y0, w - 14 * u, hT);
    if (t.sub) { c.fillStyle = A; c.fillRect(x0 + 14 * u, y0 + hT, w - 14 * u, hS); }
    tx(x0 + 14 * u + pad, yT, t.text, FT, ink(B)); if (t.sub) tx(x0 + 14 * u + pad, yS, t.sub, FS, ink(A));
  } else if (t.shape === 'duas') {
    c.font = FT; const w1 = wT + pad * 2; c.font = FS; const w2 = wS + pad * 2;
    const a1 = side === 'r' ? x0 + w - w1 : side === 'c' ? x0 + (w - w1) / 2 : x0, a2 = side === 'r' ? x0 + w - w2 : side === 'c' ? x0 + (w - w2) / 2 : x0;
    c.fillStyle = A; c.fillRect(a1, y0, w1, hT); tx(a1 + pad, yT, t.text, FT, ink(A));
    if (t.sub) { c.fillStyle = B; c.fillRect(a2, y0 + hT, w2, hS); tx(a2 + pad, yS, t.sub, FS, ink(B)); }
  } else if (t.shape === 'jornal') {
    const sk = hT * 0.3;
    c.fillStyle = A; c.beginPath(); c.moveTo(x0 + sk, y0); c.lineTo(x0 + w, y0); c.lineTo(x0 + w - sk, y0 + hT); c.lineTo(x0, y0 + hT); c.closePath(); c.fill();
    c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0, y0, w, hT * 0.42); c.restore();
    tx(x0 + sk + pad, yT, t.text.toUpperCase(), `900 italic ${fT}px ${SANS}`, ink(A));
    if (t.sub) { c.fillStyle = B; c.beginPath(); c.moveTo(x0, y0 + hT); c.lineTo(x0 + w - sk, y0 + hT); c.lineTo(x0 + w - sk * 2, y0 + h); c.lineTo(x0, y0 + h); c.closePath(); c.fill(); tx(x0 + pad, yS, t.sub, FS, ink(B)); }
  } else if (t.shape === 'pilula') {
    c.fillStyle = B; rr(c, x0, y0, w, h, Math.min(h / 2, 60 * u)); c.fill();
    const d = hT * 0.5; c.fillStyle = A; c.beginPath(); c.arc(x0 + pad + d / 2, y0 + h / 2, d / 2, 0, 7); c.fill();
    const lx = x0 + pad + d + 16 * u;
    tx(lx, t.sub ? yT + 4 * u : y0 + h / 2, t.text, FT, ink(B)); if (t.sub) tx(lx, yS - 6 * u, t.sub, FS, A === B ? ink(B) : A);
  } else if (t.shape === 'linha') {
    c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = 14 * u;
    const al = side === 'r' ? 'right' : side === 'c' ? 'center' : 'left', ax = side === 'r' ? x0 + w - pad : side === 'c' ? x0 + w / 2 : x0 + pad;
    tx(ax, yT, t.text, FT, '#fff', al);
    c.shadowBlur = 0; const lw = (Math.max(wT, wS)) * pin, lx = side === 'r' ? ax - lw : side === 'c' ? ax - lw / 2 : ax;
    c.fillStyle = A; c.fillRect(lx, y0 + hT, lw, 8 * u);
    if (t.sub) { c.shadowBlur = 14 * u; tx(ax, yS + 10 * u, t.sub, FS, '#fff', al); }
  } else {                                                // caixa
    c.fillStyle = B; c.globalAlpha *= 0.82; rr(c, x0, y0, w, h, 16 * u); c.fill(); c.globalAlpha = clamp(r * 1.6, 0, 1);
    c.fillStyle = A; rr(c, x0, y0, 14 * u, h, 7 * u); c.fill();
    tx(x0 + 14 * u + pad, yT, t.text, FT, ink(B)); if (t.sub) tx(x0 + 14 * u + pad, yS, t.sub, FS, A);
  }
  c.restore();
  t._box = [x0, y0, w, h];
  if (selText === t.id && !exporting) { c.save(); c.strokeStyle = '#fff'; c.lineWidth = 2 * u + 1; c.setLineDash([8 * u + 2, 6 * u + 2]); c.strokeRect(x0 - 4, y0 - 4, w + 8, h + 8); c.restore(); }
}
function openLT(id) {
  pause();
  let t = S.texts.find(t => t.id === id);
  if (!t) {
    const t0 = Math.min(curOut, Math.max(0, total - 0.5)), P = LT_POS[cfg.ltPos || 'be'];
    t = { id: 'l' + Date.now(), kind: 'lt', text: 'Nome do convidado', sub: 'Cargo ou informação', t0, t1: Math.min(total, t0 + 5),
      shape: cfg.ltShape || 'barra', c1: cfg.ltC1 || '#ff5a36', c2: cfg.ltC2 || '#111111', size: 1, x: P[1], y: P[2], align: P[3] };
    S.texts.push(t); commit();
  }
  selText = t.id; dirty = true;
  if (curOut < t.t0 + 0.5 || curOut >= t.t1) seekOut(Math.min(t.t0 + 0.6, t.t1 - 0.05));
  const keep = () => { cfg.ltShape = t.shape; cfg.ltC1 = t.c1; cfg.ltC2 = t.c2; saveCfg(); };   // próxima tarja já vem no mesmo estilo
  sheet('Tarja', `<input type="text" id="lT" value="${esc(t.text)}" placeholder="Título (nome)">
    <input type="text" id="lS" value="${esc(t.sub || '')}" placeholder="Linha de baixo (opcional)">
    <p class="note">Modelo</p>
    <div class="row">${Object.entries(LT_SHAPES).map(([k, v]) => `<button class="chip${t.shape === k ? ' on' : ''}" data-sh="${k}">${v}</button>`).join('')}</div>
    <p class="note">Posição (ou arraste a tarja no vídeo)</p>
    <div class="row">${Object.entries(LT_POS).map(([k, v]) => `<button class="chip" data-ps="${k}">${v[0]}</button>`).join('')}</div>
    <p class="note">Cor de destaque</p>
    <div class="row">${COLORS.map(cl => `<button class="sw${cl === t.c1 ? ' on' : ''}" data-c1="${cl}" style="background:${cl}"></button>`).join('')}</div>
    <p class="note">Cor do fundo</p>
    <div class="row">${[...new Set([...LT_BG, ...COLORS])].map(cl => `<button class="sw${cl === t.c2 ? ' on' : ''}" data-c2="${cl}" style="background:${cl}"></button>`).join('')}</div>
    ${range('lZ', 'Tamanho', 0.6, 1.6, 0.05, t.size)}
    <p class="note" id="lI"></p>
    <div class="row"><button class="chip" id="lA">Começa na agulha</button><button class="chip" id="lB">Termina na agulha</button><button class="chip" id="lAll">Vídeo todo</button></div>
    <button class="btn danger wide" id="lDel">Excluir tarja</button>`, b => {
    const info = () => b.querySelector('#lI').textContent = `Aparece de ${fmtT(t.t0)} até ${fmtT(Math.min(t.t1, total))}`; info();
    const iT = b.querySelector('#lT'), iS = b.querySelector('#lS');
    iT.oninput = () => { t.text = iT.value; dirty = true; }; iS.oninput = () => { t.sub = iS.value; dirty = true; };
    iT.onchange = iS.onchange = () => commit();
    on(b, '[data-sh]', 'click', el => { t.shape = el.dataset.sh; keep(); commit(); openLT(t.id); });
    on(b, '[data-ps]', 'click', el => { const P = LT_POS[el.dataset.ps]; t.x = P[1]; t.y = P[2]; t.align = P[3]; cfg.ltPos = el.dataset.ps; saveCfg(); commit(); dirty = true; });
    on(b, '[data-c1]', 'click', el => { t.c1 = el.dataset.c1; keep(); commit(); openLT(t.id); });
    on(b, '[data-c2]', 'click', el => { t.c2 = el.dataset.c2; keep(); commit(); openLT(t.id); });
    on(b, '#lZ', 'input', el => { t.size = +el.value; b.querySelector('#lZV').textContent = el.value; dirty = true; });
    on(b, '#lZ', 'change', () => commit());
    b.querySelector('#lA').onclick = () => { if (curOut >= t.t1 - 0.2) t.t1 = Math.min(total, curOut + 5); t.t0 = Math.min(curOut, t.t1 - 0.2); commit(); info(); };
    b.querySelector('#lB').onclick = () => { if (curOut <= t.t0 + 0.2) return toast('Mova a agulha para depois do começo.'); t.t1 = curOut; commit(); info(); };
    b.querySelector('#lAll').onclick = () => { t.t0 = 0; t.t1 = total + 999; commit(); info(); };
    b.querySelector('#lDel').onclick = () => { S.texts = S.texts.filter(x => x !== t); selText = null; commit(); closeSheet(); };
  });
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
const easeOut = p => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
/* efeito de transição no instante: d = segundos desde o corte (entrada), rest = segundos até o próximo corte (saída) */
function trFx(tr, d, ntr, rest, W, H) {
  const f = { z: 1, tx: 0, ty: 0, rot: 0, blur: 0, ghost: 0, glitch: 0, ov: null };
  const u = W / 1080;
  if (tr && d < 0.6) {
    if (tr === 'punch' && d < 0.28) f.z = 1 + 0.2 * Math.pow(1 - d / 0.28, 2);
    if (tr === 'flash' && d < 0.28) f.ov = ['#fff', 0.9 * (1 - d / 0.28)];
    if (tr === 'fade' && d < 0.3) f.ov = ['#000', 1 - d / 0.3];
    if (tr === 'zoom' && d < 0.3) { const k = 1 - easeOut(d / 0.3); f.z = 1 + 0.4 * k; f.blur = 14 * u * k; }
    if (tr === 'zoomout' && d < 0.5) { const k = 1 - easeOut(d / 0.5); f.z = 1 + 0.6 * k; }
    if (tr === 'whip' && d < 0.3) { const k = 1 - easeOut(d / 0.3); f.tx = W * 0.6 * k; f.ghost = k; }
    if (tr === 'whipv' && d < 0.3) { const k = 1 - easeOut(d / 0.3); f.ty = H * 0.6 * k; f.ghost = k; }
    if (tr === 'spin' && d < 0.4) { const k = 1 - easeOut(d / 0.4); f.rot = -0.22 * k; f.z = 1 + 0.65 * k; f.blur = 8 * u * k; }
    if (tr === 'shake' && d < 0.4) { const k = 1 - d / 0.4, a = W * 0.03 * k; f.tx = a * Math.sin(d * 95); f.ty = a * Math.cos(d * 73); f.z = 1 + 0.08 * k; }
    if (tr === 'glitch' && d < 0.25) { const k = 1 - d / 0.25; f.glitch = k; f.ov = [Math.floor(d * 30) % 2 ? '#ff00aa' : '#00e5ff', 0.18 * k]; }
    if (tr === 'blur' && d < 0.35) { const k = 1 - easeOut(d / 0.35); f.blur = 22 * u * k; f.z = 1 + 0.1 * k; }
  }
  // lado de saída: o trecho anterior já começa o movimento antes do corte
  if (ntr && rest < 0.25) {
    if (ntr === 'fade') f.ov = ['#000', 1 - rest / 0.25];
    if (rest < 0.15) {
      const k = easeOut(1 - rest / 0.15);
      if (ntr === 'zoom') { f.z *= 1 + 0.4 * k; f.blur = Math.max(f.blur, 14 * u * k); }
      if (ntr === 'whip') { f.tx = -W * 0.6 * k; f.ghost = k; }
      if (ntr === 'whipv') { f.ty = -H * 0.6 * k; f.ghost = k; }
      if (ntr === 'blur') f.blur = Math.max(f.blur, 22 * u * k);
      if (ntr === 'spin') { f.rot = 0.22 * k; f.z *= 1 + 0.65 * k; }
    }
  }
  return f;
}
/* desfoque barato: reduz o quadro e amplia de volta (leve no celular e funciona em qualquer navegador) */
let blurCv = null;
function softBlur(b) {
  const W = cv.width, H = cv.height, k = clamp(Math.round(b / 2), 3, 14);
  const w = Math.max(8, Math.round(W / k)), h = Math.max(8, Math.round(H / k));
  if (!blurCv) blurCv = document.createElement('canvas');
  if (blurCv.width !== w || blurCv.height !== h) { blurCv.width = w; blurCv.height = h; }
  const bc = blurCv.getContext('2d'); bc.imageSmoothingEnabled = true; bc.drawImage(cv, 0, 0, w, h);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = clamp(b / 10, 0, 1);
  ctx.drawImage(blurCv, 0, 0, W, H); ctx.restore();
}
/* ---------- marca (logo animado no canto, em toda edição) ---------- */
const MARCA = { fw: 260, fh: 153, n: 60, cols: 10, fps: 10 };
const marcaImg = new Image(); marcaImg.onload = () => { dirty = true; }; marcaImg.src = 'marca.webp?v=1';
function drawLogo(c, W, H, o) {
  const L = cfg.logo; if (!L || !L.on || !marcaImg.naturalWidth) return;
  const k = Math.floor(o * MARCA.fps) % MARCA.n, sx = (k % MARCA.cols) * MARCA.fw, sy = Math.floor(k / MARCA.cols) * MARCA.fh;
  const sm = Math.min(W, H), w = sm * L.size, h = w * MARCA.fh / MARCA.fw, m = Math.max(sm * 0.035, frameInset(W, H) + sm * 0.015);
  c.drawImage(marcaImg, sx, sy, MARCA.fw, MARCA.fh, L.pos === 'tl' ? m : W - w - m, m, w, h);
}
function openMarca() {
  pause();
  const L = cfg.logo;
  sheet('Marca', `<p>O logo da TV Huntter News aparece no canto de cima em todos os vídeos, inclusive no exportado.</p>
    <div class="box">${L.on ? '<span class="ok">Ligada</span><button class="btn danger" id="lgT">Desligar</button>' : '<span>Desligada</span><button class="btn" id="lgT">Ligar</button>'}</div>
    ${L.on ? `<div class="row">${[['tl', 'Canto esquerdo'], ['tr', 'Canto direito']].map(([k, n]) => `<button class="chip${L.pos === k ? ' on' : ''}" data-lp="${k}">${n}</button>`).join('')}</div>
    ${range('lgS', 'Tamanho', 0.15, 0.5, 0.01, L.size)}` : ''}`, b => {
    b.querySelector('#lgT').onclick = () => { L.on = !L.on; saveCfg(); dirty = true; openMarca(); };
    on(b, '[data-lp]', 'click', el => { L.pos = el.dataset.lp; saveCfg(); dirty = true; openMarca(); });
    on(b, '#lgS', 'input', el => { L.size = +el.value; b.querySelector('#lgSV').textContent = el.value; dirty = true; });
    on(b, '#lgS', 'change', () => saveCfg());
  });
}
function draw(paint) {
  const W = cv.width, H = cv.height, o = curOut;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  let ov = null;
  if (paint || video.readyState >= 2) {
    const g = S.segs[curSeg], d = o - offs[curSeg], nx = S.segs[curSeg + 1];
    const f = trFx(g && curSeg > 0 ? g.tr : '', d, nx ? nx.tr : '', g ? (g.e - g.s) - d : 9, W, H);
    ov = f.ov;
    const z = zoomAt(o) * f.z * fxZoom(o);
    const s0 = Math.max(W / S.vw, H / S.vh), x0 = (W - S.vw * s0) / 2, y0 = (H - S.vh * s0) / 2, cx = W / 2, cy = H * 0.42;
    const dx = cx - (cx - x0) * z, dy = cy - (cy - y0) * z, dw = S.vw * s0 * z, dh = S.vh * s0 * z;
    const src = (x, y) => paint ? paint(ctx, dx + x, dy + y, dw, dh) : ctx.drawImage(video, dx + x, dy + y, dw, dh);
    ctx.save();
    if (f.rot) { ctx.translate(W / 2, H / 2); ctx.rotate(f.rot); ctx.translate(-W / 2, -H / 2); }
    if (f.tx || f.ty) {
      // o quadro "dá a volta" para não aparecer fundo preto no movimento
      const sx = f.tx ? Math.sign(f.tx) * W : 0, sy = f.ty ? Math.sign(f.ty) * H : 0;
      src(f.tx, f.ty); src(f.tx - sx, f.ty - sy);
      if (f.ghost > 0.05) {                     // rastro de movimento
        ctx.globalAlpha = 0.3 * f.ghost;
        for (const m of [0.06, 0.12]) { const gx = f.tx ? -Math.sign(f.tx) * W * m * f.ghost : 0, gy = f.ty ? -Math.sign(f.ty) * H * m * f.ghost : 0; src(f.tx + gx, f.ty + gy); src(f.tx + gx - sx, f.ty + gy - sy); }
        ctx.globalAlpha = 1;
      }
    } else src(0, 0);
    if (f.glitch > 0) {                          // faixas deslocadas
      const n = 7, fr = Math.floor(d * 30);
      for (let k = 0; k < n; k++) {
        const r = Math.sin((k + 1) * 12.9898 + fr * 78.233) * 43758.5453, off = (r - Math.floor(r) - 0.5) * W * 0.12 * f.glitch;
        if (Math.abs(off) < 2) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(0, H * k / n + (r % 1) * H * 0.05, W, H / n * 0.45); ctx.clip(); src(off, 0); ctx.restore();
      }
    }
    ctx.restore();
    if (f.blur > 0.5) softBlur(f.blur * 1080 / W);
  }
  if (ov) { ctx.globalAlpha = clamp(ov[1], 0, 1); ctx.fillStyle = ov[0]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawImgs(W, H, o);
  camLayout(W, H, o);
  tiltLayout(W, H, o);
  drawFrame(ctx, W, H, o);
  drawCaps(ctx, W, H, o);
  drawTexts(ctx, W, H, o);
  drawLogo(ctx, W, H, o);
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
    const el = document.createElement('div'); el.className = 'tbar' + (t.kind === 'lt' ? ' lt' : t.kind === 'fx' ? ' fx' : t.kind === 'img' ? ' img' : ''); el.dataset.id = t.id; el.textContent = t.text.replace(/\n/g, ' ');
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
  const tb = e.target.closest('.tbar'); if (tb) return openAny(tb.dataset.id);
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
  const cap = !t && capBox && x >= capBox[0] && x <= capBox[0] + capBox[2] && y >= capBox[1] && y <= capBox[1] + capBox[3];
  drag = { t, cap, x, y, ox: t && t.x, oy: t ? t.y : S.caps.y, moved: false };
  if (t) { selText = t.id; dirty = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { } }
  if (cap) { capDrag = true; dirty = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { } }
});
cv.addEventListener('pointermove', e => {
  if (!drag || !(drag.t || drag.cap)) return;
  const [x, y] = cvPos(e);
  if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 8) drag.moved = true;
  if (drag.cap) { if (drag.moved) { S.caps.y = clamp(drag.oy + (y - drag.y) / cv.height, 0.08, 0.94); dirty = true; } return; }
  if (drag.moved) { drag.t.x = clamp(drag.ox + (x - drag.x) / cv.width, 0.05, 0.95); drag.t.y = clamp(drag.oy + (y - drag.y) / cv.height, 0.04, 0.96); dirty = true; }
});
cv.addEventListener('pointerup', () => {
  if (!drag) return; const d = drag; drag = null;
  if (d.cap) { capDrag = false; dirty = true; if (d.moved) { commit(); return; } }
  if (d.t) { if (d.moved) commit(); else openAny(d.t.id); }
  else playing ? pause() : play();
});
cv.addEventListener('pointercancel', () => { drag = null; if (capDrag) { capDrag = false; dirty = true; } });

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
    <label class="fld grow">Qualidade<select id="oModel">${Object.entries(MODELS).map(([k, v]) => `<option value="${k}"${k === cfg.model ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></label></div>
    <p class="note" id="oWarn"${cfg.model === 'melhor' ? '' : ' hidden'}>"Melhor" acerta mais, mas usa bastante memória. Feche os outros apps antes; se a página fechar sozinha, volte para "Boa".</p>`;
}
function bindStt(b) {
  on(b, '#oLang', 'change', el => { cfg.lang = el.value; saveCfg(); });
  on(b, '#oModel', 'change', el => { cfg.model = el.value; saveCfg(); const w = b.querySelector('#oWarn'); if (w) w.hidden = el.value !== 'melhor'; });
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
  if (tab === 'custom') body = `<p class="note">Dica: arraste a legenda no próprio vídeo para mudar de lugar.</p>
      <div class="row">${[['Em cima', 0.16], ['No meio', 0.5], ['Embaixo', 0.84]].map(([n, v]) => `<button class="chip${Math.abs(S.caps.y - v) < 0.03 ? ' on' : ''}" data-cpos="${v}">${n}</button>`).join('')}</div>
      ${range('cSize', 'Tamanho', 36, 110, 2, S.caps.size)}${range('cY', 'Altura na tela', 0.08, 0.94, 0.01, S.caps.y)}
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
    on(b, '[data-cpos]', 'click', el => { S.caps.y = +el.dataset.cpos; commit(); openCaps('custom'); });
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

const openAny = id => { const t = S.texts.find(t => t.id === id); return t && t.kind === 'lt' ? openLT(id) : t && t.kind === 'fx' ? openMotion(id) : t && t.kind === 'img' ? openImg(id) : openText(id); };
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
    <button class="btn ghost wide" id="trAll">Aplicar em todos os cortes</button>
    <button class="btn ghost wide" id="trAuto">Automático (variadas em todos os cortes)</button>`
    : '<p>As transições entram nos cortes. Use Dividir, Pausas ou Corte limpo para criar cortes primeiro.</p>', b => {
    on(b, '[data-tr]', 'click', el => { pick = el.dataset.tr; b.querySelectorAll('[data-tr]').forEach(x => x.classList.toggle('on', x === el)); });
    on(b, '#trOne', 'click', () => {
      let bi = 1; for (let i = 1; i < S.segs.length; i++) if (Math.abs(offs[i] - curOut) < Math.abs(offs[bi] - curOut)) bi = i;
      S.segs[bi].tr = pick; commit(); seekOut(Math.max(0, offs[bi] - 0.8)); openTrans(); play();
    });
    on(b, '#trAuto', 'click', () => { autoTransitions(); commit(); openTrans(); seekOut(0); toast('Transições variadas aplicadas. Toque no vídeo para ver.'); });
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
    <label class="tog">Transições automáticas<input type="checkbox" id="mT" checked></label>
    ${sttOptions()}
    <button class="btn wide" id="mGo">Editar meu vídeo</button>`, b => {
    bindStt(b);
    b.querySelector('#mGo').onclick = async () => {
      const L = b.querySelector('#mL').checked, C = b.querySelector('#mC').checked, Z = b.querySelector('#mZ').checked, T = b.querySelector('#mT').checked, before = total;
      if (L || C) { if (!await ensureWords()) return; }
      if (L) await cleanCut();
      if (C) S.caps.on = true;
      if (Z) S.zoom.on = true;
      if (T) autoTransitions();
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
    <label class="tog">Mostrar a marca (logo no canto)<input type="checkbox" id="eLogo"${cfg.logo.on ? ' checked' : ''}></label>
    <button class="btn wide" id="eGo">Exportar vídeo</button>`, b => {
    b.querySelector('#eLogo').onchange = e => { cfg.logo.on = e.target.checked; saveCfg(); dirty = true; };
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
const canFast = () => !cfg.noFast && window.isSecureContext && 'VideoEncoder' in window && 'AudioEncoder' in window && 'VideoDecoder' in window;
/* alguns celulares travam o codificador/decodificador de vídeo sem dar erro: se nada andar por um tempo, desiste */
const within = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => t = setTimeout(() => rej(new Error('travou')), ms))]).finally(() => clearTimeout(t)); };
let fastErr = '';
async function exportVideo(q) {
  fastErr = '';
  closeSheet(); pause();
  try { await within(marcaImg.decode(), 5000); } catch (e) { }
  if (canFast()) {
    try { const r = await exportFast(q); if (r) showResult(r, 'mp4'); return; }
    catch (e) {
      console.warn('exportação rápida falhou', e); fastErr = String(e && e.message || e); idle(); exporting = false; sizeCanvas(); seekOut(0);
      if (exCancel) return toast('Exportação cancelada.');
      if (String(e && e.message) === 'travou') { cfg.noFast = true; saveCfg(); }
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
  if (!vt || !(await within(vt.canDecode(), 15000))) throw new Error('decodificação não suportada');
  sizeCanvas(q);
  const W = cv.width, H = cv.height, br = q >= 1920 ? 10e6 : 5e6;
  if (MB.canEncodeVideo && !(await within(MB.canEncodeVideo('avc', { width: W, height: H, bitrate: br }), 15000))) throw new Error('codificação H.264 não suportada');

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
  await within(output.start(), 15000);
  let wl = null; try { wl = await navigator.wakeLock.request('screen'); } catch (e) { }
  try {
    if (as) { for (const b of abOut) await within(as.add(b), 15000); as.close(); }
    abOut = null;
    const sink = new MB.VideoSampleSink(vt), t0 = performance.now();
    let last = -1, shown = 0;
    for (let i = 0; i < S.segs.length && !exCancel; i++) {
      const g = S.segs[i];
      const it = sink.samples(g.s, g.e)[Symbol.asyncIterator]();
      try { while (true) {
        const nx = await within(it.next(), 12000);
        if (nx.done) break;
        const smp = nx.value;
        try {
          if (exCancel) break;
          const ot = offs[i] + Math.max(0, smp.timestamp - g.s);
          if (smp.timestamp >= g.e || ot > total) continue;
          if (last >= 0 && ot - last < 1 / 30 - 0.004) continue;      // no máximo 30 quadros por segundo
          curSeg = i; curOut = ot; last = ot;
          draw((c, x, y, w, h) => smp.draw(c, x, y, w, h));
          await within(vs.add(ot, 1 / 30), 12000);
          const now = performance.now();
          if (now - shown > 200) {
            shown = now; const el = (now - t0) / 1000, rate = ot / Math.max(el, 0.01);
            busy('Exportando…', fmtT(ot) + ' de ' + fmtT(total) + (el > 2 ? ` · ${rate.toFixed(1)}× mais rápido que o vídeo` : ''), ot / total, () => exCancel = true);
          }
        } finally { smp.close(); }
      } } finally { try { it.return && it.return().catch(() => { }); } catch (_) { } }
    }
    vs.close();
    if (exCancel) { try { await within(output.cancel(), 3000); } catch (_) { } return null; }
    busy('Finalizando o arquivo…', '', 1);
    await within(output.finalize(), 60000);
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  } catch (e) { try { await within(output.cancel(), 3000); } catch (_) { } throw e; }
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
      await within(video.play(), 10000);
      if (!started) { rec.start(); started = true; } else rec.resume();
      prepare(i + 1);
      await new Promise((res, rej) => {
        let lastT = -1, lastAt = performance.now();
        const tick = () => {
          if (exCancel || video.ended || video.currentTime >= g.e - 0.012) return res();
          const now = performance.now();
          if (video.currentTime !== lastT || document.hidden) { lastT = video.currentTime; lastAt = now; }
          else if (now - lastAt > 4000 && video.paused) video.play().catch(() => { });
          if (now - lastAt > 15000) return rej(new Error('o vídeo parou de tocar no meio. Deixe a tela ligada e o app aberto, e tente de novo'));
          curOut = offs[i] + Math.max(0, video.currentTime - g.s); draw();
          busy('Exportando…', fmtT(curOut) + ' de ' + fmtT(total), curOut / total, () => exCancel = true);
          requestAnimationFrame(tick);
        }; tick();
      });
      if (rec.state === 'recording') rec.pause();
      video.pause();
    }
    if (started) { if (rec.state === 'paused') rec.resume(); rec.stop(); await within(stopped, 15000); }
  } catch (e) { err = e; console.error(e); try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) { } }
  vids.forEach(v => v.pause()); gOut.gain.value = 1; exporting = false; idle();
  try { wl && wl.release(); } catch (e) { }
  stream.getVideoTracks().forEach(t => t.stop());
  sizeCanvas(); seekOut(0);
  if (err && (lostFile(String(err.message || err)) || lostFile(fastErr) || (video.error && video.error.code))) return askRelink();
  if (err) return sheet('A exportação falhou', `<p>${esc(String(err.message || err))}</p>
    ${fastErr ? `<p class="note">Modo rápido: ${esc(fastErr)}</p>` : ''}
    <p class="note">Tire um print desta tela e mande para o suporte. Tente de novo com a qualidade "Leve (720p)".</p>
    <button class="btn wide" id="fxOk">Fechar</button>`, b => b.querySelector('#fxOk').onclick = closeSheet);
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
/* Cópia própria do vídeo: no Android o acesso ao arquivo escolhido pode expirar
   (a prévia fica preta e a exportação dá "network error"). Copiamos para o armazenamento do app. */
let curOpfs = null;
async function ownCopy(file) {
  curOpfs = null;
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) throw 0;
    const dir = await navigator.storage.getDirectory();
    for await (const name of dir.keys()) if (name.startsWith('video-')) { try { await dir.removeEntry(name); } catch (_) { } }
    const nm = 'video-' + Date.now(), fh = await dir.getFileHandle(nm, { create: true });
    if (!fh.createWritable) throw 0;
    const w = await fh.createWritable(), rd = file.stream().getReader(); let done = 0;
    for (; ;) {
      const { value, done: end } = await rd.read(); if (end) break;
      await w.write(value); done += value.byteLength;
      busy('Preparando o vídeo…', 'Fazendo uma cópia para não perder o acesso ao arquivo', done / file.size);
    }
    await w.close();
    const f = await fh.getFile(); curOpfs = nm;
    return new File([f], file.name, { type: file.type || f.type });
  } catch (e) {
    if (file.size < 250e6) { try { return new File([await file.arrayBuffer()], file.name, { type: file.type }); } catch (_) { } }
    return file;
  }
}
let relink = false, loadingVid = false, relinkAsked = 0;
async function relinkVideo(raw) {
  busy('Abrindo o vídeo…'); loadingVid = true;
  try { await relinkInner(raw); } finally { loadingVid = false; }
}
async function relinkInner(raw) {
  const file = await ownCopy(raw), url = URL.createObjectURL(file);
  const probe = document.createElement('video'); probe.muted = true; probe.preload = 'metadata';
  try { await new Promise((res, rej) => { probe.onloadedmetadata = res; probe.onerror = rej; probe.src = url; }); }
  catch (e) { idle(); URL.revokeObjectURL(url); return toast('Não consegui abrir este vídeo.', 4000); }
  if (Math.abs(probe.duration - S.dur) > 0.25) { idle(); URL.revokeObjectURL(url); return toast('Esse não parece ser o mesmo vídeo (a duração é diferente). Escolha o mesmo arquivo.', 6000); }
  probe.removeAttribute('src');
  vids.forEach(v => v.pause()); if (srcUrl) URL.revokeObjectURL(srcUrl); srcUrl = url;
  vids.forEach(v => v.src = url); tv.src = url; S.file = file; prepI = -1; waitSwap = false; act = 0; video = vids[0];
  idle(); seekOut(curOut); dirty = true; thumbs = []; thumbN = 0; makeThumbs();
  saveProject(); toast('Pronto! Vídeo reconectado, sua edição foi mantida.', 4000);
}
const lostFile = m => /network error|notreadable|could not be read|not.?found|permission|interrupted by a call to pause/i.test(m);
function askRelink() {
  sheet('Reconectar o vídeo', `<p>O celular parou de deixar o app ler o arquivo do vídeo (isso acontece no Android depois de um tempo ou se o vídeo está na nuvem).</p>
    <p>Escolha <b>o mesmo vídeo</b> de novo: sua edição continua do jeito que está.</p>
    <button class="btn wide" id="rlGo">Escolher o vídeo de novo</button>`, b => {
    b.querySelector('#rlGo').onclick = () => { closeSheet(); relink = true; $('#file').value = ''; $('#file').click(); };
  });
}
async function loadVideo(raw, proj = null) {
  loadingVid = true;
  try { await loadInner(raw, proj); } finally { loadingVid = false; }
}
async function loadInner(raw, proj) {
  busy('Abrindo o vídeo…');
  if (!proj && resumeState) { proj = resumeState; resumeState = null; }   // vídeo escolhido de novo para continuar
  let file;
  if (proj && proj._fromStore) { file = raw; curOpfs = proj.opfs; }   // já é a cópia guardada no app
  else file = await ownCopy(raw);
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
  S.frame = { on: false, style: cfg.frStyle || 'jornal', color: cfg.frColor || '#e11d2a', text: '', tag: 'URGENTE' };
  hist = []; hi = -1; sel = -1; curSeg = 0; curOut = 0; thumbs = []; thumbN = 0; playing = false; aiHist = [];
  let pos = 0;
  if (proj) {
    if (Math.abs(proj.dur - S.dur) > 0.25) toast('Esse vídeo é diferente do salvo; comecei uma edição nova.', 5000);
    else { try { Object.assign(S, JSON.parse(proj.state)); pos = proj.pos || 0; } catch (e) { } }
  }
  $('#home').hidden = true; $('#editor').hidden = false; closeSheet(); nudgeTools();
  commit(); seekOut(Math.min(pos, total)); idle();
  if (proj && Math.abs(proj.dur - S.dur) <= 0.25) toast('Edição recuperada. Continue de onde parou.', 3500);
  try { await document.fonts.load('800 40px Montserrat'); await document.fonts.load('italic 700 40px "Playfair Display"'); } catch (e) { }
  dirty = true;
  analyze(); makeThumbs();
}

/* ---------- ligações ---------- */
$('#bPlay').innerHTML = ICON.play; $('#bUndo').innerHTML = ICON.undo; $('#bRedo').innerHTML = ICON.redo;
$('#bHome').innerHTML = ICON.home; $('#shClose').innerHTML = ICON.close; $('#bMagic').innerHTML = ICON.magic;
$('#tools').innerHTML = TOOLS.map(([k, n]) => `<button data-tool="${k}">${ICON[k]}<span>${n}</span></button>`).join('');
const ACT = { limpo: openLimpo, pausas: openPausas, legendas: () => openCaps(), texto: () => openText(), trans: openTrans, zoom: openZoom, marca: openMarca, tarja: () => openLT(), moldura: openFrame, motion: () => openMotion(), imagem: () => openImg(), ia: openAI, dividir: splitHere, excluir: deleteSeg };
// mostra que a barra de ferramentas desliza para o lado
function nudgeTools() { const t = $('#tools'); setTimeout(() => { t.scrollTo({ left: 140, behavior: 'smooth' }); setTimeout(() => t.scrollTo({ left: 0, behavior: 'smooth' }), 700); }, 900); }
$('#tools').addEventListener('scroll', e => e.target.classList.toggle('end', e.target.scrollLeft + e.target.clientWidth >= e.target.scrollWidth - 4), { passive: true });
$('#tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b && !exporting) ACT[b.dataset.tool](); });
$('#bPlay').onclick = () => playing ? pause() : play();
$('#bUndo').onclick = () => restore(hi - 1);
$('#bRedo').onclick = () => restore(hi + 1);
$('#bMagic').onclick = openMagic;
$('#bFmt').onclick = openFmt;
$('#bExport').onclick = openExport;
document.addEventListener('visibilitychange', () => { if (document.hidden && S.file) saveProject(); });
$('#bHome').onclick = () => { if (confirm('Começar com outro vídeo? A edição atual fica salva só até você abrir o próximo.')) { pause(); resumeState = null; $('#file').value = ''; $('#file').click(); } };
showResume();
$('#file').onchange = e => { const f = e.target.files[0]; if (!f) { relink = false; return; } if (relink) { relink = false; relinkVideo(f); } else loadVideo(f); };
window.addEventListener('resize', () => { fitCanvas(); dirty = true; });
// se o arquivo ficar ilegível no meio da edição, oferece reconectar sem perder nada
vids.forEach(v => v.addEventListener('error', () => {
  if (loadingVid || exporting || !S.file || $('#editor').hidden || Date.now() - relinkAsked < 8000) return;
  relinkAsked = Date.now(); pause(); askRelink();
}));
requestAnimationFrame(loop);

// modo de teste: index.html?v=arquivo.mp4 abre um vídeo da própria pasta
const demo = new URLSearchParams(location.search).get('v');
if (demo) fetch(demo).then(r => r.blob()).then(b => loadVideo(new File([b], demo, { type: b.type || 'video/mp4' })));

// instalação como app (só funciona em https ou localhost)
if ('serviceWorker' in navigator && window.isSecureContext && location.hostname !== 'localhost') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
