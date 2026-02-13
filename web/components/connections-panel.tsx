"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import type { NodeData, EdgeData, CytoscapeElement } from "@/lib/graph-data";
import type { GraphConfig } from "@/lib/graph-config";
import { getEdgeColor } from "@/lib/graph-config";

interface ConnectionsPanelProps {
  edge: EdgeData | null;
  sourceNode: NodeData | null;
  targetNode: NodeData | null;
  elements: CytoscapeElement[];
  onClose: () => void;
  config: GraphConfig | null;
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function formatEdgeType(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function EdgeCard({
  edge,
  nodeId,
  config,
  highlighted,
}: {
  edge: EdgeData;
  nodeId: string;
  config: GraphConfig;
  highlighted?: boolean;
}) {
  const edgeColor = getEdgeColor(config, edge.edge_type);
  const isSource = edge.source === nodeId;
  const otherEnd = isSource ? edge.target : edge.source;

  return (
    <div
      className={`p-2 rounded-lg border transition-colors ${
        highlighted
          ? "bg-white/[0.06] border-white/[0.12] ring-1 ring-primary/30"
          : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="size-1.5 rounded-full shrink-0"
          style={{ backgroundColor: edgeColor }}
        />
        <span
          className="text-[10px] font-mono"
          style={{ color: edgeColor }}
        >
          {formatEdgeType(edge.edge_type)}
        </span>
        <ArrowRight
          className={`size-2.5 text-muted-foreground/50 ${!isSource ? "rotate-180" : ""}`}
        />
        <span className="text-[11px] truncate">
          {otherEnd.replace(/_/g, " ")}
        </span>
      </div>
      {edge.description && (
        <p className="text-[10px] text-muted-foreground leading-relaxed pl-3">
          {edge.description}
        </p>
      )}
      {edge.amount != null && edge.amount > 0 && (
        <p className="text-[10px] text-green-400/80 font-mono pl-3">
          {formatAmount(edge.amount)}
          {edge.date && ` (${edge.date})`}
        </p>
      )}
      {edge.quote && (
        <p className="text-[10px] text-blue-300/70 italic pl-3 mt-0.5">
          &ldquo;{edge.quote}&rdquo;
        </p>
      )}
      {edge.doc_url && (
        <a
          href={edge.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary mt-1 pl-3 transition-colors"
        >
          <ExternalLink className="size-2.5" />
          {edge.source_doc || edge.doc_id || "View doc"}
        </a>
      )}
    </div>
  );
}

export function ConnectionsPanel({
  edge,
  sourceNode,
  targetNode,
  elements,
  onClose,
  config,
}: ConnectionsPanelProps) {
  const [search, setSearch] = useState("");
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string> | null>(null);

  // Collect all edges for the source node
  const allEdges = useMemo(() => {
    if (!sourceNode) return [];
    return elements
      .filter((el): el is CytoscapeElement & { data: EdgeData } =>
        el.group === "edges" &&
        ((el.data as EdgeData).source === sourceNode.id ||
          (el.data as EdgeData).target === sourceNode.id)
      )
      .map((el) => el.data as EdgeData);
  }, [elements, sourceNode]);

  // Unique edge types for filter chips
  const edgeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const e of allEdges) types.add(e.edge_type);
    return Array.from(types).sort();
  }, [allEdges]);

  // Active filters (null = all active)
  const activeFilters = activeTypeFilters ?? new Set(edgeTypes);

  // Filter edges
  const filteredEdges = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allEdges.filter((e) => {
      if (!activeFilters.has(e.edge_type)) return false;
      if (!q) return true;
      const otherEnd = e.source === sourceNode?.id ? e.target : e.source;
      return (
        otherEnd.toLowerCase().replace(/_/g, " ").includes(q) ||
        (e.description || "").toLowerCase().includes(q) ||
        (e.quote || "").toLowerCase().includes(q)
      );
    });
  }, [allEdges, activeFilters, search, sourceNode]);

  const toggleType = (type: string) => {
    setActiveTypeFilters((prev) => {
      const current = prev ?? new Set(edgeTypes);
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const isOpen = !!(edge && sourceNode && targetNode);

  return (
    <AnimatePresence>
      {isOpen && config && (
        <motion.div
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 200 }}
          className="glass-panel absolute right-3 top-16 bottom-16 w-[320px] rounded-xl z-10 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: getEdgeColor(config, edge.edge_type) }}
                  />
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: getEdgeColor(config, edge.edge_type) }}
                  >
                    {formatEdgeType(edge.edge_type)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="truncate font-medium">{sourceNode.label}</span>
                  <ArrowRight className="size-3 text-muted-foreground/50 shrink-0" />
                  <span className="truncate font-medium">{targetNode.label}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClose}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Clicked edge detail */}
          <div className="p-4 border-b border-white/5">
            <EdgeCard edge={edge} nodeId={sourceNode.id} config={config} highlighted />
          </div>

          {/* All connections section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3 pb-2 space-y-2">
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                All connections ({filteredEdges.length})
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search connections..."
                  className="h-7 pl-7 text-xs bg-white/[0.03] border-white/[0.06]"
                />
              </div>

              {/* Type filter chips */}
              <div className="flex flex-wrap gap-1">
                {edgeTypes.map((type) => {
                  const color = getEdgeColor(config, type);
                  const active = activeFilters.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                        active
                          ? "bg-white/[0.06] border-white/[0.1] text-foreground"
                          : "bg-white/[0.01] border-white/[0.04] text-muted-foreground/40"
                      }`}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: active ? color : `${color}40` }}
                      />
                      {formatEdgeType(type)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Edge list */}
            <ScrollArea className="flex-1">
              <div className="px-4 pb-4 space-y-1.5">
                {filteredEdges.map((e) => (
                  <EdgeCard
                    key={e.id}
                    edge={e}
                    nodeId={sourceNode.id}
                    config={config}
                    highlighted={e.id === edge.id}
                  />
                ))}
                {filteredEdges.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 text-center py-4">
                    No matching connections
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
