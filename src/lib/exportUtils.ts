import * as XLSX from 'xlsx'
import type { Product, IssueItem, AcceptanceReport, ApiInterface, TestCase } from '@/types'

export const exportIssuesToExcel = async (
  issues: IssueItem[],
  productName: string,
  interfaceName?: string
) => {
  const data = issues.map((issue, index) => ({
    序号: index + 1,
    问题ID: issue.id,
    问题类型: getIssueTypeLabel(issue.type),
    字段路径: issue.fieldPath || '-',
    严重程度: getSeverityLabel(issue.severity),
    问题描述: issue.description,
    期望值: issue.expected || '-',
    实际值: issue.actual || '-',
    是否已解决: issue.resolved ? '是' : '否',
    复测次数: issue.retestCount,
    最后复测时间: issue.lastRetestAt ? new Date(issue.lastRetestAt).toLocaleString('zh-CN') : '-',
    最近复测结论: (() => {
      const last = issue.retestHistory && issue.retestHistory.length > 0
        ? issue.retestHistory[issue.retestHistory.length - 1]
        : null
      return last ? (last.nowResolved ? '复测通过' : '复测未通过') : '-'
    })(),
    备注: issue.remark || ''
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 25 }, { wch: 10 },
    { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 8 },
    { wch: 20 }, { wch: 14 }, { wch: 30 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '问题清单')

  const fileName = `问题清单_${productName}${interfaceName ? '_' + interfaceName : ''}_${Date.now()}.xlsx`
  const result = await window.electronAPI.saveFileDialog({
    title: '导出问题清单',
    defaultPath: fileName,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
  })

  if (!result.canceled && result.filePath) {
    XLSX.writeFile(wb, result.filePath)
    return result.filePath
  }
  return null
}

export const exportReportToExcel = async (report: AcceptanceReport) => {
  const conclusionLabel =
    report.acceptanceConclusion === 'accepted' ? '通过验收' :
    report.acceptanceConclusion === 'rejected' ? '未通过验收' : '验收进行中'

  const summaryData = [
    { 项目: '产品名称', 内容: report.productName },
    { 项目: '报告生成时间', 内容: new Date(report.generatedAt).toLocaleString('zh-CN') },
    { 项目: '接口总数', 内容: report.totalInterfaces },
    { 项目: '通过接口数', 内容: report.passedInterfaces },
    { 项目: '未通过接口数', 内容: report.failedInterfaces },
    { 项目: '待测试接口数', 内容: report.pendingInterfaces },
    { 项目: '测试用例总数', 内容: report.totalTestCases },
    { 项目: '已执行且通过用例数', 内容: report.passedTestCases },
    { 项目: '已执行但未通过用例数', 内容: report.executedTestCases - report.passedTestCases },
    { 项目: '未执行用例数', 内容: report.totalTestCases - report.executedTestCases },
    { 项目: '问题总数', 内容: report.totalIssues },
    { 项目: '未解决问题数', 内容: report.unresolvedIssues },
    { 项目: '整体验收结论', 内容: conclusionLabel },
    { 项目: '结论说明', 内容: report.conclusionReason }
  ]

  const interfaceData = report.interfaces.map((iface, idx) => ({
    序号: idx + 1,
    接口名称: iface.interfaceName,
    接口状态: getInterfaceStatusLabel(iface.status),
    已定义字段: iface.hasFieldDefinitions ? '是' : '否',
    已发起请求: iface.hasResponses ? '是' : '否',
    用例总数: iface.totalTestCases,
    已执行用例数: iface.executedTestCases,
    已通过用例数: iface.passedTestCases,
    未执行用例数: iface.pendingTestCases,
    问题总数: iface.totalIssues,
    未解决问题数: iface.unresolvedIssues
  }))

  const issueData: any[] = []
  let issueIdx = 0
  report.interfaces.forEach((iface) => {
    iface.issues.forEach((issue) => {
      issueIdx++
      const last = issue.retestHistory && issue.retestHistory.length > 0
        ? issue.retestHistory[issue.retestHistory.length - 1]
        : null
      issueData.push({
        序号: issueIdx,
        所属接口: iface.interfaceName,
        问题类型: getIssueTypeLabel(issue.type),
        字段路径: issue.fieldPath || '-',
        严重程度: getSeverityLabel(issue.severity),
        问题描述: issue.description,
        期望值: issue.expected || '-',
        实际值: issue.actual || '-',
        是否已解决: issue.resolved ? '是' : '否',
        复测次数: issue.retestCount,
        最后复测时间: issue.lastRetestAt ? new Date(issue.lastRetestAt).toLocaleString('zh-CN') : '-',
        最近复测结论: last ? (last.nowResolved ? '复测通过' : '复测未通过') : '-',
        备注: issue.remark || ''
      })
    })
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '验收概览')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(interfaceData), '接口明细')
  if (issueData.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueData), '问题清单')
  }

  const fileName = `验收报告_${report.productName}_${Date.now()}.xlsx`
  const result = await window.electronAPI.saveFileDialog({
    title: '导出验收报告',
    defaultPath: fileName,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
  })

  if (!result.canceled && result.filePath) {
    XLSX.writeFile(wb, result.filePath)
    return result.filePath
  }
  return null
}

