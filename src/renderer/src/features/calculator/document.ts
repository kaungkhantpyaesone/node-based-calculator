import { connectionError } from './graph'
import { comparisonOperators, nameError } from './model'
import type {
  CalculatorDocument,
  CalculatorEdge,
  CalculatorNode,
  Operand,
} from './model'

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`)
  return value
}

function identifier(value: unknown, label: string): string {
  const id = text(value, label)
  if (!id.length) throw new Error(`${label} cannot be empty.`)
  return id
}

function coordinate(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${label} must be a finite number.`)
  return value
}

function dimension(value: unknown, label: string): number {
  const size = coordinate(value, label)
  if (size <= 0) throw new Error(`${label} must be greater than zero.`)
  return size
}

function readOperand(value: unknown): Operand {
  const operand = record(value, 'Condition operand')
  if (operand.kind === 'number')
    return { kind: 'number', value: text(operand.value, 'Operand value') }
  if (operand.kind === 'node')
    return { kind: 'node', nodeId: text(operand.nodeId, 'Operand node ID') }
  throw new Error('Unknown condition operand type.')
}

function readNode(value: unknown): CalculatorNode {
  const node = record(value, 'Node')
  const position = record(node.position, 'Node position')
  const data = record(node.data, 'Node data')
  const common = {
    id: identifier(node.id, 'Node ID'),
    ...(node.width === undefined
      ? {}
      : { width: dimension(node.width, 'Node width') }),
    ...(node.height === undefined
      ? {}
      : { height: dimension(node.height, 'Node height') }),
    position: {
      x: coordinate(position.x, 'Position x'),
      y: coordinate(position.y, 'Position y'),
    },
  }
  const named = {
    name: text(data.name, 'Node name'),
    nameDraft: text(data.nameDraft, 'Name draft'),
  }
  if (node.type === 'variable')
    return {
      ...common,
      type: 'variable',
      data: { ...named, value: text(data.value, 'Variable value') },
    }
  if (node.type === 'calculation')
    return {
      ...common,
      type: 'calculation',
      data: { ...named, expression: text(data.expression, 'Expression') },
    }
  if (node.type !== 'control') throw new Error('Unknown node type.')
  if (data.mode !== 'variable' && data.mode !== 'calculation')
    throw new Error('Unknown control-flow mode.')
  const condition = record(data.condition, 'Condition')
  if (
    !comparisonOperators.includes(
      condition.operator as (typeof comparisonOperators)[number],
    )
  )
    throw new Error('Unknown comparison operator.')
  return {
    ...common,
    type: 'control',
    data: {
      ...named,
      mode: data.mode,
      condition: {
        left: readOperand(condition.left),
        operator: condition.operator as (typeof comparisonOperators)[number],
        right: readOperand(condition.right),
      },
      ifValue: text(data.ifValue, 'If value'),
      elseValue: text(data.elseValue, 'Else value'),
    },
  }
}

export function readDocument(json: string): CalculatorDocument {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const document = record(value, 'Document')
  if (document.version !== 1)
    throw new Error('Unsupported calculator file version. Expected version 1.')
  if (!Array.isArray(document.nodes) || !Array.isArray(document.edges))
    throw new Error('The file must contain nodes and edges arrays.')

  // Read only document fields, excluding React Flow presentation and callbacks.
  const nodes = document.nodes.map(readNode)
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length)
    throw new Error('Node IDs must be unique.')
  for (const node of nodes) {
    const invalidName = nameError(nodes, node.id, node.data.name)
    if (invalidName) throw new Error(invalidName)
  }

  const edges: CalculatorEdge[] = []
  for (const value of document.edges) {
    const edge = record(value, 'Edge')
    const id = identifier(edge.id, 'Edge ID')
    if (edges.some((existing) => existing.id === id))
      throw new Error('Edge IDs must be unique.')
    const candidate = {
      source: identifier(edge.source, 'Edge source'),
      target: identifier(edge.target, 'Edge target'),
      sourceHandle: text(edge.sourceHandle, 'Source handle'),
      targetHandle: text(edge.targetHandle, 'Target handle'),
    }
    const invalidConnection = connectionError(nodes, edges, candidate)
    if (invalidConnection) throw new Error(invalidConnection)
    edges.push({ id, ...candidate } as CalculatorEdge)
  }

  const viewport = record(document.viewport, 'Viewport')
  const zoom = coordinate(viewport.zoom, 'Viewport zoom')
  if (zoom < 0.1 || zoom > 4)
    throw new Error('Viewport zoom must be between 0.1 and 4.')
  return {
    version: 1,
    nodes,
    edges,
    viewport: {
      x: coordinate(viewport.x, 'Viewport x'),
      y: coordinate(viewport.y, 'Viewport y'),
      zoom,
    },
  }
}

export function serializeDocument(document: CalculatorDocument): string {
  return JSON.stringify(
    {
      version: document.version,
      nodes: document.nodes.map(
        ({ id, type, position, width, height, data }) => ({
          id,
          type,
          position: { x: position.x, y: position.y },
          width,
          height,
          data,
        }),
      ),
      edges: document.edges.map(
        ({ id, source, sourceHandle, target, targetHandle }) => ({
          id,
          source,
          sourceHandle,
          target,
          targetHandle,
        }),
      ),
      viewport: document.viewport,
    },
    null,
    2,
  )
}

export function downloadDocument(
  document: CalculatorDocument,
  filename: string,
): void {
  const url = URL.createObjectURL(
    new Blob([serializeDocument(document)], { type: 'application/json' }),
  )
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  window.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Keep the URL alive until the browser has consumed the download request.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
