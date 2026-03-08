# Portfolio Planner — Projection & Estimation Model

**Author:** Manus AI
**Last Updated:** March 2026

---

## Overview

The Portfolio Planner uses a fundamental-analysis-based projection engine to estimate future stock prices and portfolio values. The model follows a calculation chain inspired by the *1000x Stocks* methodology:

> **Revenue → Net Margin → Net Income → EPS → P/E → Target Price**

Every stock in the portfolio is evaluated under three independent scenarios (Bear, Base, Bull), each with its own set of growth assumptions and valuation multiples. The portfolio-level projection is then computed by weighting each stock's future value according to its allocation percentage and summing the results.

---

## Data Model

### Current Fundamentals (per stock)

Each stock carries a snapshot of its current financial data, typically sourced from Yahoo Finance. These values serve as the starting point for all projections.

| Field | Unit | Description |
| :--- | :--- | :--- |
| `currentPrice` | $ | Current stock price |
| `currentMarketCapB` | $B | Market capitalization |
| `currentRevenueB` | $B | Trailing twelve-month (TTM) revenue |
| `currentNetIncomeB` | $B | TTM net income |
| `currentEPS` | $ | TTM earnings per share |
| `currentEPSForward` | $ | Forward EPS (analyst consensus) |
| `currentSharesB` | B | Shares outstanding (in billions) |
| `currentFCFB` | $B | TTM free cash flow |
| `currentNetMarginPct` | % | TTM net margin |
| `currentGrossMarginPct` | % | TTM gross margin |
| `currentRevenueGrowthPct` | % | Year-over-year revenue growth |
| `currentPE` | x | Trailing P/E ratio |
| `currentPEForward` | x | Forward P/E ratio |
| `currentPS` | x | Price-to-Sales ratio |

### Scenario Inputs (per scenario per stock)

Each of the three scenarios (Bear, Base, Bull) has its own set of adjustable parameters:

| Parameter | Unit | Description |
| :--- | :--- | :--- |
| `netIncomeGrowthRate` | % | Annual net income growth rate (used by EPS method) |
| `revenueGrowthRate` | % | Annual revenue growth rate (used by P/E, P/S, P/FCF methods) |
| `netMarginPct` | % | Projected net margin at the exit year |
| `peMultiple` | x | Exit P/E multiple (point estimate) |
| `peMultipleLow` | x | Low end of P/E range (optional, for range-based valuation) |
| `peMultipleHigh` | x | High end of P/E range (optional, for range-based valuation) |
| `psMultiple` | x | Exit Price-to-Sales multiple |
| `fcfMultiple` | x | Exit Price-to-Free-Cash-Flow multiple |
| `fcfMarginPct` | % | Projected FCF margin at the exit year |
| `targetPriceOverride` | $ | Manual target price override (for crypto/ETF) |

---

## Valuation Methods

The application supports five valuation methods. Each stock can be assigned a preferred method, and the engine will fall back to alternative methods if the primary one produces a non-positive result.

### 1. EPS Method (Default)

This is the primary and most commonly used method. It projects future net income directly using a net income growth rate, then derives EPS and applies a P/E multiple.

**Calculation:**

```
Future Net Income ($B) = currentNetIncomeB × (1 + netIncomeGrowthRate / 100) ^ N
Future EPS ($)         = Future Net Income / currentSharesB
Target Price ($)       = Future EPS × peMultiple
```

When both `peMultipleLow` and `peMultipleHigh` are provided, the engine uses their midpoint as the effective P/E multiple. The `calcTargetPriceRange` function can be used to obtain the full low/mid/high price range.

**Example:** A company with $2B net income, 15% annual growth, 0.5B shares, and a 25x P/E multiple over 5 years:

```
Future Net Income = $2B × (1.15)^5 = $4.02B
Future EPS        = $4.02B / 0.5B  = $8.04
Target Price      = $8.04 × 25     = $201.10
```

### 2. Revenue P/E Method

This method starts from revenue, applies a net margin to derive net income, then follows the same EPS-to-price chain. It is useful when revenue growth is more predictable than earnings growth.

**Calculation:**

```
Future Revenue ($B)    = currentRevenueB × (1 + revenueGrowthRate / 100) ^ N
Future Net Income ($B) = Future Revenue × (netMarginPct / 100)
Future EPS ($)         = Future Net Income / currentSharesB
Target Price ($)       = Future EPS × peMultiple
```

### 3. P/S (Price-to-Sales) Method

This method is commonly used for high-growth companies that may not yet be profitable. It values the company based on its projected revenue.

**Calculation:**

```
Future Revenue ($B)     = currentRevenueB × (1 + revenueGrowthRate / 100) ^ N
Revenue Per Share ($)   = Future Revenue / currentSharesB
Target Price ($)        = Revenue Per Share × psMultiple
```

### 4. P/FCF (Price-to-Free-Cash-Flow) Method

This method uses free cash flow, which many investors consider a more reliable indicator of financial health than net income because it accounts for capital expenditures.

**Calculation:**

```
Future Revenue ($B)  = currentRevenueB × (1 + revenueGrowthRate / 100) ^ N
Future FCF ($B)      = Future Revenue × (fcfMarginPct / 100)
FCF Per Share ($)    = Future FCF / currentSharesB
Target Price ($)     = FCF Per Share × fcfMultiple
```

### 5. Manual Price Override

For assets like cryptocurrencies or ETFs where fundamental analysis may not apply, the user can set a `targetPriceOverride` directly. If this value is positive, it is used as the target price without any calculation.

### Fallback Chain

