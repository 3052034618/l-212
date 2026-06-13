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

export interface MaskedCheckResult {
  isMasked: boolean
  pattern?: string
}

export const isMaskedOrRedacted = (value: any): MaskedCheckResult => {
  if (value === null || value === undefined) return { isMasked: true, pattern: 'null/undefined' }
  if (value === '') return { isMasked: true, pattern: 'empty' }
  if (typeof value !== 'string') return { isMasked: false }

  const str = value.trim()
  if (!str) return { isMasked: true, pattern: 'empty' }

  if (/^[*●•■○◆]+$/.test(str)) return { isMasked: true, pattern: '全星号' }
  if (/^[xX*]+$/.test(str)) return { isMasked: true, pattern: '全掩码' }
  if (/^[*]{2,}/.test(str) || /[*]{2,}$/.test(str)) return { isMasked: true, pattern: '前缀或后缀星号' }
  if (/^.{1,4}[*●•]{2,}.{0,4}$/.test(str)) return { isMasked: true, pattern: '中间星号' }

  if (/^1[3-9][0-9]\*{4}[0-9]{4}$/.test(str)) return { isMasked: true, pattern: '手机号脱敏(138****1234)' }
  if (/^1[3-9][0-9]-?\*{4}-?[0-9]{4}$/.test(str)) return { isMasked: true, pattern: '手机号脱敏(带横杠)' }

  if (/^[0-9]{6}\*{4}[0-9]{3}[0-9Xx]$/.test(str)) return { isMasked: true, pattern: '身份证脱敏18位(6+4*+4)' }
  if (/^[0-9]{6}\*{6,10}[0-9Xx]{0,4}$/.test(str)) return { isMasked: true, pattern: '身份证脱敏' }
  if (/^[0-9]{3,6}\*+[0-9]{2,4}$/.test(str)) return { isMasked: true, pattern: '证件号类脱敏' }

  if (/^[a-zA-Z0-9._%+-]+@\*+\.[a-zA-Z]{2,}$/.test(str)) return { isMasked: true, pattern: '邮箱脱敏' }
  if (/^.{1,2}\*+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str)) return { isMasked: true, pattern: '邮箱脱敏(用户名掩码)' }

  if (/^[\u4e00-\u9fa5]{1,2}\*+$/.test(str)) return { isMasked: true, pattern: '姓名脱敏' }
  if (/^[\u4e00-\u9fa5]\*[\u4e00-\u9fa5]?$/.test(str)) return { isMasked: true, pattern: '中文姓名星号' }

  if (/^(null|none|n\/a|n\.a\.|—|--)$/i.test(str)) return { isMasked: true, pattern: '占位空值' }

  if (str.length <= 3 && /^[A-Za-z0-9]+$/.test(str)) return { isMasked: false }

  const starRatio = (str.match(/[*●•■○◆xX]/g) || []).length / str.length
  if (starRatio >= 0.3 && str.length >= 4) return { isMasked: true, pattern: `高占比掩码(${Math.round(starRatio * 100)}%)` }

  return { isMasked: false }
}

export const looksLikeRawSensitiveValue = (value: any): { likely: boolean; hint?: string } => {
  if (typeof value !== 'string') return { likely: false }
  const str = value.trim()
  if (!str) return { likely: false }

  if (/^1[3-9][0-9]{9}$/.test(str)) return { likely: true, hint: '完整手机号(11位中国大陆手机号)' }
  if (/^1[3-9][0-9]-?[0-9]{4}-?[0-9]{4}$/.test(str) && /1[3-9]/.test(str)) {
    return { likely: true, hint: '完整手机号(带横杠分隔)' }
  }
  if (/^[1-9][0-9]{5}(19|20)[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}[0-9Xx]$/.test(str)) {
    return { likely: true, hint: '完整18位身份证号(含出生日期校验)' }
  }
  if (/^[1-9][0-9]{5}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}$/.test(str)) {
    return { likely: true, hint: '完整15位身份证号(含出生日期校验)' }
  }
  if (/^[3-6][0-9]{12,18}$/.test(str)) {
    let sum = 0
    const digits = str.split('').map(Number)
    for (let i = digits.length - 2, alt = true; i >= 0; i--, alt = !alt) {
      let d = digits[i]
      if (alt) {
        d *= 2
        if (d > 9) d -= 9
      }
      sum += d
    }
    const checkDigit = (10 - (sum % 10)) % 10
    if (checkDigit === digits[digits.length - 1]) {
      return { likely: true, hint: '完整银行卡号(Luhn校验通过)' }
    }
    return { likely: false }
  }
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str)) {
    return { likely: true, hint: '完整邮箱地址' }
  }

  return { likely: false }
}

export interface FieldCheckResult {
  field: FieldDefinition
  passed: boolean
  status: 'pass' | 'fail' | 'warning' | 'unchecked'
  reason?: string
  actualValue?: any
  actualType?: string
}

export const buildCheckSignature = (
  type: IssueItem['type'],
  fieldPath: string | undefined
): string => {
  return `${type}::${fieldPath || '__global__'}`
}

export interface CheckOutput {
  results: FieldCheckResult[]
  issues: IssueItem[]
}

