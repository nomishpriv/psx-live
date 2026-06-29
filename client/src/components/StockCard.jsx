import React from 'react';

export default function StockCard({ stock, activeTab }) {
  const isUp = stock.change >= 0;
  const arrow = isUp ? '▲' : '▼';
  const id = stock.intraday;
  
  const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
  const avatarColor = colors[stock.symbol.charCodeAt(0) % colors.length];

  const confidenceColor = {
    HIGH: '#22c55e',
    MEDIUM: '#f59e0b',
    LOW: '#64748b'
  }[id?.confidence] || '#64748b';

  return (
    <div className={`stock-card ${id?.isBuy ? 'buy-card' : ''}`}>
      <div className="stock-left">
        <div className="stock-avatar" style={{ backgroundColor: avatarColor }}>
          {stock.symbol[0]}
        </div>
        <div className="stock-info">
          <div className="stock-symbol-row">
            <span className="stock-symbol">{stock.symbol}</span>
            {id?.isBuy && (
              <span className="buy-badge" style={{ backgroundColor: confidenceColor }}>
                BUY {id.confidence}
              </span>
            )}
          </div>
          <div className="stock-name">{stock.name}</div>
          <div className="stock-meta">
            <span>HIGH {stock.high.toFixed(2)}</span>
            <span>LOW {stock.low.toFixed(2)}</span>
          </div>
          <div className="stock-volume">VOLUME {stock.volume.toLocaleString()}</div>
        </div>
      </div>

      <div className="stock-right">
        <div className="stock-price">{stock.price.toFixed(2)}</div>
        <div className={`stock-change ${isUp ? 'up' : 'down'}`}>
          {arrow} {Math.abs(stock.change).toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%)
        </div>
      </div>

      {/* Intraday Row */}
      {id?.isBuy && (
        <div className="intraday-row">
          <div className="id-item">
            <span className="id-label">Entry</span>
            <span className="id-value entry">{id.entry.toFixed(2)}</span>
          </div>
          <div className="id-item">
            <span className="id-label">T1</span>
            <span className="id-value target">{id.target1.toFixed(2)}</span>
          </div>
          <div className="id-item">
            <span className="id-label">T2</span>
            <span className="id-value target">{id.target2.toFixed(2)}</span>
          </div>
          <div className="id-item">
            <span className="id-label">SL</span>
            <span className="id-value stop">{id.stopLoss.toFixed(2)}</span>
          </div>
          <div className="id-item">
            <span className="id-label">R:R</span>
            <span className="id-value rr">{id.rr1}:1</span>
          </div>
        </div>
      )}
    </div>
  );
}