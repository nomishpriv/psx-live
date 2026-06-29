import React from 'react';

export default function StockCard({ stock }) {
  const isUp = stock.change >= 0;
  const arrow = isUp ? '▲' : '▼';
  
  // Consistent avatar color per symbol
  const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
  const avatarColor = colors[stock.symbol.charCodeAt(0) % colors.length];

  return (
    <div className="stock-card">
      <div className="stock-left">
        <div className="stock-avatar" style={{ backgroundColor: avatarColor }}>
          {stock.symbol[0]}
        </div>
        <div className="stock-info">
          <div className="stock-symbol">{stock.symbol}</div>
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
    </div>
  );
}