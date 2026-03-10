// ── Shared UI Utilities ──
// Fonte única de estilos e helpers — importar aqui em vez de copiar em cada página
import React from 'react';

// ── Paleta de cores pastel usada em badges ──
export const PASTEL = {
    '#22c55e': ['var(--bg)', 'var(--accent-green)'],
    '#ef4444': ['#FEE2E2', '#EF4444'],
    '#f59e0b': ['var(--bg)', 'var(--accent)'],
    '#3b82f6': ['var(--bg)', 'var(--muted)'],
    '#6366f1': ['var(--bg)', 'var(--text)'],
    '#64748b': ['var(--bg)', 'var(--muted)'],
};

// ── Estilos compartilhados ──
export const S = {
    card: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'none', border: 'none' },
    bdg: c => {
        const [bg, text] = PASTEL[c] ?? ['var(--bg)', 'var(--muted)'];
        return { display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700, background: bg, color: text, whiteSpace: 'nowrap', letterSpacing: '-0.01em' };
    },
    btn: (v = 'p') => ({
        padding: '12px 24px', borderRadius: 'var(--radius-pill)', border: v === 's' ? '1px solid var(--border)' : 'none',
        background: v === 'p' ? 'var(--accent)' : v === 's' ? 'var(--surface)' : v === 'd' ? '#FEE2E2' : v === 'g' ? 'var(--bg)' : 'var(--surface-alt)',
        color: v === 'p' ? 'var(--text)' : v === 's' ? 'var(--text)' : v === 'd' ? '#EF4444' : 'var(--text)',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        transition: 'all 0.2s', boxShadow: 'none',
    }),
    inp: { background: 'var(--bg)', border: '2px solid transparent', borderRadius: 'var(--radius-md)', padding: '14px 18px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s', fontWeight: 600 },
    lbl: { fontSize: 12, color: 'var(--muted)', marginBottom: 8, display: 'block', fontWeight: 600 },
    ovl: { position: 'fixed', inset: 0, background: 'rgba(245,245,240,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 },
    mbox: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 40, width: '100%', maxWidth: 700, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'none', border: '1px solid var(--border)' },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0', borderBottom: '1px solid var(--bg)' },
    alr: d => ({
        background: d < 0 || d < 7 ? '#FEE2E2' : d < 30 ? 'var(--bg)' : 'var(--surface)',
        border: `1px solid ${d < 0 || d < 7 ? 'transparent' : d < 30 ? 'transparent' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)', padding: '24px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 16,
    }),
};

// ── Date/Currency Helpers ──
export function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

export function ptDate(d) {
    if (!d) return '—';
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
}

export function fmt(v) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function weekRange() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
    return [mon, sun];
}

export function monthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return [start, end];
}

// ── Shared Components ──

export const PillTabs = ({ tabs, active, onChange, style }) => (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-pill)', padding: 6, display: 'inline-flex', gap: 4, ...style }}>
        {tabs.map(([id, l]) => (
            <button key={id} onClick={() => onChange(id)} style={{
                padding: '10px 24px', borderRadius: 'var(--radius-pill)', border: 'none',
                background: active === id ? 'var(--surface)' : 'transparent',
                color: active === id ? 'var(--text)' : 'var(--muted)',
                boxShadow: active === id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                transition: 'all .2s ease',
            }}>{l}</button>
        ))}
    </div>
);

export const Sec = ({ t }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10, borderBottom: '2px solid var(--bg)', paddingBottom: 6 }}>{t}</div>
);

// ── Export CSV Helper ──
export function exportCSV(filename, headers, rows) {
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
