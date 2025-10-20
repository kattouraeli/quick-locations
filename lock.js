// lock.js — static token gate + soft device binding for GitHub Pages
(function () {
  const cfg = (window.QL_LOCK || {});
  const TOKEN_HASHES = Array.isArray(cfg.tokenHashes) ? cfg.tokenHashes : [];
  const APPKEY = cfg.appKey || 'ql-app';
  const LS_UNLOCK = `ql:${APPKEY}:unlocked`;
  const LS_SEED   = `ql:${APPKEY}:seed`;
  const LS_DEVICE = `ql:${APPKEY}:device`;

  const elGate  = () => document.getElementById('ql-gate');
  const elToken = () => document.getElementById('ql-gate-token');
  const elMsg   = () => document.getElementById('ql-gate-msg');
  const elDev   = () => document.getElementById('ql-gate-dev');

  // ---- helpers
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }
  function getOrCreateSeed() {
    let s = localStorage.getItem(LS_SEED);
    if (!s) {
      s = crypto.getRandomValues(new Uint32Array(4)).join('-');
      localStorage.setItem(LS_SEED, s);
    }
    return s;
  }
  async function deviceHash() {
    // soft, privacy-respecting “binding”. It’s not unique, just sticky per install.
    const parts = [
      navigator.userAgent || '',
      navigator.platform || '',
      String(screen.width)+'x'+String(screen.height),
      String(window.devicePixelRatio || 1),
      String(navigator.language || ''),
      String(navigator.hardwareConcurrency || ''),
      String(navigator.maxTouchPoints || ''),
      getOrCreateSeed() // per-install salt
    ].join('|');
    const h = await sha256Hex(parts);
    localStorage.setItem(LS_DEVICE, h);
    return h;
  }
  function showGate() {
    document.documentElement.style.overflow = 'hidden';
    elGate().classList.remove('hidden');
    elToken().focus();
  }
  function hideGate() {
    elGate().classList.add('hidden');
    document.documentElement.style.overflow = '';
  }

  async function alreadyUnlocked() {
    const rec = JSON.parse(localStorage.getItem(LS_UNLOCK) || 'null');
    if (!rec || !rec.token || !rec.device) return false;
    // token must still be in allowlist
    if (!TOKEN_HASHES.includes(rec.token)) return false;
    // device must match
    const cur = await deviceHash();
    return cur === rec.device;
  }

  async function unlockWith(tokenPlain) {
    const tokenHash = await sha256Hex(String(tokenPlain || '').trim());
    if (!TOKEN_HASHES.includes(tokenHash)) return false;
    const dev = await deviceHash();
    localStorage.setItem(LS_UNLOCK, JSON.stringify({ token: tokenHash, device: dev, ts: Date.now() }));
    return true;
  }

  // ---- wire up after DOM is ready
  document.addEventListener('DOMContentLoaded', async () => {
    // if no token configured, do nothing
    if (!TOKEN_HASHES.length) return;

    // DEV bypass if query ?dev=1 (optional; remove if you don't want it)
    const url = new URL(location.href);
    if (url.searchParams.get('dev') === '1') return;

    // small device info for debugging (hidden by default)
    try { elDev().textContent = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''; } catch {}

    if (await alreadyUnlocked()) {
      hideGate();
    } else {
      showGate();
    }

    // buttons
    document.getElementById('ql-gate-submit').addEventListener('click', async () => {
      elMsg().classList.add('hidden');
      const ok = await unlockWith(elToken().value);
      if (ok) {
        hideGate();
      } else {
        elMsg().classList.remove('hidden');
        if (navigator.vibrate) navigator.vibrate(30);
      }
    });

    document.getElementById('ql-gate-cancel').addEventListener('click', () => {
      // keep gate open but clear field (prevents viewing content behind)
      elToken().value = '';
      elMsg().classList.add('hidden');
    });

    document.getElementById('ql-gate-reset').addEventListener('click', () => {
      localStorage.removeItem(LS_UNLOCK);
      localStorage.removeItem(LS_DEVICE);
      localStorage.removeItem(LS_SEED);
      elToken().value = '';
      elMsg().classList.add('hidden');
      showGate();
    });

    // Enter key submits
    elToken().addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('ql-gate-submit').click();
      }
    });
  });
})();
