"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { LocateFixed, Minus, Plus } from "lucide-react"
import { type KnowledgeEdge, type KnowledgeNode } from "@/lib/learning-map-data"
import { type GraphModuleGroup } from "@/lib/learning-map-utils"
import { cn } from "@/lib/utils"
import type { Locale } from "@/lib/bilingual-ui"

type Point = { x: number; y: number }
type ViewState = { x: number; y: number; scale: number }

const GRAPH_WIDTH = 1900
const GRAPH_HEIGHT = 900
const INITIAL_VIEW: ViewState = { x: 0, y: 0, scale: 1 }

const nodeSize = {
  goal: { width: 178, height: 58 },
  knowledge: { width: 158, height: 52 },
  ability: { width: 158, height: 52 },
  course: { width: 184, height: 62 },
}

const graphCopy = {
  zh: {
    aria: "个人学习知识图谱",
    caption: "图谱已展开 · 拖动节点或画布探索",
    legend: "图谱图例",
    goal: "你的选择",
    knowledge: "知识点",
    ability: "能力",
    course: "现有课程",
    required: "必修前置（MySQL）",
    related: "相关知识，非必修",
    canvas: "可拖动、可缩放的知识关系图",
    groupNote: "同模块课程与相关知识",
  },
  en: {
    aria: "Personal learning knowledge graph",
    caption: "Graph expanded · drag nodes or the canvas to explore",
    legend: "Knowledge graph legend",
    goal: "Your choice",
    knowledge: "Knowledge",
    ability: "Capability",
    course: "Course",
    required: "Required prerequisite (MySQL)",
    related: "Related knowledge, optional",
    canvas: "Draggable and zoomable knowledge graph",
    groupNote: "Courses and related knowledge in this module",
  },
} as const

function fittedView(nodes: KnowledgeNode[], moduleGroups: GraphModuleGroup[]): ViewState {
  if (!nodes.length && !moduleGroups.length) return INITIAL_VIEW
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const include = (minX: number, minY: number, maxX: number, maxY: number) => {
    bounds.minX = Math.min(bounds.minX, minX); bounds.minY = Math.min(bounds.minY, minY)
    bounds.maxX = Math.max(bounds.maxX, maxX); bounds.maxY = Math.max(bounds.maxY, maxY)
  }
  for (const group of moduleGroups) include(group.x, group.y, group.x + group.width, group.y + group.height)
  for (const node of nodes) {
    const size = nodeSize[node.type]
    include(node.x - size.width / 2, node.y - size.height / 2, node.x + size.width / 2, node.y + size.height / 2)
  }
  const padding = 42
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX)
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(1.28, Math.max(0.55, Math.min(
    (GRAPH_WIDTH - padding * 2) / contentWidth,
    (GRAPH_HEIGHT - padding * 2) / contentHeight,
  )))
  return {
    scale,
    x: (GRAPH_WIDTH - contentWidth * scale) / 2 - bounds.minX * scale,
    y: (GRAPH_HEIGHT - contentHeight * scale) / 2 - bounds.minY * scale,
  }
}

