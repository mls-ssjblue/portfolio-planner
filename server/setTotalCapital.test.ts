/**
 * Unit test for the setTotalCapital logic:
 * When total capital changes, dollar amounts per stock stay fixed
 * and percentages are recalculated from the new capital.
 */
import { describe, expect, it } from "vitest";

// Pure function extracted from the store logic for testing
function recalcAllocationsForNewCapital(
  stocks: Array<{ stockId: string; allocationPct: number }>,
  cashPct: number,
  oldCapital: number,
  newCapital: number
): { stocks: Array<{ stockId: string; allocationPct: number }>; cashPct: number } {
  if (oldCapital === 0 || newCapital === 0) {
    return { stocks, cashPct };
  }
  const newStocks = stocks.map((st) => {
    const dollarAmt = (st.allocationPct / 100) * oldCapital;
    const newPct = parseFloat(((dollarAmt / newCapital) * 100).toFixed(4));
    return { ...st, allocationPct: newPct };
  });
  const cashDollar = (cashPct / 100) * oldCapital;
  const newCashPct = parseFloat(((cashDollar / newCapital) * 100).toFixed(4));
  return { stocks: newStocks, cashPct: Math.max(0, newCashPct) };
}

describe("setTotalCapital: preserve dollar amounts, recalculate percentages", () => {
  it("doubles capital → halves all percentages (dollar amounts unchanged)", () => {
    const stocks = [
      { stockId: "AMD", allocationPct: 40 },
      { stockId: "NVDA", allocationPct: 30 },
    ];
    const cashPct = 30;
    const oldCapital = 100_000;
    const newCapital = 200_000;

    const result = recalcAllocationsForNewCapital(stocks, cashPct, oldCapital, newCapital);

    // AMD: $40,000 / $200,000 = 20%
    expect(result.stocks[0].allocationPct).toBeCloseTo(20, 2);
    // NVDA: $30,000 / $200,000 = 15%
    expect(result.stocks[1].allocationPct).toBeCloseTo(15, 2);
    // Cash: $30,000 / $200,000 = 15%
    expect(result.cashPct).toBeCloseTo(15, 2);
  });

  it("halves capital → doubles all percentages (dollar amounts unchanged)", () => {
    const stocks = [
      { stockId: "AMD", allocationPct: 40 },
      { stockId: "NVDA", allocationPct: 20 },
    ];
    const cashPct = 40;
    const oldCapital = 100_000;
    const newCapital = 50_000;

    const result = recalcAllocationsForNewCapital(stocks, cashPct, oldCapital, newCapital);

    // AMD: $40,000 / $50,000 = 80%
    expect(result.stocks[0].allocationPct).toBeCloseTo(80, 2);
    // NVDA: $20,000 / $50,000 = 40%
    expect(result.stocks[1].allocationPct).toBeCloseTo(40, 2);
    // Cash: $40,000 / $50,000 = 80%
    expect(result.cashPct).toBeCloseTo(80, 2);
  });

  it("same capital → percentages unchanged", () => {
    const stocks = [
      { stockId: "AMD", allocationPct: 42.27 },
      { stockId: "NVDA", allocationPct: 11.89 },
    ];
    const cashPct = 45.84;
    const capital = 500_891;

    const result = recalcAllocationsForNewCapital(stocks, cashPct, capital, capital);

    expect(result.stocks[0].allocationPct).toBeCloseTo(42.27, 2);
    expect(result.stocks[1].allocationPct).toBeCloseTo(11.89, 2);
    expect(result.cashPct).toBeCloseTo(45.84, 2);
  });

  it("handles zero old capital gracefully (no division by zero)", () => {
    const stocks = [{ stockId: "AMD", allocationPct: 50 }];
    const result = recalcAllocationsForNewCapital(stocks, 50, 0, 100_000);
    // Should return unchanged when oldCapital is 0
    expect(result.stocks[0].allocationPct).toBe(50);
    expect(result.cashPct).toBe(50);
  });

  it("handles zero new capital gracefully (no division by zero)", () => {
    const stocks = [{ stockId: "AMD", allocationPct: 50 }];
    const result = recalcAllocationsForNewCapital(stocks, 50, 100_000, 0);
    // Should return unchanged when newCapital is 0
    expect(result.stocks[0].allocationPct).toBe(50);
    expect(result.cashPct).toBe(50);
  });

  it("cashPct never goes below 0", () => {
    // If stocks have 100% and cash is 0, new capital shouldn't make cashPct negative
    const stocks = [{ stockId: "AMD", allocationPct: 100 }];
    const cashPct = 0;
    const result = recalcAllocationsForNewCapital(stocks, cashPct, 100_000, 50_000);
    expect(result.cashPct).toBeGreaterThanOrEqual(0);
  });
});
