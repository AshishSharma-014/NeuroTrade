/**
 * ============================================================
 *  StockQuest UPGRADED — server.js
 *  Node.js + Express | Yahoo Finance 2 (Free, No API Key)
 *  Supports US stocks + Indian stocks (NSE/BSE)
 * ============================================================
 *
 *  SETUP:
 *    1. npm install express yahoo-finance2
 *    2. node server.js  →  open http://localhost:3000
 *
 *  ⚠️  No API key needed! Yahoo Finance 2 is completely free.
 *
 *  Indian stock symbol format (Yahoo Finance):
 *    NSE: RELIANCE.NS   TCS.NS   INFY.NS   HDFCBANK.NS
 *    BSE: RELIANCE.BO   TCS.BO   WIPRO.BO
 *  Indices:
 *    ^NSEI  (NIFTY 50)   ^BSESN  (SENSEX)
 *    ^NSEBANK (BANKNIFTY)  ^NSMIDCP (NIFTY MIDCAP)
 *  US stock examples:
 *    AAPL   TSLA   MSFT   NVDA   GOOGL   META
 * ============================================================
 */


const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const compression = require('compression');

const app = express(); // ✅ ONLY ONCE
const PORT = process.env.PORT || 3000;

let yahooFinance; // loaded later

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key || process.env[key]) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnv();

// ─── Middlewares ─────────────────────────
app.use(cors());
app.use(compression());
app.use(express.json());

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Static files (IMPORTANT for your structure)
app.use(express.static(__dirname));

// ─── Lazy-load yahoo-finance2 (ESM package in CJS context) ────
// ─── Lazy-load yahoo-finance2 (ESM package in CJS context) ────
// ─── Lazy-load yahoo-finance2 (ESM package in CJS context) ────
// ─── Lazy-load yahoo-finance2 (ESM package in CJS context) ────
async function getYahoo() {
  if (!yahooFinance) {
    const mod = await import('yahoo-finance2');
    yahooFinance = new mod.default({
      validation: { logErrors: false },
      suppressNotices: ['yahooSurvey']  // <-- YEH NAYI LINE ADD KI HAI
    });
  }
  return yahooFinance;
}

// ─── In-memory game state ─────────────────────────────────────
let gameState = {
  balance: 6500.00,
  portfolio: [],        // [{ symbol, qty, avgBuyPrice }]
  totalTrades: 0,
  realisedPL: 0,
  rewardClaimed: false,
};

// ─── Quote cache ──────────────────────────────────────────────
// Yahoo Finance has generous rate limits but we still cache to
// prevent redundant calls during buy/sell operations.
const quoteCache = {};
const QUOTE_TTL = 15000;  // 15s for individual quotes
const OVERVIEW_TTL = 60000;  // 60s for the full market overview batch

let overviewCache = null;
let overviewCacheTime = 0;

// ─── Symbol normalizer ────────────────────────────────────────
// Converts Twelve Data / user-friendly formats to Yahoo format
function toYahooSymbol(raw) {
  const s = raw.toUpperCase().trim();
  if (s.endsWith(':NSE')) return s.replace(':NSE', '.NS');
  if (s.endsWith(':BSE')) return s.replace(':BSE', '.BO');
  // Already Yahoo format or US symbol — pass through
  return s;
}

// ─── Display symbol (strip .NS / .BO for UI) ─────────────────
function toDisplaySymbol(yahooSym) {
  return yahooSym.replace('.NS', ':NSE').replace('.BO', ':BSE');
}

