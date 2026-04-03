'use strict';

// ─── State ────────────────────────────────────────────────────
const S = {
    symbol: null,
    price: 0,
    quote: null,
    balance: 6500,
    portfolio: [],
    realisedPL: 0,
    totalTrades: 0,
    tradeLog: [],
    rewardClaimed: false,
    pollTimer: null,
    chart: null,
    chartLabels: [],
    chartPrices: [],
    sugTimer: null,
    timeframe: '1D',
};

// ─── Helpers ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = (n, cur) => {
    const sym = (cur === 'INR' || cur === 'Rs') ? '₹' : '$';
    return sym + parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtN = n => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = n => n >= 0 ? '+' : '';
const clr = n => n >= 0 ? 'var(--up)' : 'var(--down)';
const totalHoldings = () => S.portfolio.reduce((s, h) => s + h.qty, 0);
const curSymbol = () => (S.quote?.currency === 'INR') ? '₹' : '$';

let toastTimer = null;
function toast(msg, type = 's', dur = 3500) {
    if (toastTimer) clearTimeout(toastTimer);
    $('toastMsg').textContent = msg;
    $('toast').className = `show ${type}`;
    toastTimer = setTimeout(() => $('toast').className = '', dur);
}

// ─── Trade tab switching ──────────────────────────────────────
function switchTradeTab(tab) {
    ['buy', 'sell', 'log'].forEach(t => {
        $(`pane-${t}`).classList.remove('active');
        const el = $(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (el) el.classList.remove('active');
    });
    $(`pane-${tab}`).classList.add('active');
    const btn = $(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (btn) btn.classList.add('active');
}

// ─── Timeframe ────────────────────────────────────────────────
async function setTimeframe(tf, btn) {
    S.timeframe = tf;
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (S.symbol) {
        $('stockLoading').style.display = 'block';
        await loadChartHistory(S.symbol, tf);
        if (S.price) pushChart(S.price);
        $('stockLoading').style.display = 'none';
    }
    toast(`Timeframe: ${tf}`, 's', 1200);
}

function clearChart() {
    S.chartLabels = []; S.chartPrices = [];
    S.chart.data.labels = S.chartLabels;
    S.chart.data.datasets[0].data = S.chartPrices;
    S.chart.update('none');
    $('chartH').textContent = 'H: —'; $('chartL').textContent = 'L: —';
    $('chartXStart').textContent = '—'; $('chartXEnd').textContent = '—';
}

async function loadChartHistory(sym, tf) {
    clearChart();
    try {
        const cRes = await fetch(`/api/chart/${encodeURIComponent(sym)}?tf=${tf}`);
        const cData = await cRes.json();
        if (cData.success && cData.quotes) {
            cData.quotes.forEach(q => {
                if (q.close) {
                    const dt = new Date(q.date);
                    let label;
                    if (tf === '1D') label = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    else if (tf === '1W') label = dt.toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
                    else if (tf === '1M' || tf === '3M') label = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    else label = dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

                    S.chartLabels.push(label);
                    S.chartPrices.push(q.close);
                }
            });
        }
    } catch (e) { console.log("Chart history fetch failed", e); }
}


// ─── Chart Init (Groww style, tight Y-axis, crosshair) ────────
function initChart() {
    const ctx = $('priceChart').getContext('2d');

    const refLinePlugin = {
        id: 'refLine',
        afterDraw(chart) {
            if (!S.chartPrices.length) return;
            const avg = S.chartPrices.reduce((a, b) => a + b, 0) / S.chartPrices.length;
            const y = chart.scales.y.getPixelForValue(avg);
            const c = chart.ctx;
            c.save();
            c.setLineDash([4.5, 2.5]);
            c.strokeStyle = 'rgba(180,195,220,0.2)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(chart.scales.x.left, y);
            c.lineTo(chart.scales.x.right, y);
            c.stroke();
            c.restore();
        }
    };

    let blinkPhase = 0;
    const blinkPlugin = {
        id: 'blinkDot',
        afterDraw(chart) {
            const meta = chart.getDatasetMeta(0);
            if (!meta.data.length) return;
            const last = meta.data[meta.data.length - 1];
            const isUp = S.chartPrices.length >= 2 &&
                S.chartPrices[S.chartPrices.length - 1] >= S.chartPrices[0];
            const color = isUp ? '#0ecb81' : '#f6465d';
            blinkPhase += 0.045;
            const alpha = 0.3 + 0.7 * Math.abs(Math.sin(blinkPhase));
            const c = chart.ctx;
            c.save();
            c.beginPath(); c.arc(last.x, last.y, 8, 0, Math.PI * 2);
            c.fillStyle = color + '28'; c.fill();
            c.beginPath(); c.arc(last.x, last.y, 4, 0, Math.PI * 2);
            c.fillStyle = color; c.globalAlpha = alpha; c.fill();
            c.strokeStyle = '#0a0e17'; c.lineWidth = 1.5; c.globalAlpha = 1; c.stroke();
            c.restore();
        }
    };

    let crosshairX = null;
    const crosshairPlugin = {
        id: 'crosshair',
        afterDraw(chart) {
            if (crosshairX === null) return;
            const c = chart.ctx;
            const yTop = chart.scales.y.top;
            const yBot = chart.scales.y.bottom;
            c.save();
            c.setLineDash([4, 3]);
            c.strokeStyle = 'rgba(200,210,230,0.3)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(crosshairX, yTop);
            c.lineTo(crosshairX, yBot);
            c.stroke();
            c.restore();
        }
    };

    S.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: S.chartLabels,
            datasets: [{
                data: S.chartPrices,
                borderColor: '#0ecb81',
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 18,
                fill: true,
                backgroundColor: (context) => {
                    const canvas = context.chart.canvas;
                    const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, canvas.height);
                    const isUp = S.chartPrices.length >= 2 &&
                        S.chartPrices[S.chartPrices.length - 1] >= S.chartPrices[0];
                    const color = isUp ? '#0ecb81' : '#f6465d';
                    gradient.addColorStop(0, color + '55');
                    gradient.addColorStop(0.55, color + '12');
                    gradient.addColorStop(1, color + '00');
                    return gradient;
                },
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
            },
            interaction: { mode: 'index', intersect: false },
            onHover: (event, elements, chart) => {
                const tooltip = $('chartTooltip');

                if (!elements.length || !S.chartPrices.length) {
                    tooltip.style.display = 'none';
                    crosshairX = null;
                    chart.draw();
                    return;
                }

                const idx = elements[0].index;
                const meta = chart.getDatasetMeta(0);
                const pt = meta.data[idx];

                crosshairX = pt.x;
                chart.draw();

                const cw = chart.canvas.offsetWidth;
                const ch = chart.canvas.offsetHeight;
                const px = pt.x;
                const py = chart.scales.y.getPixelForValue(S.chartPrices[idx]);

                const ttLeft = px > cw * 0.65 ? px - 148 : px + 16;
                const ttTop = Math.max(4, Math.min(py - 44, ch - 90));

                tooltip.style.left = ttLeft + 'px';
                tooltip.style.top = ttTop + 'px';
                tooltip.style.display = 'block';

                const cur = S.quote?.currency || 'USD';
                const p = S.chartPrices[idx];
                const ref = S.chartPrices[0] || p;
                const delta = p - ref;
                const deltaPct = ref > 0 ? (delta / ref * 100) : 0;

                $('ttTime').textContent = S.chartLabels[idx] || '—';
                $('ttPrice').textContent = (cur === 'INR' ? '₹' : '$') + fmtN(p);
                $('ttPrice').style.color = clr(delta);

                const ttChg = $('ttChange');
                ttChg.textContent = `${sign(delta)}${fmtN(Math.abs(delta))} (${sign(deltaPct)}${Math.abs(deltaPct).toFixed(2)}%)`;
                ttChg.style.color = clr(delta);
            },
            scales: {
                x: { display: false },
                y: {
                    position: 'right',
                    grid: { display: false },
                    border: { display: false },
                    beginAtZero: false,
                    ticks: {
                        color: '#4b6280',
                        font: { family: 'DM Mono, monospace', size: 10 },
                        maxTicksLimit: 4,
                        callback: v => {
                            const cur = S.quote?.currency;
                            return (cur === 'INR' ? '₹' : '$') + Math.round(v).toLocaleString('en-IN');
                        },
                    },
                },
            },
        },
        plugins: [refLinePlugin, blinkPlugin, crosshairPlugin],
    });

    setInterval(() => {
        if (S.chartPrices.length) S.chart.draw();
    }, 500);

    $('chartWrap').addEventListener('mouseleave', () => {
        $('chartTooltip').style.display = 'none';
        crosshairX = null;
        S.chart.draw();
    });
}

