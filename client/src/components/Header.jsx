import React from 'react';

export default function Header({ 
  kse100, lastUpdated, nextUpdateIn, 
  searchQuery, setSearchQuery, 
  sortBy, setSortBy,
  activeTab, setActiveTab,
  buyCount
}) {
  const isUp = kse100 ? kse100.change >= 0 : true;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  const timeStr = lastUpdated 
    ? new Date(lastUpdated).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) 
    : '—';

  return (
    <header className="header">
      <div className="header-top">
        <div className="market-status">
          <span className="status-dot"></span>
          <span>OPEN</span>
        </div>
        
        <div className="kse100">
          <span className="index-name">KSE100</span>
          <span className="index-value">{kse100?.indexValue?.toLocaleString() || '—'}</span>
          <span className={`index-change ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(kse100?.change || 0).toFixed(0)} ({Math.abs(kse100?.changePercent || 0).toFixed(2)}%)
          </span>
        </div>

        <div className="update-info">
          <div className="update-date">{dateStr} {timeStr}</div>
          <div className="countdown">Next: {nextUpdateIn}s</div>
        </div>
      </div>

      <div className="header-tabs">
        <div 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          KSE ALL
        </div>
        <div 
          className={`tab ${activeTab === 'buy' ? 'active' : ''}`}
          onClick={() => setActiveTab('buy')}
        >
          Buy Signals
          {buyCount > 0 && <span className="tab-badge">{buyCount}</span>}
        </div>
      </div>

      <div className="header-controls">
        <input 
          type="text" 
          className="search-input"
          placeholder="Search symbol or name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="changeDesc">Top Gainers</option>
          <option value="changeAsc">Top Losers</option>
          <option value="volume">Volume</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>
    </header>
  );
}