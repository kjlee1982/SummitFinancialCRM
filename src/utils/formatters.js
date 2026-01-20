/**
 * src/utils/formatters.js
 * Standardized data presentation for the Summit CRM.
 */

function toNumber(value) {
  // Handles numbers and numeric strings safely.
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export const formatters = {
  /**
   * Currencies: 1250000 -> $1,250,000
   * Optional decimals: dollars(1234.56, 2) -> $1,234.56
   */
  dollars(value, decimals = 0) {
    const n = toNumber(value);
    if (n === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(n);
  },

  /**
   * Percentages: 5.5 -> 5.50%
   * Assumes input is already "percent units" (i.e., 5.5 means 5.5%, not 0.055).
   */
  percent(value, decimals = 2) {
    const n = toNumber(value);
    if (n === null) return (0).toFixed(decimals) + '%';
    return n.toFixed(decimals) + '%';
  },

  /**
   * Standard Date: 2024-05-20T... -> May 20, 2024
   */
  date(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (!isValidDate(d)) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  },

  /**
   * Relative Time: "2 days ago" or "In 3 days"
   */
  relativeDays(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (!isValidDate(d)) return '—';

    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  },

  /**
   * Abbreviated Numbers: 1500000 -> $1.5M
   * Optional decimals: compact(1500000, 2) -> $1.50M
   */
  compact(value, decimals = 1) {
    const n = toNumber(value);
    if (n === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(n);
  },

  /**
   * Phone Numbers: 5551234567 -> (555) 123-4567
   */
  phone(number) {
    if (number === undefined || number === null) return '';
    const cleaned = String(number).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return String(number);
  }
};
