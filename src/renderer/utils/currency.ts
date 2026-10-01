/**
 * Currency formatting utilities for Gamma POS.
 * Primary base currency: USD ($).
 * Secondary market currency: Lebanese Pounds (LBP / L.L).
 */

export const DEFAULT_USD_TO_LBP_RATE = 89500;

export function formatCurrency(
  amount: number | string | null | undefined,
  options?: {
    currency?: string;
    showSymbol?: boolean;
    useDecimals?: boolean;
  },
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  const safeNum = isNaN(num) ? 0 : num;

  const symbol = options?.currency || '$';
  const showSymbol = options?.showSymbol !== false;

  let formatted: string;
  if (symbol === '$' || symbol === 'USD') {
    formatted = safeNum.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return showSymbol ? `$${formatted}` : formatted;
  }

  if (symbol === 'LBP' || symbol === 'L.L' || symbol === 'ل.ل') {
    formatted = Math.round(safeNum).toLocaleString('en-US');
    return showSymbol ? `${formatted} L.L` : formatted;
  }

  if (options?.useDecimals || (options?.useDecimals === undefined && safeNum % 1 !== 0)) {
    formatted = safeNum.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } else {
    formatted = Math.round(safeNum).toLocaleString('en-US');
  }

  return showSymbol ? `${formatted} ${symbol}` : formatted;
}

export function formatUSD(amount: number | string | null | undefined): string {
  return formatCurrency(amount, { currency: '$' });
}

export function formatLBP(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  const safeNum = isNaN(num) ? 0 : Math.round(num);
  return `${safeNum.toLocaleString('en-US')} L.L`;
}

export function convertUsdToLbp(usdAmount: number, rate: number = DEFAULT_USD_TO_LBP_RATE): number {
  return Math.round((usdAmount || 0) * (rate || DEFAULT_USD_TO_LBP_RATE));
}

export function convertLbpToUsd(lbpAmount: number, rate: number = DEFAULT_USD_TO_LBP_RATE): number {
  const safeRate = rate > 0 ? rate : DEFAULT_USD_TO_LBP_RATE;
  return Math.round(((lbpAmount || 0) / safeRate) * 100) / 100;
}

