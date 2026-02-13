"use client";

import { useSession, signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PenLine, Zap, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NodeData } from "@/lib/graph-data";
import type { GraphConfig } from "@/lib/graph-config";
import { getNodeColor, getStatusStyle } from "@/lib/graph-config";

interface DetailPanelProps {
  node: NodeData | null;
  onClose: () => void;
  onProposeEdit: () => void;
  config: GraphConfig | null;
}

function StatusBadge({ status, config }: { status: string; config: GraphConfig }) {
  const classes = getStatusStyle(config, status);
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${classes}`}
    >
      {config.statusStyles[status]?.label || status}
    </span>
  );
}

/** Get the subtype value for a node given its type */
function getSubtypeValue(node: NodeData, config: GraphConfig): string | undefined {
  const ntConfig = config.nodeTypes[node.node_type];
  if (!ntConfig) return undefined;
  return node[ntConfig.subtypeField] as string | undefined;
}

export function DetailPanel({ node, onClose, onProposeEdit, config }: DetailPanelProps) {
  const { data: session } = useSession();
  const color = node && config
    ? getNodeColor(config, node.node_type, getSubtypeValue(node, config))
    : "#565f89";

  const subtypeValue = node && config ? getSubtypeValue(node, config) : undefined;
  const subtypeField = node && config ? config.nodeTypes[node.node_type]?.subtypeField : undefined;
  const isAdmin = session?.user?.role === "admin";
  const isLoggedIn = !!session?.user;

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 200 }}
          className="glass-panel absolute right-3 top-16 bottom-16 w-[300px] rounded-xl z-10 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <h2 className="text-sm font-medium truncate">{node.label}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono h-5 border-white/10 bg-white/[0.03]"
                  >
                    {node.node_type}
                  </Badge>
                  {subtypeValue && subtypeField && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono h-5 border-white/10"
                      style={{ backgroundColor: `${color}15`, borderColor: `${color}30`, color }}
                    >
                      {subtypeValue}
                    </Badge>
                  )}
                  {node.status && config && <StatusBadge status={node.status} config={config} />}
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

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Properties */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                  Properties
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-[11px] truncate">{node.id}</span>
                  {node.doc_count > 0 && (
                    <>
                      <span className="text-muted-foreground">Documents</span>
                      <span className="font-mono text-[11px]">
                        {node.doc_count.toLocaleString()}
                      </span>
                    </>
                  )}
                  {node.network && (
                    <>
                      <span className="text-muted-foreground">Network</span>
                      <span className="text-[11px]">{node.network}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              {node.notes && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                    Notes
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {node.notes}
                  </p>
                </div>
              )}

            </div>
          </ScrollArea>

          {/* Footer: conditional on auth state */}
          <div className="p-3 border-t border-white/5 space-y-1.5">
            {isLoggedIn ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onProposeEdit}
                  className="w-full h-8 text-xs gap-1.5 bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                >
                  <PenLine className="size-3" />
                  Propose Edit
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onProposeEdit}
                    className="w-full h-8 text-xs gap-1.5 bg-yellow-500/5 border-yellow-500/15 hover:bg-yellow-500/10 text-yellow-400"
                  >
                    <Zap className="size-3" />
                    Edit Directly (Admin)
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => signIn()}
                className="w-full h-8 text-xs gap-1.5 bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
              >
                <LogIn className="size-3" />
                Sign in to propose edits
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
