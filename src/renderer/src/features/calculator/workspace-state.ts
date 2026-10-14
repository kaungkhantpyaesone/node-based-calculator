import type { NodeChange, EdgeChange } from '@xyflow/react'
import { serializeDocument } from './document'
import {
  connectionError,
  evaluateGraph,
  modeIsLocked,
  renameNode,
} from './graph'
import type { CandidateConnection } from './graph'
import { createNode, emptyDocument } from './model'
import type {
  CalculatorDocument,
  CalculatorEdge,
  CalculatorNode,
  NodeKind,
  NodePatch,
  NodeResult,
} from './model'

type Replacement = { document: CalculatorDocument; filename: string }
export type WorkspaceState = {
  document: CalculatorDocument
  results: Map<string, NodeResult>
  savedSnapshot: string
  filename: string
  selectedNodes: string[]
  selectedEdges: string[]
  measurements: Record<string, { width: number; height: number }>
  minimumHeights: Record<string, number>
  pending: Replacement | null
  message: string | null
}

export type WorkspaceAction =
  | {
      type: 'add'
      kind: NodeKind
      position: { x: number; y: number }
      id: string
    }
  | { type: 'patch'; id: string; patch: NodePatch }
  | { type: 'rename'; id: string }
  | { type: 'connect'; connection: CandidateConnection; id: string }
  | { type: 'nodes-change'; changes: NodeChange[] }
  | { type: 'minimum-height'; id: string; height: number }
  | { type: 'edges-change'; changes: EdgeChange[] }
  | { type: 'delete'; nodeIds?: string[]; edgeIds?: string[] }
  | { type: 'viewport'; viewport: CalculatorDocument['viewport'] }
  | { type: 'request-replace'; replacement: Replacement }
  | { type: 'discard' }
  | { type: 'cancel' }
  | { type: 'saved'; snapshot: string; continueReplacement?: boolean }
  | { type: 'message'; message: string | null }

export function initialWorkspace(
  document = emptyDocument(),
  filename = 'calculator.json',
): WorkspaceState {
  return {
    document,
    filename,
    results: evaluateGraph(document.nodes, document.edges),
    savedSnapshot: serializeDocument(document),
    selectedNodes: [],
    selectedEdges: [],
    measurements: {},
    minimumHeights: {},
    pending: null,
    message: null,
  }
}

export function hasUnsavedChanges(state: WorkspaceState): boolean {
  return serializeDocument(state.document) !== state.savedSnapshot
}

function updateDocument(
  state: WorkspaceState,
  document: CalculatorDocument,
  evaluate = true,
): WorkspaceState {
  return {
    ...state,
    document,
    results: evaluate
      ? evaluateGraph(document.nodes, document.edges)
      : state.results,
  }
}

function withoutElements(
  document: CalculatorDocument,
  nodeIds: string[],
  edgeIds: string[],
): CalculatorDocument {
  return {
    ...document,
    nodes: document.nodes.filter((node) => !nodeIds.includes(node.id)),
    edges: document.edges.filter(
      (edge) =>
        !edgeIds.includes(edge.id) &&
        !nodeIds.includes(edge.source) &&
        !nodeIds.includes(edge.target),
    ),
  }
}

function selection(ids: string[], id: string, selected: boolean): string[] {
  return selected
    ? [...new Set([...ids, id])]
    : ids.filter((existing) => existing !== id)
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  const document = state.document
  switch (action.type) {
    case 'add':
      return updateDocument(state, {
        ...document,
        nodes: [
          ...document.nodes,
          createNode(action.kind, document.nodes, action.position, action.id),
        ],
      })
    case 'patch': {
      if (action.patch.mode && modeIsLocked(action.id, document.edges))
        return state
      const nodes = document.nodes.map((node) =>
        node.id === action.id
          ? ({
              ...node,
              data: { ...node.data, ...action.patch },
            } as CalculatorNode)
          : node,
      )
      return updateDocument(state, { ...document, nodes })
    }
    case 'rename':
      return updateDocument(state, renameNode(document, action.id))
    case 'connect': {
      const error = connectionError(
        document.nodes,
        document.edges,
        action.connection,
      )
      if (error) return { ...state, message: error }
      const edge = { id: action.id, ...action.connection } as CalculatorEdge
      return updateDocument(
        { ...state, message: null },
        { ...document, edges: [...document.edges, edge] },
      )
    }
    case 'nodes-change': {
      let selectedNodes = state.selectedNodes
      const measurements = { ...state.measurements }
      const removed = action.changes
        .filter((change) => change.type === 'remove')
        .map((change) => change.id)
      const updated = withoutElements(document, removed, [])
      updated.nodes = updated.nodes.map((node) => {
        let updatedNode = node
        for (const change of action.changes) {
          if (!('id' in change) || change.id !== node.id) continue
          if (change.type === 'position' && change.position)
            updatedNode = { ...updatedNode, position: change.position }

          // Only deliberate resizing is saved; observer measurements stay transient.
          if (change.type === 'dimensions' && change.dimensions) {
            if (
              change.setAttributes === true ||
              change.setAttributes === 'width'
            )
              updatedNode = { ...updatedNode, width: change.dimensions.width }
            if (
              change.setAttributes === true ||
              change.setAttributes === 'height'
            )
              updatedNode = { ...updatedNode, height: change.dimensions.height }
          }
        }
        return updatedNode
      })
      for (const change of action.changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          measurements[change.id] = change.dimensions
        }
        if (change.type === 'select')
          selectedNodes = selection(selectedNodes, change.id, change.selected)
      }
      return updateDocument(
        {
          ...state,
          measurements,
          selectedNodes: selectedNodes.filter((id) => !removed.includes(id)),
        },
        updated,
        removed.length > 0,
      )
    }
    case 'minimum-height':
      return state.minimumHeights[action.id] === action.height
        ? state
        : {
            ...state,
            minimumHeights: {
              ...state.minimumHeights,
              [action.id]: action.height,
            },
          }
    case 'edges-change': {
      let selectedEdges = state.selectedEdges
      const removed = action.changes
        .filter((change) => change.type === 'remove')
        .map((change) => change.id)
      for (const change of action.changes) {
        if (change.type === 'select')
          selectedEdges = selection(selectedEdges, change.id, change.selected)
      }
      return updateDocument(
        {
          ...state,
          selectedEdges: selectedEdges.filter((id) => !removed.includes(id)),
        },
        withoutElements(document, [], removed),
        removed.length > 0,
      )
    }
    case 'delete':
      return updateDocument(
        { ...state, selectedNodes: [], selectedEdges: [] },
        withoutElements(document, action.nodeIds ?? [], action.edgeIds ?? []),
      )
    case 'viewport':
      return updateDocument(
        state,
        { ...document, viewport: action.viewport },
        false,
      )
    case 'request-replace':
      return hasUnsavedChanges(state)
        ? { ...state, pending: action.replacement, message: null }
        : initialWorkspace(
            action.replacement.document,
            action.replacement.filename,
          )
    case 'discard':
      return state.pending
        ? initialWorkspace(state.pending.document, state.pending.filename)
        : state
    case 'cancel':
      return { ...state, pending: null }
    case 'saved':
      return action.continueReplacement && state.pending
        ? initialWorkspace(state.pending.document, state.pending.filename)
        : { ...state, savedSnapshot: action.snapshot, message: null }
    case 'message':
      return { ...state, message: action.message }
  }
}
