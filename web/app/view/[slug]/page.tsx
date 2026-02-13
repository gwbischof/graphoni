"use client";

import { useState, useEffect, useCallback, use } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Starfield } from "@/components/starfield";
const GraphCanvas = dynamic(
  () => import("@/components/graph-canvas-sigma").then((m) => ({ default: m.GraphCanvas })),
  { ssr: false }
);
import { DetailPanel } from "@/components/detail-panel";
import { GraphLegend } from "@/components/graph-legend";
import { ViewBar } from "@/components/view-bar";
import { Button } from "@/components/ui/button";

import type { CytoscapeElement, NodeData, SavedView } from "@/lib/graph-data";
import type { GraphConfig } from "@/lib/graph-config";
import { loadGraphConfig } from "@/lib/graph-config";

export default function ViewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [config, setConfig] = useState<GraphConfig | null>(null);
  const [elements, setElements] = useState<CytoscapeElement[]>([]);
  const [view, setView] = useState<SavedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [activeSubtypes, setActiveSubtypes] = useState<Map<string, Set<string>>>(new Map());
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      loadGraphConfig(),
      fetch(`/api/views/${encodeURIComponent(slug)}?results=true`).then((r) => r.json()),
    ])
      .then(([cfg, data]) => {
        setConfig(cfg);
        setView(data.view);
        setElements(data.elements || []);

        // Init filters
        const subtypes = new Map<string, Set<string>>();
        for (const [typeName, ntConfig] of Object.entries(cfg.nodeTypes)) {
          subtypes.set(typeName, new Set(Object.keys(ntConfig.subtypes)));
        }
        setActiveSubtypes(subtypes);
        setActiveEdgeTypes(new Set(Object.keys(cfg.edgeTypes)));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load view:", err);
        setLoading(false);
      });
  }, [slug]);

  const handleNodeSelect = useCallback((node: NodeData | null) => {
    setSelectedNode(node);
  }, []);

  const nodeCount = elements.filter((e) => e.group === "nodes").length;
  const edgeCount = elements.filter((e) => e.group === "edges").length;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Starfield />

      {/* Top bar */}
      <motion.div
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 200 }}
        className="glass-panel absolute top-3 left-3 right-3 h-10 rounded-xl z-20 flex items-center justify-between px-4"
      >
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="xs" className="gap-1 text-[10px] text-muted-foreground">
              <ArrowLeft className="size-3" />
              Graph
            </Button>
          </Link>
          <div className="w-px h-4 bg-white/8" />
          <h1 className="text-xs font-medium tracking-wide">
            {view?.name || slug}
          </h1>
          <span className="text-[10px] font-mono text-muted-foreground">
            {loading ? "Loading..." : `${nodeCount} nodes / ${edgeCount} edges`}
          </span>
        </div>
      </motion.div>

      {/* Graph */}
      {!loading && config && elements.length > 0 && (
        <GraphCanvas
          elements={elements}
          searchQuery=""
          activeSubtypes={activeSubtypes}
          activeEdgeTypes={activeEdgeTypes}
          onNodeSelect={handleNodeSelect}
          config={config}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-muted-foreground font-mono">Loading view...</p>
          </motion.div>
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onProposeEdit={() => {}}
        config={config}
      />

      {/* Legend */}
      {!loading && config && <GraphLegend config={config} />}

      {/* View bar */}
      <ViewBar
        viewName={view?.name || null}
        onSaveView={() => {}}
        onShare={() => {
          navigator.clipboard.writeText(window.location.href);
        }}
      />
    </div>
  );
}
