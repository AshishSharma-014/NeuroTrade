/**
 * ============================================================
 *  StockQuest — today.js  (Yahoo Finance Edition)
 *  Market Overview Page Logic
 *
 *  Data source: /api/market-overview  →  Yahoo Finance 2
 *  No fake random ticks — all prices are real (15-min delayed)
 *  Auto-refreshes every 60 seconds
 * ============================================================
 */

'use strict';

// ─── Sparkline registry ───────────────────────────────────────
const sparklineCharts = {};

// ─── DOM helper ───────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Number formatters ────────────────────────────────────────
function fmtPrice(n, currency) {
    const sym = (currency === 'INR' || !currency) ? '₹' : '$';
    return sym + parseFloat(n).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function fmtVol(n) {
    if (!n || n === 0) return '—';
    if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return (n / 1e5).toFixed(2) + ' L';
    return n.toLocaleString('en-IN');
}

function fmtNum(n, dp = 2) {
    return parseFloat(n).toFixed(dp);
}

// ─── Market status (IST 9:15 AM – 3:30 PM, Mon–Fri) ──────────
function getMarketStatus() {
    const now = new Date();
    const day = now.getDay();
    // Convert local time to IST offset (UTC+5:30)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 3600000);
    const h = ist.getHours();
    const m = ist.getMinutes();
    const total = h * 60 + m;
    if (day === 0 || day === 6) return 'closed';
    if (total >= 9 * 60 + 15 && total < 15 * 60 + 30) return 'open';
    if (total >= 9 * 60 && total < 9 * 60 + 15) return 'pre';
    return 'closed';
}

// ─── Flash animation helper ───────────────────────────────────
function flash(el, type) {
    if (!el) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(type === 'up' ? 'flash-up' : 'flash-down');
}

// ═══════════════════════════════════════════════════════════════
//  STATIC MOCK DATA  (sectors, F&O, news — not from Yahoo)
// ═══════════════════════════════════════════════════════════════

const SECTORS = [
    { name: 'IT', change: 0 },
    { name: 'Banking', change: 0 },
    { name: 'Auto', change: 0 },
    { name: 'Pharma', change: 0 },
    { name: 'Energy', change: 0 },
    { name: 'FMCG', change: 0 },
    { name: 'Metal', change: 0 },
    { name: 'Realty', change: 0 },
    { name: 'Infra', change: 0 },
    { name: 'Telecom', change: 0 },
];

// Map stock symbols to their sector for heatmap colouring
const STOCK_SECTOR_MAP = {
    'TCS.NS': 'IT', 'INFY.NS': 'IT', 'WIPRO.NS': 'IT', 'HCLTECH.NS': 'IT',
    'HDFCBANK.NS': 'Banking', 'ICICIBANK.NS': 'Banking', 'SBIN.NS': 'Banking',
    'KOTAKBANK.NS': 'Banking', 'AXISBANK.NS': 'Banking',
    'MARUTI.NS': 'Auto', 'TATAMOTORS.NS': 'Auto',
    'SUNPHARMA.NS': 'Pharma', 'DRREDDY.NS': 'Pharma', 'CIPLA.NS': 'Pharma',
    'RELIANCE.NS': 'Energy', 'ONGC.NS': 'Energy', 'NTPC.NS': 'Energy', 'POWERGRID.NS': 'Energy',
    'HINDUNILVR.NS': 'FMCG', 'ITC.NS': 'FMCG', 'NESTLEIND.NS': 'FMCG',
    'TATASTEEL.NS': 'Metal', 'JSWSTEEL.NS': 'Metal', 'COALINDIA.NS': 'Metal',
    'ADANIENT.NS': 'Infra', 'LT.NS': 'Infra',
    'BHARTIARTL.NS': 'Telecom',
    'ASIANPAINT.NS': 'Realty', 'TITAN.NS': 'Realty', 'BAJFINANCE.NS': 'Realty',
};

const FO_DATA = [
    { label: 'PCR (NIFTY)', value: '—', note: 'Put-Call Ratio', pos: null },
    { label: 'India VIX', value: '—', note: 'Implied Volatility', pos: null },
    { label: 'IV (ATM)', value: '—', note: 'At-the-Money IV', pos: null },
    { label: 'Max Pain', value: '—', note: 'Strike Level', pos: null },
    { label: 'OI Change', value: '—', note: 'Open Interest', pos: null },
    { label: 'FII/DII Net', value: '—', note: 'Institutional Flow', pos: null },
];



// ═══════════════════════════════════════════════════════════════
//  LOADING STATE
// ═══════════════════════════════════════════════════════════════

function showLoadingState() {
    const skeletonCard = (w1 = '60%', w2 = '40%') => `
    <div class="card" style="padding:18px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div>
          <div class="skeleton" style="height:12px;width:80px;margin-bottom:8px;"></div>
          <div class="skeleton" style="height:18px;width:${w1};"></div>
        </div>
        <div class="skeleton" style="height:22px;width:60px;border-radius:99px;"></div>
      </div>
      <div class="skeleton" style="height:32px;width:${w2};margin-bottom:8px;"></div>
      <div class="skeleton" style="height:44px;width:100%;margin-bottom:12px;border-radius:6px;"></div>
      <div class="skeleton" style="height:4px;width:100%;border-radius:99px;"></div>
    </div>`;

    const idxGrid = $('indicesGrid');
    if (idxGrid) idxGrid.innerHTML = [1, 2, 3, 4].map(() => skeletonCard('70%', '55%')).join('');

    const skeletonRow = () => `
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);">
      <div>
        <div class="skeleton" style="height:13px;width:80px;margin-bottom:5px;"></div>
        <div class="skeleton" style="height:11px;width:120px;margin-bottom:4px;"></div>
        <div class="skeleton" style="height:10px;width:50px;border-radius:4px;"></div>
      </div>
      <div class="skeleton" style="height:14px;width:64px;border-radius:4px;align-self:center;"></div>
      <div class="skeleton" style="height:20px;width:56px;border-radius:99px;align-self:center;"></div>
    </div>`;

    const gEl = $('gainersGrid');
    const lEl = $('losersGrid');
    if (gEl) gEl.innerHTML = [1, 2, 3, 4, 5, 6].map(skeletonRow).join('');
    if (lEl) lEl.innerHTML = [1, 2, 3, 4, 5, 6].map(skeletonRow).join('');

    const tbody = $('activeTable');
    if (tbody) {
        tbody.innerHTML = [1, 2, 3, 4, 5, 6].map((_, i) => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:12px 16px;"><div class="skeleton" style="height:13px;width:80px;margin-bottom:5px;"></div><div class="skeleton" style="height:10px;width:100px;"></div></td>
        <td style="padding:12px 16px;text-align:right;"><div class="skeleton" style="height:13px;width:60px;border-radius:4px;margin-left:auto;"></div></td>
        <td style="padding:12px 16px;text-align:right;"><div class="skeleton" style="height:13px;width:48px;border-radius:4px;margin-left:auto;"></div></td>
        <td style="padding:12px 16px;text-align:right;"><div class="skeleton" style="height:13px;width:52px;border-radius:4px;margin-left:auto;"></div></td>
      </tr>`).join('');
    }

    const lastUpdEl = $('lastUpdated');
    if (lastUpdEl) lastUpdEl.textContent = 'Fetching live data…';
}

// ═══════════════════════════════════════════════════════════════
//  RENDER FUNCTIONS (driven by real Yahoo Finance data)
// ═══════════════════════════════════════════════════════════════

/** Build a mini sparkline (seeded from real price, 20 synthetic history points) */
function buildSparkline(canvasId, basePrice, isUp, currency) {
    const existing = sparklineCharts[canvasId];
    if (existing) existing.destroy();

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Synthesise plausible history around the real price
    const hist = [basePrice];
    for (let i = 1; i < 20; i++) {
        const prev = hist[i - 1];
        const chg = prev * 0.002 * (Math.random() > 0.5 ? 1 : -1);
        hist.push(parseFloat((prev + chg).toFixed(2)));
    }

    const color = isUp ? '#0ecb81' : '#f6465d';
    const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 44);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');

    sparklineCharts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hist.map((_, i) => i),
            datasets: [{
                data: hist, borderColor: color, borderWidth: 1.5,
                pointRadius: 0, fill: true, backgroundColor: grad, tension: 0.4,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
        },
    });
}

/** Render index cards from real Yahoo data */
function renderIndices(indices) {
    const grid = $('indicesGrid');
    if (!grid) return;

    grid.innerHTML = indices.map(idx => {
        const isUp = idx.change >= 0;
        const absPct = Math.abs(idx.changePct).toFixed(2);
        const absChg = Math.abs(idx.change).toFixed(2);
        const color = isUp ? 'var(--up)' : 'var(--down)';
        const cur = idx.currency || 'INR';

        // Day range position (0–100%)
        const range = idx.high - idx.low;
        const pos = range > 0 ? (((idx.price - idx.low) / range) * 100).toFixed(0) : 50;

        return `
    <div class="card card-shimmer ${isUp ? 'idx-card-up' : 'idx-card-down'}" id="idx-${idx.id}" style="padding:18px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
        <div>
          <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">${idx.icon} ${idx.label}</div>
          <div style="font-weight:700;font-size:.95rem;">${idx.name}</div>
        </div>
        <span class="${isUp ? 'badge-up' : 'badge-down'}">${isUp ? '▲' : '▼'} ${absPct}%</span>
      </div>

      <div style="margin-bottom:10px;">
        <div class="num" style="font-size:1.6rem;font-weight:500;color:${color};" id="price-${idx.id}">
          ${fmtPrice(idx.price, cur)}
        </div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:2px;" id="change-${idx.id}">
          ${isUp ? '+' : '-'}${fmtPrice(absChg, cur)} today
        </div>
      </div>

      <div class="sparkline-wrap" style="margin-bottom:12px;">
        <canvas id="spark-${idx.id}" style="width:100%;height:44px;"></canvas>
      </div>

      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:.64rem;color:var(--muted);margin-bottom:5px;">
          <span>L ${fmtPrice(idx.low, cur)}</span>
          <span style="font-size:.6rem;">Day Range</span>
          <span>H ${fmtPrice(idx.high, cur)}</span>
        </div>
        <div style="background:var(--surface2);height:3px;border-radius:99px;position:relative;">
          <div style="position:absolute;left:0;top:0;height:100%;width:${pos}%;background:${color};border-radius:99px;transition:width .4s;"></div>
          <div style="position:absolute;top:-3px;left:calc(${pos}% - 3px);width:9px;height:9px;border-radius:50%;background:${color};border:1.5px solid var(--surface);"></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding-top:8px;border-top:1px solid var(--border);">
        <div style="font-size:.65rem;"><span style="color:var(--muted);">Open</span> <span class="num">${fmtPrice(idx.open, cur)}</span></div>
        <div style="font-size:.65rem;text-align:right;"><span style="color:var(--muted);">Prev</span> <span class="num">${fmtPrice(idx.prevClose, cur)}</span></div>
      </div>
    </div>`;
    }).join('');

    // Build sparklines
    requestAnimationFrame(() => {
        indices.forEach(idx => {
            buildSparkline(`spark-${idx.id}`, idx.price, idx.change >= 0, idx.currency);
        });
    });
}

/** Render a gainer / loser row */
function buildStockRow(stock, type) {
    const isGainer = type === 'gainer';
    const absChg = Math.abs(stock.changePct).toFixed(2);
    const cur = stock.currency || 'INR';
    return `
  <div class="stock-card ${type}" id="row-${stock.symbol.replace(/[^a-zA-Z0-9]/g, '_')}"
       style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 12px;">
    <div>
      <div style="font-weight:700;font-size:.84rem;">${stock.displaySymbol || stock.symbol}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:1px;">${stock.name || ''}</div>
    </div>
    <div style="text-align:right;">
      <div class="num" style="font-size:.86rem;font-weight:500;">
        ${fmtPrice(stock.price, cur)}
      </div>
    </div>
    <div style="text-align:right;min-width:62px;">
      <span class="${isGainer ? 'badge-up' : 'badge-down'}">${isGainer ? '▲' : '▼'} ${absChg}%</span>
    </div>
  </div>`;
}

/** Render gainers */
function renderGainers(gainers) {
    const grid = $('gainersGrid');
    if (!grid) return;
    if (!gainers || !gainers.length) {
        grid.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:.82rem;padding:20px;">No gainer data available.</div>`;
        return;
    }
    grid.innerHTML = gainers.map(s => buildStockRow(s, 'gainer')).join('');
}

/** Render losers */
function renderLosers(losers) {
    const grid = $('losersGrid');
    if (!grid) return;
    if (!losers || !losers.length) {
        grid.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:.82rem;padding:20px;">No loser data available.</div>`;
        return;
    }
    grid.innerHTML = losers.map(s => buildStockRow(s, 'loser')).join('');
}

/** Render most active table */
function renderActive(active) {
    const tbody = $('activeTable');
    if (!tbody) return;
    if (!active || !active.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px;">No data available.</td></tr>`;
        return;
    }

    const maxVol = Math.max(...active.map(s => s.volume || 0));
    tbody.innerHTML = active.map((s, i) => {
        const isUp = s.change >= 0;
        const bg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)';
        const pct = maxVol > 0 ? ((s.volume / maxVol) * 100).toFixed(0) : 10;
        const cur = s.currency || 'INR';
        return `
    <tr style="background:${bg};border-bottom:1px solid var(--border);">
      <td style="padding:10px 16px;">
        <div style="font-weight:700;font-size:.82rem;">${s.displaySymbol || s.symbol}</div>
        <div style="font-size:.68rem;color:var(--muted);">${s.name || ''}</div>
      </td>
      <td style="padding:10px 16px;text-align:right;">
        <div class="num" style="font-size:.82rem;">${fmtPrice(s.price, cur)}</div>
      </td>
      <td style="padding:10px 16px;text-align:right;">
        <span style="color:${isUp ? 'var(--up)' : 'var(--down)'};font-family:'DM Mono',monospace;font-size:.78rem;">
          ${isUp ? '+' : ''}${fmtNum(s.changePct)}%
        </span>
      </td>
      <td style="padding:10px 16px;text-align:right;">
        <div style="font-size:.75rem;font-family:'DM Mono',monospace;margin-bottom:4px;">${fmtVol(s.volume)}</div>
        <div class="vol-bar ${!isUp ? 'down' : ''}" style="width:${pct}%;"></div>
      </td>
    </tr>`;
    }).join('');
}

/** Render sector heatmap from real stock data */
function renderSectors(stocks) {
    const strip = $('sectorStrip');
    if (!strip) return;

    // Average changePct per sector
    const sectorData = {};
    if (stocks && stocks.length) {
        stocks.forEach(s => {
            const sec = STOCK_SECTOR_MAP[s.symbol];
            if (!sec) return;
            if (!sectorData[sec]) sectorData[sec] = { total: 0, count: 0 };
            sectorData[sec].total += s.changePct || 0;
            sectorData[sec].count += 1;
        });
    }

    const displaySectors = SECTORS.map(s => ({
        ...s,
        change: sectorData[s.name]
            ? parseFloat((sectorData[s.name].total / sectorData[s.name].count).toFixed(2))
            : s.change,
    }));

    strip.innerHTML = displaySectors.map(s => {
        const isUp = s.change >= 0;
        const abs = Math.abs(s.change);
        const opacity = Math.min(0.15 + abs * 0.06, 0.45);
        const bg = isUp
            ? `rgba(14,203,129,${opacity})`
            : `rgba(246,70,93,${opacity})`;

        return `
    <div class="sector-pill" style="background:${bg};border:1px solid ${isUp ? 'rgba(14,203,129,.2)' : 'rgba(246,70,93,.2)'};">
      <span style="font-size:.78rem;font-weight:600;">${s.name}</span>
      <span class="num" style="font-size:.72rem;color:${isUp ? 'var(--up)' : 'var(--down)'};">
        ${isUp ? '▲' : '▼'} ${abs.toFixed(2)}%
      </span>
    </div>`;
    }).join('');
}

/** Render news (static mock) */
function renderNews(news) {
    const container = document.getElementById('newsContainer');
    if (!container) return;

    if (!news || !news.length) {
        container.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--muted);font-size:.82rem;">
        No news available right now.
      </div>`;
        return;
    }

    container.innerHTML = news.map((n, i) => `
    <a href="${n.link}"
       target="_blank"
       rel="noopener noreferrer"
       class="news-item news-link"
       style="display:block;text-decoration:none;color:inherit;
              border-bottom:${i < news.length - 1 ? '1px solid var(--border)' : 'none'};
              padding:13px 0;
              transition:background .15s, padding .15s;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="
          font-size:.6rem;
          background:rgba(14,203,129,.1);
          color:var(--up);
          border:1px solid rgba(14,203,129,.25);
          padding:2px 8px;
          border-radius:99px;
          font-family:'DM Mono',monospace;
          white-space:nowrap;">
          📰 Live
        </span>
        <span style="font-size:.68rem;color:var(--muted);font-family:'DM Mono',monospace;white-space:nowrap;" title="${n.timeAbs}">
          ${n.timeAgo}
        </span>
        <span style="font-size:.65rem;color:var(--muted);margin-left:auto;white-space:nowrap;
                     overflow:hidden;text-overflow:ellipsis;max-width:120px;">
          ${n.source}
        </span>
      </div>
 
      ${n.thumbnail ? `
        <div style="margin-bottom:7px;border-radius:8px;overflow:hidden;height:72px;">
          <img src="${n.thumbnail}" alt=""
               style="width:100%;height:100%;object-fit:cover;border-radius:8px;
                      filter:brightness(.9);"
               onerror="this.parentElement.style.display='none'" />
        </div>` : ''}
 
      <div style="font-size:.82rem;line-height:1.5;font-weight:500;color:var(--text);">
        ${n.headline}
      </div>
 
      <div style="display:flex;align-items:center;gap:4px;margin-top:6px;">
        <span style="font-size:.66rem;color:var(--muted);">Read on Yahoo Finance</span>
        <span style="font-size:.64rem;color:var(--muted);">↗</span>
      </div>
    </a>`).join('');
}
function showNewsSkeleton() {
    const container = document.getElementById('newsContainer');
    if (!container) return;

    const skRow = () => `
    <div style="padding:13px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div class="skeleton" style="height:16px;width:40px;border-radius:99px;"></div>
        <div class="skeleton" style="height:11px;width:55px;border-radius:4px;"></div>
        <div class="skeleton" style="height:11px;width:80px;border-radius:4px;margin-left:auto;"></div>
      </div>
      <div class="skeleton" style="height:13px;width:100%;border-radius:4px;margin-bottom:5px;"></div>
      <div class="skeleton" style="height:13px;width:82%;border-radius:4px;margin-bottom:5px;"></div>
      <div class="skeleton" style="height:11px;width:48%;border-radius:4px;"></div>
    </div>`;

    container.innerHTML = [1, 2, 3, 4, 5].map(skRow).join('');
}
async function fetchNews() {
    showNewsSkeleton();

    try {
        const res = await fetch('/api/news');
        const data = await res.json();

        if (!data.success) {
            console.error('[fetchNews] API error:', data.message);
            const container = document.getElementById('newsContainer');
            if (container) {
                container.innerHTML = `
          <div style="padding:20px;text-align:center;">
            <div style="color:var(--muted);font-size:.82rem;margin-bottom:10px;">
              Could not load news.
            </div>
            <button onclick="fetchNews()"
              style="background:rgba(14,203,129,.1);border:1px solid rgba(14,203,129,.3);
                     color:var(--up);padding:6px 16px;border-radius:8px;
                     font-family:'Syne',sans-serif;font-weight:600;
                     cursor:pointer;font-size:.76rem;">
              ↻ Retry
            </button>
          </div>`;
            }
            return;
        }

        renderNews(data.news || []);

        if (data.stale) {
            console.warn('[fetchNews] Serving stale cached news.');
        }
        if (data.cached) {
            console.log('[fetchNews] Served from cache.');
        }

    } catch (err) {
        console.error('[fetchNews] Network error:', err.message);
        const container = document.getElementById('newsContainer');
        if (container) {
            container.innerHTML = `
        <div style="padding:16px;text-align:center;color:var(--muted);font-size:.8rem;">
          Network error. <span style="color:var(--up);cursor:pointer;" onclick="fetchNews()">Retry ↻</span>
        </div>`;
        }
    }
}

/** Render F&O (static mock — could be enriched later) */
function renderFO() {
    const grid = $('foGrid');
    if (!grid) return;
    grid.innerHTML = FO_DATA.map(f => {
        const color = f.pos === true ? 'var(--up)' : f.pos === false ? 'var(--down)' : 'var(--text)';
        return `
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:.64rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${f.label}</div>
      <div class="num" style="font-size:1.15rem;font-weight:500;color:${color};margin-bottom:3px;">${f.value}</div>
      <div style="font-size:.68rem;color:var(--muted);">${f.note}</div>
    </div>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
//  MARKET STATUS / CLOCK
// ═══════════════════════════════════════════════════════════════
function updateClock() {
    const timeEl = $('liveTime');
    const statusEl = $('marketStatusBadge');
    const textEl = $('marketStatusText');

    if (timeEl) {
        timeEl.textContent = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata',
        }) + ' IST';
    }

    const status = getMarketStatus();
    if (statusEl && textEl) {
        statusEl.className = `market-status market-${status}`;
        textEl.textContent = status === 'open' ? 'Market Open' : status === 'pre' ? 'Pre-Market' : 'Market Closed';
        const dot = statusEl.querySelector('.ldot');
        if (dot) dot.style.background = status === 'open' ? 'var(--up)' : status === 'pre' ? 'var(--accent)' : 'var(--down)';
    }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN DATA FETCH
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch /api/market-overview and render everything.
 * Called on boot and every 60 seconds.
 */
async function fetchAndRender() {
    const lastUpdEl = $('lastUpdated');
    if (lastUpdEl) lastUpdEl.textContent = 'Updating…';

    try {
        const res = await fetch('/api/market-overview');
        const data = await res.json();

        if (!data.success) {
            console.error('[fetchAndRender] API error:', data.message);
            if (lastUpdEl) lastUpdEl.textContent = 'Error — retrying in 60s';
            showError(data.message);
            return;
        }

        const { indices, gainers, losers, active, fetchedAt } = data;

        // Render all sections with real data
        renderIndices(indices || []);
        renderGainers(gainers || []);
        renderLosers(losers || []);
        renderActive(active || []);

        // Sector heatmap from all stocks (gainers + losers + active combined, deduplicated)
        const allStocks = [...(gainers || []), ...(losers || []), ...(active || [])];
        const seen = new Set();
        const deduped = allStocks.filter(s => {
            if (seen.has(s.symbol)) return false;
            seen.add(s.symbol); return true;
        });
        renderSectors(deduped);

        // Update timestamp
        const fetchTime = fetchedAt
            ? new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (lastUpdEl) lastUpdEl.textContent = `${fetchTime} (15-min delayed)`;

        console.log(`%c[StockQuest] Market data updated at ${fetchTime}`, 'color:#0ecb81;');

    } catch (err) {
        console.error('[fetchAndRender] Network error:', err.message);
        if (lastUpdEl) lastUpdEl.textContent = 'Network error — retrying in 60s';
        showError('Could not connect to backend. Make sure server.js is running.');
    }
}

/** Show a friendly error banner */
function showError(message) {
    const idxGrid = $('indicesGrid');
    if (!idxGrid || idxGrid.children.length > 0 && !idxGrid.querySelector('.skeleton')) return;
    idxGrid.innerHTML = `
    <div style="grid-column:1/-1;background:rgba(246,70,93,.08);border:1px solid rgba(246,70,93,.3);border-radius:12px;padding:24px;text-align:center;">
      <div style="font-size:1.5rem;margin-bottom:8px;">⚠️</div>
      <div style="font-weight:600;margin-bottom:6px;">Could not load market data</div>
      <div style="font-size:.78rem;color:var(--muted);">${message || 'Please check your internet connection and try again.'}</div>
      <button onclick="fetchAndRender()" style="margin-top:14px;background:rgba(246,70,93,.15);border:1px solid rgba(246,70,93,.4);color:var(--down);padding:7px 18px;border-radius:8px;font-family:'Syne',sans-serif;font-weight:600;cursor:pointer;font-size:.8rem;">
        ↻ Retry Now
      </button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════
function boot() {
    // Set today's date
    const dateEl = $('todayDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
    }

    // Render static sections immediately (no network needed)
    fetchNews(); // Fetch live news on load
    setInterval(fetchNews, 10 * 60 * 1000); // Auto-refresh every 10 min
    renderFO();
    updateClock();
    document.getElementById("apiStatusText").innerText = "Loading real-time data...";

    // Show skeletons while data loads
    showLoadingState();
    gsap.from(".card", { opacity: 0, y: 20, duration: 0.6, stagger: 0.1 });

    // Fetch real data
    fetchAndRender();

    // Auto-refresh every 60 seconds
    // (Yahoo Finance data is ~15-min delayed anyway — no need to hammer it)
    setInterval(fetchAndRender, 60000);

    // Clock ticks every second
    setInterval(updateClock, 1000);

    console.log('%cStockQuest Market Overview 🚀', 'color:#0ecb81;font-size:1rem;font-weight:bold;');
    console.log('%cData: Yahoo Finance (real prices, ~15-min delayed)', 'color:#848e9c;');
    console.log('%cRefreshing every 60 seconds', 'color:#848e9c;');
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
const searchBox = document.getElementById("searchBox");

if (searchBox) {
  searchBox.addEventListener("input", function () {
    const value = this.value.toLowerCase();
    const rows = document.querySelectorAll(".stock-card");

    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(value) ? "grid" : "none";
    });
  });
}

async function loadMarketData() {
  try {
    const res = await fetch('/api/market-overview');
    const data = await res.json();

    if (!data.success) {
      document.getElementById("apiStatusText").innerText = "API Error ❌";
      return;
    }

    document.getElementById("apiStatusText").innerText = "Live Data Loaded ✅";

    // CALL YOUR FUNCTIONS
    renderIndices(data.indices);
    renderGainers(data.gainers);
    renderLosers(data.losers);
    renderActive(data.active);

  } catch (err) {
    console.error(err);
    document.getElementById("apiStatusText").innerText = "Connection Failed ❌";
  }
}

// AUTO RUN
// all your functions...

async function loadMarketData() {
   // API call
}

// LAST LINE
document.addEventListener("DOMContentLoaded", () => {
  loadMarketData();
});
// OPTIONAL: refresh every 60 sec
setInterval(loadMarketData, 60000);