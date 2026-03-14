import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAmlStore } from '../store/aml.store';
import GraphVisualization from '../components/graph/GraphVisualization';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';
import { Info, GitFork, Layers, ZoomIn } from 'lucide-react';

export default function GraphView() {
  const { data: graphData, isLoading } = useQuery({
    queryKey: ['graph'],
    queryFn: api.getFullGraph,
  });

  const { selectNode } = useAmlStore();
  const [filter, setFilter] = useState('ALL');

  const filteredGraph = graphData ? (() => {
    if (filter === 'ALL') return graphData;
    const nodes = graphData.nodes.filter(n => n.flagLevel === filter || filter === 'ALL');
    const nodeIds = new Set(nodes.map(n => n.id));
    return {
      nodes,
      links: graphData.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target)),
    };
  })() : null;

  const nodeCount = filteredGraph?.nodes.length ?? 0;
  const linkCount = filteredGraph?.links.length ?? 0;
  const criticalCount = filteredGraph?.nodes.filter(n => n.flagLevel === 'CRITICAL').length ?? 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Controls row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-200 ${
                filter === f
                  ? f === 'CRITICAL' ? 'bg-red-500/30 text-red-300 border-red-400/50' :
                    f === 'HIGH' ? 'bg-orange-500/30 text-orange-300 border-orange-400/50' :
                    f === 'MEDIUM' ? 'bg-yellow-500/30 text-yellow-300 border-yellow-400/50' :
                    f === 'LOW' ? 'bg-blue-500/30 text-blue-300 border-blue-400/50' :
                    f === 'NONE' ? 'bg-gray-500/30 text-gray-300 border-gray-400/50' :
                    'bg-indigo-500/30 text-indigo-300 border-indigo-400/50'
                  : 'bg-transparent text-gray-500 border-white/10 hover:border-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          <span><span className="text-white font-medium">{nodeCount}</span> nodes</span>
          <span><span className="text-white font-medium">{linkCount}</span> edges</span>
          <span><span className="text-red-400 font-medium">{criticalCount}</span> critical</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 p-3 rounded-lg bg-navy-700/40 border border-white/5 text-xs text-gray-400 flex-wrap">
        <div className="flex items-center gap-3 font-medium text-gray-300">
          <Layers className="w-3.5 h-3.5" /> Node Shapes:
        </div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-gray-400 bg-gray-600" />Company</div>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,0 14,7 7,14 0,7" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
          </svg>
          Person
        </div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 border border-gray-400 bg-gray-600" />Bank Account</div>
        <div className="mx-2 h-4 w-px bg-white/10" />
        <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #ef4444', display: 'block', background: 'none', height: '0' }} /></div>
        <div className="flex items-center gap-1.5">
          <span style={{ display: 'inline-block', width: 24, height: 2, background: 'linear-gradient(90deg, #ef4444 0%, transparent 50%, #ef4444 100%)', borderTop: '2px dashed #ef4444', borderTopColor: '#ef4444' }} />
          Cycle path (animated)
        </div>
        <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-orange-500" />Suspicious transfer</div>
        <div className="flex items-center gap-1.5 ml-auto"><Info className="w-3.5 h-3.5" />Click node for details</div>
      </div>

      {/* Main graph */}
      {isLoading ? (
        <div className="h-[600px] bg-navy-700/50 rounded-xl border border-white/5 animate-pulse flex items-center justify-center">
          <p className="text-gray-500">Loading entity graph from Neo4j...</p>
        </div>
      ) : filteredGraph ? (
        <div className="relative">
          <GraphVisualization
            graphData={filteredGraph}
            height={600}
            onNodeClick={(node) => selectNode(node.id)}
          />
          <NodeDetailPanel />

          {/* Cycle indicator overlay */}
          {criticalCount > 0 && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
              <GitFork className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="text-xs text-red-300 font-medium">
                Circular cycle detected — animated paths
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
