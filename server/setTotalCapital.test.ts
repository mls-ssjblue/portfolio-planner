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

// Pure function mirroring the new addStockToPortfolio logic
function addStockPreservingAllocations(
  stocks: Array<{ stockId: string; allocationPct: number }>,
  cashPct: number,
  newStockId: string,
  defaultNewPct = 5
): { stocks: Array<{ stockId: string; allocationPct: number }>; cashPct: number } {
  const available = cashPct;
  const newStockPct = parseFloat(Math.min(defaultNewPct, available).toFixed(2));
  const newCashPct = parseFloat(Math.max(0, available - newStockPct).toFixed(2));
  return {
    stocks: [...stocks, { stockId: newStockId, allocationPct: newStockPct }],
    cashPct: newCashPct,
  };
}

describe("addStockToPortfolio: preserve existing allocations", () => {
  it("existing positions are unchanged when adding a new stock", () => {
    const stocks = [
      { stockId: "AMD", allocationPct: 40 },
      { stockId: "NVDA", allocationPct: 30 },
    ];
    const cashPct = 30;

    const result = addStockPreservingAllocations(stocks, cashPct, "TSLA");

    // Existing positions unchanged
    expect(result.stocks[0].allocationPct).toBe(40);
    expect(result.stocks[1].allocationPct).toBe(30);
    // New stock gets 5%
    expect(result.stocks[2].stockId).toBe("TSLA");
    expect(result.stocks[2].allocationPct).toBe(5);
    // Cash reduced by 5%
    expect(result.cashPct).toBe(25);
  });

  it("new stock gets only what cash has if cash < 5%", () => {
    const stocks = [{ stockId: "AMD", allocationPct: 97 }];
    const cashPct = 3;

    const result = addStockPreservingAllocations(stocks, cashPct, "TSLA");

    expect(result.stocks[0].allocationPct).toBe(97); // unchanged
    expect(result.stocks[1].allocationPct).toBe(3);  // capped at available cash
    expect(result.cashPct).toBe(0);
  });

  it("new stock gets 0% when no cash available", () => {
    const stocks = [{ stockId: "AMD", allocationPct: 100 }];
    const cashPct = 0;

    const result = addStockPreservingAllocations(stocks, cashPct, "TSLA");

    expect(result.stocks[0].allocationPct).toBe(100); // unchanged
    expect(result.stocks[1].allocationPct).toBe(0);   // no cash to give
    expect(result.cashPct).toBe(0);
  });
});

// Pure function mirroring the new removeStockFromPortfolio logic
function removeStockReturningToCash(
  stocks: Array<{ stockId: string; allocationPct: number }>,
  cashPct: number,
  stockIdToRemove: string
): { stocks: Array<{ stockId: string; allocationPct: number }>; cashPct: number } {
  const removedStock = stocks.find((s) => s.stockId === stockIdToRemove);
  const freedPct = removedStock?.allocationPct ?? 0;
  const newStocks = stocks.filter((s) => s.stockId !== stockIdToRemove);
  const newCashPct = parseFloat(Math.min(100, cashPct + freedPct).toFixed(4));
  return { stocks: newStocks, cashPct: newCashPct };
}

describe("removeStockFromPortfolio: freed allocation returns to cash", () => {
  it("removing a stock adds its allocation back to cash", () => {
    const stocks = [
      { stockId: "AMD", allocationPct: 40 },
      { stockId: "NVDA", allocationPct: 30 },
    ];
    const cashPct = 30;

    const result = removeStockReturningToCash(stocks, cashPct, "AMD");

    expect(result.stocks).toHaveLength(1);
    expect(result.stocks[0].stockId).toBe("NVDA");
    expect(result.stocks[0].allocationPct).toBe(30); // unchanged
    expect(result.cashPct).toBe(70); // 30 cash + 40 freed
  });

  it("removing a stock when cash is 0 gives cash = freed amount", () => {
    const stocks = [
      { stockId: "AMD", allocationPct: 60 },
      { stockId: "NVDA", allocationPct: 40 },
    ];
    const cashPct = 0;

    const result = removeStockReturningToCash(stocks, cashPct, "NVDA");

    expect(result.cashPct).toBe(40);
    expect(result.stocks).toHaveLength(1);
  });

  it("cash never exceeds 100 even if allocations are over-allocated", () => {
    const stocks = [{ stockId: "AMD", allocationPct: 80 }];
    const cashPct = 30; // already over 100 total

    const result = removeStockReturningToCash(stocks, cashPct, "AMD");

    expect(result.cashPct).toBe(100); // capped at 100
    expect(result.stocks).toHaveLength(0);
  });

  it("removing a non-existent stock leaves everything unchanged", () => {
    const stocks = [{ stockId: "AMD", allocationPct: 50 }];
    const cashPct = 50;

    const result = removeStockReturningToCash(stocks, cashPct, "TSLA");

    expect(result.stocks).toHaveLength(1);
    expect(result.cashPct).toBe(50); // no change
  });
});
