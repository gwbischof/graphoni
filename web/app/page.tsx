"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Inbox, Bookmark, Layers, History } from "lucide-react";

import { Starfield } from "@/components/starfield";
const GraphCanvas = dynamic(
  () => import("@/components/graph-canvas-sigma").then((m) => ({ default: m.GraphCanvas })),
  { ssr: false }
);
import { ControlPanel } from "@/components/control-panel";
import { DetailPanel } from "@/components/detail-panel";
import { ConnectionsPanel } from "@/components/connections-panel";
import { GraphLegend } from "@/components/graph-legend";
import { BreadcrumbBar } from "@/components/breadcrumb-bar";
import { SaveViewDialog } from "@/components/save-view-dialog";
import { ProposalForm } from "@/components/proposal-form";
import { ModQueue } from "@/components/mod-queue";
import { UserMenu } from "@/components/user-menu";
import { AuditLogPanel } from "@/components/audit-log-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { NodeData, EdgeData } from "@/lib/graph-data";
import type { GraphConfig } from "@/lib/graph-config";
import { loadGraphConfig } from "@/lib/graph-config";
import { useGraphView } from "@/hooks/use-graph-view";

/** Build a Map<nodeType, Set<subtypeKey>> with all subtypes active */
function buildAllSubtypes(config: GraphConfig): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [typeName, ntConfig] of Object.entries(config.nodeTypes)) {
    map.set(typeName, new Set(Object.keys(ntConfig.subtypes)));
  }
  return map;
}

