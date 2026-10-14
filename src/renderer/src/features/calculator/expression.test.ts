import { describe, expect, it } from 'vitest'
import { evaluateExpression, parseNumber, renameIdentifier } from './expression'

describe('arithmetic expressions', () => {
  it.each([
    ['2 + 3 * 4', 14],
    ['(2 + 3) * 4', 20],
    ['20 / 5 / 2', 2],
    ['10 - 3 - 2', 5],
    ['-(2 + 3) + +8', 3],
    ['.5 + 1.25', 1.75],
    ['1e3 / 2', 500],
    ['a * (b + 2)', 24],
    ['a--b', 8],
  ])('evaluates %s', (expression, expected) => {
    expect(
      evaluateExpression(
        expression,
        (name) => ({ a: 4, b: 4 })[name as 'a' | 'b'],
      ),
    ).toBe(expected)
  })

  it.each([
    '',
    '2 +',
    '(2 + 3',
    '2 3',
    '2 ** 3',
    'Math.random()',
    'alert(1)',
    '2;3',
  ])('rejects malformed or unsupported expression %s', (expression) => {
    expect(() => evaluateExpression(expression, () => 0)).toThrow()
  })

  it('rejects division by zero and numeric overflow', () => {
    expect(() => evaluateExpression('2 / (3 - 3)', () => 0)).toThrow('zero')
    expect(() => evaluateExpression('1e308 * 10', () => 0)).toThrow('finite')
  })

  it.each(['', '-', 'NaN', 'Infinity', '0x10', '5 dollars', '1e999'])(
    'rejects invalid numeric field %s',
    (value) => expect(() => parseNumber(value)).toThrow(),
  )
  it('accepts signed decimal and scientific numbers', () => {
    expect(parseNumber(' -1.5e2 ')).toBe(-150)
    expect(parseNumber('+0.5')).toBe(0.5)
  })
  it('renames exact identifiers without changing adjacent names or scientific notation', () => {
    expect(renameIdentifier('x + xx + tax_x + 1e3 + e3', 'x', 'price')).toBe(
      'price + xx + tax_x + 1e3 + e3',
    )
    expect(renameIdentifier('1e3 + e3', 'e3', 'scale')).toBe('1e3 + scale')
  })
})