export function KnowledgeGraph({
  nodes,
  edges,
  moduleGroups = [],
  selectedNode,
  pathIds,
  locale,
  onSelect,
}: {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  moduleGroups: GraphModuleGroup[]
  selectedNode?: string
  pathIds: string[]
  locale: Locale
  onSelect: (node: KnowledgeNode) => void
}) {
  const copy = graphCopy[locale]
  const shortType = {
    goal: copy.goal,
    knowledge: copy.knowledge,
    ability: copy.ability,
    course: copy.course,
  }
  const [view, setView] = useState(INITIAL_VIEW)
  const [positions, setPositions] = useState<Record<string, Point>>({})
  const action = useRef<{
    kind: "pan" | "node"
    id?: string
    moved: boolean
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const pos = (node: KnowledgeNode) => positions[node.id] ?? { x: node.x, y: node.y }
  const layoutSignature = useMemo(
    () => `${nodes.map((node) => `${node.id}:${node.x}:${node.y}`).join("|")}#${moduleGroups.map((group) => `${group.id}:${group.x}:${group.y}`).join("|")}`,
    [nodes, moduleGroups],
  )

  // New target selections and new MySQL data get the largest safe initial
  // scale automatically. Dragging afterwards remains entirely manual.
  useEffect(() => {
    setPositions({})
    setView(fittedView(nodes, moduleGroups))
  }, [layoutSignature, nodes, moduleGroups])

  function pointerMove(event: React.PointerEvent<SVGSVGElement>) {
    // React may execute the state updater after pointerup clears the ref.
    // Capture the active drag synchronously so a final pointer move cannot
    // dereference action.current after it becomes null.
    const drag = action.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 5) return
    drag.moved = true

    if (drag.kind === "pan") {
      setView((current) => ({
        ...current,
        x: drag.originX + dx,
        y: drag.originY + dy,
      }))
      return
    }

    const nodeId = drag.id
    if (nodeId) {
      setPositions((current) => ({
        ...current,
        [nodeId]: {
          x: drag.originX + dx / view.scale,
          y: drag.originY + dy / view.scale,
        },
      }))
    }
  }

  function pointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const drag = action.current
    action.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (drag?.kind === "node" && !drag.moved && drag.id) {
      const node = nodeMap.get(drag.id)
      if (node) onSelect(node)
    }
  }

  function pointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    action.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function zoom(delta: number) {
    setView((current) => ({
      ...current,
      scale: Math.min(1.45, Math.max(0.55, current.scale + delta)),
    }))
  }

  return (
    <section className="graph-wrap" aria-label={copy.aria}>
      <div className="graph-caption"><span className="live-dot" />{copy.caption}</div>

      <div className="graph-legend" aria-label={copy.legend}>
        <span><i className="legend-goal" />{copy.goal}</span>
        <span><i className="legend-knowledge" />{copy.knowledge}</span>
        <span><i className="legend-ability" />{copy.ability}</span>
        <span><i className="legend-course" />{copy.course}</span>
        <span className="legend-edge is-required"><i />{copy.required}</span>
        <span className="legend-edge is-related"><i />{copy.related}</span>
      </div>

      <svg
        className="graph-canvas"
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        role="group"
        aria-label={copy.canvas}
        onPointerDown={(event) => {
          if (event.button === 0 && event.target === event.currentTarget) {
            event.currentTarget.setPointerCapture(event.pointerId)
            action.current = {
              kind: "pan",
              moved: false,
              startX: event.clientX,
              startY: event.clientY,
              originX: view.x,
              originY: view.y,
            }
          }
        }}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onWheel={(event) => {
          event.preventDefault()
          zoom(event.deltaY > 0 ? -0.08 : 0.08)
        }}
      >
        <defs>
          <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 Z" className="arrow-head" />
          </marker>
          <marker id="arrow-bi" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 Z" className="arrow-head bidirectional" />
          </marker>
          <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 Z" className="arrow-head active" />
          </marker>
        </defs>

        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {moduleGroups.map((group) => (
            <g key={group.id} className="graph-module-group" aria-label={group.name}>
              <rect x={group.x} y={group.y} width={group.width} height={group.height} rx="22" />
              <text x={group.x + 22} y={group.y + 30}>{group.name}</text>
              <text className="graph-module-group-note" x={group.x + 22} y={group.y + 51}>{copy.groupNote}</text>
            </g>
          ))}
          {edges.map((edge, index) => {
            const source = nodeMap.get(edge.source)
            const target = nodeMap.get(edge.target)
            if (!source || !target) return null

            const a = pos(source)
            const b = pos(target)
            const active = pathIds.includes(source.id) || pathIds.includes(target.id)
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            const curve = index % 2 === 0 ? -22 : 22
            const marker = active ? "arrow-active" : edge.direction === "bidirectional" ? "arrow-bi" : "arrow"

            return (
              <g
                key={edge.id}
                className={cn(
                  "edge",
                  edge.kind === "REQUIRED_PREREQUISITE" ? "is-required-prerequisite" : "is-related-knowledge",
                  active && "is-path",
                )}
              >
                <path
                  d={`M ${a.x} ${a.y} Q ${mx} ${my + curve} ${b.x} ${b.y}`}
                  markerEnd={`url(#${marker})`}
                  markerStart={edge.direction === "bidirectional" ? `url(#${marker})` : undefined}
                />
              </g>
            )
          })}

          {nodes.map((node, index) => {
            const p = pos(node)
            const size = nodeSize[node.type]
            return (
              <g
                key={node.id}
                className={cn("graph-node", `node-${node.type}`, selectedNode === node.id && "is-active")}
                transform={`translate(${p.x} ${p.y})`}
                style={{ animationDelay: `${Math.min(index * 38, 520)}ms` }}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}，${shortType[node.type]}`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelect(node)
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.stopPropagation()
                  event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
                  action.current = {
                    kind: "node",
                    id: node.id,
                    moved: false,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: p.x,
                    originY: p.y,
                  }
                }}
              >
                <rect x={-size.width / 2} y={-size.height / 2} width={size.width} height={size.height} rx="15" />
                <circle cx={-size.width / 2 + 17} cy={-size.height / 2 + 16} r="3.5" />
                <text className="node-kind" x={-size.width / 2 + 29} y={-size.height / 2 + 19}>{shortType[node.type]}</text>
                <text className="node-label" textAnchor="middle" y="12">{node.label}</text>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="graph-controls" aria-label={locale === "en" ? "Map zoom controls" : "地图缩放控件"}>
        <button type="button" onClick={() => zoom(0.12)} aria-label={locale === "en" ? "Zoom in" : "放大"}><Plus /></button>
        <button type="button" onClick={() => zoom(-0.12)} aria-label={locale === "en" ? "Zoom out" : "缩小"}><Minus /></button>
        <button type="button" onClick={() => setView(fittedView(nodes, moduleGroups))} aria-label={locale === "en" ? "Fit all nodes" : "适配全部节点"}><LocateFixed /></button>
      </div>
    </section>
  )
}
