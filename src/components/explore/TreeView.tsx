import { useRef, useState, useCallback, useMemo } from 'react';
import type { GraphData, GraphNode } from '../../lib/graph-types';
import { getNodeColor, NODE_COLORS } from '../../lib/graph-layout';
import { DetailPanel } from './DetailPanel';

/*
 * Three-column hierarchical view: Use cases → Approaches → Patterns.
 * Light-theme port — surface and rail colors swap, edge accent uses
 * our cta-blue.
 */

interface Props {
  graph: GraphData;
}

interface LayerNode {
  node: GraphNode;
  layer: number;
  x: number;
  y: number;
}

interface LayerEdge {
  source: LayerNode;
  target: LayerNode;
}

const LAYER_LABELS = ['Use cases', 'Case studies', 'Building blocks'];
const LAYER_COLORS = [NODE_COLORS['use-case'], NODE_COLORS.approach, '#8B5CF6'];
const NODE_HEIGHT = 34;
const NODE_GAP = 8;
const LAYER_WIDTH = 280;
const LAYER_GAP = 180;
const PADDING = { top: 60, left: 40, right: 40, bottom: 40 };

export function TreeView({ graph }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { layerNodes, layerEdges, totalHeight } = useMemo(() => {
    const useCases = graph.nodes.filter((n) => n.type === 'use-case');
    const approaches = graph.nodes.filter((n) => n.type === 'approach');
    const patterns = graph.nodes.filter((n) => n.type === 'pattern');

    const ucToApproach = new Map<string, string[]>();
    const approachToPattern = new Map<string, string[]>();

    for (const edge of graph.edges) {
      if (edge.type === 'recommends' || edge.type === 'addresses') {
        // The "addresses" edge is approach → use-case; flip so use-case → approach.
        const ucId = edge.type === 'addresses' ? edge.target : edge.source;
        const appId = edge.type === 'addresses' ? edge.source : edge.target;
        if (!ucToApproach.has(ucId)) ucToApproach.set(ucId, []);
        ucToApproach.get(ucId)!.push(appId);
      }
      if (edge.type === 'uses-pattern') {
        if (!approachToPattern.has(edge.source)) approachToPattern.set(edge.source, []);
        approachToPattern.get(edge.source)!.push(edge.target);
      }
    }

    const connectedApproachIds = new Set<string>();
    const connectedPatternIds = new Set<string>();
    const connectedUcIds = new Set<string>();

    for (const [ucId, appIds] of ucToApproach) {
      if (appIds.length > 0) connectedUcIds.add(ucId);
      for (const appId of appIds) {
        connectedApproachIds.add(appId);
        const patIds = approachToPattern.get(appId) ?? [];
        for (const patId of patIds) connectedPatternIds.add(patId);
      }
    }
    for (const [appId, patIds] of approachToPattern) {
      if (patIds.length > 0) {
        connectedApproachIds.add(appId);
        for (const patId of patIds) connectedPatternIds.add(patId);
      }
    }

    const filteredUc = useCases.filter((n) => connectedUcIds.has(n.id));
    const filteredApp = approaches.filter((n) => connectedApproachIds.has(n.id));
    const filteredPat = patterns.filter((n) => connectedPatternIds.has(n.id));

    filteredUc.sort((a, b) => a.title.localeCompare(b.title));
    filteredApp.sort((a, b) => a.title.localeCompare(b.title));
    filteredPat.sort((a, b) => a.title.localeCompare(b.title));

    const layers = [filteredUc, filteredApp, filteredPat];
    const layerNodes: LayerNode[] = [];
    const nodeMap = new Map<string, LayerNode>();

    for (let col = 0; col < 3; col++) {
      const x = PADDING.left + col * (LAYER_WIDTH + LAYER_GAP);
      layers[col].forEach((node, row) => {
        const y = PADDING.top + row * (NODE_HEIGHT + NODE_GAP);
        const ln: LayerNode = { node, layer: col, x, y };
        layerNodes.push(ln);
        nodeMap.set(node.id, ln);
      });
    }

    const layerEdges: LayerEdge[] = [];
    for (const [ucId, appIds] of ucToApproach) {
      const src = nodeMap.get(ucId);
      if (!src) continue;
      for (const appId of appIds) {
        const tgt = nodeMap.get(appId);
        if (tgt) layerEdges.push({ source: src, target: tgt });
      }
    }
    for (const [appId, patIds] of approachToPattern) {
      const src = nodeMap.get(appId);
      if (!src) continue;
      for (const patId of patIds) {
        const tgt = nodeMap.get(patId);
        if (tgt) layerEdges.push({ source: src, target: tgt });
      }
    }

    const maxRows = Math.max(filteredUc.length, filteredApp.length, filteredPat.length);
    const totalHeight = PADDING.top + maxRows * (NODE_HEIGHT + NODE_GAP) + PADDING.bottom;

    return { layerNodes, layerEdges, totalHeight };
  }, [graph]);

  const highlightedIds = useMemo(() => {
    if (!hoveredId) return null;
    const ids = new Set<string>([hoveredId]);
    for (const e of layerEdges) {
      if (e.source.node.id === hoveredId) ids.add(e.target.node.id);
      if (e.target.node.id === hoveredId) ids.add(e.source.node.id);
    }
    return ids;
  }, [hoveredId, layerEdges]);

  const totalWidth = PADDING.left + 3 * LAYER_WIDTH + 2 * LAYER_GAP + PADDING.right;

  const handleSelectConnected = useCallback(
    (nodeId: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (node) setSelected(node);
    },
    [graph.nodes],
  );

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto' }}>
      <svg
        ref={svgRef}
        width={totalWidth}
        height={Math.max(totalHeight, 600)}
        style={{ background: '#f7fafc', display: 'block', minWidth: '100%' }}
      >
        {LAYER_LABELS.map((label, i) => (
          <text
            key={label}
            x={PADDING.left + i * (LAYER_WIDTH + LAYER_GAP) + LAYER_WIDTH / 2}
            y={28}
            textAnchor="middle"
            fill={LAYER_COLORS[i]}
            fontSize={12}
            fontWeight={700}
            letterSpacing="0.12em"
            fontFamily="JetBrains Mono, monospace"
          >
            {label.toUpperCase()}
          </text>
        ))}

        <g>
          {layerEdges.map((e, i) => {
            const sx = e.source.x + LAYER_WIDTH;
            const sy = e.source.y + NODE_HEIGHT / 2;
            const tx = e.target.x;
            const ty = e.target.y + NODE_HEIGHT / 2;
            const mx = (sx + tx) / 2;

            const isHighlighted = highlightedIds
              ? highlightedIds.has(e.source.node.id) && highlightedIds.has(e.target.node.id)
              : false;
            const isDimmed = highlightedIds && !isHighlighted;

            return (
              <path
                key={i}
                d={`M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`}
                fill="none"
                stroke={isHighlighted ? '#2257e9' : '#cbd5e0'}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isDimmed ? 0.08 : isHighlighted ? 0.85 : 0.35}
                style={{ transition: 'stroke-opacity 0.15s, stroke 0.15s, stroke-width 0.15s' }}
              />
            );
          })}
        </g>

        <g>
          {layerNodes.map((ln) => {
            const isDimmed = highlightedIds && !highlightedIds.has(ln.node.id);
            const isHovered = hoveredId === ln.node.id;
            const color = ln.layer === 2 ? getNodeColor(ln.node) : LAYER_COLORS[ln.layer];

            return (
              <g
                key={ln.node.id}
                transform={`translate(${ln.x},${ln.y})`}
                style={{
                  cursor: 'pointer',
                  opacity: isDimmed ? 0.18 : 1,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={() => setHoveredId(ln.node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelected(ln.node)}
              >
                <rect
                  width={LAYER_WIDTH}
                  height={NODE_HEIGHT}
                  rx={6}
                  fill={isHovered ? '#ffffff' : '#ffffff'}
                  stroke={isHovered ? color : '#e2e8f0'}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{ transition: 'stroke 0.15s, filter 0.15s', filter: isHovered ? 'drop-shadow(0 2px 6px rgba(13,20,36,0.08))' : 'none' }}
                />
                <rect width={4} height={NODE_HEIGHT} rx={2} fill={color} />
                <text
                  x={14}
                  y={NODE_HEIGHT / 2}
                  dominantBaseline="central"
                  fill="#1a365d"
                  fontSize={12}
                  fontWeight={600}
                  fontFamily="Inter, sans-serif"
                >
                  {ln.node.title.length > 34
                    ? ln.node.title.slice(0, 32) + '…'
                    : ln.node.title}
                </text>
                {ln.layer === 2 && ln.node.layer && (
                  <text
                    x={LAYER_WIDTH - 10}
                    y={NODE_HEIGHT / 2}
                    dominantBaseline="central"
                    textAnchor="end"
                    fill={color}
                    fontSize={9.5}
                    fontWeight={700}
                    letterSpacing="0.06em"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {ln.node.layer}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {selected && (
        <DetailPanel
          node={selected}
          graph={graph}
          onClose={() => setSelected(null)}
          onSelectNode={handleSelectConnected}
        />
      )}
    </div>
  );
}