// ─── UPDATED PUSH CHART (Smart Fluctuation) ───
function pushChart(price) {
    const MAX = 1500;
    const now = new Date();
    let label;

    if (S.timeframe === '1D') {
        label = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        if (S.chartLabels.length > 0 && S.chartLabels[S.chartLabels.length - 1] === label) {
            S.chartPrices[S.chartPrices.length - 1] = price;
        } else {
            S.chartLabels.push(label);
            S.chartPrices.push(price);
        }
    } else {
        if (S.chartPrices.length > 0) S.chartPrices[S.chartPrices.length - 1] = price;
    }

    if (S.chartLabels.length > MAX) { S.chartLabels.shift(); S.chartPrices.shift(); }
    if (!S.chartPrices.length) return;

    const isUp = S.chartPrices[S.chartPrices.length - 1] >= S.chartPrices[0];
    S.chart.data.datasets[0].borderColor = isUp ? '#0ecb81' : '#f6465d';

    const lo = Math.min(...S.chartPrices);
    const hi = Math.max(...S.chartPrices);
    S.chart.options.scales.y.min = lo * 0.999;
    S.chart.options.scales.y.max = hi * 1.001;

    S.chart.update('none');

    const isIndian = S.quote?.exchange?.includes('NSE') || S.quote?.exchange?.includes('BSE');
    $('chartH').textContent = 'H: ' + (isIndian ? '₹' : '$') + hi.toFixed(2);
    $('chartL').textContent = 'L: ' + (isIndian ? '₹' : '$') + lo.toFixed(2);
    $('chartXStart').textContent = S.chartLabels[0] || '—';
    $('chartXEnd').textContent = S.chartLabels[S.chartLabels.length - 1] || '—';

    $('chartLivePrice').textContent = price ? `${isIndian ? '₹' : '$'}${fmtN(price)}` : '';
    $('chartLivePrice').style.color = isUp ? 'var(--up)' : 'var(--down)';
}

