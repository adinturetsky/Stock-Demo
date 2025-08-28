# Stock Market Prediction Game

A static, client-side game that uses real historical stock prices from Alpha Vantage. Pick a ticker, see the prior 7 trading days plus a starting date, then predict whether the next day's price will go up or down. Scores update as you reveal each new day.

## Features
- Real data from Alpha Vantage (`TIME_SERIES_DAILY_ADJUSTED`)
- Random starting date within 7–100 days before today (trading days only)
- Chart.js line chart of closing prices
- Up/Down prediction with running score
- Handles invalid tickers and Alpha Vantage rate limit messages

## Local Usage
1. Open `index.html` in your browser (no build step needed).
2. Enter a valid stock ticker (e.g., `AAPL`, `MSFT`, `COF`) and click Load.
3. Click Predict Up/Down to play. Click End Game / Restart to finish and reset.

Note: This app calls Alpha Vantage directly from the browser. The provided API key is in `script.js` and will be visible to clients. For personal/educational use this is fine. For production, consider a server proxy and secret management.

## Deploy to GitHub Pages
Option A: Deploy from the `main` branch root (recommended for this static site)
1. Push these files to a new GitHub repository.
2. In GitHub, go to Repository → Settings → Pages.
3. Under Build and deployment, set Source = Deploy from a branch.
4. Set Branch = `main` and Folder = `/ (root)`. Save.
5. Wait for the Pages site to build. Your site will be at the URL shown on that page.

Option B: Deploy from the `gh-pages` branch
1. Create a `gh-pages` branch containing the same files in the repository root.
2. In Settings → Pages, set Source = Deploy from a branch and Branch = `gh-pages`.
3. Save and wait for publish.

## Configuration
- API Key: In `script.js`, update `API_KEY` if you want to use your own key.
- Rate Limits: Free Alpha Vantage keys are rate-limited (typically 5 requests/min, 500/day). This app fetches once per ticker load, then uses in-memory data for subsequent steps.

## Tech
- HTML/CSS/JS
- Chart.js
- Alpha Vantage API

## Disclaimer
This project is for educational purposes only and not financial advice. Data and availability are subject to Alpha Vantage limits and schedules.