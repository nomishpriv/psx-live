require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const stockService = require('./services/stockIntelService');

const app = express();
const PORT = process.env.PORT || 5000;

let marketData = { stocks: [], kse100: null, lastUpdated: null };

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

app.get('/api/stocks', (req, res) => res.json(marketData));
app.get('/api/stock/:symbol', (req, res) => {
  const stock = marketData.stocks.find(s => s.symbol === req.params.symbol.toUpperCase());
  stock ? res.json(stock) : res.status(404).json({ error: 'Not found' });
});
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const results = marketData.stocks.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 20);
  res.json(results);
});
app.get('/api/summary', (req, res) => {
  const a = marketData.stocks.filter(s => s.price > 0);
  res.json({
    total: marketData.stocks.length, active: a.length,
    gainers: a.filter(s => s.changePercent > 0).length,
    losers: a.filter(s => s.changePercent < 0).length,
    avgChange: +(a.reduce((x, b) => x + b.changePercent, 0) / a.length).toFixed(2) || 0
  });
});

// Only serve static files in production (when dist exists)
const distPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({
    status: 'PSX Live API running', stocks: marketData.stocks.length,
    kse100: marketData.kse100?.indexValue || null,
    message: 'Open http://localhost:3000 for the frontend (dev mode)'
  }));
}

app.listen(PORT, () => {
  console.log(`🚀 PSX Live server running on http://localhost:${PORT}`);
  console.log(`⏱️  Auto-refreshing market data every 60 seconds...`);
});