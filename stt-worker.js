// Reconhecimento de fala (Whisper) rodando no próprio aparelho.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';

let asr = null, current = null;

async function load(model) {
  if (asr && current === model) return;
  asr = null;
  const progress_callback = p => self.postMessage({ type: 'progress', p });
  const tries = [];
  if (self.navigator && navigator.gpu) tries.push({ device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } });
  tries.push({ device: 'wasm', dtype: 'q8' });
  let last;
  for (const opt of tries) {
    try {
      asr = await pipeline('automatic-speech-recognition', model, { ...opt, progress_callback });
      current = model;
      self.postMessage({ type: 'info', device: opt.device });
      return;
    } catch (e) { last = e; }
  }
  throw last;
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      await load(m.model);
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'run') {
      const out = await asr(m.audio, { language: m.lang, task: 'transcribe', return_timestamps: 'word' });
      self.postMessage({ type: 'result', chunks: out.chunks || [] });
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err && err.message || err) });
  }
};
