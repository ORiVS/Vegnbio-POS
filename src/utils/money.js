// src/utils/money.js
export const fmt = (n) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
        .format(Number(n || 0));

export const toNum = (v) => Number(v ?? 0);

export const remainingFromTicket = (t) =>
    Math.max(0, +(toNum(t.total_due) - toNum(t.paid_amount)).toFixed(2));
