import { describe, expect, it } from 'vitest'
import {
  connectionError,
  evaluateGraph,
  modeIsLocked,
  renameNode,
} from './graph'
import { createNode, emptyDocument, nameError } from './model'
import { calculation, control, edge, variable } from './test-fixtures'

describe('graph evaluation', () => {
  it('chains named results and ignores unused erroneous dependencies', () => {
    const nodes = [
      variable('price', 'price', '5'),
      variable('bad', 'bad', '-'),
      calculation('subtotal', 'price * 3'),
      calculation('total', 'subtotal + 2'),
    ]
    const results = evaluateGraph(nodes, [
      edge('price', 'subtotal'),
      edge('bad', 'subtotal'),
      edge('subtotal', 'total'),
    ])
    expect(results.get('total')).toEqual({ status: 'success', value: 17 })
    expect(results.get('bad')?.status).toBe('error')
  })
  it('requires a direct connection even when a name exists elsewhere in the graph', () => {
    const nodes = [
      variable('a'),
      calculation('b', 'a * 2'),
      calculation('c', 'a + b'),
    ]
    const results = evaluateGraph(nodes, [edge('a', 'b'), edge('b', 'c')])
    expect(results.get('c')).toMatchObject({
      status: 'error',
      error: expect.stringContaining('not connected'),
    })
  })
  it('propagates a used input error', () => {
    const results = evaluateGraph(
      [variable('a', 'a', '-'), calculation('b', 'a + 1')],
      [edge('a', 'b')],
    )
    expect(results.get('b')).toMatchObject({
      status: 'error',
      error: expect.stringContaining('a:'),
    })
  })
  it.each([
    ['<', 1, 2, 'if'],
    ['<=', 2, 2, 'if'],
    ['>', 3, 2, 'if'],
    ['>=', 2, 2, 'if'],
    ['==', 2, 2, 'if'],
    ['!=', 2, 2, 'else'],
    ['<', 2, 1, 'else'],
    ['<=', 3, 2, 'else'],
    ['>', 2, 2, 'else'],
    ['>=', 1, 2, 'else'],
    ['==', 1, 2, 'else'],
    ['!=', 1, 2, 'if'],
  ] as const)(
    'compares %s operands %s and %s',
    (operator, left, right, branch) => {
      const node = control('choice')
      node.data.condition = {
        left: { kind: 'number', value: String(left) },
        operator,
        right: { kind: 'number', value: String(right) },
      }
      expect(evaluateGraph([node], []).get('choice')).toEqual({
        status: 'success',
        value: branch === 'if' ? 20 : 30,
        selectedBranch: branch,
      })
    },
  )
  it('uses computed condition operands only after connecting their outputs', () => {
    const choice = control('choice')
    choice.data.condition.left = { kind: 'node', nodeId: 'computed' }
    const nodes = [calculation('computed', '2 + 3'), choice]
    expect(evaluateGraph(nodes, []).get('choice')?.status).toBe('error')
    expect(
      evaluateGraph(nodes, [edge('computed', 'choice')]).get('choice'),
    ).toMatchObject({ value: 20, selectedBranch: 'if' })
  })
  it('does not expose branch names as condition dependencies', () => {
    const choice = control('choice', 'calculation')
    choice.data.condition.left = { kind: 'node', nodeId: 'child' }
    expect(
      evaluateGraph(
        [calculation('child', '4'), choice],
        [edge('child', 'choice', 'if')],
      ).get('choice')?.status,
    ).toBe('error')
  })
  it.each(['if', 'else'] as const)(
    'nests Variable-mode controls in the %s branch',
    (branch) => {
      const parent = control('parent', 'variable', branch === 'if')
      const child = control('child', 'variable', false)
      const results = evaluateGraph(
        [parent, child, calculation('after', 'parent + 1')],
        [edge('child', 'parent', branch), edge('parent', 'after')],
      )
      expect(results.get('parent')).toMatchObject({
        value: 30,
        selectedBranch: branch,
      })
      expect(results.get('after')).toMatchObject({ value: 31 })
    },
  )
  it.each(['if', 'else'] as const)(
    'nests Calculation-mode controls with independent dependencies in the %s branch',
    (branch) => {
      const parent = control('parent', 'calculation', branch === 'if')
      const child = control('child', 'calculation')
      const nodes = [
        parent,
        child,
        variable('amount'),
        calculation('positive', 'amount * 2'),
        calculation('negative', '-amount'),
      ]
      const results = evaluateGraph(nodes, [
        edge('amount', 'positive'),
        edge('amount', 'negative'),
        edge('positive', 'child', 'if'),
        edge('negative', 'child', 'else'),
        edge('child', 'parent', branch),
      ])
      expect(results.get('parent')).toMatchObject({
        value: 20,
        selectedBranch: branch,
      })
    },
  )
  it('isolates unused branch errors while retaining independent previews', () => {
    const choice = control('choice', 'calculation')
    const nodes = [
      calculation('valid', '42'),
      calculation('invalid', '1 / 0'),
      choice,
    ]
    const connections = [
      edge('valid', 'choice', 'if'),
      edge('invalid', 'choice', 'else'),
    ]
    expect(evaluateGraph(nodes, connections).get('choice')).toMatchObject({
      value: 42,
    })
    expect(evaluateGraph(nodes, connections).get('invalid')?.status).toBe(
      'error',
    )
    choice.data.condition.left = { kind: 'number', value: '0' }
    expect(evaluateGraph(nodes, connections).get('choice')?.status).toBe(
      'error',
    )
  })
  it('reports a missing selected calculation branch', () =>
    expect(
      evaluateGraph([control('choice', 'calculation')], []).get('choice')
        ?.status,
    ).toBe('error'))
  it('keeps a stable control name when the chosen child changes', () => {
    const choice = control('choice', 'calculation')
    const nodes = [
      calculation('first', '4'),
      calculation('second', '8'),
      choice,
      calculation('downstream', 'choice * 2'),
    ]
    const connections = [
      edge('first', 'choice', 'if'),
      edge('second', 'choice', 'else'),
      edge('choice', 'downstream'),
    ]
    expect(evaluateGraph(nodes, connections).get('downstream')).toMatchObject({
      value: 8,
    })
    choice.data.condition.left = { kind: 'number', value: '0' }
    expect(evaluateGraph(nodes, connections).get('downstream')).toMatchObject({
      value: 16,
    })
  })
  it('detects cycles defensively during evaluation', () =>
    expect(
      evaluateGraph(
        [calculation('a', 'b'), calculation('b', 'a')],
        [edge('a', 'b'), edge('b', 'a')],
      ).get('a')?.status,
    ).toBe('error'))
})

