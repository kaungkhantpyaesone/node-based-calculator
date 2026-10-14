type Token = { kind: 'number' | 'name' | 'symbol'; text: string }

export function parseNumber(text: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())) {
    throw new Error('Enter a valid number.')
  }
  return finiteNumber(Number(text))
}

export function numberError(text: string): string | undefined {
  try {
    parseNumber(text)
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : 'Enter a valid number.'
  }
}

function finiteNumber(value: number): number {
  if (!Number.isFinite(value))
    throw new Error('The result must be a finite number.')
  return value
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let offset = 0
  while (offset < expression.length) {
    const remaining = expression.slice(offset)
    const whitespace = /^\s+/.exec(remaining)
    if (whitespace) {
      offset += whitespace[0].length
      continue
    }

    const numeric = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(remaining)
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(remaining)
    const symbol = /^[+\-*/()]/.exec(remaining)
    const match = numeric ?? name ?? symbol
    if (!match) throw new Error(`Unexpected character “${remaining[0]}”.`)
    tokens.push({
      kind: numeric ? 'number' : name ? 'name' : 'symbol',
      text: match[0],
    })
    offset += match[0].length
  }
  return tokens
}

export function evaluateExpression(
  expression: string,
  resolveName: (name: string) => number,
): number {
  const tokens = tokenize(expression)
  let index = 0
  if (!tokens.length) throw new Error('Enter an arithmetic expression.')

  // Recursive descent keeps precedence explicit and never executes JavaScript.
  function primary(): number {
    const token = tokens[index++]
    if (!token) throw new Error('The expression is incomplete.')
    if (token.kind === 'number') return finiteNumber(Number(token.text))
    if (token.kind === 'name') return finiteNumber(resolveName(token.text))
    if (token.text === '(') {
      const value = sum()
      if (tokens[index++]?.text !== ')')
        throw new Error('A closing parenthesis is missing.')
      return value
    }
    throw new Error(
      `Expected a number, variable, or parenthesis; found “${token.text}”.`,
    )
  }

  function unary(): number {
    const sign = tokens[index]?.text
    if (sign === '+' || sign === '-') {
      index += 1
      return (sign === '-' ? -1 : 1) * unary()
    }
    return primary()
  }

  function product(): number {
    let value = unary()
    while (tokens[index]?.text === '*' || tokens[index]?.text === '/') {
      const operator = tokens[index++].text
      const right = unary()
      if (operator === '/' && right === 0)
        throw new Error('Cannot divide by zero.')
      value = finiteNumber(operator === '*' ? value * right : value / right)
    }
    return value
  }

  function sum(): number {
    let value = product()
    while (tokens[index]?.text === '+' || tokens[index]?.text === '-') {
      const operator = tokens[index++].text
      const right = product()
      value = finiteNumber(operator === '+' ? value + right : value - right)
    }
    return value
  }

  const value = sum()
  if (index !== tokens.length)
    throw new Error(`Unexpected token “${tokens[index].text}”.`)
  return finiteNumber(value)
}

export function renameIdentifier(
  expression: string,
  oldName: string,
  newName: string,
): string {
  // Match number tokens first so names such as e3 cannot alter scientific notation.
  return expression.replace(
    /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*/g,
    (token) => (token === oldName ? newName : token),
  )
}
