(() => {
  const API_KEY = 'UE4N9SEA6RVZZYYC';
  const AV_BASE = 'https://www.alphavantage.co/query';

  const dom = {
    form: document.getElementById('tickerForm'),
    tickerInput: document.getElementById('tickerInput'),
    loadBtn: document.getElementById('loadBtn'),
    status: document.getElementById('status'),
    currentTicker: document.getElementById('currentTicker'),
    startingDate: document.getElementById('startingDate'),
    currentDate: document.getElementById('currentDate'),
    score: document.getElementById('score'),
    guessUp: document.getElementById('guessUp'),
    guessDown: document.getElementById('guessDown'),
    restart: document.getElementById('restart'),
    canvas: document.getElementById('priceChart')
  };

  /**
   * State
   */
  const state = {
    ticker: null,
    meta: null,
    dailyDataAsc: [], // ascending by date: [{date: 'YYYY-MM-DD', close: Number}]
    chart: null,
    startIndex: null, // index in dailyDataAsc of starting date
    curIndex: null, // index of the most recent revealed point on chart
    score: 0,
    running: false,
  };

  /**
   * Utils
   */
  const formatDate = (d) => {
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };

  const daysBetween = (d1, d2) => {
    const t1 = new Date(d1).setHours(0,0,0,0);
    const t2 = new Date(d2).setHours(0,0,0,0);
    return Math.round((t2 - t1) / (1000*60*60*24));
  };

  const isWeekday = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day !== 0 && day !== 6; // not Sunday(0) or Saturday(6)
  };

  const randomInt = (min, maxInclusive) => {
    return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  };

  /**
   * Alpha Vantage
   */
  async function fetchDailySeries(ticker) {
    const url = `${AV_BASE}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(ticker)}&outputsize=full&apikey=${API_KEY}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Network error: ${res.status}`);
    const data = await res.json();

    if (data['Note']) {
      throw new Error('Alpha Vantage rate limit reached. Please wait and try again.');
    }
    if (data['Error Message']) {
      throw new Error('Invalid symbol or request.');
    }
    if (!data['Time Series (Daily)']) {
      throw new Error('Unexpected API response.');
    }

    const meta = data['Meta Data'];
    const series = data['Time Series (Daily)'];
    const entries = Object.entries(series)
      .map(([date, o]) => ({
        date,
        close: Number(o['5. adjusted close'] ?? o['4. close'])
      }))
      .filter(p => Number.isFinite(p.close))
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // ascending

    return { meta, entries };
  }

  /**
   * Business logic
   */
  function pickRandomStartIndexWithinWindow(entries) {
    // Pick a weekday, non-holiday date that is at least 7 days before today and not more than 100 days before today.
    // Since market holidays are not explicitly known, use actual trading dates from entries (these exclude holidays/weekends).
    const today = new Date();
    const minDaysAgo = 7;
    const maxDaysAgo = 100;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - maxDaysAgo);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() - minDaysAgo);

    // Build a list of indices whose dates fall within [minDate, maxDate]
    const candidateIndices = [];
    for (let i = 0; i < entries.length; i++) {
      const d = new Date(entries[i].date);
      if (d >= minDate && d <= maxDate) {
        candidateIndices.push(i);
      }
    }
    if (candidateIndices.length === 0) {
      throw new Error('Not enough recent data for the requested window.');
    }
    const idx = candidateIndices[randomInt(0, candidateIndices.length - 1)];
    return idx;
  }

  function buildSevenDaysBefore(entries, startIdx) {
    // Gather 7 trading days before startIdx (exclusive), plus the startIdx day
    const points = [];
    const startFrom = Math.max(0, startIdx - 7);
    for (let i = startFrom; i <= startIdx; i++) {
      points.push(entries[i]);
    }
    return points;
  }

  /**
   * Chart
   */
  function initChart(labels, data) {
    if (state.chart) {
      state.chart.destroy();
    }
    const ctx = dom.canvas.getContext('2d');
    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Adj Close',
          data: data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.15)',
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: '#9ca3af', maxRotation: 0, autoSkip: true },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        },
        plugins: {
          legend: { labels: { color: '#e5e7eb' } },
          tooltip: { mode: 'index', intersect: false }
        }
      }
    });
  }

  function appendPointToChart(dateStr, price) {
    const c = state.chart;
    c.data.labels.push(dateStr);
    c.data.datasets[0].data.push(price);
    c.update('none');
  }

  /**
   * UI helpers
   */
  function setStatus(msg, type = 'info') {
    dom.status.textContent = msg;
    dom.status.style.color = type === 'error' ? '#ef4444' : (type === 'warn' ? '#f59e0b' : '#9ca3af');
  }

  function setControlsEnabled(enabled) {
    dom.guessUp.disabled = !enabled;
    dom.guessDown.disabled = !enabled;
    dom.restart.disabled = !state.running;
  }

  function resetGameState() {
    state.score = 0;
    dom.score.textContent = '0';
    state.startIndex = null;
    state.curIndex = null;
    state.running = false;
    setControlsEnabled(false);
  }

  function updateDateDisplays(startDateStr, currentDateStr) {
    dom.startingDate.textContent = startDateStr ?? '—';
    dom.currentDate.textContent = currentDateStr ?? '—';
  }

  /**
   * Game flow
   */
  async function loadTicker(tickerInput) {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) {
      setStatus('Please enter a ticker symbol.', 'warn');
      return;
    }
    setStatus('Loading data…');
    dom.loadBtn.disabled = true;
    resetGameState();
    try {
      const { meta, entries } = await fetchDailySeries(ticker);
      if (!entries || entries.length < 60) {
        throw new Error('Insufficient data for this symbol. Try another.');
      }

      // persist
      state.ticker = ticker;
      state.meta = meta;
      state.dailyDataAsc = entries;
      dom.currentTicker.textContent = ticker;

      // choose start
      const startIdx = pickRandomStartIndexWithinWindow(entries);
      state.startIndex = startIdx;
      state.curIndex = startIdx; // current max revealed index

      const initialPoints = buildSevenDaysBefore(entries, startIdx);
      const labels = initialPoints.map(p => p.date);
      const values = initialPoints.map(p => p.close);
      initChart(labels, values);
      updateDateDisplays(entries[startIdx].date, entries[startIdx].date);

      // enable game
      state.running = true;
      setControlsEnabled(true);
      dom.restart.disabled = false;
      setStatus('Make your prediction: Up or Down.');
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Failed to load data.', 'error');
      dom.currentTicker.textContent = '—';
      updateDateDisplays(null, null);
    } finally {
      dom.loadBtn.disabled = false;
    }
  }

  function stepRevealNextAndScore(guessDirection) {
    if (!state.running) return;
    const nextIndex = state.curIndex + 1;
    if (nextIndex >= state.dailyDataAsc.length) {
      setStatus('No more data to reveal for this symbol.', 'warn');
      setControlsEnabled(false);
      return;
    }
    const prev = state.dailyDataAsc[state.curIndex];
    const next = state.dailyDataAsc[nextIndex];

    const wentUp = next.close > prev.close;
    const correct = (guessDirection === 'up' && wentUp) || (guessDirection === 'down' && !wentUp);
    if (correct) {
      state.score += 1;
      dom.score.textContent = String(state.score);
      setStatus(`Correct! ${next.date}: ${next.close.toFixed(2)} (${wentUp ? 'Up' : 'Down'})`);
    } else {
      setStatus(`Wrong. ${next.date}: ${next.close.toFixed(2)} (${wentUp ? 'Up' : 'Down'})`, 'warn');
    }

    // reveal and advance
    appendPointToChart(next.date, next.close);
    state.curIndex = nextIndex;
    updateDateDisplays(state.dailyDataAsc[state.startIndex].date, next.date);
  }

  function endGame() {
    if (!state.running) return;
    state.running = false;
    setControlsEnabled(false);
    setStatus(`Game ended. Final score: ${state.score}`);
  }

  /**
   * Events
   */
  dom.form.addEventListener('submit', (e) => {
    e.preventDefault();
    loadTicker(dom.tickerInput.value);
  });

  dom.guessUp.addEventListener('click', () => {
    stepRevealNextAndScore('up');
  });
  dom.guessDown.addEventListener('click', () => {
    stepRevealNextAndScore('down');
  });
  dom.restart.addEventListener('click', () => {
    endGame();
  });
})();