export const computeTestCaseStats = (
  testCases: TestCase[],
  opts?: { interfaceFieldDefinitions?: any[] }
) => {
  const total = testCases.length
  const executed = testCases.filter(
    (t) => t.executionStatus === 'checked' || t.executionStatus === 'executed'
  ).length

  const hasAnyFieldDefGlobal = !!(opts?.interfaceFieldDefinitions && opts.interfaceFieldDefinitions.length > 0)

  const passed = testCases.filter((t) => {
    if (t.executionStatus !== 'checked') return false
    if (t.lastCheckPassed !== true) return false
    const hasOwnFieldDef = !!(t.fieldDefinitions && t.fieldDefinitions.length > 0)
    if (!hasOwnFieldDef && !hasAnyFieldDefGlobal) return false
    return true
  }).length
  const pending = total - executed
  return { total, executed, passed, pending }
}

export interface InterfaceEvaluation {
  status: 'passed' | 'failed' | 'pending'
  totalTestCases: number
  executedTestCases: number
  passedTestCases: number
  pendingTestCases: number
  unresolvedIssues: number
  totalIssues: number
  hasFieldDefinitions: boolean
  hasResponses: boolean
}

export const evaluateInterface = (api: ApiInterface): InterfaceEvaluation => {
  const tcStats = computeTestCaseStats(api.testCases, {
    interfaceFieldDefinitions: api.fieldDefinitions
  })
  const apiUnresolved = api.issues.filter((i) => !i.resolved).length
  const hasFieldDefinitions = (api.fieldDefinitions && api.fieldDefinitions.length > 0) ||
    api.testCases.some((t) => t.fieldDefinitions && t.fieldDefinitions.length > 0)
  const hasResponses = api.responses.length > 0

  let status: 'passed' | 'failed' | 'pending' = 'pending'
  if (tcStats.total === 0 || !hasFieldDefinitions || !hasResponses) {
    status = 'pending'
  } else if (apiUnresolved > 0) {
    status = 'failed'
  } else if (tcStats.executed === tcStats.total && tcStats.passed === tcStats.total) {
    status = 'passed'
  } else if (tcStats.pending > 0) {
    status = 'pending'
  } else {
    status = 'failed'
  }

  return {
    status,
    totalTestCases: tcStats.total,
    executedTestCases: tcStats.executed,
    passedTestCases: tcStats.passed,
    pendingTestCases: tcStats.pending,
    unresolvedIssues: apiUnresolved,
    totalIssues: api.issues.length,
    hasFieldDefinitions,
    hasResponses
  }
}

