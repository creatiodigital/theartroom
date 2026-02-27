import fs from 'fs'
import path from 'path'

export interface SchemaField {
  name: string
  type: string
  isOptional: boolean
  isArray: boolean
  isId: boolean
  isUnique: boolean
  defaultValue: string | null
  isRelation: boolean
  comment: string | null
}

export interface SchemaModel {
  name: string
  fields: SchemaField[]
  fieldCount: number
  relationCount: number
}

export interface SchemaEnum {
  name: string
  values: string[]
}

export interface ParsedSchema {
  models: SchemaModel[]
  enums: SchemaEnum[]
}

/**
 * Parse prisma/schema.prisma and extract models, fields, and enums.
 */
export function parseSchema(): ParsedSchema {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  const content = fs.readFileSync(schemaPath, 'utf-8')
  const lines = content.split('\n')

  const models: SchemaModel[] = []
  const enums: SchemaEnum[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    // Parse model block
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/)
    if (modelMatch) {
      const model = parseModelBlock(modelMatch[1], lines, i + 1)
      models.push(model)
      i = skipBlock(lines, i)
      continue
    }

    // Parse enum block
    const enumMatch = line.match(/^enum\s+(\w+)\s*\{/)
    if (enumMatch) {
      const enumDef = parseEnumBlock(enumMatch[1], lines, i + 1)
      enums.push(enumDef)
      i = skipBlock(lines, i)
      continue
    }

    i++
  }

  return { models, enums }
}

function parseModelBlock(name: string, lines: string[], startLine: number): SchemaModel {
  const fields: SchemaField[] = []

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '}') break
    if (line === '' || line.startsWith('//') || line.startsWith('@@')) continue

    const field = parseFieldLine(line)
    if (field) fields.push(field)
  }

  const relationCount = fields.filter((f) => f.isRelation).length

  return { name, fields, fieldCount: fields.length, relationCount }
}

function parseFieldLine(line: string): SchemaField | null {
  // Extract inline comment
  const commentMatch = line.match(/\/\/\s*(.+)$/)
  const comment = commentMatch ? commentMatch[1].trim() : null
  const cleanLine = line.replace(/\/\/.*$/, '').trim()

  // Match: fieldName  Type?[]  @decorators...
  const fieldMatch = cleanLine.match(/^(\w+)\s+(\w+)(\?)?(\[\])?(.*)$/)
  if (!fieldMatch) return null

  const [, fieldName, baseType, optional, array, decorators] = fieldMatch

  const isId = decorators.includes('@id')
  const isUnique = decorators.includes('@unique')

  // Extract @default value
  const defaultMatch = decorators.match(/@default\(([^)]+)\)/)
  const defaultValue = defaultMatch ? defaultMatch[1] : null

  // Detect relations: type starts with uppercase and is not a known scalar
  const scalarTypes = [
    'String',
    'Int',
    'Float',
    'Boolean',
    'DateTime',
    'Json',
    'BigInt',
    'Decimal',
    'Bytes',
  ]
  const isRelation = !scalarTypes.includes(baseType) && /^[A-Z]/.test(baseType)

  return {
    name: fieldName,
    type: baseType + (optional ? '?' : '') + (array ? '[]' : ''),
    isOptional: !!optional,
    isArray: !!array,
    isId,
    isUnique,
    defaultValue,
    isRelation,
    comment,
  }
}

function parseEnumBlock(name: string, lines: string[], startLine: number): SchemaEnum {
  const values: string[] = []
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '}') break
    if (line === '' || line.startsWith('//')) continue
    values.push(line)
  }
  return { name, values }
}

function skipBlock(lines: string[], startLine: number): number {
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].trim() === '}') return i + 1
  }
  return lines.length
}