export const checkFields = (
  definitions: FieldDefinition[],
  responseData: any
): CheckOutput => {
  const results: FieldCheckResult[] = []
  const issues: IssueItem[] = []

  definitions.forEach((def) => {
    const { found, value } = getFieldByPath(responseData, def.path)
    const actualType = getJsType(value)

    let passed = true
    let status: FieldCheckResult['status'] = 'pass'
    let reason = ''

    const pushIssue = (type: IssueItem['type'], desc: string, expected: string, actual: string, severity: IssueItem['severity'] = 'high') => {
      const issue: IssueItem = {
        id: generateId(),
        type,
        fieldPath: def.path,
        severity,
        description: desc,
        expected,
        actual,
        resolved: false,
        retestCount: 0,
        checkSignature: buildCheckSignature(type, def.path),
        retestHistory: []
      }
      issues.push(issue)
    }

    if (!found) {
      if (def.required) {
        passed = false
        status = 'fail'
        reason = `必填字段缺失: 路径 ${def.path || '(根)'} 未找到`
        pushIssue('missing_field', reason, `字段应存在 (${def.type})`, '字段不存在', 'high')
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
          pushIssue('wrong_type', `${def.name || def.path} 类型错误`, def.type, actualType, 'high')
        }
      }

      if (def.enumValues && def.enumValues.length > 0 && value !== null && value !== undefined) {
        const strVal = String(value)
        if (!def.enumValues.includes(strVal)) {
          passed = false
          status = 'fail'
          reason = reason ? reason + '; ' : ''
          reason += `枚举值不匹配: 允许值 [${def.enumValues.join(', ')}], 实际 ${strVal}`
          pushIssue('wrong_enum', `${def.name || def.path} 枚举值错误`, def.enumValues.join(' | '), strVal, 'medium')
        }
      }

      if (def.isSensitive && value !== null && value !== undefined && value !== '') {
        const masked = isMaskedOrRedacted(value)
        if (masked.isMasked) {
          if (status !== 'fail') {
            status = status === 'warning' ? 'warning' : 'pass'
          }
        } else {
          const rawCheck = looksLikeRawSensitiveValue(value)
          const displayValue = typeof value === 'string' && value.length > 24
            ? value.slice(0, 24) + '...'
            : String(value)

          if (rawCheck.likely) {
            passed = false
            status = 'fail'
            const hint = `检测到${rawCheck.hint}，未做脱敏处理`
            reason = reason ? reason + '; ' + hint : hint
            pushIssue(
              'sensitive_data',
              `${def.name || def.path} 为敏感字段，${rawCheck.hint}，未脱敏`,
              '脱敏后的值 (如 138****1234)',
              displayValue,
              'high'
            )
          }
        }
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

export interface RetestFullContext {
  responseData: any
  status?: number
  statusText?: string
  responseTime?: number
  error?: string | null
}

export const checkSingleIssueResolved = (
  issue: IssueItem,
  definitions: FieldDefinition[],
  ctx: RetestFullContext
): { resolved: boolean; newActual?: string; newExpected?: string } => {
  const { responseData, status, responseTime, error } = ctx

  if (issue.type === 'status_error') {
    if (error) {
      return {
        resolved: false,
        newActual: `请求失败: ${error}`,
        newExpected: '2xx/3xx 状态码或请求成功'
      }
    }
    const isOk = status !== undefined && status >= 200 && status < 400
    return {
      resolved: isOk,
      newActual: status !== undefined ? String(status) : '无状态码',
      newExpected: '2xx 或 3xx'
    }
  }

  if (issue.type === 'timeout') {
    if (error && /timeout|timed.?out|超时/i.test(error)) {
      return {
        resolved: false,
        newActual: `请求依然超时: ${error}`,
        newExpected: '响应时间 <= 5000ms'
      }
    }
    const ok = responseTime !== undefined && responseTime <= 5000
    return {
      resolved: ok,
      newActual: responseTime !== undefined ? `${responseTime}ms` : '无响应时间',
      newExpected: '响应时间 <= 5000ms'
    }
  }

  if (issue.type === 'other') {
    if (error) {
      return {
        resolved: false,
        newActual: `依然存在异常: ${error}`,
        newExpected: '请求成功'
      }
    }
    return {
      resolved: true,
      newActual: '请求已正常返回',
      newExpected: issue.expected || '请求成功'
    }
  }

  const relatedDef = definitions.find((d) => d.path === issue.fieldPath)
  if (!relatedDef) {
    return { resolved: false, newActual: '未找到对应字段定义' }
  }

  const { results } = checkFields([relatedDef], responseData)
  const result = results[0]
  if (!result) return { resolved: false }

  const nowHasProblem = result.status === 'fail'

  return {
    resolved: !nowHasProblem,
    newActual: result.actualValue !== undefined && result.actualValue !== null
      ? (typeof result.actualValue === 'string' && result.actualValue.length > 40
          ? result.actualValue.slice(0, 40) + '...'
          : String(result.actualValue))
      : '字段不存在',
    newExpected: issue.expected
  }
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
      const lowerKey = key.toLowerCase()

      let sensitiveHint = false
      if (/(mobile|phone|phone.?number|tel|idcard|id.?card|id_no|cert|certno|idnumber|identity|身份证|手机|手机号|电话|银行卡|cardno|card_no|email|mail|邮箱)/i.test(lowerKey)) {
        sensitiveHint = true
      }
      if (looksLikeRawSensitiveValue(value).likely) {
        sensitiveHint = true
      }

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
            isSensitive: sensitiveHint
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
          isSensitive: sensitiveHint
        })
      }
    })
  }

  return definitions
}
