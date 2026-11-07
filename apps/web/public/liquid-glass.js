/**
 * liquid-glass.js (versão do usuário, adaptada só para poder ser chamada de novo)
 * Refração real (o fundo "entorta" na borda do vidro) para elementos com a classe
 * .glass-refract, via filtro SVG (feDisplacementMap) aplicado com backdrop-filter.
 * Só funciona em navegadores Chromium; nos demais fica o vidro normal (.glass).
 * Mudanças em relação ao original: window.initLiquidGlass() pode ser chamada várias
 * vezes (o painel é React e remonta elementos); ignora elementos já processados.
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  // ====== AJUSTE AQUI ======
  const SCALE = 40;     // intensidade da distorção, em px (negativo inverte o sentido)
  const BEZEL = 22;     // largura da borda que entorta, em px
  const BLUR = 3;       // desfoque leve antes da distorção, em px
  const SATURATE = 170; // saturação do fundo, em %
  // =========================

  const MAP_RES = 0.5;
  const THROTTLE_MS = 60;
  const SETTLE_MS = 120;
  let uid = 0;

  function buildMap(w, h, radius, bezel) {
    const cw = Math.max(2, Math.round(w * MAP_RES));
    const ch = Math.max(2, Math.round(h * MAP_RES));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(cw, ch);
    const data = img.data;

    const hw = cw / 2;
    const hh = ch / 2;
    const r = Math.min(radius * MAP_RES, hw, hh);
    const b = Math.max(1, bezel * MAP_RES);

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const px = x + 0.5 - hw;
        const py = y + 0.5 - hh;

        const qx = Math.abs(px) - (hw - r);
        const qy = Math.abs(py) - (hh - r);
        const ox = Math.max(qx, 0);
        const oy = Math.max(qy, 0);
        const outside = Math.hypot(ox, oy);
        const d = -(outside + Math.min(Math.max(qx, qy), 0) - r);

        let R = 128;
        let G = 128;

        if (d > 0 && d < b) {
          let nx;
          let ny;
          if (qx > 0 && qy > 0) {
            nx = (ox / outside) * Math.sign(px);
            ny = (oy / outside) * Math.sign(py);
          } else if (qx > qy) {
            nx = Math.sign(px);
            ny = 0;
          } else {
            nx = 0;
            ny = Math.sign(py);
          }

          const t = 1 - d / b;
          const m = t * t;

          R = 128 + 127 * m * -nx;
          G = 128 + 127 * m * -ny;
        }

        const i = (y * cw + x) * 4;
        data[i] = R;
        data[i + 1] = G;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function createFilter(id, w, h, href) {
    const filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '1');
    filter.setAttribute('height', '1');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const image = document.createElementNS(NS, 'feImage');
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', String(w));
    image.setAttribute('height', String(h));
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('result', 'map');
    image.setAttribute('href', href);

    const displace = document.createElementNS(NS, 'feDisplacementMap');
    displace.setAttribute('in', 'SourceGraphic');
    displace.setAttribute('in2', 'map');
    displace.setAttribute('scale', String(SCALE));
    displace.setAttribute('xChannelSelector', 'R');
    displace.setAttribute('yChannelSelector', 'G');

    filter.append(image, displace);
    return filter;
  }

  function initLiquidGlass() {
    const targets = Array.from(document.querySelectorAll('.glass-refract')).filter((el) => !el.__lg);
    if (!targets.length) return;

    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    const isChromium =
      brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera/i.test(b.brand)) ||
      (!navigator.userAgentData && /Chrome\//.test(navigator.userAgent));
    const reduceTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
    if (!isChromium || reduceTransparency) return;

    let holder = document.getElementById('liquid-glass-defs');
    if (!holder) {
      holder = document.createElementNS(NS, 'svg');
      holder.setAttribute('id', 'liquid-glass-defs');
      holder.setAttribute('width', '0');
      holder.setAttribute('height', '0');
      holder.setAttribute('aria-hidden', 'true');
      holder.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
      document.body.appendChild(holder);
    }

    targets.forEach((el) => {
      el.__lg = true;
      let currentFilter = null;
      let lastW = 0;
      let lastH = 0;
      let lastBuild = 0;
      let settleTimer = 0;

      function apply(w, h) {
        if (!w || !h) return;
        const cs = getComputedStyle(el);
        const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
        const bezel = Math.min(Number(el.dataset.glassBezel) || BEZEL, w / 2, h / 2);

        const id = `liquid-glass-${uid++}`;
        const filter = createFilter(id, w, h, buildMap(w, h, radius, bezel));
        holder.appendChild(filter);
        el.style.backdropFilter = `blur(${BLUR}px) url(#${id}) saturate(${SATURATE}%)`;

        const old = currentFilter;
        currentFilter = filter;
        if (old) {
          requestAnimationFrame(() => requestAnimationFrame(() => old.remove()));
        }
        lastBuild = performance.now();
      }

      function update() {
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        if (!w || !h || (w === lastW && h === lastH)) return;
        lastW = w;
        lastH = h;

        if (performance.now() - lastBuild > THROTTLE_MS) apply(w, h);

        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          apply(Math.round(el.offsetWidth), Math.round(el.offsetHeight));
        }, SETTLE_MS);
      }

      update();

      if ('ResizeObserver' in window) {
        let raf = 0;
        new ResizeObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(update);
        }).observe(el);
      }
    });
  }

  window.initLiquidGlass = initLiquidGlass;
})();
