import { useMemo } from 'react';
import type { GraphData, GraphNode } from '../../lib/graph-types';
import { getNodeColor, TYPE_LABELS } from '../../lib/graph-layout';
import { renderMarkdown } from '../../lib/render';

/*
 * Side panel that opens when a graph node is selected. Shows
 * the node's first markdown sections plus its inbound and
 * outbound graph connections. Light-theme palette.
 */

interface Props {
  node: GraphNode;
  graph: GraphData;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

const ROUTE_BY_TYPE: Record<string, string> = {
  pattern: '/patterns/',
  'use-case': '/use-cases/',
  approach: '/approaches/',
  domain: '/domains/',
  jurisdiction: '/jurisdictions/',
  vendor: '/vendors/',
};

function nodeHref(node: GraphNode): string | null {
  const route = ROUTE_BY_TYPE[node.type];
  if (!route) return null;
  const prefix = node.type === 'pattern' ? 'pattern-' : node.type === 'approach' ? 'approach-' : '';
  return `${route}${prefix}${node.slug}/`;
}

export function DetailPanel({ node, graph, onClose, onSelectNode }: Props) {
  const connections = useMemo(() => {
    const result: { node: GraphNode; edgeType: string; direction: 'to' | 'from' }[] = [];
    const seen = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.source === node.id && !seen.has(edge.target)) {
        seen.add(edge.target);
        const target = graph.nodes.find((n) => n.id === edge.target);
        if (target) result.push({ node: target, edgeType: edge.type, direction: 'to' });
      }
      if (edge.target === node.id && !seen.has(edge.source)) {
        seen.add(edge.source);
        const source = graph.nodes.find((n) => n.id === edge.source);
        if (source) result.push({ node: source, edgeType: edge.type, direction: 'from' });
      }
    }
    const typeOrder: Record<string, number> = {
      'use-case': 0, approach: 1, pattern: 2, vendor: 3, domain: 4, jurisdiction: 5,
    };
    result.sort((a, b) => (typeOrder[a.node.type] ?? 9) - (typeOrder[b.node.type] ?? 9));
    return result;
  }, [node, graph]);

  const contentHtml = useMemo(() => {
    const sections = node.content.split(/\n(?=## )/);
    const limited = sections.slice(0, 4).join('\n');
    return renderMarkdown(limited);
  }, [node.content]);

  const badges = [node.layer, node.maturity, node.status, node.primary_domain].filter(Boolean);
  const detailHref = nodeHref(node);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        maxWidth: '95vw',
        background: '#ffffff',
        borderLeft: `2px solid ${getNodeColor(node)}`,
        overflowY: 'auto',
        zIndex: 20,
        boxShadow: '-8px 0 32px rgba(13, 20, 36, 0.08)',
      }}
    >
      <div
        style={{
          padding: '18px 18px 12px',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: getNodeColor(node),
                marginBottom: 4,
                letterSpacing: '0.1em',
              }}
            >
              {TYPE_LABELS[node.type]}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a365d', letterSpacing: '-0.015em' }}>
              {node.title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            style={{
              background: 'none',
              border: 'none',
              color: '#718096',
              fontSize: 22,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {badges.map((b, i) => (
            <span
              key={i}
              style={{
                background: '#edf2f7',
                color: '#4a5568',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {b}
            </span>
          ))}
        </div>
        {node.privacy_goal && (
          <div style={{ fontSize: 12.5, color: '#4a5568', marginTop: 10, lineHeight: 1.55 }}>
            {node.privacy_goal}
          </div>
        )}
        {detailHref && (
          <a
            href={detailHref}
            style={{
              display: 'inline-block',
              marginTop: 12,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              fontWeight: 700,
              color: '#2257e9',
              textDecoration: 'none',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Open full page →
          </a>
        )}
      </div>

      <div
        style={{ padding: 18, fontSize: 13, lineHeight: 1.65, color: '#1a202c' }}
        className="detail-content"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {connections.length > 0 && (
        <div style={{ padding: '0 18px 18px' }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#718096',
              marginBottom: 8,
              letterSpacing: '0.12em',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            Connected ({connections.length})
          </div>
          {connections.map(({ node: cn, edgeType }) => (
            <button
              key={cn.id}
              type="button"
              onClick={() => onSelectNode(cn.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '7px 11px',
                marginBottom: 4,
                cursor: 'pointer',
                color: '#1a202c',
                fontSize: 12.5,
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = getNodeColor(cn);
                e.currentTarget.style.background = '#f7fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: getNodeColor(cn),
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{cn.title}</span>
              <span
                style={{
                  fontSize: 9.5,
                  color: '#a0aec0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {edgeType}
              </span>
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '8px 18px 18px', fontSize: 11, color: '#a0aec0', fontFamily: 'JetBrains Mono, monospace' }}>
        Source: {node.file}
      </div>

      <style>{`
        .detail-content h2 {
          font-size: 14.5px; font-weight: 700; margin: 16px 0 8px;
          color: #1a365d; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
        }
        .detail-content h3 { font-size: 13.5px; font-weight: 700; margin: 12px 0 4px; color: #1a365d; }
        .detail-content p { margin: 6px 0; color: #1a202c; }
        .detail-content ul, .detail-content ol { padding-left: 18px; margin: 6px 0; }
        .detail-content li { margin: 2px 0; }
        .detail-content strong { color: #1a365d; }
        .detail-content code {
          background: #f7fafc; padding: 1px 5px; border-radius: 3px; font-size: 12px;
          color: #1a365d; font-family: 'JetBrains Mono', monospace;
        }
        .detail-content a { color: #2257e9; text-decoration: none; }
        .detail-content a:hover { text-decoration: underline; }
        .detail-content table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
        .detail-content th, .detail-content td {
          border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left;
        }
        .detail-content th { background: #f7fafc; font-weight: 700; color: #1a365d; }
      `}</style>
    </div>
  );
}
