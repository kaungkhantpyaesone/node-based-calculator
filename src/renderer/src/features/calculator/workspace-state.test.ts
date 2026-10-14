import { describe, expect, it } from 'vitest'
import { serializeDocument } from './document'
import { emptyDocument } from './model'
import { calculation, control, edge, variable } from './test-fixtures'
import {
  hasUnsavedChanges,
  initialWorkspace,
  workspaceReducer,
} from './workspace-state'

describe('workspace edits and unsaved changes', () => {
  function editedWorkspace() {
    return workspaceReducer(initialWorkspace(), {
      type: 'add',
      kind: 'variable',
      position: { x: 0, y: 0 },
      id: 'a',
    })
  }
  const replacement = {
    document: { ...emptyDocument(), nodes: [variable('new')] },
    filename: 'new.json',
  }

  it('tracks unfinished edits and layout, but excludes selection', () => {
    let state = initialWorkspace({ ...emptyDocument(), nodes: [variable('a')] })
    state = workspaceReducer(state, {
      type: 'nodes-change',
      changes: [{ type: 'select', id: 'a', selected: true }],
    })
    expect(hasUnsavedChanges(state)).toBe(false)
    state = workspaceReducer(state, {
      type: 'patch',
      id: 'a',
      patch: { nameDraft: 'unfinished name' },
    })
    expect(hasUnsavedChanges(state)).toBe(true)
    state = workspaceReducer(state, {
      type: 'saved',
      snapshot: serializeDocument(state.document),
    })
    expect(hasUnsavedChanges(state)).toBe(false)
    state = workspaceReducer(state, {
      type: 'nodes-change',
      changes: [{ type: 'position', id: 'a', position: { x: 20, y: 30 } }],
    })
    expect(hasUnsavedChanges(state)).toBe(true)
  })
  it('preserves evaluation results when nodes or the viewport move', () => {
    const state = editedWorkspace()
    expect(
      workspaceReducer(state, {
        type: 'nodes-change',
        changes: [{ type: 'position', id: 'a', position: { x: 100, y: 200 } }],
      }).results,
    ).toBe(state.results)
    expect(
      workspaceReducer(state, {
        type: 'viewport',
        viewport: { x: 20, y: 30, zoom: 0.5 },
      }).results,
    ).toBe(state.results)
  })
  it('retains React Flow measurements for rendering without making the document dirty', () => {
    const state = initialWorkspace({
      ...emptyDocument(),
      nodes: [variable('a')],
    })
    const measured = workspaceReducer(state, {
      type: 'nodes-change',
      changes: [
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 352, height: 335 },
        },
      ],
    })
    expect(measured.measurements.a).toEqual({ width: 352, height: 335 })
    expect(hasUnsavedChanges(measured)).toBe(false)
    expect(measured.results).toBe(state.results)
    expect(serializeDocument(measured.document)).not.toContain('measurements')
  })
  it('updates live results after value edits and removes associated edges on deletion', () => {
    let state = initialWorkspace({
      ...emptyDocument(),
      nodes: [variable('a'), calculation('b', 'a * 2')],
      edges: [edge('a', 'b')],
    })
    state = workspaceReducer(state, {
      type: 'patch',
      id: 'a',
      patch: { value: '7' },
    })
    expect(state.results.get('b')).toMatchObject({ value: 14 })
    state = workspaceReducer(state, { type: 'delete', nodeIds: ['a'] })
    expect(state.document.edges).toHaveLength(0)
    expect(state.results.get('b')?.status).toBe('error')
  })
  it('saves deliberate resizes and their positions without recalculating results', () => {
    const state = initialWorkspace({
      ...emptyDocument(),
      nodes: [variable('a')],
    })
    const resized = workspaceReducer(state, {
      type: 'nodes-change',
      changes: [
        { type: 'position', id: 'a', position: { x: -40, y: -20 } },
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 480, height: 420 },
          setAttributes: true,
          resizing: true,
        },
      ],
    })
    expect(resized.document.nodes[0]).toMatchObject({
      width: 480,
      height: 420,
      position: { x: -40, y: -20 },
    })
    expect(resized.results).toBe(state.results)
    expect(hasUnsavedChanges(resized)).toBe(true)
    const saved = workspaceReducer(resized, {
      type: 'saved',
      snapshot: serializeDocument(resized.document),
    })
    const measured = workspaceReducer(saved, {
      type: 'nodes-change',
      changes: [
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 480, height: 430 },
        },
      ],
    })
    expect(measured.document.nodes[0].height).toBe(420)
    expect(hasUnsavedChanges(measured)).toBe(false)
  })
  it('keeps content size constraints transient and supports one-axis size changes', () => {
    const state = initialWorkspace({
      ...emptyDocument(),
      nodes: [variable('a')],
    })
    const constrained = workspaceReducer(state, {
      type: 'minimum-height',
      id: 'a',
      height: 360,
    })
    expect(constrained.minimumHeights.a).toBe(360)
    expect(hasUnsavedChanges(constrained)).toBe(false)
    expect(constrained.results).toBe(state.results)
    const resized = workspaceReducer(constrained, {
      type: 'nodes-change',
      changes: [
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 500, height: 360 },
          setAttributes: 'width',
        },
      ],
    })
    expect(resized.document.nodes[0].width).toBe(500)
    expect(resized.document.nodes[0].height).toBeUndefined()
  })
  it('retains the current document while prompting and when replacement is canceled', () => {
    const edited = editedWorkspace()
    const pending = workspaceReducer(edited, {
      type: 'request-replace',
      replacement,
    })
    expect(pending.document).toBe(edited.document)
    expect(pending.pending).toEqual(replacement)
    const canceled = workspaceReducer(pending, { type: 'cancel' })
    expect(canceled.document).toBe(edited.document)
    expect(canceled.pending).toBeNull()
  })
  it('replaces clean documents directly and replaces dirty documents only on Discard or Save and continue', () => {
    expect(
      workspaceReducer(initialWorkspace(), {
        type: 'request-replace',
        replacement,
      }).document,
    ).toBe(replacement.document)
    const pending = workspaceReducer(editedWorkspace(), {
      type: 'request-replace',
      replacement,
    })
    const discarded = workspaceReducer(pending, { type: 'discard' })
    expect(discarded.document).toBe(replacement.document)
    expect(hasUnsavedChanges(discarded)).toBe(false)
    const saved = workspaceReducer(pending, {
      type: 'saved',
      snapshot: serializeDocument(pending.document),
      continueReplacement: true,
    })
    expect(saved.document).toBe(replacement.document)
    expect(saved.filename).toBe('new.json')
  })
  it('does not mark newer edits saved by an older exported snapshot', () => {
    const state = editedWorkspace()
    const snapshot = serializeDocument(state.document)
    const edited = workspaceReducer(state, {
      type: 'patch',
      id: 'a',
      patch: { value: '9' },
    })
    expect(
      hasUnsavedChanges(workspaceReducer(edited, { type: 'saved', snapshot })),
    ).toBe(true)
  })
  it('guards mode changes on attached controls and preserves inline values when unwired', () => {
    let state = initialWorkspace({
      ...emptyDocument(),
      nodes: [control('child'), control('parent')],
      edges: [edge('child', 'parent', 'if')],
    })
    expect(
      workspaceReducer(state, {
        type: 'patch',
        id: 'child',
        patch: { mode: 'calculation' },
      }),
    ).toBe(state)
    expect(
      workspaceReducer(state, {
        type: 'patch',
        id: 'parent',
        patch: { mode: 'calculation' },
      }),
    ).toBe(state)
    state = workspaceReducer(state, {
      type: 'delete',
      edgeIds: [edge('child', 'parent', 'if').id],
    })
    state = workspaceReducer(state, {
      type: 'patch',
      id: 'parent',
      patch: { mode: 'calculation' },
    })
    expect(state.document.nodes[1].data).toMatchObject({
      mode: 'calculation',
      ifValue: '20',
      elseValue: '30',
    })
  })
})
