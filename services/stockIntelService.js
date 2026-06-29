const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE = 'https://app.stockintel.com/api';
const PHONE = process.env.STOCKINTEL_PHONE || '';
const PASSWORD = process.env.STOCKINTEL_PASSWORD || '';
const DEVICE_ID = process.env.DEVICE_ID || '';
const TOKEN_FILE = path.join(__dirname, '..', '.token.json');

const cache = new Map();
const TTL = 60000;

function getCache(k) {
  const e = cache.get(k);
  if (!e || Date.now() - e.t > TTL) { cache.delete(k); return null; }
  return e.d;
}
function setCache(k, d) { cache.set(k, { d, t: Date.now() }); }

/* ========== TOKEN ========== */
async function loadToken() {
  try {
    await fs.promises.access(TOKEN_FILE);
    const raw = await fs.promises.readFile(TOKEN_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data.expiry > Date.now()) return data.token;
  } catch { }
  return null;
}

async function saveToken(token) {
  try {
    const dir = path.dirname(TOKEN_FILE);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(TOKEN_FILE, JSON.stringify({ token, expiry: Date.now() + 3500000 }));
  } catch (e) {
    console.error('Failed to save token:', e.message);
  }
}

let loginPromise = null;

async function loginAndGetToken() {
  if (loginPromise) return loginPromise;
  loginPromise = (async () => {
    try {
      console.log('🔑 Auto-login...');
      const { data } = await axios.post(`${BASE}/login`, {
        phone: PHONE, password: PASSWORD,
        device: { id: DEVICE_ID, name: 'Chrome', os: 'windows', type: 'desktop' }
      }, { timeout: 10000 });

      const token = data?.data?.access_token;
      if (token) {
        await saveToken(token);
        console.log('✅ Auto-login success');
        return token;
      }
      return null;
    } catch (e) {
      if (e.response?.status === 429) console.log('⏳ Rate limited — use manual token');
      return null;
    } finally {
      loginPromise = null;
    }
  })();
  return loginPromise;
}

async function getToken() {
  const stored = await loadToken();
  if (stored) return stored;
  const newToken = await loginAndGetToken();
  if (newToken) return newToken;
  return process.env.STOCKINTEL_TOKEN || '';
}

