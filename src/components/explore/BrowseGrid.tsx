import { useState, useMemo } from 'react';
import type { GraphData, GraphNode } from '../../lib/graph-types';
import { getNodeColor, TYPE_LABELS, nodeMatchesFilters } from '../../lib/graph-layout';

/*
 * Filterable card grid for the /explore/browse view. Light theme.
 * Click a card to expand it inline with extra context; click again
 * to collapse. Click the title-link to jump to the full detail page.
 */

interface Props {
  graph: GraphData;
}

const ROUTE_BY_TYPE: Record<string, string> = {
  pattern: '/patterns/',
  'use-case': '/use-cases/',
  approach: '/approaches/',
  jurisdiction: '/jurisdictions/',
  vendor: '/vendors/',
};

function nodeHref(node: GraphNode): string | null {
  const route = ROUTE_BY_TYPE[node.type];
  if (!route) return null;
  const prefix = node.type === 'pattern' ? 'pattern-' : node.type === 'approach' ? 'approach-' : '';
  return `${route}${prefix}${node.slug}/`;
}

export function BrowseGrid({ graph }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const filtered = useMemo(() => {
    return graph.nodes
      .filter((n) => n.type !== 'domain')
      .filter((n) => nodeMatchesFilters(n, filters))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [graph.nodes, filters]);

  const types = useMemo(() => {
    const s = new Set<string>();
    graph.nodes.forEach((n) => {
      if (n.type !== 'domain') s.add(n.type);
    });
    return [...s].sort();
  }, [graph.nodes]);

  const set = (key: string, val: string) => {
    const next = { ...filters };
    if (val) next[key] = val;
    else delete next[key];
    setFilters(next);
  };

  return (
    <div style={{ padding: '1rem 0 3rem' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search…"
          style={{
            background: '#ffffff',
            color: '#1a202c',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 13.5,
            width: 240,
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
          }}
          value={filters.search ?? ''}
          onChange={(e) => set('search', e.target.value)}
        />
        <select
          style={{
            background: '#ffffff',
            color: '#1a202c',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '7px 10px',
            fontSize: 13.5,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            outline: 'none',
          }}
          value={filters.type ?? ''}
          onChange={(e) => set('type', e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t as keyof typeof TYPE_LABELS] ?? t}
            </option>
          ))}
        </select>
        <span style={{ color: '#718096', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
          {filtered.length} items
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {filtered.map((node) => {
          const isOpen = selected?.id === node.id;
          const href = nodeHref(node);
          return (
            <div
              key={node.id}
              onClick={() => setSelected(isOpen ? null : node)}
              style={{
                background: '#ffffff',
                border: `1px solid ${isOpen ? getNodeColor(node) : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '14px 14px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isOpen ? '0 4px 12px rgba(13, 20, 36, 0.06)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isOpen) e.currentTarget.style.borderColor = '#cbd5e0';
              }}
              onMouseLeave={(e) => {
                if (!isOpen) e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: getNodeColor(node),
                    color: '#ffffff',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {TYPE_LABELS[node.type]}
                </span>
                {node.layer && (
                  <span
                    style={{
                      background: '#edf2f7',
                      color: '#4a5568',
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {node.layer}
                  </span>
                )}
                {node.maturity && (
                  <span
                    style={{
                      background: '#edf2f7',
                      color: '#4a5568',
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {node.maturity}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#1a365d' }}>
                {node.title}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: '#4a5568',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {node.summary}
              </div>

              {isOpen && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid #e2e8f0',
                    fontSize: 12.5,
                    color: '#4a5568',
                    lineHeight: 1.55,
                  }}
                >
                  {node.privacy_goal && (
                    <p style={{ fontStyle: 'italic', margin: '0 0 8px', color: '#1a365d' }}>
                      {node.privacy_goal}
                    </p>
                  )}
                  {node.primary_domain && (
                    <p style={{ fontSize: 11.5, color: '#718096', margin: 0 }}>
                      Domain: {node.primary_domain}
                    </p>
                  )}
                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      gap: 8,
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {href && (
                      <a
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: '#2257e9',
                          textDecoration: 'none',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        Open full page →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
