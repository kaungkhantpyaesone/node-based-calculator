import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import {
  ArrowRight,
  Calculator,
  GitBranch,
  Trash2,
  Variable,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { comparisonOperators } from './model'
import { numberError } from './expression'
import type {
  Branch,
  CalculatorNode,
  ControlData,
  NodeKind,
  NodePatch,
  NodeResult,
  Operand,
} from './model'

export type ConnectedInput = { id: string; name: string; edgeId: string }
export type NodeEditor = {
  result: NodeResult
  nameError?: string
  inputs: ConnectedInput[]
  branches: Partial<Record<Branch, ConnectedInput>>
  modeLocked: boolean
  patch: (patch: NodePatch) => void
  commitName: () => void
  remove: () => void
  disconnect: (edgeId: string) => void
}
export type FlowNode = Node<
  { definition: CalculatorNode; editor: NodeEditor },
  NodeKind
>

const nodeDetails = {
  variable: {
    title: 'Variable',
    description: 'Give a number a name.',
    icon: Variable,
  },
  calculation: {
    title: 'Calculation',
    description: 'Turn connected inputs into a result.',
    icon: Calculator,
  },
  control: {
    title: 'Control flow',
    description: 'Choose a result with an if / else.',
    icon: GitBranch,
  },
}

export function CalculatorNodeView({ data, selected }: NodeProps<FlowNode>) {
  const { definition, editor } = data
  const details = nodeDetails[definition.type]
  const Icon = details.icon
  return (
    <Card
      className={cn('calculator-node', selected && 'node-selected')}
      data-kind={definition.type}
    >
      <CardHeader className="node-drag-handle">
        <div className="flex items-center justify-between gap-ui-xs">
          <div className="flex items-center gap-ui-xs">
            <span className="node-icon">
              <Icon className="size-4" />
            </span>
            <CardTitle>{details.title}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="nodrag nopan"
            aria-label={`Delete ${definition.data.name}`}
            onClick={editor.remove}
          >
            <Trash2 />
          </Button>
        </div>
        <CardDescription>{details.description}</CardDescription>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-ui-sm nodrag nopan nowheel"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <NameField node={definition} editor={editor} />
        {definition.type !== 'variable' && (
          <Dependencies editor={editor} name={definition.data.name} />
        )}
        {definition.type === 'variable' && (
          <FieldGroup>
            <Field data-invalid={editor.result.status === 'error'}>
              <FieldLabel htmlFor={`${definition.id}-value`}>Value</FieldLabel>
              <Input
                id={`${definition.id}-value`}
                inputMode="decimal"
                value={definition.data.value}
                onChange={(event) =>
                  editor.patch({ value: event.target.value })
                }
                aria-invalid={editor.result.status === 'error'}
              />
              {editor.result.status === 'error' && (
                <FieldError>{editor.result.error}</FieldError>
              )}
            </Field>
          </FieldGroup>
        )}
        {definition.type === 'calculation' && (
          <FieldGroup>
            <Field data-invalid={editor.result.status === 'error'}>
              <FieldLabel htmlFor={`${definition.id}-expression`}>
                Expression
              </FieldLabel>
              <Input
                id={`${definition.id}-expression`}
                value={definition.data.expression}
                placeholder="e.g. price * quantity"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) =>
                  editor.patch({ expression: event.target.value })
                }
                aria-invalid={editor.result.status === 'error'}
              />
              <FieldDescription>
                Use connected names, numbers, + − × / and ( ).
              </FieldDescription>
              {editor.result.status === 'error' && (
                <FieldError>{editor.result.error}</FieldError>
              )}
            </Field>
          </FieldGroup>
        )}
        {definition.type === 'control' && (
          <ControlFields
            id={definition.id}
            name={definition.data.name}
            control={definition.data}
            editor={editor}
          />
        )}
      </CardContent>
      <ResultFooter name={definition.data.name} result={editor.result} />
    </Card>
  )
}

function NameField({
  node,
  editor,
}: {
  node: CalculatorNode
  editor: NodeEditor
}) {
  return (
    <FieldGroup>
      <Field data-invalid={Boolean(editor.nameError)}>
        <FieldLabel htmlFor={`${node.id}-name`}>
          {node.type === 'variable' ? 'Variable name' : 'Output name'}
        </FieldLabel>
        <Input
          id={`${node.id}-name`}
          value={node.data.nameDraft}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => editor.patch({ nameDraft: event.target.value })}
          onBlur={editor.commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              editor.commitName()
            }
          }}
          aria-invalid={Boolean(editor.nameError)}
        />
        {editor.nameError && <FieldError>{editor.nameError}</FieldError>}
      </Field>
    </FieldGroup>
  )
}

