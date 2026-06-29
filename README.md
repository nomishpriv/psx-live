# PSX Live

1-minute live Pakistan Stock Exchange (PSX) ticker built with Node.js + React.

## Features
- Auto-login to StockIntel API
- 846 PSX stocks with live prices
- KSE100 index tracking
- 1-minute auto-refresh
- Search & sort by gainers/losers/volume

## Setup
1. Clone repo
2. `npm install` in root and `cd client && npm install`
3. Create `.env` file with your StockIntel credentials
4. `npm run dev`

## Tech Stack
- Backend: Node.js + Express
- Frontend: React + Vite
- Data: StockIntel API