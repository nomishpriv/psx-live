require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const stockService = require('./services/stockIntelService');

// Optional news service — app works fine without it
let newsService = null;
try {
  newsService = require('./services/newsService');
} catch (e) {
  console.log('⚠️  News service not loaded:', e.message);
}

const app = express();
const PORT = process.env.PORT || 5000;

let marketData = { stocks: [], kse100: null, lastUpdated: null };
let newsData = null;

/* ========== MARKET DATA ========== */
async function refreshData() {
  try {
    const [stocks, kse100] = await Promise.all([
      stockService.fetchAllStocks(),
      stockService.getKSE100Volume()
    ]);
    marketData = { stocks, kse100, lastUpdated: new Date().toISOString() };
    console.log(`[${new Date().toLocaleTimeString()}] ✅ ${stocks.length} stocks | KSE100 ${kse100?.indexValue?.toLocaleString() || '—'}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Refresh failed:`, err.message);
  }
}

refreshData();
setInterval(refreshData, 60000);

/* ========== NEWS DATA ========== */
async function refreshNews() {
  if (!newsService) return;
  try {
    newsData = await newsService.getNewsImpact();
    console.log(`[${new Date().toLocaleTimeString()}] 📰 News: ${newsData.headlines.length} headlines | Signal: ${newsData.aiAnalysis?.signal || '—'}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ News failed:`, err.message);
  }
}

refreshNews();
setInterval(refreshNews, 300000); // every 5 minutes

/* ========== NEWS ENRICHMENT ========== */
function enrichWithNews(stocks) {
  if (!newsData || !newsData.aiAnalysis) return stocks;

  const { aiAnalysis, headlines } = newsData;
  const topTradesMap = new Map();
  (aiAnalysis.topTrades || []).forEach(t => {
    if (t.ticker) topTradesMap.set(t.ticker.toUpperCase(), t);
  });

  // Reverse sector map: ticker -> sector name
  const tickerToSector = new Map();
  if (newsService?.SECTOR_TICKERS) {
    Object.entries(newsService.SECTOR_TICKERS).forEach(([sector, tickers]) => {
      tickers.forEach(t => tickerToSector.set(t.toUpperCase(), sector));
    });
  }

  const sectorImpacts = new Map();
  (aiAnalysis.affectedSectors || []).forEach(s => {
    sectorImpacts.set(s.sector, s);
  });

  // Headline direct mentions
  const mentions = new Map();
  (headlines || []).forEach(h => {
    const title = h.title?.toLowerCase() || '';
    stocks.forEach(stock => {
      const sym = stock.symbol.toLowerCase();
      const name = stock.name?.toLowerCase() || '';
      if (title.includes(sym) || title.includes(name)) {
        if (!mentions.has(stock.symbol)) mentions.set(stock.symbol, []);
        mentions.get(stock.symbol).push(h);
      }
    });
  });

  return stocks.map(stock => {
    const sym = stock.symbol.toUpperCase();
    const sector = tickerToSector.get(sym);
    const impact = {
      hasNews: false,
      level: 'none',
      signal: null,
      trade: null,
      sectorImpact: null,
      headlines: [],
      summary: aiAnalysis.summary || null
    };

    // 1. Direct AI trade signal
    if (topTradesMap.has(sym)) {
      impact.hasNews = true;
      impact.level = 'direct';
      impact.trade = topTradesMap.get(sym);
      impact.signal = impact.trade.action;
    }

    // 2. Sector impact
    if (sector && sectorImpacts.has(sector)) {
      const si = sectorImpacts.get(sector);
      if (!impact.hasNews) { impact.hasNews = true; impact.level = 'sector'; }
      impact.sectorImpact = si;
      if (!impact.signal) {
        impact.signal = si.impact === 'POSITIVE' ? 'BUY' : si.impact === 'NEGATIVE' ? 'SELL' : 'HOLD';
      }
    }

    // 3. Direct headline mention
    if (mentions.has(sym)) {
      const hls = mentions.get(sym);
      if (!impact.hasNews) { impact.hasNews = true; impact.level = 'mention'; }
      impact.headlines = hls.slice(0, 2);
      if (!impact.signal) impact.signal = 'NEWS';
    }

    return { ...stock, newsImpact: impact.hasNews ? impact : null };
  });
}

/* ========== API ROUTES ========== */
app.get('/api/stocks', (req, res) => {
  const enriched = enrichWithNews(marketData.stocks);
  res.json({ ...marketData, stocks: enriched });
});

app.get('/api/stock/:symbol', (req, res) => {
  const enriched = enrichWithNews(marketData.stocks);
  const stock = enriched.find(s => s.symbol === req.params.symbol.toUpperCase());
  stock ? res.json(stock) : res.status(404).json({ error: 'Not found' });
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const enriched = enrichWithNews(marketData.stocks);
  const results = enriched.filter(s => 
    s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  ).slice(0, 20);
  res.json(results);
});

app.get('/api/summary', (req, res) => {
  const enriched = enrichWithNews(marketData.stocks);
  const a = enriched.filter(s => s.price > 0);
  res.json({
    total: enriched.length,
    active: a.length,
    gainers: a.filter(s => s.changePercent > 0).length,
    losers: a.filter(s => s.changePercent < 0).length,
    avgChange: +(a.reduce((x, b) => x + b.changePercent, 0) / a.length).toFixed(2) || 0,
    newsStocks: enriched.filter(s => s.newsImpact).length
  });
});

app.get('/api/news', async (req, res) => {
  if (!newsService) return res.status(503).json({ error: 'News service not available' });
  try {
    const data = await newsService.getNewsImpact({ forceRefresh: req.query.refresh === 'true' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ========== STATIC FILES ========== */
const distPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({
    status: 'PSX Live API running',
    stocks: marketData.stocks.length,
    kse100: marketData.kse100?.indexValue || null,
    message: 'Open http://localhost:3000 for the frontend (dev mode)'
  }));
}

app.listen(PORT, () => {
  console.log(`🚀 PSX Live server running on http://localhost:${PORT}`);
  console.log(`⏱️  Market refresh: 60s | News refresh: 5min`);
});