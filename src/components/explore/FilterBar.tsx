import { useMemo } from 'react';
import type { GraphData } from '../../lib/graph-types';
import { TYPE_LABELS } from '../../lib/graph-layout';

/*
 * Filter controls bar — ported from iptf-web with our light-theme
 * palette and form-control tokens.
 */

interface Props {
  graph: GraphData;
  filters: Record<string, string>;
  onFilterChange: (filters: Record<string, string>) => void;
}

const controlStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#1a202c',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer',
  outline: 'none',
};

const inputStyle: React.CSSProperties = {
  ...controlStyle,
  width: 200,
  padding: '6px 12px',
};

export function FilterBar({ graph, filters, onFilterChange }: Props) {
  const layers = useMemo(() => {
    const s = new Set<string>();
    graph.nodes.forEach((n) => {
      if (n.layer) s.add(n.layer);
    });
    return [...s].sort();
  }, [graph]);

  const maturities = useMemo(() => {
    const s = new Set<string>();
    graph.nodes.forEach((n) => {
      if (n.maturity) s.add(n.maturity);
    });
    return [...s].sort();
  }, [graph]);

  const types = useMemo(() => {
    const s = new Set<string>();
    graph.nodes.forEach((n) => s.add(n.type));
    return [...s].sort();
  }, [graph]);

  const set = (key: string, val: string) => {
    const next = { ...filters };
    if (val) next[key] = val;
    else delete next[key];
    onFilterChange(next);
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        zIndex: 10,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'saturate(180%) blur(10px)',
        WebkitBackdropFilter: 'saturate(180%) blur(10px)',
        borderRadius: 8,
        padding: 8,
      }}
    >
      <input
        type="search"
        placeholder="Search nodes…"
        style={inputStyle}
        value={filters.search ?? ''}
        onChange={(e) => set('search', e.target.value)}
      />
      <select style={controlStyle} value={filters.layer ?? ''} onChange={(e) => set('layer', e.target.value)}>
        <option value="">All layers</option>
        {layers.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <select style={controlStyle} value={filters.maturity ?? ''} onChange={(e) => set('maturity', e.target.value)}>
        <option value="">All maturity</option>
        {maturities.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select style={controlStyle} value={filters.type ?? ''} onChange={(e) => set('type', e.target.value)}>
        <option value="">All types</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t as keyof typeof TYPE_LABELS] ?? t}
          </option>
        ))}
      </select>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onFilterChange({})}
          style={{
            ...controlStyle,
            cursor: 'pointer',
            color: '#2257e9',
            borderColor: '#2257e9',
            background: 'rgba(34, 87, 233, 0.08)',
          }}
        >
          Reset ({activeCount})
        </button>
      )}
    </div>
  );
}
