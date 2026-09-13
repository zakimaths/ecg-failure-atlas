/* Visual playback of computed samples. Never changes analysis or export data. */
'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let keyboard = false;
  document.addEventListener('keydown', () => { keyboard = true; }, true);
  document.addEventListener('pointerdown', () => { keyboard = false; }, true);
  function mount(anchor) {
    const panel = document.createElement('section');
    panel.className = 'process-preview';
    panel.setAttribute('aria-label', 'Processing stages');
    const bar = document.createElement('div');bar.className = 'process-preview-bar';
    const title = document.createElement('p');title.textContent = 'COMPUTED PROCESSING STAGES';
    const button = document.createElement('button');button.type = 'button';button.className = 'text-button';button.textContent = 'Play processing';
    bar.append(title, button);
    const stages = document.createElement('div');stages.className = 'process-stages';
    const note = document.createElement('p');note.className = 'process-preview-note';
    const status = document.createElement('span');status.className = 'process-status';status.setAttribute('role', 'status');
    panel.append(bar, stages, note, status);anchor.after(panel);
    let animations = [], revision = 0, ready = false;
    function stop() {
      revision++;animations.forEach(a => a.cancel());animations = [];
      panel.dataset.playing = 'false';button.textContent = 'Play processing';
      stages.querySelectorAll('.process-stage').forEach(el => {el.removeAttribute('data-active');});
    }
    function available() {
      button.disabled = !ready || reduced.matches;
      button.textContent = reduced.matches ? 'Motion reduced' : 'Play processing';
    }
    function update({input, output, config, fs, inputLabel = 'Recorded input'}) {
      stop();ready = true;stages.replaceChildren();
      const clipped = config.clip_mv ? input.map(v => Math.max(-config.clip_mv, Math.min(config.clip_mv, v))) : input;
      const series = [input, clipped, output];
      let lo = Infinity, hi = -Infinity;
      for (const values of series) for (const v of values) {lo = Math.min(lo, v);hi = Math.max(hi, v);}
      const span = hi - lo || 1;lo -= span * .08;hi += span * .08;
      const labels = [inputLabel, config.clip_mv ? `Clipping · ±${config.clip_mv} mV` : 'Clipping · bypass', config.cutoff_hz ? `FIR · ${config.cutoff_hz} Hz · ${config.mode}` : 'FIR · bypass'];
      for (let index = 0; index < 3; index++) {
        const stage = document.createElement('div');stage.className = 'process-stage';
        const label = document.createElement('p');label.textContent = `${index + 1}. ${labels[index]}`;
        const frame = document.createElement('div');frame.className = 'process-frame';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 640 112');svg.setAttribute('preserveAspectRatio', 'none');svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svg.namespaceURI, 'path');
        // All samples use a common amplitude scale. No smoothing is applied to the samples.
        path.setAttribute('d', series[index].map((v, i) => `${i ? 'L' : 'M'}${(i / (input.length - 1) * 640).toFixed(3)},${(104 - (v - lo) / (hi - lo) * 96).toFixed(3)}`).join(''));
        path.setAttribute('vector-effect', 'non-scaling-stroke');svg.append(path);
        const cursor = document.createElement('div');cursor.className = 'process-cursor';cursor.setAttribute('aria-hidden', 'true');
        frame.append(svg, cursor);stage.append(label, frame);stages.append(stage);
      }
      note.textContent = `${input.length.toLocaleString('en-GB')} samples · ${(input.length / fs).toFixed(0)} s · shared amplitude scale. Playback shows completed stages, not computation time.`;
      status.textContent = '';available();
      if (!reduced.matches && !keyboard) {
        const a = stages.animate([{opacity: .65}, {opacity: 1}], {duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)'});
        animations.push(a);
      }
    }
    async function play() {
      if (panel.dataset.playing === 'true') {stop();available();status.textContent = 'Playback stopped.';return;}
      if (!ready || reduced.matches) return;
      if (keyboard) {status.textContent = 'All three computed stages are shown. Keyboard playback uses the static view.';return;}
      stop();const token = revision;panel.dataset.playing = 'true';button.textContent = 'Stop playback';status.textContent = '';
      for (const stage of stages.children) {
        if (token !== revision) return;
        stage.dataset.active = 'true';
        const cursor = stage.querySelector('.process-cursor');
        const a = cursor.animate([{transform: 'translateX(-100%)', opacity: 0}, {offset: .08, opacity: .8}, {offset: .92, opacity: .8}, {transform: 'translateX(0)', opacity: 0}], {duration: 520, easing: 'linear'});
        animations.push(a);
        try {await a.finished;} catch {return;}
        stage.removeAttribute('data-active');
      }
      if (token === revision) {stop();available();status.textContent = 'Playback complete.';}
    }
    button.addEventListener('click', play);
    reduced.addEventListener('change', () => {stop();available();});
    document.addEventListener('visibilitychange', () => {if (document.hidden) {stop();available();}});
    panel.addEventListener('keydown', event => {if (event.key === 'Escape') {stop();available();status.textContent = 'Playback stopped.';}});
    return {update, invalidate() {stop();ready = false;available();status.textContent = 'Run the changed settings to update these stages.';}};
  }
  globalThis.ECGProcessMotion = {mount};
})();
