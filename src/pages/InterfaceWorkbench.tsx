import React, { useState, useMemo } from 'react'
import {
  Tabs,
  Card,
  Select,
  Input,
  Button,
  Space,
  Form,
  Modal,
  App as AntApp,
  Divider,
  Radio,
  Tag,
  List,
  Statistic,
  Row,
  Col,
  Empty,
  Tooltip,
  InputNumber,
  Checkbox,
  Badge,
  Popconfirm,
  Alert,
  Progress
} from 'antd'
import {
  ThunderboltOutlined,
  ThunderboltFilled,
  SaveOutlined,
  SaveFilled,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  EyeOutlined,
  DownloadOutlined,
  FormOutlined,
  LockOutlined
} from '@ant-design/icons'
import { useAppStore } from '@/store/appStore'
import {
  addTestCase,
  updateTestCase,
  deleteTestCase,
  addResponse,
  addIssue,
  updateIssue,
  deleteIssue,
  updateFieldDefinitions,
  updateInterface,
  syncIssuesFromCheck,
  getDatabase,
  generateId
} from '@/lib/database'
import { sendRequest } from '@/lib/httpClient'
import {
  checkFields,
  extractFieldsFromData,
  checkSingleIssueResolved,
  buildCheckSignature,
  type FieldCheckResult
} from '@/lib/fieldValidator'
import { exportIssuesToExcel, getIssueTypeLabel, getSeverityLabel } from '@/lib/exportUtils'
import type {
  HttpMethod,
  BodyType,
  KeyValuePair,
  TestCase,
  ResponseRecord,
  IssueItem,
  FieldDefinition,
  RetestRecord
} from '@/types'
import JsonViewer from '@/components/JsonViewer'
import KeyValueEditor from '@/components/KeyValueEditor'

const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

const methodOptions: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const bodyTypeOptions: { value: BodyType; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'form-data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'raw' }
]

const statusColor = (code: number) => {
  if (code >= 200 && code < 300) return 'status-ok'
  if (code >= 300 && code < 400) return 'status-redirect'
  if (code >= 400 && code < 500) return 'status-error'
  if (code >= 500) return 'status-error'
  return ''
}