// ─── Fetch single quote via Yahoo Finance ────────────────────
async function fetchQuote(rawSymbol) {
  const ySymbol = toYahooSymbol(rawSymbol);
  const now = Date.now();

  if (quoteCache[ySymbol] && (now - quoteCache[ySymbol].timestamp) < QUOTE_TTL) {
    return quoteCache[ySymbol];
  }

  try {
    const yf = await getYahoo();
    const data = await yf.quote(ySymbol);

    if (!data || !data.regularMarketPrice) {
      throw new Error(`No data returned for ${ySymbol}`);
    }

    const price = data.regularMarketPrice;
    const prevClose = data.regularMarketPreviousClose || price;
    const change = data.regularMarketChange || 0;
    const changePct = data.regularMarketChangePercent || 0;
    const currency = data.currency || 'USD';

    const quote = {
      symbol: ySymbol,
      displaySymbol: toDisplaySymbol(ySymbol),
      name: data.longName || data.shortName || ySymbol,
      exchange: data.fullExchangeName || data.exchange || '',
      price,
      previousClose: prevClose,
      change: parseFloat(change.toFixed(2)),
      changePct: parseFloat(changePct.toFixed(2)),
      open: data.regularMarketOpen || price,
      high: data.regularMarketDayHigh || price,
      low: data.regularMarketDayLow || price,
      volume: data.regularMarketVolume || 0,
      marketCap: data.marketCap || 0,
      currency,
      timestamp: now,
      valid: true,
    };

    quoteCache[ySymbol] = quote;
    return quote;
  } catch (err) {
    console.error(`[fetchQuote] ${ySymbol}: ${err.message}`);
    return quoteCache[ySymbol] || null;
  }
}

// ─── Symbols for the Market Overview batch ───────────────────
const OVERVIEW_SYMBOLS = {
  // Market indices
  indices: ['^NSEI', '^BSESN', '^NSEBANK', '^NSMIDCP'],

  // Stocks used for gainers/losers/active (NIFTY 50 basket sample)
  stocks: [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS',
    'ICICIBANK.NS', 'HINDUNILVR.NS', 'SBIN.NS', 'KOTAKBANK.NS',
    'BHARTIARTL.NS', 'ITC.NS', 'ASIANPAINT.NS', 'MARUTI.NS',
    'AXISBANK.NS', 'LT.NS', 'TITAN.NS', 'BAJFINANCE.NS',
    'WIPRO.NS', 'NTPC.NS', 'ONGC.NS', 'POWERGRID.NS',
    'SUNPHARMA.NS', 'TATAMOTORS.NS', 'NESTLEIND.NS', 'DRREDDY.NS',
    'CIPLA.NS', 'COALINDIA.NS', 'TATASTEEL.NS', 'JSWSTEEL.NS',
    'ADANIENT.NS', 'HCLTECH.NS',
  ],
};

