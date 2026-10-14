import { useEffect, useReducer, useRef } from 'react'
import type { ChangeEvent, Dispatch, KeyboardEvent } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react'
import type { Edge } from '@xyflow/react'
import {
  AlertCircle,
  Calculator,
  Download,
  FilePlus2,
  FolderOpen,
  GitBranch,
  Network,
  Trash2,
  Variable,
  X,
} from 'lucide-react'
import { PageLayout } from '@/components/layouts/page-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { CalculatorNodeView } from './calculator-node'
import type { ConnectedInput, FlowNode, NodeEditor } from './calculator-node'
import { downloadDocument, readDocument, serializeDocument } from './document'
import { connectionError, modeIsLocked } from './graph'
import { emptyDocument, nameError } from './model'
import type { Branch, NodeKind } from './model'
import {
  hasUnsavedChanges,
  initialWorkspace,
  workspaceReducer,
} from './workspace-state'
import type { WorkspaceAction, WorkspaceState } from './workspace-state'

const nodeTypes = {
  variable: CalculatorNodeView,
  calculation: CalculatorNodeView,
  control: CalculatorNodeView,
}

export function CalculatorWorkspace() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  )
}

function Workspace() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, () =>
    initialWorkspace(),
  )
  const fileInput = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const flow = useReactFlow<FlowNode>()
  const nodesInitialized = useNodesInitialized()
  const fitPending = useRef(false)
  const dirty = hasUnsavedChanges(state)
  const document = state.document

  // Browser closure prompts apply only while this document has unsaved edits.
  useEffect(() => {
    if (!dirty) return
    function preventUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [dirty])

  useEffect(() => {
    if (nodesInitialized && fitPending.current) {
      fitPending.current = false
      void flow.fitView({ padding: 0.2, maxZoom: 1, duration: 200 })
    }
  }, [nodesInitialized, flow])

  // Coordinate document edits and portable file actions.
  function addNode(kind: NodeKind) {
    const bounds = canvas.current?.getBoundingClientRect()
    const origin = flow.screenToFlowPosition({
      x: (bounds?.left ?? 0) + 48,
      y: (bounds?.top ?? 0) + 48,
    })
    const position = document.nodes.length
      ? {
          x: Math.max(...document.nodes.map((node) => node.position.x)) + 420,
          y: Math.min(...document.nodes.map((node) => node.position.y)),
        }
      : origin
    fitPending.current = true
    dispatch({ type: 'add', kind, position, id: crypto.randomUUID() })
  }

  function save(continueReplacement = false) {
    try {
      const snapshot = serializeDocument(document)
      downloadDocument(document, state.filename)
      dispatch({ type: 'saved', snapshot, continueReplacement })
    } catch {
      dispatch({
        type: 'message',
        message:
          'The file could not be downloaded. Your edits are still here; try Save again.',
      })
    }
  }

  async function openFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const document = readDocument(await file.text())
      dispatch({
        type: 'request-replace',
        replacement: { document, filename: file.name },
      })
    } catch (error) {
      dispatch({
        type: 'message',
        message:
          error instanceof Error
            ? error.message
            : 'The file could not be opened.',
      })
    }
  }

  function deleteSelection(event: KeyboardEvent) {
    const target = event.target
    if (
      target instanceof Element &&
      target.closest(
        'input, textarea, button, select, [role="combobox"], [role="dialog"], [role="alertdialog"], [contenteditable="true"]',
      )
    )
      return
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      (state.selectedNodes.length || state.selectedEdges.length)
    ) {
      event.preventDefault()
      dispatch({
        type: 'delete',
        nodeIds: state.selectedNodes,
        edgeIds: state.selectedEdges,
      })
    }
  }

  // Keep React Flow measurements, selection, and callbacks out of saved data.
  const nodes: FlowNode[] = document.nodes.map((node) => {
    const connections = document.edges.filter((edge) => edge.target === node.id)
    const inputFor = (edgeId: string): ConnectedInput => {
      const edge = connections.find((edge) => edge.id === edgeId)!
      return {
        id: edge.source,
        name: document.nodes.find((source) => source.id === edge.source)!.data
          .name,
        edgeId,
      }
    }
    const branches: Partial<Record<Branch, ConnectedInput>> = {}
    for (const edge of connections)
      if (edge.targetHandle !== 'dependencies')
        branches[edge.targetHandle] = inputFor(edge.id)
    const editor: NodeEditor = {
      result: state.results.get(node.id)!,
      nameError: nameError(document.nodes, node.id, node.data.nameDraft),
      inputs: connections
        .filter((edge) => edge.targetHandle === 'dependencies')
        .map((edge) => inputFor(edge.id)),
      branches,
      modeLocked: modeIsLocked(node.id, document.edges),
      patch: (patch) => dispatch({ type: 'patch', id: node.id, patch }),
      commitName: () => dispatch({ type: 'rename', id: node.id }),
      remove: () => dispatch({ type: 'delete', nodeIds: [node.id] }),
      disconnect: (edgeId) => dispatch({ type: 'delete', edgeIds: [edgeId] }),
    }
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      measured: state.measurements[node.id],
      selected: state.selectedNodes.includes(node.id),
      dragHandle: '.node-drag-handle',
      ariaLabel: `${nodeDetailsLabel(node.type)} ${node.data.name}`,
      data: { definition: node, editor },
    }
  })

  const edges: Edge[] = document.edges.map((edge) => {
    const isBranch = edge.targetHandle !== 'dependencies'
    const active =
      state.results.get(edge.target)?.selectedBranch === edge.targetHandle
    return {
      ...edge,
      selected: state.selectedEdges.includes(edge.id),
      label: isBranch
        ? edge.targetHandle === 'if'
          ? 'If true'
          : 'Else'
        : undefined,
      className: cn(
        isBranch && 'branch-edge',
        isBranch && active && 'edge-active',
        isBranch && !active && 'edge-inactive',
      ),
      markerEnd: { type: MarkerType.ArrowClosed },
      ariaLabel: `${document.nodes.find((node) => node.id === edge.source)?.data.name} to ${document.nodes.find((node) => node.id === edge.target)?.data.name} ${edge.targetHandle}`,
    }
  })

  return (
    <main className="h-full" onKeyDown={deleteSelection}>
      <PageLayout
        width="full"
        className="workspace flex h-full flex-col gap-ui-sm py-ui-sm"
      >
        <WorkspaceHeader
          filename={state.filename}
          dirty={dirty}
          onNew={() =>
            dispatch({
              type: 'request-replace',
              replacement: {
                document: emptyDocument(),
                filename: 'calculator.json',
              },
            })
          }
          onOpen={() => fileInput.current?.click()}
          onSave={() => save()}
        />
        <WorkspaceToolbar
          addNode={addNode}
          selectedCount={
            state.selectedNodes.length + state.selectedEdges.length
          }
          onDelete={() =>
            dispatch({
              type: 'delete',
              nodeIds: state.selectedNodes,
              edgeIds: state.selectedEdges,
            })
          }
        />
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="Open calculator JSON file"
          onChange={(event) => void openFile(event)}
          tabIndex={-1}
        />
        {state.message && (
          <Alert variant="destructive" className="shrink-0">
            <AlertCircle />
            <AlertTitle>Unable to complete that action</AlertTitle>
            <AlertDescription className="flex flex-row items-center justify-between gap-ui-xs">
              <span>{state.message}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Dismiss message"
                onClick={() => dispatch({ type: 'message', message: null })}
              >
                <X />
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div
          ref={canvas}
          className="calculator-canvas relative min-h-0 flex-1 rounded-xl border overflow-hidden"
        >
          <ReactFlow<FlowNode>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            viewport={document.viewport}
            onViewportChange={(viewport) =>
              dispatch({ type: 'viewport', viewport })
            }
            onNodesChange={(changes) =>
              dispatch({ type: 'nodes-change', changes })
            }
            onEdgesChange={(changes) =>
              dispatch({ type: 'edges-change', changes })
            }
            onConnect={(connection) =>
              dispatch({ type: 'connect', connection, id: crypto.randomUUID() })
            }
            isValidConnection={(connection) =>
              !connectionError(document.nodes, document.edges, connection)
            }
            onConnectEnd={(_, connection) => {
              if (
                connection.isValid !== false ||
                !connection.fromHandle ||
                !connection.toHandle
              )
                return
              const from = connection.fromHandle
              const to = connection.toHandle
              const source = from.type === 'source' ? from : to
              const target = from.type === 'source' ? to : from
              const message = connectionError(document.nodes, document.edges, {
                source: source.nodeId,
                sourceHandle: source.id,
                target: target.nodeId,
                targetHandle: target.id,
              })
              if (message) dispatch({ type: 'message', message })
            }}
            deleteKeyCode={null}
            minZoom={0.1}
            maxZoom={4}
            zoomOnDoubleClick={false}
          >
            <Background gap={24} size={1} color="var(--border)" />
            <Controls showInteractive={false} />
            <Panel position="top-left">
              <Badge variant="outline">
                <span className="live-dot" />
                Live calculation
              </Badge>
            </Panel>
            {!nodes.length && <CanvasEmpty onAdd={() => addNode('variable')} />}
          </ReactFlow>
        </div>
        <WorkspaceFooter nodeCount={nodes.length} edgeCount={edges.length} />
        <UnsavedChangesDialog
          state={state}
          dispatch={dispatch}
          onSave={() => save(true)}
        />
      </PageLayout>
    </main>
  )
}

function nodeDetailsLabel(kind: NodeKind): string {
  return {
    variable: 'Variable',
    calculation: 'Calculation',
    control: 'Control flow',
  }[kind]
}

function WorkspaceHeader({
  filename,
  dirty,
  onNew,
  onOpen,
  onSave,
}: {
  filename: string
  dirty: boolean
  onNew: () => void
  onOpen: () => void
  onSave: () => void
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-ui-sm">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-ui-xs">
          <Network className="size-4 text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Numbers, connected
          </p>
        </div>
        <h1 className="text-3xl">Flow calculator</h1>
        <p
          className="text-xs text-muted-foreground truncate max-w-80"
          title={filename}
        >
          {filename}{' '}
          <span aria-live="polite">
            · {dirty ? 'Unsaved changes' : 'No unsaved changes'}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-ui-xs">
        <Button variant="ghost" size="sm" onClick={onNew}>
          <FilePlus2 data-icon="inline-start" />
          New
        </Button>
        <Button variant="outline" size="sm" onClick={onOpen}>
          <FolderOpen data-icon="inline-start" />
          Open
        </Button>
        <Button size="sm" onClick={onSave}>
          <Download data-icon="inline-start" />
          Save JSON
        </Button>
      </div>
    </header>
  )
}

function WorkspaceToolbar({
  addNode,
  selectedCount,
  onDelete,
}: {
  addNode: (kind: NodeKind) => void
  selectedCount: number
  onDelete: () => void
}) {
  return (
    <section
      className="flex shrink-0 flex-wrap items-center justify-between gap-ui-xs"
      aria-label="Workspace tools"
    >
      <div className="flex flex-wrap items-center gap-ui-xs">
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Add node
        </span>
        <Button variant="outline" size="sm" onClick={() => addNode('variable')}>
          <Variable data-icon="inline-start" />
          Variable
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addNode('calculation')}
        >
          <Calculator data-icon="inline-start" />
          Calculation
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('control')}>
          <GitBranch data-icon="inline-start" />
          Control flow
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={!selectedCount}
        onClick={onDelete}
      >
        <Trash2 data-icon="inline-start" />
        Delete{selectedCount > 0 ? ` (${selectedCount})` : ''}
      </Button>
    </section>
  )
}

function CanvasEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <Panel position="top-center" className="canvas-empty">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Network />
          </EmptyMedia>
          <EmptyTitle>Start with a number.</EmptyTitle>
          <EmptyDescription>
            Give it a name, connect a calculation, and let your ideas take
            shape.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onAdd}>
            <Variable data-icon="inline-start" />
            Add your first variable
          </Button>
          <p className="text-xs text-muted-foreground">
            Variables → calculations → decisions
          </p>
        </EmptyContent>
      </Empty>
    </Panel>
  )
}

function WorkspaceFooter({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number
  edgeCount: number
}) {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-ui-xs text-xs text-muted-foreground">
      <div className="flex items-center gap-ui-xs">
        <span>
          {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
        </span>
        <Separator orientation="vertical" className="h-3" />
        <span>
          {edgeCount} {edgeCount === 1 ? 'connection' : 'connections'}
        </span>
      </div>
      <p>
        Outputs → Dependencies for inputs. Child outputs → If / Else for
        branches.
      </p>
    </footer>
  )
}

function UnsavedChangesDialog({
  state,
  dispatch,
  onSave,
}: {
  state: WorkspaceState
  dispatch: Dispatch<WorkspaceAction>
  onSave: () => void
}) {
  return (
    <AlertDialog
      open={Boolean(state.pending)}
      onOpenChange={(open) => {
        if (!open) dispatch({ type: 'cancel' })
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            This workspace has unsaved edits. Download a JSON copy before
            replacing it, or discard the edits.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.message && (
          <Alert variant="destructive">
            <AlertTitle>Save did not complete</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            onClick={() => dispatch({ type: 'discard' })}
          >
            Discard
          </AlertDialogAction>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              onSave()
            }}
          >
            Save and continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
