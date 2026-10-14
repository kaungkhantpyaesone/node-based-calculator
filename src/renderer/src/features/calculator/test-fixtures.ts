import type {
  CalculatorEdge,
  CalculatorNode,
  ControlMode,
  InputHandle,
} from './model'

export function variable(id: string, name = id, value = '10'): CalculatorNode {
  return {
    id,
    type: 'variable',
    position: { x: 0, y: 0 },
    data: { name, nameDraft: name, value },
  }
}

export function calculation(id: string, expression: string): CalculatorNode {
  return {
    id,
    type: 'calculation',
    position: { x: 400, y: 0 },
    data: { name: id, nameDraft: id, expression },
  }
}

export function control(
  id: string,
  mode: ControlMode = 'variable',
  truth = true,
): Extract<CalculatorNode, { type: 'control' }> {
  return {
    id,
    type: 'control',
    position: { x: 800, y: 0 },
    data: {
      name: id,
      nameDraft: id,
      mode,
      condition: {
        left: { kind: 'number', value: truth ? '1' : '0' },
        operator: '>',
        right: { kind: 'number', value: '0' },
      },
      ifValue: '20',
      elseValue: '30',
    },
  }
}

export function edge(
  source: string,
  target: string,
  targetHandle: InputHandle = 'dependencies',
): CalculatorEdge {
  return {
    id: `${source}-${target}-${targetHandle}`,
    source,
    sourceHandle: 'output',
    target,
    targetHandle,
  }
}
