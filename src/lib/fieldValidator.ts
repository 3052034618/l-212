import type { FieldDefinition, IssueItem } from '@/types'
import { generateId } from './database'

const getFieldByPath = (data: any, path: string): { found: boolean; value: any } => {
  if (!path) return { found: true, value: data }
  const parts = path.split('.').filter((p) => p)
  let current: any = data
  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) {
      return { found: false, value: undefined }
    }
    if (Array.isArray(current)) {
      const idx = parseInt(parts[i])
      if (!isNaN(idx) && idx < current.length) {
        current = current[idx]
      } else if (current.length > 0) {
        current = current[0]
      } else {
        return { found: false, value: undefined }
      }
    } else if (typeof current === 'object') {
      if (parts[i] in current) {
        current = current[parts[i]]
      } else {
        return { found: false, value: undefined }
      }
    } else {
      return { found: false, value: undefined }
    }
  }
  return { found: true, value: current }
}

const getJsType = (value: any): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

export interface FieldCheckResult {
  field: FieldDefinition
  passed: boolean
  status: 'pass' | 'fail' | 'warning' | 'unchecked'
  reason?: string
  actualValue?: any
  actualType?: string
}

export const checkFields = (
  definitions: FieldDefinition[],
  responseData: any
): { results: FieldCheckResult[]; issues: IssueItem[] } => {
  const results: FieldCheckResult[] = []
  const issues: IssueItem[] = []

  definitions.forEach((def) => {
    const { found, value } = getFieldByPath(responseData, def.path)
    const actualType = getJsType(value)

    let passed = true
    let status: FieldCheckResult['status'] = 'pass'
    let reason = ''

    if (!found) {
      if (def.required) {
        passed = false
        status = 'fail'
        reason = `必填字段缺失: 路径 ${def.path || '(根)'} 未找到`
        issues.push({
          id: generateId(),
          type: 'missing_field',
          fieldPath: def.path,
          severity: 'high',
          description: reason,
          expected: `字段应存在 (${def.type})`,
          actual: '字段不存在',
          resolved: false,
          retestCount: 0
        })
      } else {
        status = 'warning'
        reason = `可选字段缺失: ${def.path || '(根)'}`
      }
    } else {
      if (def.type !== 'null' && actualType !== def.type && actualType !== 'null') {
        if (def.type === 'number' && actualType === 'string' && !isNaN(Number(value))) {
          status = 'warning'
          reason = `类型不匹配: 期望 ${def.type}, 实际 string(可转为数字)`
        } else if (def.type === 'string' && actualType === 'number') {
          status = 'warning'
          reason = `类型不匹配: 期望 string, 实际 number(可转为字符串)`
        } else {
          passed = false
          status = 'fail'
          reason = `类型不匹配: 期望 ${def.type}, 实际 ${actualType}`
          issues.push({
            id: generateId(),
            type: 'wrong_type',
            fieldPath: def.path,
            severity: 'high',
            description: `${def.name || def.path} 类型错误`,
            expected: def.type,
            actual: actualType,
            resolved: false,
            retestCount: 0
          })
        }
      }

      if (def.enumValues && def.enumValues.length > 0 && value !== null && value !== undefined) {
        const strVal = String(value)
        if (!def.enumValues.includes(strVal)) {
          passed = false
          status = 'fail'
          reason = `枚举值不匹配: 允许值 [${def.enumValues.join(', ')}], 实际 ${strVal}`
          issues.push({
            id: generateId(),
            type: 'wrong_enum',
            fieldPath: def.path,
            severity: 'medium',
            description: `${def.name || def.path} 枚举值错误`,
            expected: def.enumValues.join(' | '),
            actual: strVal,
            resolved: false,
            retestCount: 0
          })
        }
      }

      if (def.isSensitive && value !== null && value !== undefined && value !== '') {
        status = status === 'fail' ? 'fail' : 'warning'
        const sensitiveHint = `敏感字段包含实际数据，建议检查是否脱敏`
        if (status !== 'fail') {
          reason = reason ? reason + '; ' + sensitiveHint : sensitiveHint
        }
        issues.push({
          id: generateId(),
          type: 'sensitive_data',
          fieldPath: def.path,
          severity: 'medium',
          description: `${def.name || def.path} 为敏感字段，返回值需脱敏`,
          expected: '脱敏后的值 (如 *****)',
          actual: typeof value === 'string' && value.length > 20 ? value.slice(0, 20) + '...' : String(value),
          resolved: false,
          retestCount: 0
        })
      }
    }

    results.push({
      field: { ...def, status, failReason: reason },
      passed,
      status,
      reason,
      actualValue: value,
      actualType
    })
  })

  return { results, issues }
}

export const extractFieldsFromData = (
  data: any,
  prefix: string = '',
  definitions: FieldDefinition[] = []
): FieldDefinition[] => {
  if (data === null || data === undefined) return definitions

  if (Array.isArray(data)) {
    if (data.length > 0) {
      const item = data[0]
      if (typeof item === 'object' && item !== null) {
        extractFieldsFromData(item, prefix, definitions)
      } else {
        definitions.push({
          id: generateId(),
          name: prefix.split('.').pop() || 'item',
          path: prefix,
          type: getJsType(item) as any,
          required: false,
          description: '',
          isSensitive: false
        })
      }
    }
  } else if (typeof data === 'object') {
    Object.keys(data).forEach((key) => {
      const value = data[key]
      const path = prefix ? `${prefix}.${key}` : key
      const jsType = getJsType(value)

      if (jsType === 'object' || jsType === 'array') {
        if (jsType === 'object' && value !== null) {
          extractFieldsFromData(value, path, definitions)
        } else if (jsType === 'array') {
          definitions.push({
            id: generateId(),
            name: key,
            path,
            type: 'array',
            required: false,
            description: '',
            isSensitive: false
          })
          if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            extractFieldsFromData(value[0], `${path}.0`, definitions)
          }
        }
      } else {
        definitions.push({
          id: generateId(),
          name: key,
          path,
          type: jsType as any,
          required: false,
          description: '',
          isSensitive: false
        })
      }
    })
  }

  return definitions
}