// ─── Autocomplete ─────────────────────────────────────────────
$('symbolInput').addEventListener('input', () => {
    clearTimeout(S.sugTimer);
    const v = $('symbolInput').value.trim();
    if (!v) { hideSug(); return; }
    S.sugTimer = setTimeout(() => fetchSug(v), 320);
});
$('symbolInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { hideSug(); searchStock(); }
    if (e.key === 'Escape') hideSug();
});
document.addEventListener('click', e => {
    if (!$('searchWrap').contains(e.target)) hideSug();
});
function hideSug() { $('suggestions').style.display = 'none'; }

async function fetchSug(q) {
    try {
        const r = await fetch(`/api/search/${encodeURIComponent(q)}`);
        const d = await r.json();
        if (!d.results?.length) { hideSug(); return; }
        $('suggestions').innerHTML = d.results.map(r => `
      <div class="sug-item" onclick="pickSug('${r.symbol}')">
        <span class="sug-sym">${r.symbol}</span>
        <span class="sug-name">${r.description.replace(/\([^)]*\)\s*$/, '').trim()}</span>
        <span class="sug-exch">${r.exchange || ''}</span>
      </div>`).join('');
        $('suggestions').style.display = 'block';
    } catch { hideSug(); }
}

function pickSug(sym) { $('symbolInput').value = sym; hideSug(); searchStock(); }