// ─── Build market overview from Yahoo Finance ─────────────────
async function buildMarketOverview() {
  const now = Date.now();

  // Return cached overview if still fresh
  if (overviewCache && (now - overviewCacheTime) < OVERVIEW_TTL) {
    return overviewCache;
  }

  const yf = await getYahoo();

  // Fetch all symbols in one batch call (Yahoo Finance 2 supports arrays)
  const allSymbols = [...OVERVIEW_SYMBOLS.indices, ...OVERVIEW_SYMBOLS.stocks];

  let rawResults = [];
  try {
    // quoteSummary doesn't support batching, but quote() does
    rawResults = await Promise.all(
      allSymbols.map(sym =>
        yf.quote(sym).catch(err => {
          console.warn(`[overview] Failed for ${sym}: ${err.message}`);
          return null;
        })
      )
    );
  } catch (err) {
    console.error('[buildMarketOverview] Batch fetch error:', err.message);
    throw err;
  }

  // Map raw Yahoo data to our clean shape
  function mapQuote(data, sym) {
    if (!data || !data.regularMarketPrice) return null;
    const price = data.regularMarketPrice;
    const prevClose = data.regularMarketPreviousClose || price;
    const change = data.regularMarketChange || 0;
    const changePct = data.regularMarketChangePercent || 0;
    return {
      symbol: sym,
      displaySymbol: toDisplaySymbol(sym),
      name: data.longName || data.shortName || sym,
      exchange: data.fullExchangeName || '',
      price,
      prevClose,
      change: parseFloat(change.toFixed(2)),
      changePct: parseFloat(changePct.toFixed(2)),
      open: data.regularMarketOpen || price,
      high: data.regularMarketDayHigh || price,
      low: data.regularMarketDayLow || price,
      volume: data.regularMarketVolume || 0,
      currency: data.currency || 'INR',
    };
  }

  const mapped = allSymbols
    .map((sym, i) => mapQuote(rawResults[i], sym))
    .filter(Boolean);

  // ── Split into indices vs stocks ──
  const indices = mapped
    .filter(q => OVERVIEW_SYMBOLS.indices.includes(q.symbol))
    .map(q => {
      // Give each index a friendly name / icon
      const META = {
        '^NSEI': { name: 'NIFTY 50', label: 'NSE', icon: '📊' },
        '^BSESN': { name: 'SENSEX', label: 'BSE', icon: '📈' },
        '^NSEBANK': { name: 'BANKNIFTY', label: 'NSE', icon: '🏦' },
        '^NSMIDCP': { name: 'NIFTY MIDCAP', label: 'NSE', icon: '📉' },
      };
      const meta = META[q.symbol] || {};
      return {
        ...q,
        id: q.symbol.replace('^', '').toLowerCase(),
        name: meta.name || q.name,
        label: meta.label || q.exchange,
        icon: meta.icon || '📊',
      };
    });

  const stocks = mapped.filter(q => !OVERVIEW_SYMBOLS.indices.includes(q.symbol));

  // ── Sort for gainers / losers ──
  const sorted = [...stocks].sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.filter(s => s.changePct > 0).slice(0, 8);
  const losers = sorted.filter(s => s.changePct < 0).reverse().slice(0, 8);

  // ── Sort for most active by volume ──
  const active = [...stocks]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  overviewCache = { indices, gainers, losers, active, fetchedAt: new Date().toISOString() };
  overviewCacheTime = now;

  return overviewCache;
}

// ═══════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/market-overview
 * Batch endpoint: fetches all index + stock data from Yahoo Finance,
 * sorts and returns indices, gainers, losers, active in one response.
 * Cached for 60 seconds to avoid hammering Yahoo.
 */
app.get('/api/market-overview', async (req, res) => {
  try {
    const overview = await buildMarketOverview();
    res.json({ success: true, ...overview });
  } catch (err) {
    console.error('[/api/market-overview]', err.message);
    res.status(502).json({
      success: false,
      message: 'Could not fetch market data from Yahoo Finance. Please try again shortly.',
      error: err.message,
    });
  }
});

/**
 * GET /api/quote/:symbol
 * Single stock quote via Yahoo Finance.
 * Accepts: AAPL, RELIANCE:NSE, TCS.NS, ^NSEI
 */
