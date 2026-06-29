import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StockList from './components/StockList';

const API_URL = ''; // same origin

function App() {
  const [stocks, setStocks] = useState([]);
  const [kse100, setKse100] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('changeDesc');
  const [nextUpdateIn, setNextUpdateIn] = useState(60);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/stocks`);
      const data = await res.json();
      setStocks(data.stocks || []);
      setKse100(data.kse100);
      setLastUpdated(data.lastUpdated);
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, []);

  // Initial load + 1-minute polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Countdown timer (resets on every successful update)
  useEffect(() => {
    setNextUpdateIn(60);
    const timer = setInterval(() => {
      setNextUpdateIn(prev => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Update browser tab title with KSE100
  useEffect(() => {
    if (kse100) {
      const arrow = kse100.change >= 0 ? '▲' : '▼';
      document.title = `KSE100 ${kse100.indexValue.toLocaleString()} ${arrow} ${Math.abs(kse100.changePercent).toFixed(2)}% | PSX Live`;
    }
  }, [kse100]);

  const filtered = stocks.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'changeDesc': return b.changePercent - a.changePercent;
      case 'changeAsc': return a.changePercent - b.changePercent;
      case 'volume': return b.volume - a.volume;
      case 'name': return a.symbol.localeCompare(b.symbol);
      default: return b.changePercent - a.changePercent;
    }
  });

  return (
    <div className="app">
      <Header 
        kse100={kse100} 
        lastUpdated={lastUpdated} 
        nextUpdateIn={nextUpdateIn}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />
      {loading ? (
        <div className="loading">Loading market data...</div>
      ) : (
        <StockList stocks={sorted} />
      )}
    </div>
  );
}

export default App;