// ─── Search ───────────────────────────────────────────────────
function quickSearch(sym) { $('symbolInput').value = sym; searchStock(); }

async function searchStock() {
    const sym = $('symbolInput').value.trim().toUpperCase();
    if (!sym) { toast('Enter a symbol', 'w'); return; }
    hideSug();

    $('stockEmpty').style.display = 'none';
    $('stockLoaded').style.display = 'none';
    $('stockLoading').style.display = 'block';

    try {
        const r = await fetch(`/api/quote/${encodeURIComponent(sym)}`);
        const d = await r.json();

        if (!d.success) {
            $('stockLoading').style.display = 'none';
            $('stockEmpty').style.display = 'block';
            toast(d.message, 'e'); return;
        }

        S.symbol = sym; S.price = d.quote.price; S.quote = d.quote;
        renderStockCard(d.quote);
        updateTradePanel();

        await loadChartHistory(sym, S.timeframe);
        pushChart(d.quote.price);

        $('stockLoading').style.display = 'none';
        clearInterval(S.pollTimer);
        S.pollTimer = setInterval(pollQuote, 8000);

        toast(`${d.quote.displaySymbol || sym} loaded`, 's');
    } catch {
        $('stockLoading').style.display = 'none';
        $('stockEmpty').style.display = 'block';
        toast('Network error.', 'e');
    }
}

// ─── UPDATED POLL QUOTE ───
async function pollQuote() {
    if (!S.symbol) return;
    try {
        const r = await fetch(`/api/quote/${encodeURIComponent(S.symbol)}`);
        const d = await r.json();
        if (!d.success) return;
        S.price = d.quote.price; S.quote = d.quote;
        renderStockCard(d.quote);
        pushChart(d.quote.price);
        updateTradePanel();
        updateRewardButton();
    } catch { }
}

