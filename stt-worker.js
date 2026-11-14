// Reconhecimento de fala (Whisper) rodando no próprio aparelho.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';

let asr = null, current = null, device = null, noGpu = false, progress_callback = null;

// No processador (wasm) a memória do celular é o limite: o modelo grande vai mais comprimido
// para caber; os menores ficam com o codificador completo, que acerta mais.
const OPTS = model => ({
  webgpu: { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
  wasm: { device: 'wasm', dtype: /small|medium|large/.test(model)
    ? { encoder_model: 'q8', decoder_model_merged: 'q4' }
    : { encoder_model: 'fp32', decoder_model_merged: 'q8' } },
});

async function free() {
  const old = asr; asr = null; current = null; device = null;
  try { if (old && old.dispose) await old.dispose(); } catch (e) { }
}

async function load(model) {
  if (asr && current === model) return;
  await free();
  const o = OPTS(model), tries = [];
  if (!noGpu && self.navigator && navigator.gpu) tries.push(o.webgpu);
  tries.push(o.wasm);
  let last;
  for (const opt of tries) {
    try {
      asr = await pipeline('automatic-speech-recognition', model, { ...opt, progress_callback });
      current = model; device = opt.device;
      self.postMessage({ type: 'info', device });
      return;
    } catch (e) { last = e; }
  }
  throw last;
}

// A placa de vídeo do celular pode "cair" no meio do trabalho (Device is lost).
// Nesse caso troca para o processador (wasm) e tenta o mesmo trecho de novo.
async function run(m) {
  const opts = { language: m.lang, task: 'transcribe', return_timestamps: 'word' };
  try {
    return await asr(m.audio, opts);
  } catch (err) {
    if (device !== 'webgpu') throw err;
    const model = current;
    noGpu = true;
    await free();
    self.postMessage({ type: 'info', device: 'wasm', fallback: true });
    await load(model);
    return await asr(m.audio, opts);
  }
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      if (m.noGpu) noGpu = true;
      progress_callback = p => self.postMessage({ type: 'progress', p });
      await load(m.model);
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'run') {
      const out = await run(m);
      self.postMessage({ type: 'result', chunks: out.chunks || [] });
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err && err.message || err) });
  }
};