// ─── GET CHART DATA (Handles 1D, 1W, 1M, 1Y, 5Y) ───
app.get('/api/chart/:symbol', async (req, res) => {
  try {
    const yf = await getYahoo();
    const tf = req.query.tf || '1D'; // Frontend se Timeframe lo (Default 1D)
    
    let period1, interval;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Timeframe ke hisaab se date aur candle size (interval) set karo
    if (tf === '1D')      { period1 = now - day; interval = '2m'; }
    else if (tf === '1W') { period1 = now - 7 * day; interval = '15m'; }
    else if (tf === '1M') { period1 = now - 30 * day; interval = '1d'; }
    else if (tf === '3M') { period1 = now - 90 * day; interval = '1d'; }
    else if (tf === '1Y') { period1 = now - 365 * day; interval = '1d'; }
    else if (tf === '5Y') { period1 = now - 5 * 365 * day; interval = '1wk'; }
    else                  { period1 = now - day; interval = '2m'; }

    const result = await yf.chart(req.params.symbol, {
      period1: new Date(period1),
      interval: interval
    });
    res.json({ success: true, quotes: result.quotes });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});
app.get('/api/quote/:symbol', async (req, res) => {
  const rawSymbol = req.params.symbol.trim();

  if (!rawSymbol || rawSymbol.length > 25) {
    return res.status(400).json({ success: false, message: 'Invalid symbol.' });
  }

  const quote = await fetchQuote(rawSymbol);

  if (!quote) {
    return res.status(502).json({
      success: false,
      message: `Could not fetch "${rawSymbol}" from Yahoo Finance. Check the symbol and try again.`,
    });
  }

  res.json({ success: true, quote });
});

/**
 * GET /api/search/:query
 * Symbol search via Yahoo Finance autosuggest.
 */
app.get('/api/search/:query', async (req, res) => {
  const query = req.params.query.trim();
  if (!query) return res.json({ success: true, results: [] });

  try {
    const yf = await getYahoo();
    const data = await yf.search(query);

    const results = (data.quotes || [])
      .filter(r => r.quoteType === 'EQUITY' || r.quoteType === 'INDEX')
      .slice(0, 8)
      .map(r => ({
        symbol: r.symbol,
        description: r.longname || r.shortname || r.symbol,
        exchange: r.exchDisp || r.exchange || '',
        type: r.quoteType,
      }));

    res.json({ success: true, results });
  } catch (err) {
    console.error('[search] Error:', err.message);
    res.json({ success: true, results: [] });
  }
});

/**
 * POST /api/buy
 * Body: { symbol: string, qty: number }
 */
app.post('/api/buy', async (req, res) => {
  const { symbol, qty } = req.body;
  const n = parseInt(qty);

  if (!symbol || !n || n <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid symbol or quantity.' });
  }

  const quote = await fetchQuote(symbol);
  if (!quote || !quote.valid) {
    return res.status(400).json({ success: false, message: `Cannot price "${symbol}". Search it first.` });
  }

  const cost = parseFloat((quote.price * n).toFixed(2));
  const ySymbol = toYahooSymbol(symbol);

  if (gameState.balance < cost) {
    return res.status(400).json({
      success: false,
      message: `Need ${quote.currency} ${cost.toFixed(2)} but balance is $${gameState.balance.toFixed(2)}.`,
    });
  }

  let h = gameState.portfolio.find(p => p.symbol === ySymbol);
  if (h) {
    h.avgBuyPrice = parseFloat(((h.avgBuyPrice * h.qty + quote.price * n) / (h.qty + n)).toFixed(4));
    h.qty += n;
  } else {
    gameState.portfolio.push({
      symbol: ySymbol,
      displaySymbol: quote.displaySymbol,
      currency: quote.currency,
      qty: n,
      avgBuyPrice: quote.price,
    });
  }

  gameState.balance = parseFloat((gameState.balance - cost).toFixed(2));
  gameState.totalTrades++;

  res.json({
    success: true,
    message: `✅ Bought ${n} × ${toDisplaySymbol(ySymbol)} @ ${quote.price.toFixed(2)}`,
    trade: { action: 'BUY', symbol: ySymbol, qty: n, price: quote.price, total: cost },
    player: { balance: gameState.balance, portfolio: gameState.portfolio, totalTrades: gameState.totalTrades },
  });
});

/**
 * POST /api/sell
 * Body: { symbol: string, qty: number }
 */
app.post('/api/sell', async (req, res) => {
  const { symbol, qty } = req.body;
  const n = parseInt(qty);
  const ySymbol = toYahooSymbol(symbol || '');

  if (!ySymbol || !n || n <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid symbol or quantity.' });
  }

  const h = gameState.portfolio.find(p => p.symbol === ySymbol);
  if (!h || h.qty < n) {
    return res.status(400).json({
      success: false,
      message: `You only hold ${h ? h.qty : 0} shares of ${toDisplaySymbol(ySymbol)}.`,
    });
  }

  const quote = await fetchQuote(ySymbol);
  if (!quote) {
    return res.status(400).json({ success: false, message: `Cannot get price for ${ySymbol}.` });
  }

  const proceeds = parseFloat((quote.price * n).toFixed(2));
  const pl = parseFloat((proceeds - h.avgBuyPrice * n).toFixed(2));

  h.qty -= n;
  if (h.qty === 0) gameState.portfolio = gameState.portfolio.filter(p => p.symbol !== ySymbol);

  gameState.balance = parseFloat((gameState.balance + proceeds).toFixed(2));
  gameState.realisedPL = parseFloat((gameState.realisedPL + pl).toFixed(2));
  gameState.totalTrades++;

  res.json({
    success: true,
    message: `✅ Sold ${n} × ${toDisplaySymbol(ySymbol)} @ ${quote.price.toFixed(2)} | P&L: ${pl >= 0 ? '📈' : '📉'} ${pl.toFixed(2)}`,
    trade: { action: 'SELL', symbol: ySymbol, qty: n, price: quote.price, total: proceeds, tradePL: pl },
    player: {
      balance: gameState.balance,
      portfolio: gameState.portfolio,
      realisedPL: gameState.realisedPL,
      totalTrades: gameState.totalTrades,
    },
  });
});

/**
 * GET /api/portfolio
 */
app.get('/api/portfolio', async (req, res) => {
  try {
    const enriched = await Promise.all(
      gameState.portfolio.map(async h => {
        const q = await fetchQuote(h.symbol);
        const lp = q ? q.price : h.avgBuyPrice;
        const mv = parseFloat((lp * h.qty).toFixed(2));
        const upl = parseFloat((mv - h.avgBuyPrice * h.qty).toFixed(2));
        const plPct = h.avgBuyPrice > 0
          ? parseFloat(((upl / (h.avgBuyPrice * h.qty)) * 100).toFixed(2))
          : 0;
        return {
          symbol: h.symbol,
          displaySymbol: h.displaySymbol || toDisplaySymbol(h.symbol),
          currency: h.currency || 'USD',
          qty: h.qty,
          avgBuyPrice: h.avgBuyPrice,
          livePrice: lp,
          marketValue: mv,
          unrealisedPL: upl,
          plPct,
          change: q ? q.change : 0,
          changePct: q ? q.changePct : 0,
        };
      })
    );

    const totalMV = enriched.reduce((s, h) => s + h.marketValue, 0);
    const totalUPL = enriched.reduce((s, h) => s + h.unrealisedPL, 0);

    res.json({
      success: true,
      portfolio: enriched,
      summary: {
        balance: gameState.balance,
        totalMarketValue: parseFloat(totalMV.toFixed(2)),
        totalUnrealisedPL: parseFloat(totalUPL.toFixed(2)),
        realisedPL: gameState.realisedPL,
        totalTrades: gameState.totalTrades,
        netWorth: parseFloat((gameState.balance + totalMV).toFixed(2)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching portfolio.' });
  }
});

/**
 * POST /api/reward
 * Requires: balance < $100 AND zero holdings.
 */
app.post('/api/reward', (req, res) => {
  if (gameState.rewardClaimed) {
    return res.status(403).json({ success: false, message: '🚫 Reward already claimed this session.' });
  }
  const totalHoldings = gameState.portfolio.reduce((s, h) => s + h.qty, 0);
  if (gameState.balance >= 100) {
    return res.status(400).json({ success: false, message: `Balance is $${gameState.balance.toFixed(2)}. Must be below $100 to claim.` });
  }
  if (totalHoldings > 0) {
    return res.status(400).json({ success: false, message: 'Sell all active stocks before claiming rescue funds.' });
  }
  gameState.balance += 2000;
  gameState.rewardClaimed = true;
  res.json({ success: true, message: '🎉 $2,000 rescue funds credited! Back in the game.', player: { balance: gameState.balance } });
});

/**
 * GET /api/leaderboard
 */
app.get('/api/leaderboard', (req, res) => {
  const mock = [
    { username: 'TradingKing99', netWorth: 18420, badge: '🏆 Legend' },
    { username: 'BullRunQueen', netWorth: 15300, badge: '🥈 Elite' },
    { username: 'QuantumTrader', netWorth: 12800, badge: '🥉 Pro' },
    { username: 'NiftyNinja', netWorth: 9900, badge: '⚡ Advanced' },
    { username: 'MarketMogul', netWorth: 8750, badge: '📈 Rising' },
  ];
  const portVal = gameState.portfolio.reduce((s, h) => {
    const c = quoteCache[toYahooSymbol(h.symbol)];
    return s + (c ? c.price * h.qty : h.avgBuyPrice * h.qty);
  }, 0);
  const you = {
    username: 'You 🎮',
    netWorth: parseFloat((gameState.balance + portVal).toFixed(2)),
    badge: '🔥 Live',
    isYou: true,
  };
  const ranked = [...mock, you].sort((a, b) => b.netWorth - a.netWorth).map((p, i) => ({ ...p, rank: i + 1 }));
  res.json({ success: true, leaderboard: ranked });
});

/**
 * POST /api/reset
 */
app.post('/api/reset', (req, res) => {
  gameState = { balance: 6500, portfolio: [], totalTrades: 0, realisedPL: 0, rewardClaimed: false };
  res.json({ success: true, message: '🔄 Game reset! Starting fresh with $6,500.' });
});
/**
 * GET /api/news
 * Fetches real financial news via yahoo-finance2 search.
 * Returns a clean array of { headline, source, link, time, timeAgo }.
 *
 * ── WHERE TO PASTE ──────────────────────────────────────────
 *  Add this block in server.js BEFORE the catch-all route:
 *    app.get('*', (req, res) => res.sendFile(...));
 * ────────────────────────────────────────────────────────────
 */

// ─── News cache (refresh every 10 minutes) ───────────────────
let newsCache = null;
let newsCacheTime = 0;
const NEWS_TTL = 10 * 60 * 1000; // 10 minutes in ms

app.get('/api/news', async (req, res) => {
  const now = Date.now();

  // Serve from cache if still fresh
  if (newsCache && (now - newsCacheTime) < NEWS_TTL) {
    return res.json({ success: true, news: newsCache, cached: true });
  }

  try {
    const yf = await getYahoo();

    // Run two searches in parallel for broader coverage
    // Run two searches using ACTUAL Symbols to guarantee news
    const [niftyResults, relianceResults] = await Promise.all([
      yf.search('^NSEI', { newsCount: 6 }) // Nifty 50 News
        .catch(() => ({ news: [] })),
      yf.search('RELIANCE.NS', { newsCount: 6 }) // Reliance/Market News
        .catch(() => ({ news: [] })),
    ]);

    const rawNews = [
      ...(niftyResults.news || []),
      ...(relianceResults.news || []),
    ];

    // Deduplicate by UUID / link
    const seen = new Set();
    const deduped = rawNews.filter(item => {
      const key = item.uuid || item.link;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Helper: convert Unix timestamp → "X hours ago" / "X days ago"
    function timeAgo(unixTs) {
      if (!unixTs) return 'Recently';
      const diffMs = Date.now() - unixTs * 1000;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h ago`;
      const diffD = Math.floor(diffH / 24);
      return `${diffD}d ago`;
    }

    // Helper: format absolute time as "DD MMM, HH:MM IST"
    function absTime(unixTs) {
      if (!unixTs) return '';
      return new Date(unixTs * 1000).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }) + ' IST';
    }

    // Map to clean shape
    const news = deduped
      .slice(0, 8)  // cap at 8 items
      .map(item => ({
        headline: item.title || 'No title',
        source: item.publisher || 'Yahoo Finance',
        link: item.link || 'https://finance.yahoo.com',
        thumbnail: item.thumbnail?.resolutions?.[0]?.url || null,
        timeAgo: timeAgo(item.providerPublishTime),
        timeAbs: absTime(item.providerPublishTime),
        unixTs: item.providerPublishTime || 0,
      }))
      // Sort newest first
      .sort((a, b) => b.unixTs - a.unixTs);

    // Store in cache
    newsCache = news;
    newsCacheTime = now;

    res.json({ success: true, news, cached: false });

  } catch (err) {
    console.error('[/api/news] Error:', err.message);

    // If cache exists (even stale), return it rather than failing
    if (newsCache) {
      return res.json({ success: true, news: newsCache, cached: true, stale: true });
    }

    res.status(502).json({
      success: false,
      message: 'Could not fetch news from Yahoo Finance.',
      error: err.message,
    });
  }
});

function buildLocalAdvice(message) {
  const q = String(message || '').toLowerCase();

  if (q.includes('tax')) {
    return 'Keep salary slips, Form 16, deduction proofs, and investment statements ready. Verify your taxable income, compare deduction options, and file only after reconciling AIS/TIS details.';
  }
  if (q.includes('save') || q.includes('saving') || q.includes('budget')) {
    return 'Start with a simple split: essentials first, then emergency fund, then SIPs. If savings are below 15% of income, reduce recurring non-essential expenses before increasing investing risk.';
  }
  if (q.includes('goal') || q.includes('sip') || q.includes('invest')) {
    return 'Define the target amount, time horizon, and monthly contribution needed. Match short-term goals with safer assets and long-term goals with diversified SIPs.';
  }
  if (q.includes('debt') || q.includes('loan')) {
    return 'Pay off high-interest debt before increasing aggressive investments. Keep EMIs manageable and avoid using credit for speculative trading.';
  }

  return 'Focus on three things first: emergency fund, controlled spending, and disciplined investing. Ask me with your income, expenses, and target if you want a more specific plan.';
}

app.post('/api/ai-advice', async (req, res) => {
  const message = String(req.body?.message || '').trim();

  if (!message) {
    return res.status(400).json({ success: false, message: 'Question is required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return res.json({
      success: true,
      provider: 'fallback',
      reply: buildLocalAdvice(message),
    });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: 'You are a practical virtual Chartered Accountant and financial planner for Indian users. Give concise, accurate, action-oriented answers. Avoid hype, guarantee language, and legal certainty. When tax/legal details may depend on current law, say it is general guidance and suggest verification with current filings or a licensed CA.',
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: message }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('\n')
        .trim() || '';

    if (!geminiRes.ok || !reply) {
      throw new Error(data?.error?.message || 'Gemini returned an empty response.');
    }

    res.json({
      success: true,
      provider: 'gemini',
      reply,
    });
  } catch (err) {
    console.error('[/api/ai-advice] Error:', err.message);
    res.json({
      success: true,
      provider: 'fallback',
      reply: buildLocalAdvice(message),
      fallbackReason: err.message,
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    time: new Date(),
    server: 'NeuroTrade Backend',
  });
});
// Catch-all SPA
// YEH NAYI LINE ADD KARNI HAI
// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   🚀  StockQuest — Server LIVE                   ║
  ║   📡  http://localhost:${PORT}                      ║
  ║   📊  Yahoo Finance (free, no API key needed)    ║
  ║   🇮🇳  Indian: RELIANCE.NS, TCS.NS, ^NSEI        ║
  ║   🇺🇸  US:     AAPL, TSLA, NVDA                  ║
  ╚══════════════════════════════════════════════════╝
  `);
  // Warm up Yahoo Finance module on startup
  try {
    await getYahoo();
    console.log('  ✅  yahoo-finance2 loaded successfully\n');
  } catch (err) {
    console.error('  ⚠️  yahoo-finance2 failed to load:', err.message);
    console.error('  ⚠️  Run: npm install yahoo-finance2\n');
  }
});