function renderStockCard(q) {
    $('stockLoaded').style.display = 'block';
    $('stockEmpty').style.display = 'none';
    const isUp = q.change >= 0;
    const cur = q.currency || 'USD';
    const csym = cur === 'INR' ? '₹' : '$';

    $('stockSymbol').textContent = q.displaySymbol || q.symbol;
    $('stockName').textContent = q.name || '';
    $('stockExchange').textContent = q.exchange || '';
    $('stockExchange').style.display = q.exchange ? 'inline' : 'none';
    $('stockCurrency').textContent = cur;
    $('stockUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();
    $('stockOpen').textContent = q.open ? csym + fmtN(q.open) : '—';
    $('stockHigh').textContent = q.high ? csym + fmtN(q.high) : '—';
    $('stockLow').textContent = q.low ? csym + fmtN(q.low) : '—';
    $('stockPrev').textContent = q.previousClose ? csym + fmtN(q.previousClose) : '—';
    $('chartSymLabel').textContent = q.displaySymbol || q.symbol;

    const pEl = $('stockPrice');
    pEl.textContent = csym + fmtN(q.price);
    pEl.style.color = isUp ? 'var(--up)' : 'var(--down)';

    const pill = $('stockChangePill');
    const changeStr = Math.abs(q.change).toFixed(2);
    const pctStr = Math.abs(q.changePct).toFixed(2);
    pill.textContent = `${isUp ? '▲' : '▼'} ${csym}${changeStr} (${pctStr}%)`;
    pill.className = `pill ${isUp ? 'pill-up' : 'pill-down'}`;

    const card = $('stockCard');
    card.classList.remove('flash-up', 'flash-down');
    void card.offsetWidth;
    card.classList.add(isUp ? 'flash-up' : 'flash-down');
}

// ─── Trade panel ──────────────────────────────────────────────
function updateTradePanel() {
    if (!S.symbol) return;
    const csym = curSymbol();
    $('tradeSymLabel').innerHTML =
        `<strong>${S.quote?.displaySymbol || S.symbol}</strong> <span style="color:var(--muted);font-size:.8rem;font-weight:400;">@ ${csym}${fmtN(S.price)}</span>`;
    const h = S.portfolio.find(p => p.symbol === S.symbol);
    $('tradeHolding').textContent = h ? `${h.qty} shares` : '0 shares';
    updatePreviews();
}

function setQ(id, v) { $(id).value = v; updatePreviews(); }
function sellAllShares() {
    const h = S.portfolio.find(p => p.symbol === S.symbol);
    $('sellQty').value = h ? h.qty : 0; updatePreviews();
}

$('buyQty').addEventListener('input', updatePreviews);
$('sellQty').addEventListener('input', updatePreviews);

function updatePreviews() {
    const bq = parseInt($('buyQty').value) || 0;
    const sq = parseInt($('sellQty').value) || 0;
    const cost = bq * S.price;
    const csym = curSymbol();

    $('buyCost').textContent = csym + fmtN(cost);
    $('buyCost').style.color = cost > S.balance ? 'var(--down)' : 'var(--up)';
    $('balAfterBuy').textContent = cost > 0 ? '$' + fmtN(S.balance - cost) : '—';
    $('balAfterBuy').style.color = (S.balance - cost) < 0 ? 'var(--down)' : 'var(--text)';
    $('sellProceeds').textContent = csym + fmtN(sq * S.price);
}

// ─── Buy ──────────────────────────────────────────────────────
async function doBuy() {
    if (!S.symbol) { toast('Search a stock first!', 'w'); return; }
    const qty = parseInt($('buyQty').value);
    if (!qty || qty < 1) { toast('Enter a valid quantity.', 'w'); return; }
    try {
        const r = await fetch('/api/buy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: S.symbol, qty }),
        });
        const d = await r.json();
        if (d.success) {
            S.balance = d.player.balance; S.totalTrades = d.player.totalTrades;
            syncPortfolio(d.player.portfolio);
            addLog('BUY', S.quote?.displaySymbol || S.symbol, qty, S.price, qty * S.price, null);
            $('buyQty').value = '';
            renderWallet(); updateTradePanel(); renderStats(); updateRewardButton();
            toast(d.message, 's');
        } else { toast(d.message, 'e'); }
    } catch { toast('Network error.', 'e'); }
}

// ─── Sell ─────────────────────────────────────────────────────
async function doSell() {
    if (!S.symbol) { toast('Search a stock first!', 'w'); return; }
    const qty = parseInt($('sellQty').value);
    if (!qty || qty < 1) { toast('Enter a valid quantity.', 'w'); return; }
    try {
        const r = await fetch('/api/sell', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: S.symbol, qty }),
        });
        const d = await r.json();
        if (d.success) {
            S.balance = d.player.balance; S.realisedPL = d.player.realisedPL;
            S.totalTrades = d.player.totalTrades;
            syncPortfolio(d.player.portfolio);
            addLog('SELL', S.quote?.displaySymbol || S.symbol, qty, S.price, d.trade.total, d.trade.tradePL);
            $('sellQty').value = '';
            renderWallet(); updateTradePanel(); renderStats(); updateRewardButton();
            toast(d.message, d.trade.tradePL >= 0 ? 's' : 'w');
        } else { toast(d.message, 'e'); }
    } catch { toast('Network error.', 'e'); }
}

