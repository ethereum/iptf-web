import type { GraphNode } from '../../lib/graph-types';
import { getNodeColor, TYPE_LABELS } from '../../lib/graph-layout';

/*
 * Hover tooltip for graph nodes — ported from iptf-web with our
 * light-theme palette. Background flips white-on-token,
 * accent border still encodes the node type via getNodeColor().
 */

interface Props {
  node: GraphNode;
  x: number;
  y: number;
}

export function NodeTooltip({ node, x, y }: Props) {
  const badges = [
    node.type !== 'pattern' && TYPE_LABELS[node.type],
    node.layer,
    node.maturity,
    node.status,
  ].filter(Boolean);

  return (
    <div
      style={{
        position: 'fixed',
        left: x + 16,
        top: y - 10,
        background: '#ffffff',
        border: `1px solid ${getNodeColor(node)}`,
        borderRadius: 8,
        padding: '8px 12px',
        maxWidth: 300,
        pointerEvents: 'none',
        zIndex: 50,
        boxShadow: '0 4px 24px rgba(13, 20, 36, 0.12)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#1a365d' }}>
        {node.title}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
        {badges.map((b, i) => (
          <span
            key={i}
            style={{
              background: '#edf2f7',
              color: '#4a5568',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {b}
          </span>
        ))}
      </div>
      {node.summary && (
        <div style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.5 }}>
          {node.summary.slice(0, 150)}
          {node.summary.length > 150 ? '…' : ''}
        </div>
      )}
    </div>
  );
}