/* ========== API ========== */
const api = axios.create({ baseURL: BASE, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  config.headers.Authorization = `Bearer ${await getToken()}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 403) {
      console.log('🔄 Token expired, refreshing...');
      try { await fs.promises.unlink(TOKEN_FILE); } catch { }
      const newToken = await loginAndGetToken();
      if (newToken) {
        err.config.headers.Authorization = `Bearer ${newToken}`;
        return api(err.config);
      }
    }
    return Promise.reject(err);
  }
);

/* ========== SHARED MARKET FETCH ========== */
let marketDataPromise = null;

async function fetchMarketData() {
  const cached = getCache('market_raw');
  if (cached) return cached;
  if (marketDataPromise) return marketDataPromise;

  marketDataPromise = (async () => {
    try {
      const { data } = await api.get('/market');
      setCache('market_raw', data);
      return data;
    } finally {
      marketDataPromise = null;
    }
  })();
  return marketDataPromise;
}

/* ========== KSE100 VOLUME ========== */
let kseVolumeCache = null;
let kseVolumeLastFetch = 0;

function analyzeKSE100Volume(kseData) {
  if (!kseData) return null;
  const current = +kseData.v || 0;
  const avg10 = +kseData.v10a || 1;
  const avg30 = +kseData.v30a || 1;
  const ratio10 = (current / avg10) * 100;
  const ratio30 = (current / avg30) * 100;

  let level, color, signal, emoji;
  if (ratio10 > 200) {
    level = 'HEAVY_INSTITUTIONAL'; color = '#a855f7'; emoji = '🔴🔴';
    signal = 'Major institutional activity — strong momentum expected';
  } else if (ratio10 > 150) {
    level = 'INSTITUTIONAL'; color = '#f97316'; emoji = '🔴';
    signal = 'Smart money entering — follow the trend';
  } else if (ratio10 > 120) {
    level = 'ELEVATED'; color = '#f59e0b'; emoji = '🟡';
    signal = 'Above average volume — increased interest';
  } else if (ratio10 > 80) {
    level = 'NORMAL'; color = '#22c55e'; emoji = '🟢';
    signal = 'Normal retail volume — trade technicals';
  } else {
    level = 'LOW'; color = '#64748b'; emoji = '⚪';
    signal = 'Below average volume — low participation';
  }

  return {
    currentVolume: current, avg10Day: avg10, avg30Day: avg30,
    ratioVs10Day: +ratio10.toFixed(1), ratioVs30Day: +ratio30.toFixed(1),
    level, color, emoji, signal,
    indexValue: +kseData.c || 0, change: +kseData.ch || 0,
    changePercent: +kseData.pch ? +(kseData.pch * 100).toFixed(2) : 0,
    dayHigh: +kseData.h || 0, dayLow: +kseData.l || 0, open: +kseData.o || 0
  };
}

async function getKSE100Volume() {
  const now = Date.now();
  if (kseVolumeCache && (now - kseVolumeLastFetch) < TTL) return kseVolumeCache;
  try {
    const data = await fetchMarketData();
    const kseData = data?.data?.in?.KSE100;
    if (!kseData) return null;
    const analysis = analyzeKSE100Volume(kseData);
    kseVolumeCache = analysis;
    kseVolumeLastFetch = now;
    return analysis;
  } catch (e) {
    return null;
  }
}

/* ========== INTRADAY SIGNAL ENGINE ========== */
function calculateIntraday(stock) {
  const {
    price, open, high, low, prevClose, rsi, volume, volAvg10d,
    pivot, r1, r2, r3, s1, s2, upperCircuit, lowerCircuit,
    changePercent, bidAskRatio
  } = stock;

  const checks = {
    bullish: price > open,
    abovePrevClose: price > prevClose,
    rsiGood: rsi > 40 && rsi < 75,
    volumeGood: volume > (volAvg10d * 0.8),
    abovePivot: price >= pivot,
    positiveChange: changePercent > 0,
    bidAskGood: bidAskRatio > 0.8
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const isBuy = passed >= 5;

  let entry = price;
  if (price < pivot) {
    entry = +(pivot + 0.01).toFixed(2);
  } else if (price > r1 && price < r2) {
    entry = price;
  } else {
    entry = +(price + 0.05).toFixed(2);
  }

  let stopLoss = Math.max(s1 || 0, low || 0, +(entry * 0.985).toFixed(2));
  if (stopLoss >= entry) stopLoss = +(entry * 0.985).toFixed(2);
  if (stopLoss < lowerCircuit) stopLoss = lowerCircuit;

  const target1 = r1 || +(entry * 1.02).toFixed(2);
  const target2 = r2 || +(entry * 1.04).toFixed(2);
  const target3 = r3 || upperCircuit || +(entry * 1.06).toFixed(2);

  const risk = +(entry - stopLoss).toFixed(2);
  const reward1 = +(target1 - entry).toFixed(2);
  const reward2 = +(target2 - entry).toFixed(2);
  const reward3 = +(target3 - entry).toFixed(2);

  const rr1 = risk > 0 ? +(reward1 / risk).toFixed(2) : 0;
  const rr2 = risk > 0 ? +(reward2 / risk).toFixed(2) : 0;
  const rr3 = risk > 0 ? +(reward3 / risk).toFixed(2) : 0;

  let confidence = 'LOW';
  if (passed >= 6) confidence = 'HIGH';
  else if (passed >= 4) confidence = 'MEDIUM';

  return {
    isBuy,
    entry: +entry.toFixed(2),
    stopLoss: +stopLoss.toFixed(2),
    target1: +target1.toFixed(2),
    target2: +target2.toFixed(2),
    target3: +target3.toFixed(2),
    risk: risk > 0 ? risk : 0.01,
    rr1, rr2, rr3,
    confidence,
    score: passed,
    checks
  };
}

/* ========== FETCH ALL STOCKS ========== */
let fetchPromise = null;

async function fetchAllStocks() {
  const cached = getCache('all');
  if (cached) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    console.log('📡 Fetching from StockIntel...');
    try {
      const data = await fetchMarketData();
      const raw = data?.data?.eq;
      if (!raw) return [];

      const kseData = data?.data?.in?.KSE100;
      if (kseData) {
        const volAnalysis = analyzeKSE100Volume(kseData);
        kseVolumeCache = volAnalysis;
        kseVolumeLastFetch = Date.now();
        console.log(`📊 KSE100 Vol: ${volAnalysis.emoji} ${volAnalysis.level} (${volAnalysis.ratioVs10Day}% of 10d avg)`);
      }

      const stocks = Object.entries(raw)
        .filter(([sym, s]) => {
          if (!s.c || +s.c <= 0) return false;
          // ONLY ALLSHR stocks
          if (!s.li || !Array.isArray(s.li) || !s.li.includes('ALLSHR')) return false;
          return true;
        })
        .map(([sym, s]) => {
          const price = +s.c;
          const open = +s.o;
          const high = +s.h;
          const low = +s.l;
          const prevClose = +s.ldcp;
          const rsi = +(s.rsi ?? 0);
          const volume = +s.v;
          const volAvg10d = +(s.va10d ?? 0);
          const pivot = +(s.pp?.pp ?? 0);
          const r1 = +(s.pp?.r1 ?? 0);
          const r2 = +(s.pp?.r2 ?? 0);
          const r3 = +(s.pp?.r3 ?? 0);
          const s1 = +(s.pp?.s1 ?? 0);
          const s2 = +(s.pp?.s2 ?? 0);
          const s3 = +(s.pp?.s3 ?? 0);
          const upperCircuit = +s.uc;
          const lowerCircuit = +s.lc;
          const changePercent = +((s.pch || 0) * 100).toFixed(2);
          const bidAskRatio = (s.bidv && s.askv && +s.askv > 0) ? +((+s.bidv / +s.askv)).toFixed(2) : 0;

          const stock = {
            symbol: sym, name: s.nm, price, open, high, low,
            volume, change: +s.ch, changePercent,
            prevClose, prevVolume: +s.ldcv,
            rsi,
            upperCircuit, lowerCircuit,
            pivot, r1, r2, r3, s1, s2, s3,
            indices: s.li || [],
            perf1w: +(s.p1w ?? 0), perf1m: +(s.p1m ?? 0), perf3m: +(s.p3m ?? 0), perf1y: +(s.p1y ?? 0), perfYtd: +(s.pytd ?? 0),
            eps: +(s.eps ?? 0), dps: +(s.dps ?? 0), pe: +(s.pr ?? 0), divYield: +(s.di ?? 0),
            volAvg1w: +(s.vaw ?? 0), volAvg10d, volAvg1m: +(s.vam ?? 0), volAvg30d: +(s.v30a ?? 0),
            beta1m: +(s.bt?.['1m'] ?? 0), beta1y: +(s.bt?.['1y'] ?? 0),
            bidPrice: s.bidp ? +s.bidp : 0, bidVolume: s.bidv ? +s.bidv : 0,
            askPrice: s.askp ? +s.askp : 0, askVolume: s.askv ? +s.askv : 0,
            spreadAbs: (s.askp && s.bidp) ? +(+s.askp - +s.bidp).toFixed(2) : 0,
            spreadPct: (s.askp && s.bidp && +s.bidp > 0) ? +(((+s.askp - +s.bidp) / +s.bidp) * 100).toFixed(2) : 0,
            bidAskRatio,
            status: 'ACTIVE', lastUpdate: s.d,
            signal: (() => {
              const pch = +s.pch || 0;
              const r = +(s.rsi ?? 0);
              const ratio = (s.bidv && s.askv && +s.askv > 0) ? +s.bidv / +s.askv : 1;
              let score = 0;
              if (pch > 0.01) score++;
              if (pch < -0.01) score--;
              if (r < 40) score++;
              if (r > 60) score--;
              if (ratio > 1.2) score++;
              if (ratio < 0.8) score--;
              return score >= 2 ? 'STRONG_BUY' : score === 1 ? 'BUY' : score === -1 ? 'SELL' : score <= -2 ? 'STRONG_SELL' : 'NEUTRAL';
            })(),
          };

          stock.intraday = calculateIntraday(stock);
          return stock;
        });

      console.log(`✅ ${stocks.length} ALLSHR stocks loaded | Buy signals: ${stocks.filter(s => s.intraday.isBuy).length}`);
      setCache('all', stocks);
      return stocks;
    } catch (e) {
      console.error('❌ Fetch failed:', e.response?.status || e.message);
      return [];
    } finally {
      fetchPromise = null;
    }
  })();
  return fetchPromise;
}

async function getStock(s) {
  if (!s || typeof s !== 'string') return null;
  const all = await fetchAllStocks();
  return all.find(x => x.symbol === s.toUpperCase()) || null;
}

async function getSummary() {
  const all = await fetchAllStocks();
  const a = all.filter(s => s.price > 0);
  const buyStocks = all.filter(s => s.intraday?.isBuy);
  return {
    total: all.length,
    active: a.length,
    gainers: a.filter(s => s.changePercent > 0).length,
    losers: a.filter(s => s.changePercent < 0).length,
    avgChange: +(a.reduce((x, b) => x + b.changePercent, 0) / a.length).toFixed(2) || 0,
    buySignals: buyStocks.length
  };
}

async function searchStocks(q) {
  if (!q || typeof q !== 'string') return [];
  const all = await fetchAllStocks();
  const ql = q.toLowerCase();
  return all.filter(s => s.symbol.toLowerCase().includes(ql) || s.name.toLowerCase().includes(ql)).slice(0, 20);
}

async function getOpportunities(n = 10) {
  const all = await fetchAllStocks();
  return all.filter(s => s.price > 0 && s.volume > 10000).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, n);
}

async function getBuySignals() {
  const all = await fetchAllStocks();
  return all
    .filter(s => s.intraday?.isBuy)
    .sort((a, b) => b.intraday.score - a.intraday.score);
}

function clearCache() {
  cache.clear();
  kseVolumeCache = null;
  kseVolumeLastFetch = 0;
}

module.exports = {
  fetchAllStocks, getStock, getSummary, searchStocks,
  getOpportunities, clearCache, getKSE100Volume, getBuySignals, getToken
};