// ─── Portfolio ────────────────────────────────────────────────
function syncPortfolio(raw) {
    S.portfolio = raw.map(r => {
        const ex = S.portfolio.find(p => p.symbol === r.symbol);
        return {
            symbol: r.symbol,
            displaySymbol: r.displaySymbol || r.symbol,
            currency: r.currency || 'USD',
            qty: r.qty,
            avgBuyPrice: r.avgBuyPrice,
            livePrice: ex?.livePrice || r.avgBuyPrice,
            unrealisedPL: ex?.unrealisedPL || 0,
            plPct: ex?.plPct || 0,
            changePct: ex?.changePct || 0,
        };
    });
    renderPortfolio();
}

async function refreshPortfolio() {
    try {
        const r = await fetch('/api/portfolio');
        const d = await r.json();
        if (!d.success) return;
        S.portfolio = d.portfolio;
        S.balance = d.summary.balance;
        S.realisedPL = d.summary.realisedPL;
        S.totalTrades = d.summary.totalTrades;
        renderPortfolio(d.summary);
        renderWallet(); renderStats(); updateTradePanel(); updateRewardButton();
    } catch { toast('Could not refresh.', 'e'); }
}

function renderPortfolio(summary) {
    const list = $('portfolioList');
    if (!S.portfolio.length) {
        list.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:.82rem;padding:22px 0;">No holdings. Start trading!</div>`;
        $('portSummaryRow').style.display = 'none';
        return;
    }
    list.innerHTML = S.portfolio.map(h => {
        const sel = h.symbol === S.symbol ? 'selected' : '';
        const upl = h.unrealisedPL || 0;
        const plp = h.plPct || 0;
        const csym = h.currency === 'INR' ? '₹' : '$';
        return `<div class="port-row ${sel}" onclick="quickSearch('${h.symbol}')">
      <div>
        <div style="font-family:'DM Mono',monospace;font-weight:500;font-size:.86rem;color:var(--accent2);">${h.displaySymbol || h.symbol}</div>
        <div style="font-size:.66rem;color:var(--muted);">${h.qty} shares</div>
      </div>
      <div>
        <div style="font-size:.77rem;font-family:'DM Mono',monospace;">${csym}${fmtN(h.avgBuyPrice || 0)}</div>
        <div style="font-size:.65rem;color:var(--muted);">avg cost</div>
      </div>
      <div>
        <div style="font-size:.77rem;font-family:'DM Mono',monospace;">${csym}${fmtN(h.livePrice || h.avgBuyPrice)}</div>
        <div style="font-size:.65rem;color:${h.changePct >= 0 ? 'var(--up)' : 'var(--down)'};">${h.changePct >= 0 ? '▲' : '▼'}${Math.abs(h.changePct || 0).toFixed(2)}%</div>
      </div>
      <div>
        <div style="font-size:.77rem;font-family:'DM Mono',monospace;color:${clr(upl)};">${sign(upl)}${csym}${fmtN(Math.abs(upl))}</div>
        <div style="font-size:.65rem;color:${clr(plp)};">${sign(plp)}${plp.toFixed(2)}%</div>
      </div>
    </div>`;
    }).join('');

    if (summary) {
        $('portSummaryRow').style.display = 'block';
        $('portValue').textContent = '$' + fmtN(summary.totalMarketValue);
        $('portUPL').textContent = `${sign(summary.totalUnrealisedPL)}$${fmtN(Math.abs(summary.totalUnrealisedPL))}`;
        $('portUPL').style.color = clr(summary.totalUnrealisedPL);
    }
}

// ─── Wallet ───────────────────────────────────────────────────
function renderWallet() {
    $('walletBal').textContent = '$' + fmtN(S.balance);
    $('hdrBalance').textContent = '$' + fmtN(S.balance);
    updateRewardButton();
}

