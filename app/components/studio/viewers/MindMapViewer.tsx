'use client'

import { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ipc } from '../../../lib/ipc'

interface MindMapNode {
  name: string
  children?: MindMapNode[]
}

interface Props {
  notebookId: string
}

let nodeId = 0
const nextId = () => `mm-${++nodeId}`

function buildGraph(
  node: MindMapNode,
  parentId: string | null,
  x: number,
  y: number,
  depth: number,
  nodes: Node[],
  edges: Edge[],
) {
  const id = nextId()
  nodes.push({
    id,
    position: { x, y },
    data: { label: node.name },
    style: {
      background: depth === 0 ? 'var(--color-accent)' : 'var(--color-elevated)',
      color: depth === 0 ? '#fff' : 'var(--color-text-primary)',
      border: `1px solid ${depth === 0 ? 'var(--color-accent)' : 'var(--color-separator)'}`,
      borderRadius: '8px',
      fontSize: depth === 0 ? '13px' : '12px',
      fontWeight: depth === 0 ? '600' : '400',
      padding: '6px 12px',
      minWidth: '80px',
      textAlign: 'center',
    },
  })
  if (parentId) {
    edges.push({
      id: `e-${parentId}-${id}`,
      source: parentId,
      target: id,
      style: { stroke: 'var(--color-separator)', strokeWidth: 1.5 },
    })
  }
  const children = node.children ?? []
  const spread = 160
  const startX = x - ((children.length - 1) * spread) / 2
  children.forEach((child, i) => {
    buildGraph(child, id, startX + i * spread, y + 120, depth + 1, nodes, edges)
  })
}

export function MindMapViewer({ notebookId }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    nodeId = 0
    setLoading(true)
    ipc.getArtifactData(notebookId, 'mind_map')
      .then((data: unknown) => {
        const root = parseMindMap(data)
        if (!root) { setError('Could not parse mind map data'); setLoading(false); return }
        const ns: Node[] = []
        const es: Edge[] = []
        buildGraph(root, null, 0, 0, 0, ns, es)
        setNodes(ns)
        setEdges(es)
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [notebookId])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-sm text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
    </div>
  )

  return (
    <div className="h-full w-full" style={{ background: 'var(--color-app-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Controls
          style={{
            background: 'var(--color-elevated)',
            border: '1px solid var(--color-separator)',
            borderRadius: '8px',
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-separator)" />
      </ReactFlow>
    </div>
  )
}

function parseMindMap(data: unknown): MindMapNode | null {
  if (!data) return null
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>
    if (d.name) return d as unknown as MindMapNode
    // Some APIs return { root: {...} }
    if (d.root) return d.root as MindMapNode
  }
  return null
}
