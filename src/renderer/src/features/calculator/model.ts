export type NodeKind = 'variable' | 'calculation' | 'control'
export type Branch = 'if' | 'else'
export type InputHandle = 'dependencies' | Branch
export type ControlMode = 'variable' | 'calculation'
export const comparisonOperators = ['<', '<=', '>', '>=', '==', '!='] as const
export type ComparisonOperator = (typeof comparisonOperators)[number]

export type Operand =
  { kind: 'number'; value: string } | { kind: 'node'; nodeId: string }

export type Condition = {
  left: Operand
  operator: ComparisonOperator
  right: Operand
}

type NamedData = { name: string; nameDraft: string }
export type VariableData = NamedData & { value: string }
export type CalculationData = NamedData & { expression: string }
export type ControlData = NamedData & {
  mode: ControlMode
  condition: Condition
  ifValue: string
  elseValue: string
}

type NodeDefinition<Kind extends NodeKind, Data> = {
  id: string
  type: Kind
  position: { x: number; y: number }
  data: Data
}

export type CalculatorNode =
  | NodeDefinition<'variable', VariableData>
  | NodeDefinition<'calculation', CalculationData>
  | NodeDefinition<'control', ControlData>

export type NodePatch = Partial<VariableData & CalculationData & ControlData>

export type CalculatorEdge = {
  id: string
  source: string
  sourceHandle: 'output'
  target: string
  targetHandle: InputHandle
}

export type CalculatorDocument = {
  version: 1
  nodes: CalculatorNode[]
  edges: CalculatorEdge[]
  viewport: { x: number; y: number; zoom: number }
}

export type NodeResult =
  | { status: 'success'; value: number; selectedBranch?: Branch }
  | { status: 'error'; error: string; selectedBranch?: Branch }

export function emptyDocument(): CalculatorDocument {
  return { version: 1, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
}

export function nameError(
  nodes: CalculatorNode[],
  id: string,
  name: string,
): string | undefined {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return 'Start with a letter or underscore; use letters, numbers, and underscores.'
  }
  if (nodes.some((node) => node.id !== id && node.data.name === name)) {
    return `The name “${name}” is already in use.`
  }
  return undefined
}

export function createNode(
  kind: NodeKind,
  nodes: CalculatorNode[],
  position: { x: number; y: number },
  id: string = crypto.randomUUID(),
): CalculatorNode {
  const prefix = {
    variable: 'variable',
    calculation: 'result',
    control: 'choice',
  }[kind]
  let suffix = 1
  while (nodes.some((node) => node.data.name === `${prefix}_${suffix}`))
    suffix += 1
  const name = `${prefix}_${suffix}`
  const common = { id, position }
  const named = { name, nameDraft: name }

  if (kind === 'variable') {
    return { ...common, type: kind, data: { ...named, value: '0' } }
  }
  if (kind === 'calculation') {
    return { ...common, type: kind, data: { ...named, expression: '' } }
  }
  return {
    ...common,
    type: 'control',
    data: {
      ...named,
      mode: 'variable',
      condition: {
        left: { kind: 'number', value: '0' },
        operator: '>',
        right: { kind: 'number', value: '0' },
      },
      ifValue: '1',
      elseValue: '0',
    },
  }
}