function updateRewardButton() {
    const btn = $('rewardBtn');
    const note = $('rewardNote');
    const bal = S.balance;
    const holdings = totalHoldings();

    if (S.rewardClaimed) {
        btn.disabled = true;
        btn.textContent = '✅ Claimed';
        btn.style.background = '#1e2d45'; btn.style.color = 'var(--muted)';
        note.textContent = 'Rescue funds already claimed this session.';
        note.style.color = 'var(--muted)';
        return;
    }

    btn.style.background = ''; btn.style.color = '';

    if (bal >= 100 && holdings > 0) {
        btn.disabled = true;
        note.textContent = 'Balance must be below $100 and you must hold zero stocks.';
        note.style.color = 'var(--muted)';
    } else if (bal >= 100) {
        btn.disabled = true;
        note.textContent = 'Balance must be below $100 to claim.';
        note.style.color = 'var(--muted)';
    } else if (holdings > 0) {
        btn.disabled = true;
        note.textContent = 'Sell all active stocks to claim rescue funds.';
        note.style.color = 'var(--warn)';
    } else {
        btn.disabled = false;
        btn.textContent = '🎯 CLAIM RESCUE FUNDS';
        note.textContent = '✅ Eligible! Balance < $100 and no holdings.';
        note.style.color = 'var(--up)';
    }
}

async function claimReward() {
    const btn = $('rewardBtn');
    btn.disabled = true; btn.textContent = '⏳ Processing…';
    try {
        const r = await fetch('/api/reward', { method: 'POST' });
        const d = await r.json();
        if (d.success) {
            S.balance = d.player.balance; S.rewardClaimed = true;
            renderWallet(); renderStats(); updateRewardButton();
            toast(d.message, 's', 4500);
        } else {
            btn.disabled = false; btn.textContent = '🎯 CLAIM RESCUE FUNDS';
            $('rewardNote').textContent = d.message;
            $('rewardNote').style.color = 'var(--warn)';
            toast(d.message, 'w');
        }
    } catch {
        btn.disabled = false; btn.textContent = '🎯 CLAIM RESCUE FUNDS';
        toast('Network error.', 'e');
    }
}

// ─── Stats ────────────────────────────────────────────────────
function renderStats() {
    $('tradeCount').textContent = S.totalTrades;
    const plEl = $('realisedPLLabel');
    plEl.textContent = `${sign(S.realisedPL)}$${fmtN(Math.abs(S.realisedPL))}`;
    plEl.style.color = clr(S.realisedPL);

    $('walletTrades').textContent = S.totalTrades;
    const wplEl = $('walletPL');
    wplEl.textContent = `${sign(S.realisedPL)}$${fmtN(Math.abs(S.realisedPL))}`;
    wplEl.style.color = clr(S.realisedPL);

    const portVal = S.portfolio.reduce((a, h) => a + (h.livePrice || h.avgBuyPrice) * h.qty, 0);
    const portUPL = S.portfolio.reduce((a, h) => a + (h.unrealisedPL || 0), 0);
    const net = S.balance + portVal;

    $('netWorthDisplay').textContent = '$' + fmtN(net);
    $('nwCash').textContent = '$' + fmtN(S.balance);
    $('nwPortfolio').textContent = '$' + fmtN(portVal);
    const uplEl = $('nwUPL');
    uplEl.textContent = `${sign(portUPL)}$${fmtN(Math.abs(portUPL))}`;
    uplEl.style.color = clr(portUPL);
}

