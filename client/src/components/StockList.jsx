import React from 'react';
import StockCard from './StockCard';

export default function StockList({ stocks, activeTab }) {
  if (stocks.length === 0) {
    return (
      <div className="no-results">
        {activeTab === 'buy' ? 'No buy signals found right now.' : 'No stocks found.'}
      </div>
    );
  }

  return (
    <div className="stock-list">
      {stocks.map(stock => (
        <StockCard key={stock.symbol} stock={stock} activeTab={activeTab} />
      ))}
    </div>
  );
}