'use strict';
(() => {
  const data = window.ATLAS_DATA;
  const $ = id => document.getElementById(id);
  const theme = getComputedStyle(document.documentElement);
  const token = name => theme.getPropertyValue('--' + name).trim();
  const colors = {reference: token('reference'), output: token('output'), muted: token('muted'), secondary: token('secondary')};
  let group, variant, view = 'overlay', aligned = false;
  const hidden = new Set();
  const config = {responsive: true, displayModeBar: false, scrollZoom: false, doubleClick: 'reset'};
  function format(value) {
    if (value === null) return 'n/a';
    if (value === 0 || Math.abs(value) < 1e-13) return '0';
    if (Math.abs(value) < .001) return value.toExponential(2);
    return new Intl.NumberFormat('en-GB', {maximumFractionDigits: Math.abs(value) < 1 ? 3 : 2}).format(value);
  }
  function coordinates(name) {
    const d = variant.descriptors[name];
    return variant.arrays[name].map((_, i) => d.start_s + i / d.fs_hz);
  }
  function plot() {
    $('overlay-view').setAttribute('aria-pressed', String(view === 'overlay'));
    $('difference-view').setAttribute('aria-pressed', String(view === 'difference'));
    $('alignment-control').hidden = group.kind !== 'delay' || view !== 'overlay';
    $('chart-note').textContent = aligned && view === 'overlay'
      ? `Aligned by ${variant.value} samples · unavailable tail excluded`
      : 'Fixed axes · full-resolution samples · drag to zoom';
    let traces;
    if (view === 'difference') {
      const d = variant.difference;
      traces = [{x: d.values.map((_, i) => d.start_s + i / d.fs_hz), y: d.values,
        type: 'scatter', mode: 'lines', line: {color: colors.output, width: 1.8}, name: d.label,
        hovertemplate: '%{x:.3f} s<br>%{y:.5f} mV<extra>Difference</extra>'}];
    } else {
      traces = variant.traces.map(trace => {
        const name = aligned && trace.array === 'output' ? 'aligned' : trace.array;
        return {x: coordinates(name), y: variant.arrays[name], type: 'scatter',
          mode: group.kind === 'aliasing' && trace.array !== 'input' ? 'lines+markers' : 'lines',
          line: {color: colors[trace.color], width: trace.color === 'muted' ? 1.4 : 2.1,
                 dash: trace.color === 'secondary' ? 'dot' : 'solid'},
          marker: {size: 4}, name: trace.label, visible: hidden.has(trace.array) ? false : true,
          hovertemplate: '%{x:.3f} s<br>%{y:.5f} mV<extra>%{fullData.name}</extra>'};
      });
    }
    const axis = {gridcolor: token('grid'), zerolinecolor: token('control'), tickfont: {size: 12, color: token('muted')},
                  showline: false, ticks: '', fixedrange: false, automargin: true};
    const layout = {margin: {l: 64, r: 24, t: 16, b: 48}, paper_bgcolor: token('surface'), plot_bgcolor: token('surface'),
      font: {family: token('font-body'), color: token('muted')}, showlegend: false,
      xaxis: {...axis, range: group.view, title: {text: 'Time (s)', font: {size: 12}, standoff: 12}},
      yaxis: {...axis, range: view === 'difference' ? [-group.difference_range, group.difference_range] : group.y_range,
        title: {text: view === 'difference' ? 'Difference (mV)' : 'Amplitude (mV)', font: {size: 12}, standoff: 12}},
      hovermode: 'x', dragmode: 'zoom', hoverlabel: {bgcolor: token('raised'), bordercolor: token('control'), font: {size: 12, color: token('ink')}},
      uirevision: `${group.kind}-${view}-${aligned}`};
    Plotly.react($('chart'), traces, layout, config).then(() => Plotly.Plots.resize($('chart')));
    $('chart').setAttribute('aria-label', `${group.question} ${view === 'difference' ? 'Difference' : 'Overlay'} view. ${group.limitation} Numeric measurements follow.`);
    $('legend').hidden = view === 'difference';
  }
  function renderLegend() {
    $('legend').replaceChildren();
    variant.traces.forEach(trace => {
      const label = document.createElement('label');
      label.style.setProperty('--trace', colors[trace.color]);
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !hidden.has(trace.array);
      input.addEventListener('change', () => {input.checked ? hidden.delete(trace.array) : hidden.add(trace.array); plot();});
      const swatch = document.createElement('span'); swatch.className = 'swatch';
      label.append(input, swatch, document.createTextNode(trace.label)); $('legend').append(label);
    });
  }
  function renderMetrics() {
    $('metrics').replaceChildren();
    variant.metrics.headline.forEach(metric => {
      const article = document.createElement('article'); article.className = 'metric';
      const h = document.createElement('h3'); h.textContent = metric.label;
      const value = document.createElement('div'); value.className = 'metric-value'; value.textContent = format(metric.value);
      const unit = document.createElement('span'); unit.textContent = metric.unit; value.append(unit);
      const desc = document.createElement('p'); desc.textContent = metric.description;
      article.append(h, value, desc); $('metrics').append(article);
    });
  }
  function setVariant(index, changeURL = true) {
    variant = group.variants[index];
    if (changeURL) history.replaceState(null, '', `#${group.kind}/${variant.case_id}`);
    document.querySelectorAll('input[name=setting]').forEach((input, i) => {input.checked = i === index;});
    $('download').href = variant.download; $('download').download = variant.download.split('/').pop();
    $('manifest').href = variant.manifest; $('method-manifest').href = variant.manifest;
    $('manifest').textContent = `CASE ${variant.case_id} ↗`;
    $('copy-status').textContent = '';
    renderMetrics(); renderLegend(); plot();
  }
  function showCase(kind, caseId) {
    group = data.cases.find(c => c.kind === kind) || data.cases[0];
    view = 'overlay'; aligned = false; hidden.clear(); $('align').checked = false;
    document.querySelectorAll('.nav-item').forEach(a => {
      if (a.dataset.kind === group.kind) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('case-number').textContent = `EXPERIMENT ${group.number} / ${String(data.cases.length).padStart(2, '0')}`;
    $('case-title').textContent = group.title; $('case-summary').textContent = group.summary;
    $('case-question').textContent = group.question; $('case-explanation').textContent = group.explanation;
    $('case-limitation').textContent = group.limitation; $('setting-label').textContent = group.control;
    $('settings').replaceChildren();
    group.variants.forEach((v, i) => {
      const label = document.createElement('label'); const input = document.createElement('input');
      input.type = 'radio'; input.name = 'setting'; input.value = String(v.value);
      input.setAttribute('aria-label', `${group.control}: ${v.value} ${group.unit}`);
      input.addEventListener('change', () => setVariant(i));
      const span = document.createElement('span'); span.textContent = `${v.value} ${group.unit}`;
      label.append(input, span); $('settings').append(label);
    });
    document.title = `${group.short} | ECG Failure Atlas`;
    const found = group.variants.findIndex(v => v.case_id === caseId);
    setVariant(found >= 0 ? found : group.default);
  }
  data.cases.forEach(c => {
    const a = document.createElement('a'); a.href = `#${c.kind}`; a.className = 'nav-item'; a.dataset.kind = c.kind;
    const number = document.createElement('span'); number.className = 'num'; number.textContent = c.number;
    a.append(number, document.createTextNode(c.short)); $('case-nav').append(a);
  });
  $('overlay-view').addEventListener('click', () => {view = 'overlay'; plot();});
  $('difference-view').addEventListener('click', () => {view = 'difference'; plot();});
  $('align').addEventListener('change', () => {aligned = $('align').checked; plot();});
  $('reset-view').addEventListener('click', () => {
    Plotly.relayout($('chart'), {'xaxis.range': group.view, 'yaxis.range': view === 'difference'
      ? [-group.difference_range, group.difference_range] : group.y_range});
  });
  $('next-case').addEventListener('click', () => {location.hash = data.cases[(data.cases.indexOf(group) + 1) % data.cases.length].kind;});
  $('copy-link').addEventListener('click', async () => {
    $('copy-status').textContent = 'Copying link…';
    let timeout;
    try {
      await Promise.race([navigator.clipboard.writeText(location.href), new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error('Clipboard unavailable')), 1500);})]);
      $('copy-status').textContent = 'Case link copied.';
    } catch (_) {$('copy-status').textContent = `Copy this address: ${location.href}`;}
    finally {clearTimeout(timeout);}
  });
  document.querySelector('.skip').addEventListener('click', event => {event.preventDefault(); $('main').focus(); $('main').scrollIntoView();});
  function fromHash() {const [kind, id] = location.hash.slice(1).split('/'); showCase(kind, id);}
  window.addEventListener('hashchange', fromHash);
  $('case-count').textContent = `${data.bundle_count} prepared cases`;
  document.querySelector('a[href="#methodology"]').addEventListener('click', event => {event.preventDefault(); $('methodology').open = true; $('methodology').scrollIntoView(); $('methodology').querySelector('summary').focus();});
  const chartResize = new ResizeObserver(() => {if ($('chart').data) Plotly.Plots.resize($('chart'));});
  chartResize.observe($('chart'));
  fromHash();
})();