export const generateReport = (product: Product): AcceptanceReport => {
  let passedInterfaces = 0
  let failedInterfaces = 0
  let pendingInterfaces = 0
  let totalIssues = 0
  let unresolvedIssues = 0
  let totalTestCases = 0
  let executedTestCases = 0
  let passedTestCases = 0

  const interfaceDetails = product.interfaces.map((api) => {
    const evalResult = evaluateInterface(api)
    totalTestCases += evalResult.totalTestCases
    executedTestCases += evalResult.executedTestCases
    passedTestCases += evalResult.passedTestCases
    totalIssues += evalResult.totalIssues
    unresolvedIssues += evalResult.unresolvedIssues

    if (evalResult.status === 'passed') passedInterfaces++
    else if (evalResult.status === 'failed') failedInterfaces++
    else pendingInterfaces++

    return {
      interfaceId: api.id,
      interfaceName: api.name,
      status: evalResult.status,
      totalTestCases: evalResult.totalTestCases,
      executedTestCases: evalResult.executedTestCases,
      passedTestCases: evalResult.passedTestCases,
      pendingTestCases: evalResult.pendingTestCases,
      unresolvedIssues: evalResult.unresolvedIssues,
      totalIssues: evalResult.totalIssues,
      hasFieldDefinitions: evalResult.hasFieldDefinitions,
      hasResponses: evalResult.hasResponses,
      issues: api.issues
    }
  })

  let acceptanceConclusion: AcceptanceReport['acceptanceConclusion'] = 'pending'
  let conclusionReason = ''

  if (product.interfaces.length === 0) {
    acceptanceConclusion = 'pending'
    conclusionReason = '当前产品尚未创建任何接口，请先在产品详情中录入接口'
  } else if (pendingInterfaces === product.interfaces.length) {
    acceptanceConclusion = 'pending'
    conclusionReason = `全部 ${product.interfaces.length} 个接口均未完成完整测试（缺少字段定义/请求响应/未执行用例），暂无法判定`
  } else if (unresolvedIssues === 0 && passedInterfaces + failedInterfaces > 0 && failedInterfaces === 0) {
    acceptanceConclusion = 'accepted'
    conclusionReason = `共 ${passedInterfaces}/${product.interfaces.length} 个接口通过，所有测试用例均执行且全部通过，问题清单无未解决项`
  } else if (unresolvedIssues > 0 || failedInterfaces > 0) {
    acceptanceConclusion = 'rejected'
    const parts = []
    if (failedInterfaces > 0) parts.push(`${failedInterfaces} 个接口未通过`)
    if (unresolvedIssues > 0) parts.push(`存在 ${unresolvedIssues} 个未解决问题`)
    if (pendingInterfaces > 0) parts.push(`${pendingInterfaces} 个接口待完成测试`)
    conclusionReason = parts.join('；')
  } else {
    acceptanceConclusion = 'pending'
    conclusionReason = '部分接口仍在测试中，验收未结束'
  }

  return {
    productId: product.id,
    productName: product.name,
    generatedAt: new Date().toISOString(),
    totalInterfaces: product.interfaces.length,
    passedInterfaces,
    failedInterfaces,
    pendingInterfaces,
    totalIssues,
    unresolvedIssues,
    executedTestCases,
    passedTestCases,
    totalTestCases,
    acceptanceConclusion,
    conclusionReason,
    interfaces: interfaceDetails
  }
}

export const getIssueTypeLabel = (type: IssueItem['type']): string => {
  const map: Record<IssueItem['type'], string> = {
    missing_field: '字段缺失',
    wrong_type: '类型错误',
    wrong_enum: '枚举错误',
    sensitive_data: '敏感数据',
    timeout: '超时',
    status_error: '状态码错误',
    other: '其他'
  }
  return map[type] || type
}

export const getSeverityLabel = (s: IssueItem['severity']): string => {
  const map: Record<IssueItem['severity'], string> = {
    critical: '致命',
    high: '高',
    medium: '中',
    low: '低'
  }
  return map[s] || s
}

export const getInterfaceStatusLabel = (s: ApiInterface['status']): string => {
  const map: Record<ApiInterface['status'], string> = {
    pending: '待测试',
    testing: '测试中',
    passed: '通过',
    failed: '未通过'
  }
  return map[s] || s
}