function Dependencies({ editor, name }: { editor: NodeEditor; name: string }) {
  return (
    <section
      className="dependency-section relative"
      aria-label={`${name} connected inputs`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="dependencies"
        aria-label={`${name} Dependencies input`}
      />
      <p className="text-xs font-medium">
        Dependencies{' '}
        <span className="text-muted-foreground">· {editor.inputs.length}</span>
      </p>
      {editor.inputs.length ? (
        <ScrollArea
          className={cn(
            'dependency-list',
            editor.inputs.length > 2 ? 'h-24' : 'h-12',
          )}
        >
          <div className="flex flex-wrap gap-ui-xs pr-ui-xs">
            {editor.inputs.map((input) => (
              <Badge
                variant="secondary"
                key={input.edgeId}
                className="max-w-full gap-1"
              >
                <span className="truncate">{input.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Disconnect ${input.name} from ${name}`}
                  onClick={() => editor.disconnect(input.edgeId)}
                >
                  <X />
                </Button>
              </Badge>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <p className="text-xs text-muted-foreground">
          Connect outputs to this port to use their names.
        </p>
      )}
    </section>
  )
}

function ControlFields({
  id,
  name,
  control,
  editor,
}: {
  id: string
  name: string
  control: ControlData
  editor: NodeEditor
}) {
  return (
    <>
      <FieldGroup>
        <Field data-disabled={editor.modeLocked}>
          <FieldLabel>Result type</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={control.mode}
            disabled={editor.modeLocked}
            aria-label="Result type"
            onValueChange={(value) => {
              if (value === 'variable' || value === 'calculation')
                editor.patch({ mode: value })
            }}
            className="w-full"
          >
            <ToggleGroupItem value="variable" className="flex-1">
              Variable
            </ToggleGroupItem>
            <ToggleGroupItem value="calculation" className="flex-1">
              Calculation
            </ToggleGroupItem>
          </ToggleGroup>
          {editor.modeLocked && (
            <FieldDescription>
              Disconnect branch links to change the result type.
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
      <FieldSet>
        <FieldLegend variant="label">Condition</FieldLegend>
        <FieldGroup className="gap-ui-xs">
          <OperandField
            id={`${id}-left`}
            label="Left operand"
            operand={control.condition.left}
            inputs={editor.inputs}
            onChange={(left) =>
              editor.patch({ condition: { ...control.condition, left } })
            }
          />
          <Field>
            <FieldLabel>Comparison</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={control.condition.operator}
              aria-label="Comparison"
              className="w-full"
              onValueChange={(value) => {
                const operator = comparisonOperators.find(
                  (operator) => operator === value,
                )
                if (operator)
                  editor.patch({
                    condition: { ...control.condition, operator },
                  })
              }}
            >
              {comparisonOperators.map((operator) => (
                <ToggleGroupItem
                  key={operator}
                  value={operator}
                  className="flex-1"
                  aria-label={operator}
                >
                  {operator}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <OperandField
            id={`${id}-right`}
            label="Right operand"
            operand={control.condition.right}
            inputs={editor.inputs}
            onChange={(right) =>
              editor.patch({ condition: { ...control.condition, right } })
            }
          />
        </FieldGroup>
      </FieldSet>
      <FieldGroup>
        {(['if', 'else'] as const).map((branch) => (
          <BranchField
            key={branch}
            id={id}
            name={name}
            branch={branch}
            control={control}
            editor={editor}
          />
        ))}
      </FieldGroup>
      {editor.result.status === 'error' && (
        <FieldError>{editor.result.error}</FieldError>
      )}
    </>
  )
}

function OperandField({
  id,
  label,
  operand,
  inputs,
  onChange,
}: {
  id: string
  label: string
  operand: Operand
  inputs: ConnectedInput[]
  onChange: (operand: Operand) => void
}) {
  const missing =
    operand.kind === 'node' &&
    !inputs.some((input) => input.id === operand.nodeId)
  const numericError =
    operand.kind === 'number' ? numberError(operand.value) : undefined
  return (
    <Field data-invalid={missing || Boolean(numericError)}>
      <FieldLabel htmlFor={`${id}-source`}>{label}</FieldLabel>
      <div className="flex items-center gap-ui-xs">
        <Select
          value={
            operand.kind === 'number' ? 'number' : `node:${operand.nodeId}`
          }
          onValueChange={(value) =>
            onChange(
              value === 'number'
                ? { kind: 'number', value: '0' }
                : { kind: 'node', nodeId: value.slice(5) },
            )
          }
        >
          <SelectTrigger
            id={`${id}-source`}
            className="flex-1 min-w-0"
            aria-invalid={missing}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="number">Number</SelectItem>
              {inputs.map((input) => (
                <SelectItem key={input.id} value={`node:${input.id}`}>
                  {input.name}
                </SelectItem>
              ))}
              {missing && operand.kind === 'node' && (
                <SelectItem value={`node:${operand.nodeId}`} disabled>
                  Disconnected input
                </SelectItem>
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
        {operand.kind === 'number' && (
          <Input
            id={`${id}-number`}
            aria-invalid={Boolean(numericError)}
            aria-label={`${label} number`}
            className="w-24"
            inputMode="decimal"
            value={operand.value}
            onChange={(event) =>
              onChange({ kind: 'number', value: event.target.value })
            }
          />
        )}
      </div>
      {missing && (
        <FieldError>Reconnect this input or choose another operand.</FieldError>
      )}
      {numericError && <FieldError>{numericError}</FieldError>}
    </Field>
  )
}

function BranchField({
  id,
  name,
  branch,
  control,
  editor,
}: {
  id: string
  name: string
  branch: Branch
  control: ControlData
  editor: NodeEditor
}) {
  const child = editor.branches[branch]
  const active = editor.result.selectedBranch === branch
  const label = branch === 'if' ? 'If true' : 'Else'
  const numericError =
    control.mode === 'variable' && !child
      ? numberError(branch === 'if' ? control.ifValue : control.elseValue)
      : undefined
  return (
    <Field
      data-invalid={Boolean(numericError)}
      className={cn('branch-field relative', active && 'branch-active')}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={branch}
        aria-label={`${name} ${branch === 'if' ? 'If' : 'Else'} branch input`}
      />
      <div className="flex items-center justify-between gap-ui-xs">
        <FieldLabel
          htmlFor={
            child || control.mode === 'calculation'
              ? undefined
              : `${id}-${branch}-value`
          }
        >
          {label}
        </FieldLabel>
        {active && <Badge variant="secondary">Selected</Badge>}
      </div>
      {child ? (
        <div className="flex items-center justify-between gap-ui-xs">
          <span className="text-sm truncate" title={child.name}>
            {child.name}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Disconnect ${label} branch from ${name}`}
            onClick={() => editor.disconnect(child.edgeId)}
          >
            <X />
          </Button>
        </div>
      ) : control.mode === 'variable' ? (
        <Input
          id={`${id}-${branch}-value`}
          aria-invalid={Boolean(numericError)}
          inputMode="decimal"
          value={branch === 'if' ? control.ifValue : control.elseValue}
          onChange={(event) =>
            editor.patch(
              branch === 'if'
                ? { ifValue: event.target.value }
                : { elseValue: event.target.value },
            )
          }
        />
      ) : (
        <FieldDescription>
          Connect a calculation or Calculation-mode control.
        </FieldDescription>
      )}
      {control.mode === 'variable' && !child && (
        <FieldDescription>
          Or connect a Variable-mode control to this port.
        </FieldDescription>
      )}
      {numericError && <FieldError>{numericError}</FieldError>}
    </Field>
  )
}

function ResultFooter({ name, result }: { name: string; result: NodeResult }) {
  return (
    <CardFooter className="node-result relative flex-col items-stretch gap-ui-xs">
      <div className="flex items-center justify-between gap-ui-xs">
        <span className="text-xs text-muted-foreground truncate" title={name}>
          {name}
        </span>
        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
      </div>
      <p
        className={cn(
          'text-base font-semibold break-all',
          result.status === 'error' && 'text-muted-foreground',
        )}
        aria-live="polite"
      >
        {result.status === 'success' ? String(result.value) : 'Needs attention'}
      </p>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        aria-label={`${name} output`}
      />
    </CardFooter>
  )
}