If the selected valuation method produces a zero or negative result (e.g., negative net income for a pre-profit company), the engine automatically falls back through alternative methods in a defined order:

| Selected Method | Fallback Order |
| :--- | :--- |
| EPS | EPS → Revenue P/E → P/S → P/FCF |
| Revenue P/E | Revenue P/E → P/S → P/FCF |
| P/S | P/S → Revenue P/E → P/FCF |
| P/FCF | P/FCF → P/S → Revenue P/E |
| Manual Price | Override → EPS fallback chain |

---

## Scenario Framework: Bear, Base, and Bull

The three scenarios represent different assumptions about a company's future performance. They are fully independent — each scenario has its own growth rates, margins, and multiples.

### Default Scenario Values

When a new stock is added without specific data, the following defaults are applied:

| Parameter | Bear | Base | Bull |
| :--- | ---: | ---: | ---: |
| Net Income Growth Rate | 8% | 15% | 25% |
| Revenue Growth Rate | 5% | 10% | 20% |
| Net Margin | 8% | 10% | 15% |
| P/E Multiple | 15x | 20x | 30x |
| P/E Multiple Low | 12x | 15x | 25x |
| P/E Multiple High | 18x | 25x | 40x |
| P/S Multiple | 3x | 5x | 8x |
| P/FCF Multiple | 15x | 20x | 30x |
| FCF Margin | 5% | 8% | 12% |

### Auto-Derived Scenario Values

When a stock is loaded with real market data, the application auto-derives scenario parameters from the current fundamentals:

The **Base case** typically mirrors current metrics (current P/E becomes the base P/E, current revenue growth becomes the base growth rate, etc.). The **Bear case** is set to roughly 30% below the base values, and the **Bull case** is set to roughly 80% above. The `niGrowthAutoSet` flag tracks whether the net income growth rate was auto-derived or manually edited by the user.

---

## Portfolio-Level Projections

### Per-Stock Future Value

For each stock in the portfolio, the future value of the investment is calculated as:

```
Return Multiple = Target Price / Current Price
Future Value    = Invested Amount × Return Multiple
```

Where `Invested Amount = (allocationPct / 100) × totalCapital`.

### CAGR (Compound Annual Growth Rate)

The CAGR is calculated from the return multiple over the projection horizon:

```
CAGR (%) = ((Return Multiple) ^ (1 / N) - 1) × 100
```

Where `N` is the number of projection years (default: 5).

### Total Portfolio Value

The total projected portfolio value is the sum of all stock future values plus the cash allocation (which does not grow):

```
Total Future Value = Σ (Stock Future Values) + Cash Value
Cash Value         = (cashPct / 100) × totalCapital
```

### Year-by-Year Trajectory

The engine also computes a year-by-year trajectory for charting purposes. For each year `y` from 0 to N:

```
Year y Value = Σ (Invested Amount × Return Multiple at year y) + Cash Value
```

This produces a smooth growth curve for each scenario, enabling the area charts shown in the Analytics Panel.

### Portfolio CAGR

The overall portfolio CAGR is derived from the total return:

```
Portfolio CAGR = ((Total Future Value / Total Capital) ^ (1 / N) - 1) × 100
```

---

## Target Price Range (P/E Range)

For the EPS valuation method, if both `peMultipleLow` and `peMultipleHigh` are provided, the engine can compute a price range:

```
Low Price  = Future EPS × peMultipleLow
Mid Price  = Future EPS × ((peMultipleLow + peMultipleHigh) / 2)
High Price = Future EPS × peMultipleHigh
```

This allows the Projection Drawer to display a confidence band around the target price for each scenario.

---

## Allocation Model

### Percentage-Based Allocation

Each stock in a portfolio has an `allocationPct` (0–100) representing its weight. The remaining percentage is automatically assigned to `cashPct`:

```
cashPct = 100 - Σ (stock allocationPct values)
```

### Capital Adjustment

When the user changes the total capital amount, the system preserves dollar amounts rather than percentages. Each stock's allocation percentage is recalculated:

```
New Allocation % = (Dollar Amount / New Total Capital) × 100
Dollar Amount    = (Old Allocation % / 100) × Old Total Capital
```

This ensures that changing the capital slider does not alter the relative dollar positions.

---

## Formatting Utilities

The projection engine includes several formatting functions used throughout the UI:

| Function | Purpose | Example Output |
| :--- | :--- | :--- |
| `formatCurrency(value, compact)` | Formats dollar values with optional compact notation | `$1,234` or `$1.2K` |
| `formatPct(value, decimals)` | Formats percentage with sign | `+15.3%` or `-2.1%` |
| `formatMultiple(value)` | Formats return multiples | `2.50x` |

---

## File Reference

| File | Purpose |
| :--- | :--- |
| `client/src/lib/types.ts` | Type definitions for `ScenarioProjection`, `StockProjections`, `Stock`, `Portfolio` |
| `client/src/lib/projections.ts` | Core calculation engine: `calcTargetPrice`, `calcReturnMultiple`, `calcCAGR`, `calcPortfolioProjection` |
| `client/src/lib/sampleData.ts` | Pre-loaded sample stocks with real market data (Feb 2026) |
| `client/src/lib/store.ts` | Zustand store managing portfolios, allocations, and stock library state |
| `client/src/components/ProjectionDrawer.tsx` | UI for editing per-stock scenario inputs |
| `client/src/components/AnalyticsPanel.tsx` | Portfolio analytics: allocation charts, scenario comparison, growth projections |
| `client/src/components/PortfolioComparison.tsx` | Side-by-side comparison of multiple portfolios |
