/**
 * src/utils/formatters.js
 * Standardized data presentation for the Summit CRM.
 */

export const formatters = {
    /**
     * Currencies: 1250000 -> $1,250,000
     */
    dollars(value) {
        if (value === undefined || value === null || isNaN(value)) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(value);
    },

    /**
     * Percentages: 5.5 -> 5.50%
     */
    percent(value) {
        if (value === undefined || value === null || isNaN(value)) return '0.00%';
        return parseFloat(value).toFixed(2) + '%';
    },

    /**
     * Standard Date: 2024-05-20T... -> May 20, 2024
     */
    date(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
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
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0) return `In ${diffDays} days`;
        return `${Math.abs(diffDays)} days ago`;
    },

    /**
     * Abbreviated Numbers: 1500000 -> $1.5M
     */
    compact(value) {
        if (value === undefined || value === null || isNaN(value)) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(value);
    },

    /**
     * Phone Numbers: 5551234567 -> (555) 123-4567
     */
    phone(number) {
        const cleaned = ('' + number).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return '(' + match[1] + ') ' + match[2] + '-' + match[3];
        }
        return number;
    }
};