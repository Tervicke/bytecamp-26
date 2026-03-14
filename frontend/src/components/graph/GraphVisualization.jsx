import { useRef, useCallback, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useAmlStore } from '../../store/aml.store';

// Node colors by flag level
const FLAG_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  NONE: '#4b5563',
};

// Link colors
const LINK_COLOR_CYCLE = '#ef4444';
const LINK_COLOR_SUSPICIOUS = '#f97316';
const LINK_COLOR_NORMAL = 'rgba(255,255,255,0.12)';

function drawNode(node, ctx, globalScale, selectedId) {
  const size = node.type === 'account' ? 8 : node.type === 'person' ? 7 : 9;
  const color = FLAG_COLORS[node.flagLevel] || FLAG_COLORS.NONE;
  const isSelected = node.id === selectedId;

  ctx.save();

  // Glow for critical
  if (node.flagLevel === 'CRITICAL') {
    ctx.shadowColor = color;
    ctx.shadowBlur = isSelected ? 20 : 10;
  }

  // Draw shape based on type
  ctx.fillStyle = isSelected ? '#6366f1' : color;
  ctx.strokeStyle = isSelected ? '#818cf8' : color;
  ctx.lineWidth = isSelected ? 2.5 : 1.5;

  const x = node.x, y = node.y;

  if (node.type === 'company') {
    // Circle
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (node.type === 'person') {
    // Diamond
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Square (bank account)
    const half = size * 0.8;
    ctx.beginPath();
    ctx.rect(x - half, y - half, half * 2, half * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  // Label
  if (globalScale >= 0.7) {
    const label = node.name?.length > 14 ? node.name.slice(0, 13) + '…' : node.name;
    ctx.font = `${Math.max(4, 6 / globalScale)}px Inter`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y + size + 2);
  }

  ctx.restore();
}

export default function GraphVisualization({ graphData, highlightNodeIds = new Set(), highlightLinkIds = new Set(), onNodeClick, height = 520 }) {
  const fgRef = useRef();
  const { selectedNodeId } = useAmlStore();

  const processedData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    return {
      nodes: graphData.nodes.map(n => ({ ...n })),
      links: graphData.links.map(l => ({ ...l })),
    };
  }, [graphData]);

  const getLinkColor = useCallback((link) => {
    if (link.isCycle) return LINK_COLOR_CYCLE;
    if (link.properties?.isSuspicious) return LINK_COLOR_SUSPICIOUS;
    return LINK_COLOR_NORMAL;
  }, []);

  const getLinkWidth = useCallback((link) => {
    if (link.isCycle || link.properties?.isSuspicious) return 2;
    return 1;
  }, []);

  const getLinkDash = useCallback((link) => {
    return link.isCycle ? [4, 2] : null;
  }, []);

  const handleNodeClick = useCallback((node) => {
    onNodeClick && onNodeClick(node);
  }, [onNodeClick]);

  // Center graph on load
  useEffect(() => {
    if (fgRef.current) {
      setTimeout(() => fgRef.current?.zoomToFit(400, 40), 500);
    }
  }, [processedData]);

  return (
    <div className="graph-container w-full rounded-xl overflow-hidden bg-navy-800/50 border border-white/5">
      <ForceGraph2D
        ref={fgRef}
        graphData={processedData}
        width={undefined}
        height={height}
        backgroundColor="#0d1117"
        nodeCanvasObject={(node, ctx, globalScale) =>
          drawNode(node, ctx, globalScale, selectedNodeId)
        }
        nodeCanvasObjectMode={() => 'replace'}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        linkLineDash={getLinkDash}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(link) => (link.isCycle || link.properties?.isSuspicious ? 3 : 0)}
        linkDirectionalParticleColor={getLinkColor}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.006}
        linkCurvature={0.1}
        onNodeClick={handleNodeClick}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