// ─── Trade log ────────────────────────────────────────────────
function addLog(action, sym, qty, price, total, pl) {
    S.tradeLog.unshift({ action, sym, qty, price, total, pl, t: new Date().toLocaleTimeString() });
    renderLog();
}
function renderLog() {
    const el = $('tradeLog');
    if (!S.tradeLog.length) {
        el.innerHTML = `<div style="color:var(--muted);font-size:.82rem;text-align:center;padding:24px 0;">No trades yet.</div>`;
        return;
    }
    el.innerHTML = S.tradeLog.slice(0, 30).map(l => {
        const plStr = l.pl !== null
            ? `<span style="color:${clr(l.pl)};font-size:.71rem;">${sign(l.pl)}$${fmtN(Math.abs(l.pl))}</span>` : '';
        return `<div class="tlog-row ${l.action}">
      <span style="color:${l.action === 'BUY' ? 'var(--up)' : 'var(--down)'};font-weight:600;min-width:34px;">${l.action}</span>
      <span style="color:var(--accent2);min-width:60px;font-size:.73rem;">${l.sym}</span>
      <span>${l.qty}×${fmtN(l.price)}</span>
      <span>${fmtN(l.total)}</span>
      ${plStr}
      <span style="color:var(--muted);font-size:.67rem;">${l.t}</span>
    </div>`;
    }).join('');
}

// ─── Leaderboard ─────────────────────────────────────────────
async function loadLB() {
    try {
        const r = await fetch('/api/leaderboard');
        const d = await r.json();
        if (!d.success) return;
        const icons = ['🥇', '🥈', '🥉', '4.', '5.', '6.'];
        $('lbList').innerHTML = d.leaderboard.map((p, i) => `
      <div class="lb-row ${p.isYou ? 'you' : ''}">
        <span style="font-size:.95rem;text-align:center;">${icons[i] || p.rank + '.'}</span>
        <span style="font-family:'Syne',sans-serif;font-size:.81rem;${p.isYou ? 'color:var(--up);font-weight:700;' : ''}">${p.username}</span>
        <span style="font-size:.66rem;color:var(--muted);font-family:'DM Mono',monospace;">${p.badge}</span>
        <span class="num" style="font-size:.79rem;${p.isYou ? 'color:var(--up);' : ''}">${'$' + fmtN(p.netWorth)}</span>
      </div>`).join('');
    } catch { }
}

// ─── Reset ────────────────────────────────────────────────────
async function resetGame() {
    if (!confirm('Reset? Balance returns to $6,500.')) return;
    try {
        const r = await fetch('/api/reset', { method: 'POST' });
        const d = await r.json();
        if (d.success) {
            clearInterval(S.pollTimer);
            Object.assign(S, {
                symbol: null, price: 0, quote: null, balance: 6500,
                portfolio: [], realisedPL: 0, totalTrades: 0,
                tradeLog: [], rewardClaimed: false,
                chartLabels: [], chartPrices: [],
            });
            S.chart.options.scales.y.min = undefined;
            S.chart.options.scales.y.max = undefined;
            S.chart.data.labels = S.chartLabels;
            S.chart.data.datasets[0].data = S.chartPrices;
            S.chart.update();

            $('stockLoaded').style.display = 'none';
            $('stockLoading').style.display = 'none';
            $('stockEmpty').style.display = 'flex';
            $('chartSymLabel').textContent = '— Search a stock';
            $('chartLivePrice').textContent = '';
            $('chartH').textContent = 'H: —'; $('chartL').textContent = 'L: —';
            $('symbolInput').value = '';
            $('tradeSymLabel').innerHTML = '<span style="color:var(--muted);font-weight:400;font-size:.82rem;">Search a stock first</span>';
            $('tradeHolding').textContent = '0 shares';

            const rb = $('rewardBtn');
            rb.disabled = false; rb.textContent = '🎯 CLAIM RESCUE FUNDS';
            rb.style.background = ''; rb.style.color = '';

            renderWallet(); renderPortfolio(); renderLog(); renderStats(); loadLB(); updateRewardButton();
            toast(d.message, 's');
        }
    } catch { toast('Reset failed.', 'e'); }
}

// ─── Boot ─────────────────────────────────────────────────────
function boot() {
    initChart();
    renderWallet();
    renderPortfolio();
    renderLog();
    renderStats();
    updateRewardButton();
    loadLB();
    setInterval(loadLB, 15000);
    setInterval(refreshPortfolio, 20000);
}

document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();