describe('connections and naming', () => {
  const nodes = [
    variable('a'),
    calculation('b', 'a'),
    control('v'),
    control('c', 'calculation'),
  ]
  it('rejects self-links, duplicate edges, and cycles', () => {
    expect(connectionError(nodes, [], edge('b', 'b'))).toContain('itself')
    expect(connectionError(nodes, [edge('a', 'b')], edge('a', 'b'))).toContain(
      'already',
    )
    expect(connectionError(nodes, [edge('b', 'c')], edge('c', 'b'))).toContain(
      'cycle',
    )
  })
  it('enforces branch types and one connection per branch', () => {
    expect(connectionError(nodes, [], edge('a', 'v', 'if'))).toContain(
      'Variable-mode',
    )
    expect(connectionError(nodes, [], edge('b', 'v', 'if'))).toContain(
      'Variable-mode',
    )
    expect(connectionError(nodes, [], edge('v', 'c', 'if'))).toContain(
      'Calculation-mode',
    )
    expect(connectionError(nodes, [], edge('b', 'c', 'if'))).toBeUndefined()
    expect(
      connectionError(nodes, [edge('b', 'c', 'if')], edge('c', 'c', 'if')),
    ).toBeDefined()
    expect(
      connectionError(
        [...nodes, calculation('other', '1')],
        [edge('b', 'c', 'if')],
        edge('other', 'c', 'if'),
      ),
    ).toContain('Disconnect')
  })
  it('allows fan-out and the same result in both branches', () => {
    expect(
      connectionError(nodes, [edge('a', 'b')], edge('a', 'v')),
    ).toBeUndefined()
    expect(
      connectionError(nodes, [edge('b', 'c', 'if')], edge('b', 'c', 'else')),
    ).toBeUndefined()
  })
  it('locks modes for both parents and nested children', () => {
    expect(modeIsLocked('v', [edge('v', 'c', 'if')])).toBe(true)
    expect(modeIsLocked('c', [edge('v', 'c', 'if')])).toBe(true)
    expect(modeIsLocked('v', [edge('v', 'b')])).toBe(false)
  })
  it('renames direct formula references without changing unrelated formulas or node-ID conditions', () => {
    const source = variable('source', 'x')
    source.data.nameDraft = 'price'
    const choice = control('choice')
    choice.data.condition.left = { kind: 'node', nodeId: 'source' }
    const document = {
      ...emptyDocument(),
      nodes: [
        source,
        calculation('used', 'x + xx'),
        calculation('unrelated', 'x'),
        choice,
      ],
      edges: [edge('source', 'used'), edge('source', 'choice')],
    }
    const renamed = renameNode(document, 'source')
    expect(renamed.nodes[0].data.name).toBe('price')
    expect(renamed.nodes[1].data).toMatchObject({ expression: 'price + xx' })
    expect(renamed.nodes[2].data).toMatchObject({ expression: 'x' })
    expect(renamed.nodes[3].data).toMatchObject({
      condition: { left: { nodeId: 'source' } },
    })
  })
  it('retains invalid drafts and enforces global case-sensitive names', () => {
    const source = variable('source', 'x')
    source.data.nameDraft = 'two words'
    const document = { ...emptyDocument(), nodes: [source] }
    expect(renameNode(document, 'source')).toBe(document)
    expect(nameError(nodes, 'v', 'a')).toContain('already')
    expect(nameError(nodes, 'v', 'A')).toBeUndefined()
    expect(
      createNode(
        'variable',
        [variable('a', 'variable_1')],
        { x: 0, y: 0 },
        'new',
      ).data.name,
    ).toBe('variable_2')
  })
})
