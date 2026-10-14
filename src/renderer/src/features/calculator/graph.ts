import { evaluateExpression, parseNumber, renameIdentifier } from './expression'
import { nameError } from './model'
import type {
  Branch,
  CalculatorDocument,
  CalculatorEdge,
  CalculatorNode,
  ComparisonOperator,
  NodeResult,
  Operand,
} from './model'

export type CandidateConnection = {
  source: string | null
  target: string | null
  sourceHandle?: string | null
  targetHandle?: string | null
}

export function connectionError(
  nodes: CalculatorNode[],
  edges: CalculatorEdge[],
  connection: CandidateConnection,
): string | undefined {
  const source = nodes.find((node) => node.id === connection.source)
  const target = nodes.find((node) => node.id === connection.target)
  const handle = connection.targetHandle
  if (!source || !target) return 'Both ends must connect to existing nodes.'
  if (source.id === target.id) return 'A node cannot connect to itself.'
  if (connection.sourceHandle !== 'output')
    return 'Start at a node’s output port.'
  if (
    target.type === 'variable' ||
    !['dependencies', 'if', 'else'].includes(handle ?? '')
  ) {
    return 'Connect to a dependency, If, or Else port.'
  }
  if (
    edges.some(
      (edge) =>
        edge.source === source.id &&
        edge.target === target.id &&
        edge.targetHandle === handle,
    )
  ) {
    return 'These ports are already connected.'
  }

  // Branch edges select a result; ordinary dependency edges only provide names.
  if (handle !== 'dependencies') {
    if (target.type !== 'control')
      return 'Only control-flow nodes have branch ports.'
    if (
      edges.some(
        (edge) => edge.target === target.id && edge.targetHandle === handle,
      )
    ) {
      return 'Disconnect the current branch before connecting another node.'
    }
    const compatible =
      target.data.mode === 'variable'
        ? source.type === 'control' && source.data.mode === 'variable'
        : source.type === 'calculation' ||
          (source.type === 'control' && source.data.mode === 'calculation')
    if (!compatible)
      return `This branch requires ${target.data.mode === 'variable' ? 'a Variable-mode control' : 'a calculation or Calculation-mode control'}.`
  }

  const visited = new Set<string>()
  function reachesSource(id: string): boolean {
    if (id === source!.id) return true
    if (visited.has(id)) return false
    visited.add(id)
    return edges.some(
      (edge) => edge.source === id && reachesSource(edge.target),
    )
  }
  if (reachesSource(target.id)) return 'This connection would create a cycle.'
  return undefined
}

export function modeIsLocked(id: string, edges: CalculatorEdge[]): boolean {
  return edges.some(
    (edge) =>
      edge.targetHandle !== 'dependencies' &&
      (edge.source === id || edge.target === id),
  )
}

export function renameNode(
  document: CalculatorDocument,
  id: string,
): CalculatorDocument {
  const renamed = document.nodes.find((node) => node.id === id)
  if (!renamed || nameError(document.nodes, id, renamed.data.nameDraft))
    return document
  const oldName = renamed.data.name
  const newName = renamed.data.nameDraft
  if (oldName === newName) return document

  const consumers = new Set(
    document.edges
      .filter(
        (edge) => edge.source === id && edge.targetHandle === 'dependencies',
      )
      .map((edge) => edge.target),
  )
  return {
    ...document,
    nodes: document.nodes.map((node) => {
      if (node.id === id)
        return {
          ...node,
          data: { ...node.data, name: newName },
        } as CalculatorNode
      if (node.type === 'calculation' && consumers.has(node.id)) {
        return {
          ...node,
          data: {
            ...node.data,
            expression: renameIdentifier(
              node.data.expression,
              oldName,
              newName,
            ),
          },
        }
      }
      return node
    }),
  }
}

function compare(
  left: number,
  operator: ComparisonOperator,
  right: number,
): boolean {
  switch (operator) {
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '==':
      return left === right
    case '!=':
      return left !== right
  }
}

export function evaluateGraph(
  nodes: CalculatorNode[],
  edges: CalculatorEdge[],
): Map<string, NodeResult> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const results = new Map<string, NodeResult>()
  const visiting = new Set<string>()
  const incoming = new Map<string, CalculatorEdge[]>()
  for (const edge of edges)
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge])

  function requiredValue(id: string): number {
    const result = evaluateNode(id)
    if (result.status === 'error')
      throw new Error(`${byId.get(id)?.data.name ?? 'Input'}: ${result.error}`)
    return result.value
  }

  function operandValue(
    operand: Operand,
    dependencies: CalculatorEdge[],
  ): number {
    if (operand.kind === 'number') return parseNumber(operand.value)
    if (!dependencies.some((edge) => edge.source === operand.nodeId)) {
      throw new Error(
        'Connect the selected condition input to the Dependencies port.',
      )
    }
    return requiredValue(operand.nodeId)
  }

  function evaluateNode(id: string): NodeResult {
    const cached = results.get(id)
    if (cached) return cached
    const node = byId.get(id)
    if (!node) return { status: 'error', error: 'The input node is missing.' }
    if (visiting.has(id))
      return { status: 'error', error: 'A dependency cycle was found.' }
    visiting.add(id)
    let selectedBranch: Branch | undefined
    let result: NodeResult

    // Resolve only names and branches actually used by this node.
    try {
      const invalidName = nameError(nodes, id, node.data.name)
      if (invalidName) throw new Error(invalidName)
      const connections = incoming.get(id) ?? []
      const dependencies = connections.filter(
        (edge) => edge.targetHandle === 'dependencies',
      )
      let value: number
      if (node.type === 'variable') {
        value = parseNumber(node.data.value)
      } else if (node.type === 'calculation') {
        value = evaluateExpression(node.data.expression, (name) => {
          const dependency = dependencies.find(
            (edge) => byId.get(edge.source)?.data.name === name,
          )
          if (!dependency)
            throw new Error(`“${name}” is not connected to this calculation.`)
          return requiredValue(dependency.source)
        })
      } else {
        const { condition } = node.data
        selectedBranch = compare(
          operandValue(condition.left, dependencies),
          condition.operator,
          operandValue(condition.right, dependencies),
        )
          ? 'if'
          : 'else'
        const child = connections.find(
          (edge) => edge.targetHandle === selectedBranch,
        )
        if (child) {
          value = requiredValue(child.source)
        } else if (node.data.mode === 'variable') {
          value = parseNumber(
            selectedBranch === 'if' ? node.data.ifValue : node.data.elseValue,
          )
        } else {
          throw new Error(
            `Connect a calculation or Calculation-mode control to the ${selectedBranch === 'if' ? 'If' : 'Else'} port.`,
          )
        }
      }
      result = {
        status: 'success',
        value,
        ...(selectedBranch && { selectedBranch }),
      }
    } catch (error) {
      result = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Calculation failed.',
        ...(selectedBranch && { selectedBranch }),
      }
    }

    visiting.delete(id)
    results.set(id, result)
    return result
  }

  // Independent previews may show errors without poisoning an unused branch.
  for (const node of nodes) evaluateNode(node.id)
  return results
}