export default function Home() {
  // Auth
  const { data: session } = useSession();

  // Config
  const [config, setConfig] = useState<GraphConfig | null>(null);

  // Graph view state (hierarchical zoom, community expansion, views)
  const graphView = useGraphView();

  // Selection
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null);
  const [selectedEdgeSource, setSelectedEdgeSource] = useState<NodeData | null>(null);
  const [selectedEdgeTarget, setSelectedEdgeTarget] = useState<NodeData | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubtypes, setActiveSubtypes] = useState<Map<string, Set<string>>>(new Map());
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<Set<string>>(new Set());

  // Dialogs
  const [proposalFormOpen, setProposalFormOpen] = useState(false);
  const [modQueueOpen, setModQueueOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);

  // Pending count (fetched from API)
  const [pendingCount, setPendingCount] = useState(0);

  // Load config
  useEffect(() => {
    loadGraphConfig()
      .then((cfg) => {
        setConfig(cfg);
        setActiveSubtypes(buildAllSubtypes(cfg));
        setActiveEdgeTypes(new Set(Object.keys(cfg.edgeTypes)));
      })
      .catch((err) => console.error("Failed to load config:", err));
  }, []);

  // Fetch pending count when authenticated
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/proposals?status=pending&limit=1")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.proposals?.length ?? 0))
      .catch(() => {});
  }, [session]);

  // Counts
  const nodeCount = graphView.elements.filter((e) => e.group === "nodes").length;
  const edgeCount = graphView.elements.filter((e) => e.group === "edges").length;

  // Handlers
  const handleNodeSelect = useCallback(
    (node: NodeData | null) => {
      setSelectedNode(node);
      // Close connections panel when a node is clicked
      setSelectedEdge(null);
      setSelectedEdgeSource(null);
      setSelectedEdgeTarget(null);
    },
    []
  );

  const handleEdgeSelect = useCallback(
    (edge: EdgeData, sourceNode: NodeData, targetNode: NodeData) => {
      setSelectedEdge(edge);
      setSelectedEdgeSource(sourceNode);
      setSelectedEdgeTarget(targetNode);
      // Close detail panel when an edge is clicked
      setSelectedNode(null);
    },
    []
  );

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      if (graphView.isCommunityNode(nodeId)) {
        const el = graphView.elements.find((e) => e.group === "nodes" && e.data.id === nodeId);
        const label = (el?.data as NodeData)?.label || nodeId;
        graphView.expandCommunity(nodeId, label);
      }
    },
    [graphView]
  );

  const handleToggleSubtype = useCallback((nodeType: string, subtype: string) => {
    setActiveSubtypes((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(nodeType) || []);
      if (set.has(subtype)) set.delete(subtype);
      else set.add(subtype);
      next.set(nodeType, set);
      return next;
    });
  }, []);

  const handleToggleEdgeType = useCallback((type: string) => {
    setActiveEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleFit = useCallback(() => {
    // Sigma handles camera internally
  }, []);

  const handleReset = useCallback(() => {
    if (!config) return;
    setSearchQuery("");
    setActiveSubtypes(buildAllSubtypes(config));
    setActiveEdgeTypes(new Set(Object.keys(config.edgeTypes)));
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedEdgeSource(null);
    setSelectedEdgeTarget(null);
  }, [config]);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleCloseConnections = useCallback(() => {
    setSelectedEdge(null);
    setSelectedEdgeSource(null);
    setSelectedEdgeTarget(null);
  }, []);

  const handleSaveView = useCallback(
    async (name: string, description: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      try {
        await fetch("/api/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            name,
            description,
            query: { type: "search", q: searchQuery || "all" },
          }),
        });
      } catch (err) {
        console.error("Failed to save view:", err);
      }
    },
    [searchQuery]
  );

  const isMod = session?.user?.role === "mod" || session?.user?.role === "admin";
  const isLoading = graphView.loading || !config;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Starfield background */}
      <Starfield />

      {/* Top bar */}
      <motion.div
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 200 }}
        className="glass-panel absolute top-3 left-3 right-3 h-10 rounded-xl z-20 flex items-center justify-between px-4"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xs font-medium tracking-wide">Graphoni</h1>
          <div className="w-px h-4 bg-white/8" />
          <span className="text-[10px] font-mono text-muted-foreground">
            {isLoading ? "Loading..." : `${nodeCount} nodes / ${edgeCount} edges`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Views link */}
          <Link href="/view">
            <Button variant="ghost" size="xs" className="gap-1.5 text-[10px] text-muted-foreground">
              <Layers className="size-3" />
              Views
            </Button>
          </Link>

          {/* Save as View */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSaveViewOpen(true)}
            className="gap-1.5 text-[10px] text-muted-foreground"
          >
            <Bookmark className="size-3" />
            Save
          </Button>

          <div className="w-px h-4 bg-white/8" />

          {/* User menu (replaces mod toggle) */}
          <UserMenu />

          <div className="w-px h-4 bg-white/8" />

          {/* Proposals button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setModQueueOpen(true)}
            className="gap-1.5 text-[10px] text-muted-foreground"
          >
            <Inbox className="size-3" />
            Proposals
            {pendingCount > 0 && (
              <Badge
                variant="outline"
                className="text-[8px] font-mono h-3.5 px-1 bg-yellow-500/15 border-yellow-500/25 text-yellow-400 ml-0.5"
              >
                {pendingCount}
              </Badge>
            )}
          </Button>

          {/* Audit log (mod+) */}
          {isMod && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setAuditLogOpen(true)}
              className="gap-1.5 text-[10px] text-muted-foreground"
            >
              <History className="size-3" />
              Audit
            </Button>
          )}
        </div>
      </motion.div>

      {/* Breadcrumb bar */}
      <BreadcrumbBar
        items={graphView.breadcrumb}
        onNavigate={(index) => graphView.collapseTo(index)}
      />

      {/* Graph */}
      {!isLoading && graphView.elements.length > 0 && (
        <GraphCanvas
          elements={graphView.elements}
          searchQuery={searchQuery}
          activeSubtypes={activeSubtypes}
          activeEdgeTypes={activeEdgeTypes}
          onNodeSelect={handleNodeSelect}
          onEdgeSelect={handleEdgeSelect}
          onNodeDoubleClick={handleNodeDoubleClick}
          config={config!}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-muted-foreground font-mono">Loading graph data...</p>
          </motion.div>
        </div>
      )}

      {/* Control Panel (left) */}
      {!isLoading && config && (
        <ControlPanel
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeSubtypes={activeSubtypes}
          onToggleSubtype={handleToggleSubtype}
          activeEdgeTypes={activeEdgeTypes}
          onToggleEdgeType={handleToggleEdgeType}
          onFit={handleFit}
          onReset={handleReset}
          nodeCount={nodeCount}
          edgeCount={edgeCount}
          config={config}
        />
      )}

      {/* Detail Panel (right) */}
      <DetailPanel
        node={selectedNode}
        onClose={handleCloseDetail}
        onProposeEdit={() => setProposalFormOpen(true)}
        config={config}
      />

      {/* Connections Panel (right, when edge clicked) */}
      <ConnectionsPanel
        edge={selectedEdge}
        sourceNode={selectedEdgeSource}
        targetNode={selectedEdgeTarget}
        elements={graphView.elements}
        onClose={handleCloseConnections}
        config={config}
      />

      {/* Legend (bottom) */}
      {!isLoading && config && <GraphLegend config={config} />}

      {/* Save View Dialog */}
      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        onSave={handleSaveView}
      />

      {/* Proposal Form */}
      <ProposalForm
        open={proposalFormOpen}
        onOpenChange={setProposalFormOpen}
        node={selectedNode}
      />

      {/* Mod Queue */}
      <ModQueue
        open={modQueueOpen}
        onOpenChange={(open) => {
          setModQueueOpen(open);
          // Refresh pending count when closing
          if (!open && session?.user) {
            fetch("/api/proposals?status=pending&limit=1")
              .then((r) => r.json())
              .then((data) => setPendingCount(data.proposals?.length ?? 0))
              .catch(() => {});
          }
        }}
      />

      {/* Audit Log */}
      <AuditLogPanel
        open={auditLogOpen}
        onOpenChange={setAuditLogOpen}
      />
    </div>
  );
}
