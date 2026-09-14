// Module Web Worker: scanning a 5 MB paste here keeps the page responsive. No network, no storage.
import { scan, restore } from './detect.js';

onmessage = ({ data }) => {
  if (data.type === 'scan') {
    const t = performance.now();
    postMessage({ type: 'scan', id: data.id, ...scan(data.text, data.enabled), ms: Math.round(performance.now() - t) });
  } else if (data.type === 'restore') {
    postMessage({ type: 'restore', id: data.id, text: restore(data.text, data.map) });
  }
};