const sizeToStr = (bytes?: number) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const InterfaceWorkbench: React.FC = () => {
  const { message, modal } = AntApp.useApp()
  const {
    getSelectedProduct,
    getSelectedInterface,
    getSelectedTestCase,
    selectedTestCaseId,
    setSelectedTestCase,
    refresh,
    lastResponse,
    setLastResponse
  } = useAppStore()

  const product = getSelectedProduct()!
  const api = getSelectedInterface()!
  const tc = getSelectedTestCase()

  const [loading, setLoading] = useState(false)
  const [timeoutMs, setTimeoutMs] = useState(30000)
  const [activeTab, setActiveTab] = useState('request')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null)
  const [fieldModalOpen, setFieldModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null)

  const [method, setMethod] = useState<HttpMethod>(tc?.method || api?.method || 'GET')
  const [url, setUrl] = useState<string>(tc?.url || (api ? `${api.baseUrl}${api.path}` : ''))
  const [headers, setHeaders] = useState<KeyValuePair[]>(tc?.headers || [])
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>(tc?.queryParams || [])
  const [bodyType, setBodyType] = useState<BodyType>(tc?.bodyType || 'none')
  const [bodyRaw, setBodyRaw] = useState<string>(tc?.bodyRaw || '')
  const [bodyFormData, setBodyFormData] = useState<KeyValuePair[]>(tc?.bodyFormData || [])
  const [bodyUrlEncoded, setBodyUrlEncoded] = useState<KeyValuePair[]>(tc?.bodyUrlEncoded || [])
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>(
    tc?.fieldDefinitions?.length ? tc.fieldDefinitions : (api?.fieldDefinitions || [])
  )
  const [checkResults, setCheckResults] = useState<FieldCheckResult[]>([])
  const [currentResponse, setCurrentResponse] = useState<ResponseRecord | null>(lastResponse)
  const [tcName, setTcName] = useState('')
  const [tcDesc, setTcDesc] = useState('')
  const [saveAsNew, setSaveAsNew] = useState(!tc)

  const [issueForm] = Form.useForm()
  const [fieldForm] = Form.useForm()
  const [saveForm] = Form.useForm()

  const loadTestCase = (t: TestCase) => {
    setSelectedTestCase(t.id)
    setMethod(t.method)
    setUrl(t.url)
    setHeaders(t.headers || [])
    setQueryParams(t.queryParams || [])
    setBodyType(t.bodyType || 'none')
    setBodyRaw(t.bodyRaw || '')
    setBodyFormData(t.bodyFormData || [])
    setBodyUrlEncoded(t.bodyUrlEncoded || [])
    setFieldDefs(t.fieldDefinitions || [])
    setCheckResults([])
    setCurrentResponse(null)
    setSaveAsNew(false)
  }

  const resetToDefault = () => {
    setSelectedTestCase(null)
    setMethod(api.method)
    setUrl(`${api.baseUrl}${api.path}`)
    setHeaders([])
    setQueryParams([])
    setBodyType('none')
    setBodyRaw('')
    setBodyFormData([])
    setBodyUrlEncoded([])
    setFieldDefs(api.fieldDefinitions || [])
    setCheckResults([])
    setCurrentResponse(null)
    setSaveAsNew(true)
  }

  const buildTcForSave = (): Partial<TestCase> => ({
    name: tcName,
    description: tcDesc,
    method,
    url,
    headers,
    queryParams,
    bodyType,
    bodyRaw,
    bodyFormData,
    bodyUrlEncoded,
    fieldDefinitions: fieldDefs
  })

  const handleSend = async () => {
    if (!url.trim()) {
      message.error('请输入请求地址')
      return
    }
    setLoading(true)
    try {
      const testCaseForReq: TestCase = {
        id: 'temp',
        name: 'temp',
        description: '',
        method,
        url,
        headers,
        queryParams,
        bodyType,
        bodyRaw,
        bodyFormData,
        bodyUrlEncoded,
        fieldDefinitions: fieldDefs,
        createdAt: '',
        updatedAt: ''
      }
      const result = await sendRequest(testCaseForReq, timeoutMs)

      if (result.success) {
        const now = new Date().toISOString()
        const rec = await addResponse(product.id, api.id, {
          testCaseId: selectedTestCaseId || '',
          status: result.status!,
          statusText: result.statusText!,
          headers: result.headers!,
          data: result.data,
          responseTime: result.responseTime,
          size: result.size || 0
        })
        setCurrentResponse(rec)
        setLastResponse(rec)

        if (selectedTestCaseId) {
          await updateTestCase(product.id, api.id, selectedTestCaseId, {
            lastExecutedAt: now,
            executionStatus: 'executed'
          })
        }

        const { results, issues: fieldIssues } = checkFields(fieldDefs, result.data)
        setCheckResults(results)

        const syncResult = await syncIssuesFromCheck(product.id, api.id, fieldIssues)

        if (result.status && result.status >= 400) {
          const existingStatusIssue = api.issues.find(
            (i) => i.type === 'status_error' && !i.resolved
          )
          if (!existingStatusIssue) {
            await addIssue(product.id, api.id, {
              type: 'status_error',
              severity: 'high',
              description: `HTTP状态码异常: ${result.status} ${result.statusText}`,
              expected: '2xx 或 3xx',
              actual: String(result.status)
            })
          }
        } else {
          const db = getDatabase()
          const statusIssues = db.products
            .find((p) => p.id === product.id)
            ?.interfaces.find((i) => i.id === api.id)
            ?.issues.filter((i) => i.type === 'status_error' && !i.resolved) || []
          for (const si of statusIssues) {
            await updateIssue(product.id, api.id, si.id, { resolved: true })
          }
        }

        if (result.responseTime > 5000) {
          const existingTimeout = api.issues.find(
            (i) => i.type === 'timeout' && !i.resolved
          )
          if (!existingTimeout) {
            await addIssue(product.id, api.id, {
              type: 'timeout',
              severity: 'medium',
              description: `响应时间过长: ${result.responseTime}ms`,
              expected: '< 5000ms',
              actual: `${result.responseTime}ms`
            })
          }
        } else {
          const db = getDatabase()
          const timeoutIssues = db.products
            .find((p) => p.id === product.id)
            ?.interfaces.find((i) => i.id === api.id)
            ?.issues.filter((i) => i.type === 'timeout' && !i.resolved) || []
          for (const ti of timeoutIssues) {
            await updateIssue(product.id, api.id, ti.id, { resolved: true })
          }
        }

        if (selectedTestCaseId) {
          const anyFail = results.some((r) => r.status === 'fail')
          await updateTestCase(product.id, api.id, selectedTestCaseId, {
            lastCheckPassed: !anyFail,
            executionStatus: 'checked'
          })
        }

        refresh()

        const unresolvedAfter = (() => {
          const db = getDatabase()
          return db.products
            .find((p) => p.id === product.id)
            ?.interfaces.find((i) => i.id === api.id)
            ?.issues.filter((i) => !i.resolved).length || 0
        })()

        let newStatus = api.status
        if (unresolvedAfter === 0 && result.status && result.status < 400 && fieldDefs.length > 0) {
          newStatus = 'passed'
        } else if (unresolvedAfter > 0) {
          newStatus = 'failed'
        } else {
          newStatus = 'testing'
        }
        if (newStatus !== api.status) {
          await updateInterface(product.id, api.id, { status: newStatus })
        }

        const parts: string[] = []
        parts.push(`请求完成，耗时 ${result.responseTime}ms`)
        if (syncResult.added > 0) parts.push(`新增问题 ${syncResult.added} 个`)
        if (syncResult.removed > 0) parts.push(`清理已修复问题 ${syncResult.removed} 个`)
        if (results.length > 0) {
          const pass = results.filter((r) => r.status === 'pass').length
          parts.push(`字段校验: ${pass}/${results.length} 通过`)
        }
        message.success(parts.join('；'))
      } else {
        setCurrentResponse({
          id: 'temp-error',
          testCaseId: selectedTestCaseId || '',
          status: 0,
          statusText: result.errorType || 'Error',
          headers: {},
          data: null,
          responseTime: result.responseTime,
          size: 0,
          timestamp: new Date().toISOString(),
          error: result.error
        })
        message.error(`请求失败: ${result.error}`)
      }
    } catch (err: any) {
      message.error('发送请求出错: ' + err.message)
    } finally {
      setLoading(false)
      refresh()
    }
  }

  const handleOpenSave = () => {
    if (selectedTestCaseId && !saveAsNew) {
      saveForm.setFieldsValue({ name: tc?.name, description: tc?.description })
    } else {
      saveForm.setFieldsValue({ name: '', description: '' })
    }
    setSaveModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await saveForm.validateFields()
      setTcName(values.name)
      setTcDesc(values.description)
      const data = { ...buildTcForSave(), name: values.name, description: values.description }

      if (selectedTestCaseId && !saveAsNew) {
        await updateTestCase(product.id, api.id, selectedTestCaseId, data)
        message.success('测试用例已更新')
      } else {
        const newTc = await addTestCase(product.id, api.id, data)
        setSelectedTestCase(newTc.id)
        setSaveAsNew(false)
        message.success('测试用例已保存')
      }
      refresh()
      setSaveModalOpen(false)
    } catch {}
  }

  const handleDeleteTestCase = async (id: string) => {
    await deleteTestCase(product.id, api.id, id)
    if (selectedTestCaseId === id) {
      resetToDefault()
    }
    refresh()
    message.success('测试用例已删除')
  }

  const handleDuplicateTestCase = async (t: TestCase) => {
    await addTestCase(product.id, api.id, {
      ...t,
      name: t.name + ' (副本)',
      id: undefined as any
    })
    refresh()
    message.success('已创建副本')
  }

  const handleExtractFields = () => {
    if (!currentResponse?.data) {
      message.warning('请先发送请求获取响应数据')
      return
    }
    const extracted = extractFieldsFromData(currentResponse.data)
    const existingPaths = new Set(fieldDefs.map((f) => f.path))
    const merged = [
      ...fieldDefs,
      ...extracted.filter((f) => !existingPaths.has(f.path))
    ]
    setFieldDefs(merged)
    message.success(`已从响应中提取 ${extracted.length} 个字段，合并后共 ${merged.length} 个`)
  }

  const handleSaveFieldDefs = async () => {
    if (selectedTestCaseId) {
      await updateTestCase(product.id, api.id, selectedTestCaseId, { fieldDefinitions: fieldDefs })
    }
    await updateFieldDefinitions(product.id, api.id, fieldDefs)
    refresh()
    message.success('字段定义已保存')
  }

  const handleRunCheck = async () => {
    if (!currentResponse?.data) {
      message.warning('请先发送请求获取响应数据')
      return
    }
    if (fieldDefs.length === 0) {
      message.warning('还没有字段定义，请先提取或手动添加')
      return
    }
    const { results, issues: fieldIssues } = checkFields(fieldDefs, currentResponse.data)
    setCheckResults(results)

    const syncResult = await syncIssuesFromCheck(product.id, api.id, fieldIssues)

    if (selectedTestCaseId) {
      const anyFail = results.some((r) => r.status === 'fail')
      await updateTestCase(product.id, api.id, selectedTestCaseId, {
        lastCheckPassed: !anyFail,
        executionStatus: 'checked'
      })
    }

    refresh()
    const pass = results.filter((r) => r.status === 'pass').length
    const parts = [`字段校验完成: ${pass}/${results.length} 通过`]
    if (syncResult.added > 0) parts.push(`新增问题 ${syncResult.added} 个`)
    if (syncResult.removed > 0) parts.push(`自动清理已修复问题 ${syncResult.removed} 个`)
    if (syncResult.added === 0 && syncResult.removed === 0) {
      parts.push('问题清单无变化')
    }
    message.success(parts.join('；'))
  }

  const handleOpenField = (f?: FieldDefinition) => {
    setEditingField(f || null)
    fieldForm.resetFields()
    if (f) {
      fieldForm.setFieldsValue({
        ...f,
        enumValuesStr: f.enumValues?.join(', ') || ''
      })
    } else {
      fieldForm.setFieldsValue({
        type: 'string',
        required: false,
        isSensitive: false
      })
    }
    setFieldModalOpen(true)
  }

  const handleSaveField = async () => {
    try {
      const values = await fieldForm.validateFields()
      const enumValues = values.enumValuesStr
        ? values.enumValuesStr.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined
      const field: FieldDefinition = {
        id: editingField?.id || generateId(),
        name: values.name,
        path: values.path,
        type: values.type,
        required: !!values.required,
        description: values.description || '',
        isSensitive: !!values.isSensitive,
        enumValues
      }
      if (editingField) {
        setFieldDefs(fieldDefs.map((f) => (f.id === editingField.id ? field : f)))
      } else {
        setFieldDefs([...fieldDefs, field])
      }
      setFieldModalOpen(false)
    } catch {}
  }

  const handleDeleteField = (id: string) => {
    setFieldDefs(fieldDefs.filter((f) => f.id !== id))
  }

  const handleOpenIssue = (issue?: IssueItem) => {
    setEditingIssue(issue || null)
    issueForm.resetFields()
    if (issue) {
      issueForm.setFieldsValue(issue)
    } else {
      issueForm.setFieldsValue({
        type: 'other',
        severity: 'medium',
        resolved: false
      })
    }
    setIssueModalOpen(true)
  }

  const handleSaveIssue = async () => {
    try {
      const values = await issueForm.validateFields()
      if (editingIssue) {
        await updateIssue(product.id, api.id, editingIssue.id, values)
      } else {
        await addIssue(product.id, api.id, values)
      }
      refresh()
      setIssueModalOpen(false)
      message.success(editingIssue ? '问题已更新' : '问题已添加')
    } catch {}
  }

  const handleRetestIssue = async (issue: IssueItem) => {
    if (!currentResponse) {
      message.warning('请先发送请求获取最新响应，再进行复测')
      return
    }
    if (fieldDefs.length === 0) {
      message.warning('还没有字段定义，无法基于字段进行复测')
      return
    }

    const checkResult = checkSingleIssueResolved(issue, fieldDefs, currentResponse.data)
    const now = new Date().toISOString()

    const record: RetestRecord = {
      timestamp: now,
      wasResolved: issue.resolved,
      nowResolved: checkResult.resolved,
      previousActual: issue.actual,
      newActual: checkResult.newActual,
      previousExpected: issue.expected,
      comment: checkResult.resolved ? '复测通过，问题已修复' : '复测未通过，问题仍然存在'
    }

    const history = issue.retestHistory ? [...issue.retestHistory, record] : [record]

    const patch: Partial<IssueItem> = {
      retestCount: issue.retestCount + 1,
      lastRetestAt: now,
      resolved: checkResult.resolved,
      retestHistory: history
    }
    if (checkResult.newActual !== undefined) {
      patch.actual = checkResult.newActual
    }

    await updateIssue(product.id, api.id, issue.id, patch)
    refresh()

    if (checkResult.resolved) {
      message.success(
        `复测第 ${issue.retestCount + 1} 次：问题已自动标记为已解决 (${checkResult.newActual || '字段已正常'})`
      )
    } else {
      message.warning(
        `复测第 ${issue.retestCount + 1} 次：问题仍未修复 (实际: ${checkResult.newActual || '字段异常'})`
      )
    }
  }

  const handleExportIssues = async () => {
    const path = await exportIssuesToExcel(api.issues, product.name, api.name)
    if (path) message.success(`已导出到：${path}`)
  }

  const fieldCheckStats = useMemo(() => {
    if (checkResults.length === 0) return { pass: 0, fail: 0, warn: 0, total: 0 }
    return {
      total: checkResults.length,
      pass: checkResults.filter((r) => r.status === 'pass').length,
      fail: checkResults.filter((r) => r.status === 'fail').length,
      warn: checkResults.filter((r) => r.status === 'warning').length
    }
  }, [checkResults])

  if (!product || !api) {
    return <Empty description="未选择接口" />
  }

  const unresolvedIssues = api.issues.filter((i) => !i.resolved)

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>
              <span className={`method-tag method-${api.method}`} style={{ marginRight: 12 }}>{api.method}</span>
              {api.name}
            </h2>
            <div style={{ color: '#595959', fontFamily: 'Consolas, monospace', fontSize: 13 }}>
              {api.baseUrl}<span style={{ color: '#1677ff' }}>{api.path}</span>
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>{api.description || '暂无描述'}</div>
          </div>
          <Space>
            <Tag color={api.status === 'passed' ? 'success' : api.status === 'failed' ? 'error' : 'processing'}>
              {api.status === 'passed' ? '已通过' : api.status === 'failed' ? '未通过' : api.status === 'testing' ? '测试中' : '待测试'}
            </Tag>
            <Badge count={unresolvedIssues.length} offset={[-4, 4]} title="待解决问题">
              <Button icon={<FormOutlined />} onClick={() => setActiveTab('issues')}>
                问题清单 ({api.issues.length})
              </Button>
            </Badge>
          </Space>
        </div>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="测试用例"
              value={api.testCases.length}
              prefix={<SaveFilled style={{ color: '#1677ff' }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="字段定义"
              value={fieldDefs.length}
              prefix={<EyeOutlined style={{ color: '#722ed1' }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="响应记录"
              value={api.responses.length}
              prefix={<ClockCircleOutlined style={{ color: '#13c2c2' }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="待解决问题"
              value={unresolvedIssues.length}
              valueStyle={{ color: unresolvedIssues.length > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={6}>
          <Card
            title={
              <Space>
                <SaveOutlined />
                <span>测试用例</span>
                <Tag color="blue">{api.testCases.length}</Tag>
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            <div style={{ marginBottom: 8 }}>
              <Button block size="small" icon={<PlusOutlined />} onClick={resetToDefault}>
                新建测试用例
              </Button>
            </div>
            {api.testCases.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无测试用例" />
            ) : (
              <List
                size="small"
                dataSource={api.testCases}
                renderItem={(t) => (
                  <List.Item
                    key={t.id}
                    className={selectedTestCaseId === t.id ? 'field-row' : ''}
                    style={{
                      background: selectedTestCaseId === t.id ? '#e6f4ff' : undefined,
                      padding: '8px 12px',
                      borderRadius: 6,
                      marginBottom: 4
                    }}
                    actions={[
                      <Tooltip key="copy" title="复制">
                        <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleDuplicateTestCase(t)} />
                      </Tooltip>,
                      <Popconfirm
                        key="del"
                        title="删除该测试用例？"
                        onConfirm={() => handleDeleteTestCase(t.id)}
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<ExperimentOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                      title={
                        <a onClick={() => loadTestCase(t)} style={{ fontSize: 13 }}>
                          {t.name}
                        </a>
                      }
                      description={
                        <Space size={4}>
                          <span className={`method-tag method-${t.method}`} style={{ fontSize: 10 }}>{t.method}</span>
                          <span style={{ color: '#8c8c8c', fontSize: 11 }}>
                            {new Date(t.updatedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>历史响应</span>
              </Space>
            }
            size="small"
          >
            {api.responses.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无请求记录" />
            ) : (
              <List
                size="small"
                dataSource={api.responses.slice(0, 20)}
                renderItem={(r) => (
                  <List.Item
                    key={r.id}
                    onClick={() => setCurrentResponse(r)}
                    style={{
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: 6,
                      marginBottom: 4,
                      background: currentResponse?.id === r.id ? '#e6f4ff' : undefined
                    }}
                    className="field-row"
                  >
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className={`${statusColor(r.status)}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          {r.status || 'ERR'} {r.statusText}
                        </span>
                        <span style={{ fontSize: 11, color: '#8c8c8c' }}>{r.responseTime}ms</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {new Date(r.timestamp).toLocaleString('zh-CN')}
                      </div>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col span={18}>
          <Card
            title="接口工作台"
            size="small"
            extra={
              <Space>
                <span>超时：</span>
                <InputNumber
                  size="small"
                  min={1000}
                  max={300000}
                  step={1000}
                  value={timeoutMs}
                  onChange={(v) => setTimeoutMs(Number(v) || 30000)}
                  addonAfter="ms"
                  style={{ width: 130 }}
                />
                <Button icon={<SaveOutlined />} onClick={handleOpenSave}>
                  {selectedTestCaseId && !saveAsNew ? '保存用例' : '另存为用例'}
                </Button>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={handleSend}
                  loading={loading}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  {loading ? '请求中...' : '发送试调用'}
                </Button>
              </Space>
            }
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Select
                value={method}
                onChange={setMethod}
                style={{ width: 110 }}
                size="large"
              >
                {methodOptions.map((m) => (
                  <Option key={m} value={m}>{m}</Option>
                ))}
              </Select>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="请输入请求地址，如 https://api.example.com/v1/user/info"
                size="large"
                style={{ flex: 1, fontFamily: 'Consolas, monospace' }}
                onPressEnter={handleSend}
              />
            </div>

            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <TabPane tab="请求配置" key="request">
                <Tabs defaultActiveKey="params" size="small">
                  <TabPane tab="Query 参数" key="params">
                    <KeyValueEditor
                      value={queryParams}
                      onChange={setQueryParams}
                      keyPlaceholder="参数名"
                      valuePlaceholder="参数值"
                      addButtonText="添加 Query 参数"
                    />
                  </TabPane>
                  <TabPane tab="Headers" key="headers">
                    <KeyValueEditor
                      value={headers}
                      onChange={setHeaders}
                      keyPlaceholder="Header 名称 (如 Content-Type)"
                      valuePlaceholder="Header 值"
                      addButtonText="添加 Header"
                    />
                  </TabPane>
                  <TabPane tab="Body" key="body">
                    <div style={{ marginBottom: 12 }}>
                      <Radio.Group value={bodyType} onChange={(e) => setBodyType(e.target.value)}>
                        {bodyTypeOptions.map((opt) => (
                          <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
                        ))}
                      </Radio.Group>
                    </div>
                    {bodyType === 'none' && (
                      <Alert type="info" message="该请求无 Body 数据" showIcon />
                    )}
                    {bodyType === 'json' && (
                      <TextArea
                        value={bodyRaw}
                        onChange={(e) => setBodyRaw(e.target.value)}
                        rows={10}
                        placeholder={`{\n  "key": "value",\n  "array": [1, 2, 3]\n}`}
                        style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}
                      />
                    )}
                    {bodyType === 'raw' && (
                      <TextArea
                        value={bodyRaw}
                        onChange={(e) => setBodyRaw(e.target.value)}
                        rows={10}
                        placeholder="raw body 内容..."
                        style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}
                      />
                    )}
                    {bodyType === 'form-data' && (
                      <KeyValueEditor
                        value={bodyFormData}
                        onChange={setBodyFormData}
                        keyPlaceholder="字段名"
                        valuePlaceholder="字段值"
                        addButtonText="添加 form-data 字段"
                      />
                    )}
                    {bodyType === 'x-www-form-urlencoded' && (
                      <KeyValueEditor
                        value={bodyUrlEncoded}
                        onChange={setBodyUrlEncoded}
                        keyPlaceholder="字段名"
                        valuePlaceholder="字段值"
                        addButtonText="添加表单字段"
                      />
                    )}
                  </TabPane>
                </Tabs>
              </TabPane>

              <TabPane tab="响应查看" key="response">
                {!currentResponse ? (
                  <Empty
                    description={
                      <Space direction="vertical">
                        <span>暂无响应数据</span>
                        <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                          点击右上角"发送试调用"按钮发起请求
                        </span>
                      </Space>
                    }
                  />
                ) : (
                  <div>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title="状态码"
                            value={currentResponse.status || '-'}
                            suffix={currentResponse.statusText}
                            valueStyle={{ color: currentResponse.status && currentResponse.status < 400 ? '#52c41a' : '#ff4d4f' }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title="响应时间"
                            value={currentResponse.responseTime}
                            suffix="ms"
                            prefix={<ClockCircleOutlined />}
                            valueStyle={{ color: currentResponse.responseTime > 3000 ? '#fa8c16' : '#1677ff' }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title="响应大小"
                            value={sizeToStr(currentResponse.size)}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>请求时间</div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {new Date(currentResponse.timestamp).toLocaleString('zh-CN')}
                          </div>
                        </Card>
                      </Col>
                    </Row>
                    {currentResponse.error && (
                      <Alert
                        type="error"
                        showIcon
                        message="请求错误"
                        description={currentResponse.error}
                        style={{ marginBottom: 16 }}
                      />
                    )}
                    <Tabs defaultActiveKey="body" size="small">
                      <TabPane tab="响应 Body" key="body">
                        {typeof currentResponse.data === 'object' && currentResponse.data !== null ? (
                          <JsonViewer data={currentResponse.data} />
                        ) : (
                          <pre className="json-viewer">{String(currentResponse.data ?? '')}</pre>
                        )}
                      </TabPane>
                      <TabPane tab={`响应 Headers (${Object.keys(currentResponse.headers || {}).length})`} key="headers">
                        <JsonViewer data={currentResponse.headers || {}} />
                      </TabPane>
                    </Tabs>
                  </div>
                )}
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <span>字段核对</span>
                    {checkResults.length > 0 && (
                      <Badge
                        count={`${fieldCheckStats.pass}/${fieldCheckStats.total}`}
                        style={{ backgroundColor: fieldCheckStats.fail > 0 ? '#ff4d4f' : '#52c41a' }}
                      />
                    )}
                  </Space>
                }
                key="fields"
              >
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={handleExtractFields}>
                      从响应提取字段
                    </Button>
                    <Button icon={<PlusOutlined />} onClick={() => handleOpenField()}>
                      手动添加字段
                    </Button>
                    <Button icon={<ThunderboltOutlined />} onClick={handleRunCheck} disabled={!currentResponse}>
                      执行字段校验
                    </Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveFieldDefs}>
                      保存字段定义
                    </Button>
                  </Space>
                  {checkResults.length > 0 && (
                    <Space size={16}>
                      <span style={{ color: '#52c41a' }}>
                        <CheckCircleOutlined /> 通过 {fieldCheckStats.pass}
                      </span>
                      <span style={{ color: '#ff4d4f' }}>
                        <CloseCircleOutlined /> 失败 {fieldCheckStats.fail}
                      </span>
                      <span style={{ color: '#faad14' }}>
                        <ExclamationCircleOutlined /> 警告 {fieldCheckStats.warn}
                      </span>
                    </Space>
                  )}
                </div>

                {fieldDefs.length === 0 ? (
                  <Empty
                    description={
                      <Space direction="vertical">
                        <span>暂无字段定义</span>
                        <Space>
                          <Button icon={<DownloadOutlined />} onClick={handleExtractFields}>
                            从响应提取
                          </Button>
                          <Button icon={<PlusOutlined />} onClick={() => handleOpenField()}>
                            手动添加
                          </Button>
                        </Space>
                      </Space>
                    }
                  />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 60 }}>状态</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 50 }}>必填</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>字段名</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 180 }}>路径</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 80 }}>类型</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 200 }}>枚举/说明</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 60 }}>敏感</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>校验结果</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', width: 120 }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldDefs.map((f) => {
                          const result = checkResults.find((r) => r.field.id === f.id)
                          return (
                            <tr key={f.id} className="field-row" style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '10px 12px' }}>
                                {result ? (
                                  result.status === 'pass' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                                  result.status === 'fail' ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> :
                                  result.status === 'warning' ? <ExclamationCircleOutlined style={{ color: '#faad14' }} /> :
                                  <span style={{ color: '#bfbfbf' }}>-</span>
                                ) : (
                                  <span style={{ color: '#bfbfbf' }}>未校验</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                {f.required ? <Tag color="red" style={{ margin: 0 }}>必填</Tag> : <Tag style={{ margin: 0 }}>可选</Tag>}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'Consolas, monospace', color: '#d73a49' }}>{f.name}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'Consolas, monospace', fontSize: 12, color: '#595959' }}>
                                <Tooltip title={f.path}>{f.path || '(root)'}</Tooltip>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <Tag color="blue" style={{ margin: 0 }}>{f.type}</Tag>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: 12, color: '#595959' }}>
                                {f.enumValues && f.enumValues.length > 0 ? (
                                  <div>枚举: {f.enumValues.join(', ')}</div>
                                ) : (
                                  <div>{f.description || '-'}</div>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                {f.isSensitive && <LockOutlined style={{ color: '#eb2f96' }} title="敏感字段" />}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: 12, color: result?.status === 'fail' ? '#ff4d4f' : '#8c8c8c' }}>
                                {result?.reason || '-'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <Space size="small">
                                  <Button size="small" onClick={() => handleOpenField(f)}>编辑</Button>
                                  <Popconfirm
                                    title="删除该字段定义？"
                                    onConfirm={() => handleDeleteField(f.id)}
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button size="small" danger>删除</Button>
                                  </Popconfirm>
                                </Space>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <span>问题清单</span>
                    <Badge count={unresolvedIssues.length} offset={[-2, 2]} title="待解决">
                      <Tag color="blue" style={{ marginLeft: 4 }}>{api.issues.length}</Tag>
                    </Badge>
                  </Space>
                }
                key="issues"
              >
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenIssue()}>
                      添加问题
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
                      刷新
                    </Button>
                  </Space>
                  <Button icon={<FileExcelOutlined />} onClick={handleExportIssues} disabled={api.issues.length === 0}>
                    导出 Excel
                  </Button>
                </div>
                {api.issues.length === 0 ? (
                  <Empty description="暂无问题记录，发送请求后自动检测或手动添加" />
                ) : (
                  <List
                    itemLayout="vertical"
                    dataSource={api.issues}
                    renderItem={(issue) => (
                      <List.Item
                        key={issue.id}
                        style={{
                          background: issue.resolved ? '#f6ffed' : '#fff',
                          borderRadius: 8,
                          padding: 16,
                          marginBottom: 12,
                          border: issue.resolved ? '1px solid #b7eb8f' : '1px solid #f0f0f0'
                        }}
                        actions={[
                          <Space key="op1">
                            <Tag color={
                              issue.severity === 'critical' ? 'red' :
                              issue.severity === 'high' ? 'orange' :
                              issue.severity === 'medium' ? 'blue' : 'default'
                            }>
                              {getSeverityLabel(issue.severity)}
                            </Tag>
                            <Tag>{getIssueTypeLabel(issue.type)}</Tag>
                            {issue.resolved ? (
                              <Tag color="success">已解决</Tag>
                            ) : (
                              <Tag color="processing">未解决</Tag>
                            )}
                          </Space>,
                          <Button key="retest" size="small" icon={<ReloadOutlined />} onClick={() => handleRetestIssue(issue)}>
                            复测 ({issue.retestCount})
                          </Button>,
                          <Button key="edit" size="small" icon={<FormOutlined />} onClick={() => handleOpenIssue(issue)}>
                            编辑
                          </Button>,
                          <Popconfirm
                            key="del"
                            title="删除该问题？"
                            onConfirm={() => { deleteIssue(product.id, api.id, issue.id); refresh() }}
                            okButtonProps={{ danger: true }}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                          </Popconfirm>
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space>
                              <span style={{ fontWeight: 500, fontSize: 14 }}>{issue.description}</span>
                              {issue.fieldPath && (
                                <Tag color="purple" style={{ margin: 0 }}>{issue.fieldPath}</Tag>
                              )}
                            </Space>
                          }
                          description={
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              期望: {issue.expected || '-'} | 实际: {issue.actual || '-'}
                            </div>
                          }
                        />
                        {issue.remark && (
                          <div style={{ fontSize: 12, color: '#595959', marginTop: 8, background: '#fafafa', padding: '8px 12px', borderRadius: 4 }}>
                            <strong>备注:</strong> {issue.remark}
                          </div>
                        )}
                        {(issue.retestCount > 0 || issue.lastRetestAt || (issue.retestHistory && issue.retestHistory.length > 0)) && (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#595959',
                              marginTop: 8,
                              background: '#fafcff',
                              padding: '8px 12px',
                              borderRadius: 4,
                              border: '1px solid #e6f4ff'
                            }}
                          >
                            <div style={{ fontWeight: 500, marginBottom: 6 }}>
                              <ReloadOutlined style={{ color: '#1677ff', marginRight: 4 }} />
                              复测记录（共 {issue.retestCount} 次
                              {issue.lastRetestAt && `，最后: ${new Date(issue.lastRetestAt).toLocaleString('zh-CN')}`}）
                            </div>
                            {issue.retestHistory && issue.retestHistory.length > 0 ? (
                              <div>
                                {issue.retestHistory.slice().reverse().map((rec, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      gap: 8,
                                      padding: '4px 0',
                                      borderTop: idx === 0 ? 'none' : '1px dashed #e6e6e6',
                                      alignItems: 'flex-start',
                                      fontSize: 11
                                    }}
                                  >
                                    <span style={{ color: '#8c8c8c', width: 160, flexShrink: 0 }}>
                                      {new Date(rec.timestamp).toLocaleString('zh-CN')}
                                    </span>
                                    <span style={{ width: 70, flexShrink: 0 }}>
                                      {rec.nowResolved ? (
                                        <Tag color="success" style={{ margin: 0 }}>已修复</Tag>
                                      ) : (
                                        <Tag color="warning" style={{ margin: 0 }}>仍存在</Tag>
                                      )}
                                    </span>
                                    <span style={{ color: '#595959', flex: 1 }}>
                                      {rec.comment}
                                      {rec.previousActual !== undefined && rec.previousActual !== rec.newActual && (
                                        <span style={{ color: '#8c8c8c', display: 'block', marginTop: 2 }}>
                                          实际值: {rec.previousActual || '-'} → {rec.newActual || '-'}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                暂无详细历史，建议在最新响应下重新点击"复测"按钮
                              </div>
                            )}
                          </div>
                        )}
                      </List.Item>
                    )}
                  />
                )}
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      <Modal
        title={selectedTestCaseId && !saveAsNew ? '保存测试用例' : '另存为新测试用例'}
        open={saveModalOpen}
        onOk={handleSave}
        onCancel={() => setSaveModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {selectedTestCaseId && !saveAsNew && (
          <div style={{ marginBottom: 16 }}>
            <Checkbox checked={saveAsNew} onChange={(e) => setSaveAsNew(e.target.checked)}>
              作为新用例保存（不覆盖原用例）
            </Checkbox>
          </div>
        )}
        <Form form={saveForm} layout="vertical">
          <Form.Item label="测试用例名称" name="name" rules={[{ required: true, message: '请输入用例名称' }]}>
            <Input placeholder="如：正常参数查询、异常参数测试等" />
          </Form.Item>
          <Form.Item label="用例描述" name="description">
            <TextArea rows={3} placeholder="描述该测试用例的测试场景、预期结果" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingField ? '编辑字段定义' : '新增字段定义'}
        open={fieldModalOpen}
        onOk={handleSaveField}
        onCancel={() => setFieldModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={620}
        destroyOnClose
      >
        <Form form={fieldForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="字段名称" name="name" rules={[{ required: true, message: '请输入字段名' }]}>
                <Input placeholder="如：用户手机号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="JSON 路径" name="path" rules={[{ required: true, message: '请输入字段路径' }]}>
                <Input placeholder="如：data.user.mobile 或 items.0.name" style={{ fontFamily: 'Consolas, monospace' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="数据类型" name="type" rules={[{ required: true }]}>
                <Select>
                  <Option value="string">string 字符串</Option>
                  <Option value="number">number 数字</Option>
                  <Option value="boolean">boolean 布尔</Option>
                  <Option value="object">object 对象</Option>
                  <Option value="array">array 数组</Option>
                  <Option value="null">null 空值</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="必填" name="required" valuePropName="checked">
                <Checkbox>该字段必须存在</Checkbox>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="敏感字段" name="isSensitive" valuePropName="checked">
                <Checkbox>需要脱敏处理</Checkbox>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="枚举值（可选，逗号分隔）" name="enumValuesStr">
            <Input placeholder="如：male, female, unknown" />
          </Form.Item>
          <Form.Item label="字段描述" name="description">
            <TextArea rows={2} placeholder="字段用途、说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingIssue ? '编辑问题' : '新增问题'}
        open={issueModalOpen}
        onOk={handleSaveIssue}
        onCancel={() => setIssueModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={issueForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="问题类型" name="type" rules={[{ required: true }]}>
                <Select>
                  <Option value="missing_field">字段缺失</Option>
                  <Option value="wrong_type">类型错误</Option>
                  <Option value="wrong_enum">枚举错误</Option>
                  <Option value="sensitive_data">敏感数据泄露</Option>
                  <Option value="timeout">响应超时</Option>
                  <Option value="status_error">状态码错误</Option>
                  <Option value="other">其他问题</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="严重程度" name="severity" rules={[{ required: true }]}>
                <Select>
                  <Option value="critical">致命</Option>
                  <Option value="high">高</Option>
                  <Option value="medium">中</Option>
                  <Option value="low">低</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="关联字段路径" name="fieldPath">
            <Input placeholder="如：data.user.mobile（可选）" />
          </Form.Item>
          <Form.Item label="问题描述" name="description" rules={[{ required: true, message: '请描述问题' }]}>
            <TextArea rows={3} placeholder="详细描述发现的问题" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="期望值" name="expected">
                <Input placeholder="如：返回字符串类型" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="实际值" name="actual">
                <Input placeholder="如：实际返回 null" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="问题备注/整改要求" name="remark">
            <TextArea rows={3} placeholder="修复建议、对接人、跟踪记录等" />
          </Form.Item>
          <Form.Item name="resolved" valuePropName="checked" initialValue={false}>
            <Checkbox>标记为已解决</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default InterfaceWorkbench
