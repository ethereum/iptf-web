export type NodeType = 'pattern' | 'use-case' | 'approach' | 'domain' | 'jurisdiction' | 'vendor';
export type EdgeType =
  | 'see-also' | 'uses-pattern' | 'implements' | 'recommends'
  | 'in-domain' | 'regulated-by' | 'addresses'
  | 'requires' | 'composes-with' | 'alternative-to';

export interface CROPSProfile {
  cr: 'high' | 'medium' | 'low' | 'none';
  o: 'yes' | 'partial' | 'no';
  p: 'full' | 'partial' | 'none';
  s: 'high' | 'medium' | 'low';
}

export interface CROPSContext {
  cr?: string;
  o?: string;
  p?: string;
  s?: string;
}

export interface PostQuantum {
  risk?: 'high' | 'medium' | 'low';
  vector?: string;
  mitigation?: string;
}

export interface RelatedPatterns {
  requires?: string[];
  composes_with?: string[];
  alternative_to?: string[];
  see_also?: string[];
}

export interface OpenSourceImpl {
  url: string;
  description?: string;
  language?: string;
}

export interface IptfPocsBlock {
  folder?: string;
  requirements?: string;
  pocs?: Array<{
    name: string;
    sub_approach?: string;
    spec?: string;
    status?: 'spec-only' | 'implemented' | 'benchmarked';
  }>;
}

export interface SubPatternRef {
  name: string;
  pattern: string;
  crops_summary?: string;
}

export interface ContextDifferentiation {
  i2i?: string;
  i2u?: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  slug: string;
  file: string;
  summary: string;
  content: string;

  // Scalars
  layer?: string;
  maturity?: string;
  status?: string;
  context?: 'i2i' | 'i2u' | 'both';
  last_reviewed?: string;
  website?: string;
  category?: string;
  region?: string;
  primary_domain?: string;
  secondary_domain?: string;
  privacy_goal?: string;
  use_case?: string;
  kind?: 'standard' | 'meta';

  // Structured
  works_best_when?: string[];
  avoid_when?: string[];
  crops_profile?: CROPSProfile | 'n/a';
  crops_context?: CROPSContext;
  post_quantum?: PostQuantum;
  visibility?: Record<string, string[]>;
  standards?: string[];
  related_patterns?: RelatedPatterns;
  open_source_implementations?: OpenSourceImpl[];
  iptf_pocs?: IptfPocsBlock;
  primary_patterns?: string[];
  supporting_patterns?: string[];
  related_use_cases?: string[];
  context_differentiation?: ContextDifferentiation;
  sub_patterns?: SubPatternRef[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    generated_at: string;
    node_count: number;
    edge_count: number;
  };
}

// D3 simulation node
export interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SimEdge {
  source: SimNode;
  target: SimNode;
  type: EdgeType;
}
