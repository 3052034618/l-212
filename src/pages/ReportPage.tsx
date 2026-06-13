import React, { useMemo, useState } from 'react'
import {
  Card,
  Select,
  Table,
  Tag,
  Space,
  Button,
  Progress,
  App as AntApp,
  Empty,
  Row,
  Col,
  Statistic,
  Divider,
  List,
  Tooltip,
  Collapse,
  Alert,
  Typography
} from 'antd'
import {
  FileTextOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ExperimentOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons'
import { useAppStore } from '@/store/appStore'
import {
  generateReport,
  exportReportToExcel,
  exportIssuesToExcel,
  getIssueTypeLabel,
  getSeverityLabel,
  computeTestCaseStats
} from '@/lib/exportUtils'
import type { Product, AcceptanceReport } from '@/types'

const { Option } = Select
const { Title, Text } = Typography

const productStatusColor = (s: Product['status']) =>
  s === 'accepted' ? 'success' :
  s === 'rejected' ? 'error' :
  s === 'pending' ? 'processing' : 'default'

const productStatusLabel = (s: Product['status']) =>
  s === 'accepted' ? '已通过' :
  s === 'rejected' ? '已驳回' :
  s === 'pending' ? '待验收' : '草稿'

const ReportPage: React.FC = () => {
  const { message } = AntApp.useApp()
  const { products, setSelectedProduct, setSelectedInterface, setMenuKey, refresh } = useAppStore()
  const [selectedProductId, setSelectedProductId] = useState<string | 'all'>('all')

  const currentProduct = products.find((p) => p.id === selectedProductId)

  const allIssues = useMemo(() => {
    const list: Array<{
      issue: any
      productId: string
      productName: string
      interfaceId: string
      interfaceName: string
    }> = []
    products.forEach((p) => {
      p.interfaces.forEach((a) => {
        a.issues.forEach((issue) => {
          list.push({
            issue,
            productId: p.id,
            productName: p.name,
            interfaceId: a.id,
            interfaceName: a.name
          })
        })
      })
    })
    return list
  }, [products])

  const unresolvedIssues = allIssues.filter((x) => !x.issue.resolved)

  const globalStats = useMemo(() => {
    const totalInterfaces = products.reduce((s, p) => s + p.interfaces.length, 0)
    const passedInterfaces = products.reduce(
      (s, p) => s + p.interfaces.filter((a) => a.status === 'passed').length,
      0
    )
    const failedInterfaces = products.reduce(
      (s, p) => s + p.interfaces.filter((a) => a.status === 'failed').length,
      0
    )
    const pendingInterfaces = products.reduce(
      (s, p) => s + p.interfaces.filter((a) => a.status === 'pending').length,
      0
    )
    return {
      products: products.length,
      interfaces: totalInterfaces,
      passedInterfaces,
      failedInterfaces,
      pendingInterfaces,
      issues: allIssues.length,
      unresolved: unresolvedIssues.length
    }
  }, [products, allIssues, unresolvedIssues])

  const report: AcceptanceReport | null = useMemo(() => {
    if (!currentProduct) return null
    return generateReport(currentProduct)
  }, [currentProduct])

  const handleExportReport = async () => {
    if (!report) return
    const p = await exportReportToExcel(report)
    if (p) message.success(`报告已导出到：${p}`)
  }

  const handleExportAllIssues = async () => {
    const issues = allIssues.map((x) => x.issue)
    if (issues.length === 0) {
      message.warning('暂无问题可导出')
      return
    }
    const p = await exportIssuesToExcel(issues, selectedProductId === 'all' ? '全部产品' : currentProduct!.name)
    if (p) message.success(`问题清单已导出到：${p}`)
  }

  const gotoInterface = (productId: string, interfaceId: string) => {
    setSelectedProduct(productId)
    setSelectedInterface(interfaceId)
    setMenuKey('workbench')
  }

  const productColumns = [
    {
      title: '产品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (t: string, r: Product) => (
        <a onClick={() => setSelectedProductId(r.id)} style={{ fontWeight: 500 }}>{t}</a>
      )
    },
    { title: '编码', dataIndex: 'code', key: 'code', width: 120 },
    { title: '提供方', dataIndex: 'provider', key: 'provider', width: 140 },
    {
      title: '接口数',
      key: 'ifaceCount',
      width: 90,
      align: 'center' as const,
      render: (_: any, r: Product) => <Tag color="blue">{r.interfaces.length}</Tag>
    },
    {
      title: '通过/失败',
      key: 'pf',
      width: 140,
      render: (_: any, r: Product) => {
        const passed = r.interfaces.filter((a) => a.status === 'passed').length
        const failed = r.interfaces.filter((a) => a.status === 'failed').length
        return (
          <Space>
            <span style={{ color: '#52c41a' }}><CheckCircleOutlined /> {passed}</span>
            <span style={{ color: '#ff4d4f' }}><CloseCircleOutlined /> {failed}</span>
          </Space>
        )
      }
    },
    {
      title: '待解决问题',
      key: 'issues',
      width: 110,
      align: 'center' as const,
      render: (_: any, r: Product) => {
        const count = r.interfaces.reduce((s, a) => s + a.issues.filter((i) => !i.resolved).length, 0)
        return count > 0 ? <Tag color="red">{count}</Tag> : <Tag color="green">0</Tag>
      }
    },
    {
      title: '产品状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: Product['status']) => (
        <Tag color={productStatusColor(s)}>{productStatusLabel(s)}</Tag>
      )
    },
    {
      title: '操作',
      key: 'op',
      width: 100,
      render: (_: any, r: Product) => (
        <Button size="small" onClick={() => setSelectedProductId(r.id)}>
          查看详情
        </Button>
      )
    }
  ]

  const severityStats = useMemo(() => {
    const map: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    unresolvedIssues.forEach((x) => {
      map[x.issue.severity] = (map[x.issue.severity] || 0) + 1
    })
    return map
  }, [unresolvedIssues])

  const allIssueColumns = [
    {
      title: '产品',
      key: 'product',
      width: 150,
      render: (_: any, r: any) => (
        <a onClick={() => setSelectedProductId(r.productId)}>{r.productName}</a>
      )
    },
    {
      title: '接口',
      key: 'interface',
      width: 160,
      render: (_: any, r: any) => (
        <a onClick={() => gotoInterface(r.productId, r.interfaceId)}>{r.interfaceName}</a>
      )
    },
    {
      title: '严重程度',
      dataIndex: ['issue', 'severity'],
      key: 'severity',
      width: 90,
      render: (s: string) => (
        <Tag color={
          s === 'critical' ? 'red' :
          s === 'high' ? 'orange' :
          s === 'medium' ? 'blue' : 'default'
        }>
          {getSeverityLabel(s as any)}
        </Tag>
      )
    },
    {
      title: '问题类型',
      dataIndex: ['issue', 'type'],
      key: 'type',
      width: 100,
      render: (t: string) => <Tag>{getIssueTypeLabel(t as any)}</Tag>
    },
    {
      title: '字段',
      dataIndex: ['issue', 'fieldPath'],
      key: 'field',
      width: 150,
      render: (v: string) => v ? <code style={{ fontSize: 12 }}>{v}</code> : '-'
    },
    {
      title: '描述',
      dataIndex: ['issue', 'description'],
      key: 'desc',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: ['issue', 'resolved'],
      key: 'resolved',
      width: 80,
      align: 'center' as const,
      render: (v: boolean) => v
        ? <Tag color="success">已解决</Tag>
        : <Tag color="processing">未解决</Tag>
    }
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card>
            <Statistic title="产品总数" value={globalStats.products} prefix={<FileTextOutlined style={{ color: '#1677ff' }} />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="接口总数" value={globalStats.interfaces} prefix={<ExperimentOutlined style={{ color: '#722ed1' }} />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="通过接口"
              value={globalStats.passedInterfaces}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="失败接口"
              value={globalStats.failedInterfaces}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待解决问题"
              value={globalStats.unresolved}
              valueStyle={{ color: globalStats.unresolved > 0 ? '#ff7a45' : '#52c41a' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="问题总数" value={globalStats.issues} prefix={<WarningOutlined style={{ color: '#faad14' }} />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            验收概览
          </Title>
          <Space>
            <Select
              style={{ width: 240 }}
              value={selectedProductId}
              onChange={(v) => setSelectedProductId(v)}
              allowClear={false}
            >
              <Option value="all">全部产品</Option>
              {products.map((p) => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportReport}
              disabled={!report}
              type="primary"
            >
              导出验收报告
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={handleExportAllIssues}>
              导出问题清单
            </Button>
          </Space>
        </div>

        {report ? (
          <div>
            <Alert
              type={report.acceptanceConclusion === 'accepted' ? 'success' : report.acceptanceConclusion === 'rejected' ? 'error' : 'warning'}
              showIcon
              message={`${report.productName} 验收结论：${report.acceptanceConclusion === 'accepted' ? '✅ 通过验收' : report.acceptanceConclusion === 'rejected' ? '❌ 未通过验收' : '⏳ 验收中'}`}
              description={
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space>
                    <span>接口: {report.passedInterfaces}/{report.totalInterfaces} 通过（{report.pendingInterfaces} 待测试）</span>
                    <span>测试用例: 已执行 {report.executedTestCases}/{report.totalTestCases}，通过 {report.passedTestCases}</span>
                    <span>问题: {report.unresolvedIssues}/{report.totalIssues} 待解决</span>
                  </Space>
                  {report.conclusionReason && (
                    <Text type="secondary" style={{ fontSize: 12 }}>说明：{report.conclusionReason}</Text>
                  )}
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col span={6}>
                <Card size="small">
                  <div style={{ marginBottom: 8 }}>接口通过率</div>
                  <Progress
                    type="dashboard"
                    percent={report.totalInterfaces > 0
                      ? Math.round(report.passedInterfaces / report.totalInterfaces * 100)
                      : 0}
                    strokeColor="#52c41a"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <div style={{ marginBottom: 8 }}>问题解决率</div>
                  <Progress
                    type="dashboard"
                    percent={report.totalIssues > 0
                      ? Math.round((report.totalIssues - report.unresolvedIssues) / report.totalIssues * 100)
                      : 100}
                    strokeColor={report.unresolvedIssues === 0 ? '#52c41a' : '#fa8c16'}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="严重程度分布（未解决）">
                  <Row gutter={12} style={{ marginTop: 8 }}>
                    {[
                      { label: '致命', key: 'critical', color: '#7f1d1d', icon: <ArrowUpOutlined /> },
                      { label: '高', key: 'high', color: '#dc2626', icon: <ArrowUpOutlined /> },
                      { label: '中', key: 'medium', color: '#2563eb', icon: <ArrowUpOutlined /> },
                      { label: '低', key: 'low', color: '#6b7280', icon: <ArrowDownOutlined /> }
                    ].map((s) => (
                      <Col span={6} key={s.key}>
                        <div style={{ background: '#fafafa', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                          <div style={{ color: s.color, fontSize: 11, marginBottom: 4 }}>
                            {s.icon} {s.label}
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 600, color: s.color }}>
                            {report.interfaces.reduce(
                              (sum, i) => sum + i.issues.filter(
                                (x) => !x.resolved && x.severity === s.key
                              ).length, 0
                            )}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </Card>
              </Col>
            </Row>

            <Divider orientation="left">接口明细</Divider>
            <Collapse
              items={report.interfaces.map((iface) => {
                const tcStats = computeTestCaseStats(currentProduct?.interfaces.find(i => i.id === iface.interfaceId)?.testCases || [])
                return {
                key: iface.interfaceId,
                label: (
                  <Space wrap>
                    <Tag color={
                      iface.status === 'passed' ? 'success' :
                      iface.status === 'failed' ? 'error' : 'processing'
                    }>
                      {iface.status === 'passed' ? '通过' : iface.status === 'failed' ? '未通过' : '待测试'}
                    </Tag>
                    <span style={{ fontWeight: 500 }}>{iface.interfaceName}</span>
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                      用例 已执行{tcStats.executed}/{tcStats.total}，通过{tcStats.passed}
                      {tcStats.pending > 0 && <Tag color="default" style={{ marginLeft: 4 }}>待执行{tcStats.pending}</Tag>}
                    </span>
                    {!iface.hasFieldDefinitions && (
                      <Tag color="orange">未配置字段定义</Tag>
                    )}
                    {!iface.hasResponses && (
                      <Tag color="orange">无响应记录</Tag>
                    )}
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                      问题 <Tag color={iface.issues.filter(i => !i.resolved).length > 0 ? 'red' : 'green'}>
                        {iface.issues.filter(i => !i.resolved).length}/{iface.issues.length}
                      </Tag>
                    </span>
                    <Button size="small" type="link" onClick={() => gotoInterface(selectedProductId as string, iface.interfaceId)}>
                      跳转处理
                    </Button>
                  </Space>
                ),
                children: iface.issues.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无问题" />
                ) : (
                  <List
                    size="small"
                    dataSource={iface.issues}
                    renderItem={(issue) => (
                      <List.Item
                        style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          marginBottom: 6,
                          background: issue.resolved ? '#f6ffed' : '#fff7e6'
                        }}
                      >
                        <Space style={{ width: '100%' }}>
                          <Tag color={
                            issue.severity === 'critical' ? 'red' :
                            issue.severity === 'high' ? 'orange' :
                            issue.severity === 'medium' ? 'blue' : 'default'
                          }>
                            {getSeverityLabel(issue.severity)}
                          </Tag>
                          <Tag>{getIssueTypeLabel(issue.type)}</Tag>
                          {issue.resolved
                            ? <Tag color="success">已解决</Tag>
                            : <Tag color="processing">未解决</Tag>
                          }
                          {issue.fieldPath && <code style={{ fontSize: 12, color: '#722ed1' }}>{issue.fieldPath}</code>}
                          <span style={{ flex: 1, color: '#262626' }}>{issue.description}</span>
                          <Tooltip title={issue.remark}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {issue.expected ? `期望:${issue.expected}` : ''}
                              {issue.actual ? ` 实际:${issue.actual}` : ''}
                            </Text>
                          </Tooltip>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            复测{issue.retestCount}次
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                )
              }})}
            />
          </div>
        ) : (
          <Card title="产品验收状态总览" size="small">
            {products.length === 0 ? (
              <Empty description="暂无产品数据，先在产品列表创建产品和接口" />
            ) : (
              <Table
                size="small"
                columns={productColumns}
                dataSource={products}
                rowKey="id"
                pagination={false}
              />
            )}
          </Card>
        )}
      </Card>

      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>全部问题清单</span>
            <Tag color={unresolvedIssues.length > 0 ? 'red' : 'green'}>
              待解决 {unresolvedIssues.length}/{allIssues.length}
            </Tag>
          </Space>
        }
        size="small"
      >
        {allIssues.length === 0 ? (
          <Empty description="暂无问题记录。在接口工作台发送请求后会自动检测并创建问题。" />
        ) : (
          <Table
            size="small"
            columns={allIssueColumns}
            dataSource={selectedProductId === 'all'
              ? allIssues
              : allIssues.filter((x) => x.productId === selectedProductId)
            }
            rowKey={(r) => r.issue.id}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>
    </div>
  )
}

export default ReportPage
