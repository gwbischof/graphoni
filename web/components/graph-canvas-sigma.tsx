"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { type Settings } from "sigma/settings";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { CytoscapeElement, NodeData, EdgeData } from "@/lib/graph-data";
import type { GraphConfig } from "@/lib/graph-config";
import { cytoscapeToGraphology } from "@/lib/graph-adapter";
import {
  createNodeReducer,
  createEdgeReducer,
  drawDarkHover,
  type NodeState,
  type EdgeState,
} from "@/lib/sigma-styles";

interface GraphCanvasSigmaProps {
  elements: CytoscapeElement[];
  searchQuery: string;
  activeSubtypes: Map<string, Set<string>>;
  activeEdgeTypes: Set<string>;
  onNodeSelect: (node: NodeData | null) => void;
  onEdgeSelect?: (edge: EdgeData, sourceNode: NodeData, targetNode: NodeData) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  config: GraphConfig;
}

export function GraphCanvas({
  elements,
  searchQuery,
  activeSubtypes,
  activeEdgeTypes,
  onNodeSelect,
  onEdgeSelect,
  onNodeDoubleClick,
  config,
}: GraphCanvasSigmaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const selectedRef = useRef<string | null>(null);

  // Build the graph from elements
  const graph = useMemo(() => {
    const g = cytoscapeToGraphology(elements);

    // If no positions set, run ForceAtlas2 synchronously for small graphs
    let hasPositions = false;
    g.forEachNode((_id, attrs) => {
      if (attrs.x !== undefined && attrs.y !== undefined) hasPositions = true;
    });

    if (!hasPositions) {
      // Assign random initial positions
      g.forEachNode((id) => {
        g.setNodeAttribute(id, "x", Math.random() * 1000);
        g.setNodeAttribute(id, "y", Math.random() * 1000);
      });

      // Run ForceAtlas2 for layout (synchronous, fine for <5K nodes)
      if (g.order > 0 && g.order < 5000) {
        forceAtlas2.assign(g, {
          iterations: 100,
          settings: {
            gravity: 1,
            scalingRatio: 10,
            barnesHutOptimize: g.order > 500,
            strongGravityMode: true,
            slowDown: 5,
          },
        });
      }
    }

    return g;
  }, [elements]);

  // Compute filtered-out sets
  const filteredOutNodes = useMemo(() => {
    const filtered = new Set<string>();
    graph.forEachNode((id, attrs) => {
      const nodeType = attrs.node_type as string;
      const ntConfig = config.nodeTypes[nodeType];
      if (ntConfig) {
        const subtypeField = ntConfig.subtypeField;
        const subtypeValue = attrs[subtypeField] as string;
        const activeSet = activeSubtypes.get(nodeType);
        if (activeSet && subtypeValue && !activeSet.has(subtypeValue)) {
          filtered.add(id);
        }
      }
    });
    return filtered;
  }, [graph, activeSubtypes, config]);

  const filteredOutEdges = useMemo(() => {
    const filtered = new Set<string>();
    graph.forEachEdge((key, attrs, source, target) => {
      const edgeType = attrs.edge_type as string;
      if (
        !activeEdgeTypes.has(edgeType) ||
        filteredOutNodes.has(source) ||
        filteredOutNodes.has(target)
      ) {
        filtered.add(key);
      }
    });
    return filtered;
  }, [graph, activeEdgeTypes, filteredOutNodes]);

  // Compute search matches
  const searchMatches = useMemo(() => {
    const matches = new Set<string>();
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase();
    graph.forEachNode((id, attrs) => {
      const label = ((attrs.label as string) || "").toLowerCase();
      const nodeId = ((attrs.id as string) || id).toLowerCase();
      const notes = ((attrs.notes as string) || "").toLowerCase();
      if (label.includes(q) || nodeId.includes(q) || notes.includes(q)) {
        matches.add(id);
      }
    });
    return matches;
  }, [graph, searchQuery]);

  // Selection state
  const getSelectionState = useCallback(
    (selectedNodeId: string | null) => {
      const selected = new Set<string>();
      const connectedNodes = new Set<string>();
      const connectedEdges = new Set<string>();
      const isDimmed = !!selectedNodeId;

      if (selectedNodeId && graph.hasNode(selectedNodeId)) {
        selected.add(selectedNodeId);
        graph.forEachEdge(selectedNodeId, (edgeKey, _attrs, source, target) => {
          connectedEdges.add(edgeKey);
          connectedNodes.add(source);
          connectedNodes.add(target);
        });
      }

      const nodeState: NodeState = {
        selected,
        connected: connectedNodes,
        dimmed: isDimmed,
        searchMatches,
        filteredOut: filteredOutNodes,
      };

      const edgeState: EdgeState = {
        connected: connectedEdges,
        dimmed: isDimmed,
        filteredOut: filteredOutEdges,
      };

      return { nodeState, edgeState };
    },
    [graph, searchMatches, filteredOutNodes, filteredOutEdges]
  );

  // Initialize Sigma
  useEffect(() => {
    if (!containerRef.current || graph.order === 0) return;

    graphRef.current = graph;

    const { nodeState, edgeState } = getSelectionState(selectedRef.current);

    const settings: Partial<Settings> = {
      nodeReducer: createNodeReducer(config, nodeState),
      edgeReducer: createEdgeReducer(config, edgeState),
      renderLabels: true,
      labelFont: "system-ui, sans-serif",
      labelSize: 11,
      labelColor: { color: "#dde2f5" },
      labelRenderedSizeThreshold: 6,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultDrawNodeHover: drawDarkHover as any,
      defaultEdgeType: "arrow",
      enableEdgeEvents: true,
      minCameraRatio: 0.05,
      maxCameraRatio: 10,
      itemSizesReference: "screen",
      stagePadding: 60,
    };

    const sigma = new Sigma(graph, containerRef.current, settings);
    sigmaRef.current = sigma;

    // Click node
    sigma.on("clickNode", ({ node }) => {
      selectedRef.current = node;
      const attrs = graph.getNodeAttributes(node);
      const nodeData = { id: node, ...attrs } as NodeData;
      onNodeSelect(nodeData);
      refreshReducers();
    });

    // Click edge
    sigma.on("clickEdge", ({ edge }) => {
      if (!onEdgeSelect) return;
      const edgeAttrs = graph.getEdgeAttributes(edge);
      const source = graph.source(edge);
      const target = graph.target(edge);
      const sourceAttrs = graph.getNodeAttributes(source);
      const targetAttrs = graph.getNodeAttributes(target);
      const edgeData = { id: edge, source, target, edge_type: edgeAttrs.edge_type || "", ...edgeAttrs } as EdgeData;
      const sourceNode = { id: source, ...sourceAttrs } as NodeData;
      const targetNode = { id: target, ...targetAttrs } as NodeData;
      onEdgeSelect(edgeData, sourceNode, targetNode);
    });

    // Double-click node (expand community)
    sigma.on("doubleClickNode", ({ node }) => {
      if (onNodeDoubleClick) {
        onNodeDoubleClick(node);
      }
    });

    // Click canvas (deselect)
    sigma.on("clickStage", () => {
      selectedRef.current = null;
      onNodeSelect(null);
      refreshReducers();
    });

    function refreshReducers() {
      const { nodeState: ns, edgeState: es } = getSelectionState(selectedRef.current);
      sigma.setSetting("nodeReducer", createNodeReducer(config, ns));
      sigma.setSetting("edgeReducer", createEdgeReducer(config, es));
    }

    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph, config, getSelectionState, onNodeSelect, onEdgeSelect, onNodeDoubleClick]);

  // Update reducers when filters/search change
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    const { nodeState, edgeState } = getSelectionState(selectedRef.current);
    sigma.setSetting("nodeReducer", createNodeReducer(config, nodeState));
    sigma.setSetting("edgeReducer", createEdgeReducer(config, edgeState));
  }, [config, getSelectionState]);

  return (
    <div
      ref={containerRef}
      className="sigma-container absolute inset-0"
      style={{ zIndex: 1 }}
    />
  );
}
