import * as XLSX from 'xlsx'
import type { Product, IssueItem, AcceptanceReport, ApiInterface } from '@/types'

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
    备注: issue.remark || ''
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 25 }, { wch: 10 },
    { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 8 },
    { wch: 20 }, { wch: 30 }
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
  const summaryData = [
    { 项目: '产品名称', 内容: report.productName },
    { 项目: '生成时间', 内容: new Date(report.generatedAt).toLocaleString('zh-CN') },
    { 项目: '接口总数', 内容: report.totalInterfaces },
    { 项目: '通过接口数', 内容: report.passedInterfaces },
    { 项目: '失败接口数', 内容: report.failedInterfaces },
    { 项目: '待测试接口数', 内容: report.pendingInterfaces },
    { 项目: '问题总数', 内容: report.totalIssues },
    { 项目: '未解决问题数', 内容: report.unresolvedIssues },
    { 项目: '整体验收结论', 内容: report.unresolvedIssues === 0 ? '通过' : '未通过' }
  ]

  const interfaceData = report.interfaces.map((iface, idx) => ({
    序号: idx + 1,
    接口名称: iface.interfaceName,
    测试状态: getInterfaceStatusLabel(iface.status),
    测试用例数: iface.totalTestCases,
    通过用例数: iface.passedTestCases,
    问题数: iface.issues.length,
    未解决问题数: iface.issues.filter((i) => !i.resolved).length
  }))

  const issueData: any[] = []
  let issueIdx = 0
  report.interfaces.forEach((iface) => {
    iface.issues.forEach((issue) => {
      issueIdx++
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

export const generateReport = (product: Product): AcceptanceReport => {
  let passed = 0, failed = 0, pending = 0
  let totalIssues = 0, unresolvedIssues = 0

  const interfaceDetails = product.interfaces.map((api) => {
    if (api.status === 'passed') passed++
    else if (api.status === 'failed') failed++
    else pending++

    totalIssues += api.issues.length
    unresolvedIssues += api.issues.filter((i) => !i.resolved).length

    const passedTC = api.testCases.filter((t) => t.fieldDefinitions.length > 0).length

    return {
      interfaceId: api.id,
      interfaceName: api.name,
      status: api.status,
      totalTestCases: api.testCases.length,
      passedTestCases: passedTC,
      issues: api.issues
    }
  })

  return {
    productId: product.id,
    productName: product.name,
    generatedAt: new Date().toISOString(),
    totalInterfaces: product.interfaces.length,
    passedInterfaces: passed,
    failedInterfaces: failed,
    pendingInterfaces: pending,
    totalIssues,
    unresolvedIssues,
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
