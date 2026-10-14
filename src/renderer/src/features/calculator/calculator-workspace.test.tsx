// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalculatorWorkspace } from './calculator-workspace'
import { emptyDocument } from './model'
import { serializeDocument } from './document'
import { calculation, control, edge, variable } from './test-fixtures'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:calculator'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function upload(json: string) {
  const file = new File([json], 'opened.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: async () => json })
  fireEvent.change(screen.getByLabelText('Open calculator JSON file'), {
    target: { files: [file] },
  })
}

describe('workspace user flows', () => {
  it('focuses and selects dependency sources on double-click or keyboard activation', async () => {
    render(<CalculatorWorkspace />)
    upload(
      serializeDocument({
        ...emptyDocument(),
        nodes: [variable('a'), calculation('b', 'a + 1'), control('choice')],
        edges: [edge('a', 'b'), edge('b', 'choice')],
      }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Focus a source')).toBeTruthy(),
    )
    const chip = screen.getByLabelText('Focus a source')
    const source = screen
      .getByLabelText('Variable name')
      .closest('.react-flow__node')!
    await userEvent.click(chip)
    expect(source.classList.contains('selected')).toBe(false)
    await userEvent.dblClick(chip)
    await waitFor(() => expect(document.activeElement).toBe(source))
    expect(source.classList.contains('selected')).toBe(true)
    expect(source.querySelector('.card-resize-handle')).toBeTruthy()
    expect(
      chip.closest('.react-flow__node')?.classList.contains('selected'),
    ).toBe(false)

    const chainedChip = screen.getByLabelText('Focus b source')
    chainedChip.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(document.activeElement).toBe(chip.closest('.react-flow__node')),
    )
    expect(
      document.querySelectorAll('.react-flow__node.selected'),
    ).toHaveLength(1)
    chip.focus()
    await userEvent.keyboard(' ')
    await waitFor(() => expect(document.activeElement).toBe(source))
    expect(screen.getByLabelText('Expression').getAttribute('value')).toBe(
      'a + 1',
    )
  })
  it('keeps disconnecting a chip separate from source navigation', async () => {
    render(<CalculatorWorkspace />)
    upload(
      serializeDocument({
        ...emptyDocument(),
        nodes: [variable('a'), calculation('b', 'a + 1')],
        edges: [edge('a', 'b')],
      }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Disconnect a from b')).toBeTruthy(),
    )
    await userEvent.click(screen.getByLabelText('Disconnect a from b'))
    expect(screen.queryByLabelText('Focus a source')).toBeNull()
    expect(
      screen
        .getByLabelText('Variable name')
        .closest('.react-flow__node')
        ?.classList.contains('selected'),
    ).toBe(false)
    expect(
      screen.getByLabelText('Expression').getAttribute('aria-invalid'),
    ).toBe('true')
  })
  it('marks invalid numeric condition and branch fields without blocking an unused branch', async () => {
    render(<CalculatorWorkspace />)
    await userEvent.click(screen.getByRole('button', { name: 'Control flow' }))
    const left = screen.getByLabelText('Left operand number')
    fireEvent.change(left, { target: { value: '-' } })
    expect(left.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(left, { target: { value: '1' } })
    const otherwise = screen.getByLabelText('Else')
    fireEvent.change(otherwise, { target: { value: '-' } })
    expect(otherwise.getAttribute('aria-invalid')).toBe('true')
    expect(
      otherwise.closest('.calculator-node')?.querySelector('.node-result p')
        ?.textContent,
    ).toBe('1')
  })
  it('starts empty and protects pending edits during browser closure', async () => {
    render(<CalculatorWorkspace />)
    expect(screen.getByText('Start with a number.')).toBeTruthy()
    expect(
      window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    expect(
      window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Save JSON' }))
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(
      window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ).toBe(true)
  })
  it('offers Cancel, Discard, and Save and continue when creating a new workspace', async () => {
    render(<CalculatorWorkspace />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    await userEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Variable name')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'New' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Save and continue' }),
    )
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(screen.getByText('Start with a number.')).toBeTruthy()
  })
  it('leaves the document and dialog intact if downloading fails', async () => {
    render(<CalculatorWorkspace />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    await userEvent.click(screen.getByRole('button', { name: 'New' }))
    vi.mocked(URL.createObjectURL).mockImplementation(() => {
      throw new Error('Download failed')
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Save and continue' }),
    )
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByLabelText('Variable name')).toBeTruthy()
  })
  it('validates imports before offering to replace unsaved work', async () => {
    render(<CalculatorWorkspace />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    upload('bad JSON')
    await waitFor(() =>
      expect(screen.getByText('This file is not valid JSON.')).toBeTruthy(),
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
    upload(
      serializeDocument({
        ...emptyDocument(),
        nodes: [variable('imported', 'imported', '42')],
      }),
    )
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(
      (screen.getByLabelText('Variable name') as HTMLInputElement).value,
    ).toBe('imported')
    expect((screen.getByLabelText('Value') as HTMLInputElement).value).toBe(
      '42',
    )
    expect(
      window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ).toBe(true)
  })
  it('keeps deletion keys inside a field from deleting the selected node', async () => {
    render(<CalculatorWorkspace />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    const input = screen.getByLabelText('Value')
    const wrapper = input.closest('.react-flow__node')!
    fireEvent.click(wrapper)
    fireEvent.keyDown(input, { key: 'Delete' })
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(screen.getByLabelText('Value')).toBeTruthy()
  })
})
