import { describe, expect, it } from 'vitest'
import { readDocument, serializeDocument } from './document'
import { emptyDocument } from './model'
import { calculation, control, edge, variable } from './test-fixtures'

describe('portable calculator documents', () => {
  function example() {
    return {
      ...emptyDocument(),
      nodes: [
        variable('a'),
        calculation('b', 'a * 2'),
        control('choice', 'calculation'),
      ],
      edges: [edge('a', 'b'), edge('b', 'choice', 'if')],
      viewport: { x: 40, y: -20, zoom: 0.75 },
    }
  }

  it('round-trips graph structure, positions, viewport, and unfinished field text', () => {
    const document = example()
    document.nodes[0].data.nameDraft = 'unfinished name!'
    document.nodes[0].position = { x: 27, y: 48 }
    document.nodes[1] = calculation('b', 'a + (')
    expect(readDocument(serializeDocument(document))).toEqual(document)
  })
  it('excludes node selection and other React Flow presentation properties', () => {
    const document = example()
    Object.assign(document.nodes[0], {
      selected: true,
      measured: { width: 200 },
      result: { value: 10 },
    })
    const json = serializeDocument(document)
    expect(json).not.toContain('selected')
    expect(json).not.toContain('measured')
    expect(json).not.toContain('result')
  })
  it('round-trips explicit card sizes while accepting existing unsized documents', () => {
    const document = example()
    expect(readDocument(serializeDocument(document))).toEqual(document)
    for (const node of document.nodes) {
      node.width = 500
      node.height = 1000
    }
    expect(readDocument(serializeDocument(document))).toEqual(document)
  })
  it.each([0, -10, '480', null])(
    'rejects invalid card dimensions %s',
    (size) => {
      for (const dimension of ['width', 'height']) {
        const document = example()
        Object.assign(document.nodes[0], { [dimension]: size })
        expect(() => readDocument(serializeDocument(document))).toThrow(
          `Node ${dimension}`,
        )
      }
    },
  )
  it.each(['not JSON', 'null', '[]', '{"version":2}', '{"version":1}'])(
    'rejects malformed or unsupported file %s',
    (json) => expect(() => readDocument(json)).toThrow(),
  )
  it('rejects duplicate node IDs and global names', () => {
    const document = example()
    document.nodes.push(variable('a', 'other'))
    expect(() => readDocument(serializeDocument(document))).toThrow('IDs')
    document.nodes.pop()
    document.nodes.push(variable('other', 'a'))
    expect(() => readDocument(serializeDocument(document))).toThrow('already')
  })
  it('rejects invalid handles, dangling edges, and incompatible branches', () => {
    const document = example()
    document.edges.push(edge('missing', 'b'))
    expect(() => readDocument(serializeDocument(document))).toThrow('existing')
    document.edges.pop()
    document.edges.push(edge('a', 'choice', 'else'))
    expect(() => readDocument(serializeDocument(document))).toThrow(
      'Calculation-mode',
    )
    document.edges.pop()
    const json = JSON.parse(serializeDocument(document))
    json.edges[0].targetHandle = 'bad-port'
    expect(() => readDocument(JSON.stringify(json))).toThrow('port')
  })
  it('rejects cycles and duplicate connections', () => {
    const document = example()
    document.edges.push(edge('choice', 'b'))
    expect(() => readDocument(serializeDocument(document))).toThrow('cycle')
    document.edges.pop()
    document.edges.push({ ...edge('a', 'b'), id: 'duplicate' })
    expect(() => readDocument(serializeDocument(document))).toThrow('already')
  })
  it('rejects invalid numeric layout while allowing unfinished numeric fields', () => {
    const document = example()
    document.nodes[0] = variable('a', 'a', '-')
    expect(
      readDocument(serializeDocument(document)).nodes[0].data,
    ).toMatchObject({ value: '-' })
    document.viewport.zoom = 0
    expect(() => readDocument(serializeDocument(document))).toThrow('zoom')
    document.viewport.zoom = 1
    document.nodes[0].position.x = Infinity
    expect(() => readDocument(serializeDocument(document))).toThrow('finite')
  })
  it('retains a disconnected condition reference as an editable draft', () => {
    const choice = control('choice')
    choice.data.condition.left = { kind: 'node', nodeId: 'deleted' }
    const document = { ...emptyDocument(), nodes: [choice] }
    expect(readDocument(serializeDocument(document))).toEqual(document)
  })
})
