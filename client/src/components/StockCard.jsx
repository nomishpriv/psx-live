import React from 'react';

export default function StockCard({ stock }) {
  const isUp = stock.change >= 0;
  const id = stock.intraday;
  const news = stock.newsImpact;

  const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
  const avatarColor = colors[stock.symbol.charCodeAt(0) % colors.length];

  const confidenceColor = {
    HIGH: '#22c55e',
    MEDIUM: '#f59e0b',
    LOW: '#64748b'
  }[id?.confidence] || '#64748b';

  const newsLevelColor = {
    direct: '#22c55e',
    sector: '#f59e0b',
    mention: '#3b82f6'
  };

  const newsIcon = {
    direct: '🔥',
    sector: '📊',
    mention: '📰'
  };

  return (
    <div className={`stock-card ${id?.isBuy ? 'buy-card' : ''}`}>
      {/* Row 1 */}
      <div className="card-top">
        <div className="card-top-left">
          <div className="stock-avatar" style={{ backgroundColor: avatarColor }}>
            {stock.symbol[0]}
          </div>
          <div className="card-title">
            <div className="card-title-row">
              <span className="stock-symbol">{stock.symbol}</span>
              {id?.isBuy && (
                <span className="buy-badge" style={{ backgroundColor: confidenceColor }}>
                  BUY {id.confidence}
                </span>
              )}
              {news && (
                <span className="news-badge" style={{ backgroundColor: newsLevelColor[news.level] || '#555' }}>
                  {newsIcon[news.level] || '📰'} {news.signal}
                </span>
              )}
            </div>
            <div className="stock-name">{stock.name}</div>
          </div>
        </div>
        <div className="card-top-right">
          <div className="stock-price">{stock.price.toFixed(2)}</div>
          <div className={`stock-change ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="card-meta">
        <span>H: {stock.high.toFixed(2)}</span>
        <span>L: {stock.low.toFixed(2)}</span>
        <span>Vol: {(stock.volume / 1000).toFixed(1)}K</span>
      </div>

      {/* Row 3: Intraday */}
      {id?.isBuy && (
        <div className="intraday-row">
          <div className="id-box">
            <span className="id-label">Entry</span>
            <span className="id-value entry">{id.entry.toFixed(2)}</span>
          </div>
          <div className="id-box">
            <span className="id-label">T1</span>
            <span className="id-value target">{id.target1.toFixed(2)}</span>
          </div>
          <div className="id-box">
            <span className="id-label">T2</span>
            <span className="id-value target">{id.target2.toFixed(2)}</span>
          </div>
          <div className="id-box">
            <span className="id-label">SL</span>
            <span className="id-value stop">{id.stopLoss.toFixed(2)}</span>
          </div>
          <div className="id-box">
            <span className="id-label">R:R</span>
            <span className="id-value rr">{id.rr1}:1</span>
          </div>
        </div>
      )}

      {/* Row 4: News Impact */}
      {news && (
        <div className={`news-impact ${news.level}`}>
          <span className="news-icon">{newsIcon[news.level] || '📰'}</span>
          <div className="news-body">
            {news.level === 'direct' && news.trade && (
              <span>
                <strong>AI Trade:</strong> {news.trade.action} — {news.trade.reason}
                {news.trade.riskLevel && <span className={`risk-tag ${news.trade.riskLevel.toLowerCase()}`}>{news.trade.riskLevel}</span>}
              </span>
            )}
            {news.level === 'sector' && news.sectorImpact && (
              <span>
                <strong>Sector {news.sectorImpact.impact}:</strong> {news.sectorImpact.reason}
              </span>
            )}
            {news.level === 'mention' && news.headlines.length > 0 && (
              <span>{news.headlines[0].title}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}