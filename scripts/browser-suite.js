// Executed by the pinned Playwright CLI. The runner injects only output paths and a local URL.
async page => {
  const {browser, directory, offlineURL, outputPrefix} = __ATLAS_OPTIONS__;
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/.test(url) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) externalRequests.push(url);
  });
  const assert = (condition, message) => {if (!condition) throw new Error(message);};
  const chartReady = () => page.waitForFunction(() => {
    const group = ATLAS_DATA.cases.find(c => location.hash.startsWith('#' + c.kind + '/'));
    const variant = group?.variants.find(v => location.hash.endsWith('/' + v.case_id));
    const graph = document.getElementById('chart');
    return variant && graph.data?.length === variant.traces.length && variant.traces.every((trace, i) => {
      const expected = variant.arrays[trace.array];
      return graph.data[i].y?.length === expected.length && expected.every((y,j) => graph.data[i].y[j] === y);
    });
  });
  const fit = () => page.waitForFunction(() => {
    const graph = document.getElementById('chart');
    const svg = graph.querySelector('.main-svg');
    return svg && Math.abs(svg.getBoundingClientRect().width - graph.clientWidth) < 2;
  });
  await page.reload();
  await chartReady();
  const names = ['01 Clipping','02 Timing delay','03 Aliasing','04 Baseline wander','05 Filter edges'];
  let variantsChecked = 0;
  for (const name of names) {
    await page.getByRole('link',{name,exact:true}).click();
    const radios = page.getByRole('radio');
    assert(await radios.count() === 3, name + ' settings missing');
    for (let i=0;i<3;i++) {
      await radios.nth(i).check();
      await chartReady();
      const agreement = await page.evaluate(() => {
        const g = ATLAS_DATA.cases.find(c => location.hash.startsWith('#' + c.kind + '/'));
        const v = g.variants.find(v => location.hash.endsWith('/' + v.case_id));
        const chart = document.getElementById('chart');
        const coordinatesMatch = v.traces.every((trace,i) => chart.data[i].x.every((t,j) => t === v.descriptors[trace.array].start_s + j/v.descriptors[trace.array].fs_hz));
        const articles = [...document.querySelectorAll('.metric')];
        const metricsMatch = articles.length === v.metrics.headline.length && articles.every((article,i) => {
          const metric = v.metrics.headline[i];
          const actual = Number(article.querySelector('.metric-value').firstChild.textContent.replaceAll(',',''));
          const tolerance = Math.abs(metric.value) < 1 ? .00051 : .0051;
          return article.querySelector('h3').textContent === metric.label && Math.abs(actual-metric.value) <= tolerance;
        });
        return coordinatesMatch && metricsMatch && document.getElementById('download').getAttribute('href') === v.download
          && document.getElementById('manifest').getAttribute('href') === v.manifest
          && document.querySelector('input[name=setting]:checked').value === String(v.value);
      });
      assert(agreement, name + ' chart/metric/link disagreement');
      variantsChecked++;
    }
    await page.getByRole('button',{name:'Difference',exact:true}).click();
    await page.waitForFunction(() => {
      const g=ATLAS_DATA.cases.find(c=>location.hash.startsWith('#'+c.kind+'/'));
      const v=g.variants.find(v=>location.hash.endsWith('/'+v.case_id));
      const graph=document.getElementById('chart');
      return graph.data.length===1 && v.difference.values.every((y,i)=>graph.data[0].y[i]===y);
    });
    assert(!await page.getByLabel('Visible traces').isVisible(), 'Overlay legend visible in Difference');
    await page.getByRole('button',{name:'Overlay',exact:true}).click();
    await chartReady();
  }
  await page.getByRole('link',{name:'02 Timing delay',exact:true}).click();
  await chartReady();
  await page.getByRole('checkbox',{name:'Remove known delay for comparison'}).check();
  await page.waitForFunction(()=>document.getElementById('chart').data[1].y.length===3995);
  assert((await page.locator('#chart-note').textContent()).includes('5 samples'), 'Alignment disclosure missing');
  await page.getByRole('button',{name:'Difference',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('chart').data.length===1 && document.getElementById('chart').data[0].y.length===4000);

  await page.getByRole('link',{name:'01 Clipping',exact:true}).click();
  await page.getByRole('radio',{name:'Clipping limit: 0.65 mV',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  assert(await page.getByRole('radio',{name:'Clipping limit: 0.9 mV',exact:true}).isChecked(), 'Keyboard selection failed');
  const deepLink=page.url();
  await page.reload();
  await chartReady();
  assert(page.url()===deepLink, 'Deep link changed during reload');
  const pending=page.waitForEvent('download');
  await page.getByRole('link',{name:'Download case',exact:true}).click();
  const download=await pending;
  await download.saveAs(directory + '/' + outputPrefix + '-case.zip');
  assert(download.suggestedFilename().includes(deepLink.split('/').pop()), 'Download ID differs');

  // Simulate the browser denying clipboard access. Do not read the system clipboard.
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new Error('Denied for test'))}));
  await page.getByRole('button',{name:'Copy link',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('copy-status').textContent.startsWith('Copy this address:'));
  assert((await page.getByRole('status').textContent()).includes(deepLink), 'Clipboard fallback lost case URL');
  await page.reload();
  await chartReady();
  await page.getByRole('link',{name:'Skip to experiment',exact:true}).focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('#main').evaluate(el=>el===document.activeElement), 'Skip link did not focus main');
  assert(page.url()===deepLink, 'Skip link changed case');

  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await fit();
    assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), 'Document overflow');
  }
  await page.screenshot({path:directory+'/'+outputPrefix+'-mobile.png',fullPage:true});
  await page.context().setOffline(true);
  try {
    if (browser === 'chrome') await page.goto(offlineURL);
    await chartReady();
    await page.getByRole('radio',{name:'Clipping limit: 0.4 mV',exact:true}).check();
    await chartReady();
  } finally {await page.context().setOffline(false);}
  assert(!errors.length, errors.join('\n'));
  assert(!externalRequests.length, 'Unexpected external requests: '+externalRequests.join(', '));
  const accounts = {X:'https://x.com/vesperlemma',LinkedIn:'https://www.linkedin.com/in/alhasan-alkaseem/',GitHub:'https://github.com/zakimaths'};
  for(const [name,url] of Object.entries(accounts)){const links=page.getByRole('link',{name:name+' profile (opens in a new tab)',exact:true}); assert(await links.count()===2,name+' needs top and bottom links');for(const link of await links.all()){assert(await link.getAttribute('href')===url,name+' URL differs');assert(await link.getAttribute('target')==='_blank',name+' link should open separately');}}
  assert(!await page.locator('body').innerText().then(text=>text.includes('\u2014')), 'Em dash in visible copy');
  return {status:'passed',offlineMode:browser==='chrome'?'file navigation with network disabled':'loaded page interactions with network disabled',variantsChecked,differenceViews:5,browser:await page.context().browser().version(),
    checks:['exact trace samples','sample coordinates','metric values','links','alignment','keyboard','deep link reload','download','clipboard denial','skip link','responsive plot',browser==='chrome'?'offline file gallery':'offline loaded-page interaction','profile links','no em dashes','no external requests'],
    errors};
}
