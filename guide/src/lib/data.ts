/**
 * Data access layer — reads graph.json and glossary.json at build time
 */
import graphData from '../data/graph.json';
import glossaryData from '../data/glossary.json';
import type { GraphNode, GraphEdge, GraphData } from './graph-types';

const graph = graphData as GraphData;

// ── Node queries ──

export function getAllNodes(): GraphNode[] {
  return graph.nodes;
}

export function getNodesByType(type: string): GraphNode[] {
  return graph.nodes.filter(n => n.type === type);
}

export function getNodeBySlug(type: string, slug: string): GraphNode | undefined {
  return graph.nodes.find(n => n.type === type && n.slug === slug);
}

export function getNodeById(id: string): GraphNode | undefined {
  return graph.nodes.find(n => n.id === id);
}

// ── Edge queries ──

export function getEdgesFrom(nodeId: string): (GraphEdge & { targetNode: GraphNode })[] {
  return graph.edges
    .filter(e => e.source === nodeId)
    .map(e => {
      const targetNode = graph.nodes.find(n => n.id === e.target);
      return targetNode ? { ...e, targetNode } : null;
    })
    .filter(Boolean) as (GraphEdge & { targetNode: GraphNode })[];
}

export function getEdgesTo(nodeId: string): (GraphEdge & { sourceNode: GraphNode })[] {
  return graph.edges
    .filter(e => e.target === nodeId)
    .map(e => {
      const sourceNode = graph.nodes.find(n => n.id === e.source);
      return sourceNode ? { ...e, sourceNode } : null;
    })
    .filter(Boolean) as (GraphEdge & { sourceNode: GraphNode })[];
}

/** Get all nodes connected to a node, grouped by relationship type */
export function getRelated(nodeId: string) {
  const outgoing = getEdgesFrom(nodeId);
  const incoming = getEdgesTo(nodeId);

  return {
    // Outgoing edges grouped by type
    patterns: outgoing.filter(e => e.targetNode.type === 'pattern').map(e => e.targetNode),
    vendors: outgoing.filter(e => e.targetNode.type === 'vendor').map(e => e.targetNode),
    approaches: outgoing.filter(e => e.targetNode.type === 'approach').map(e => e.targetNode),
    jurisdictions: outgoing.filter(e => e.targetNode.type === 'jurisdiction').map(e => e.targetNode),
    domains: outgoing.filter(e => e.targetNode.type === 'domain').map(e => e.targetNode),
    useCases: outgoing.filter(e => e.targetNode.type === 'use-case').map(e => e.targetNode),
    seeAlso: outgoing.filter(e => e.type === 'see-also').map(e => e.targetNode),

    // Incoming (reverse lookups)
    usedInApproaches: incoming.filter(e => e.sourceNode.type === 'approach').map(e => e.sourceNode),
    usedInDomains: incoming.filter(e => e.sourceNode.type === 'domain').map(e => e.sourceNode),
    implementedBy: incoming.filter(e => e.sourceNode.type === 'vendor').map(e => e.sourceNode),
  };
}

// ── Glossary ──

export interface GlossaryTerm {
  term: string;
  definition: string;
  category: string;
}

export function getGlossary(): GlossaryTerm[] {
  return glossaryData as GlossaryTerm[];
}

// ── Graph meta ──

export function getGraphMeta() {
  return graph.meta;
}
