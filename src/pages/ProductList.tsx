import React, { useMemo, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Input,
  Tag,
  Modal,
  Form,
  Select,
  App as AntApp,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ImportOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileUnknownOutlined
} from '@ant-design/icons'
import type { Product } from '@/types'
import { useAppStore } from '@/store/appStore'
import { addProduct, updateProduct, deleteProduct, importJson } from '@/lib/database'

const { Search } = Input
const { Option } = Select

const statusMap: Record<Product['status'], { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: '草稿', color: 'default', icon: <FileUnknownOutlined /> },
  pending: { label: '待验收', color: 'processing', icon: <ClockCircleOutlined /> },
  accepted: { label: '已通过', color: 'success', icon: <CheckCircleOutlined /> },
  rejected: { label: '已驳回', color: 'error', icon: <CloseCircleOutlined /> }
}

const ProductList: React.FC = () => {
  const { message, modal } = AntApp.useApp()
  const { products, refresh, setSelectedProduct, setMenuKey } = useAppStore()
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form] = Form.useForm()

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !searchText ||
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.code.toLowerCase().includes(searchText.toLowerCase()) ||
        p.provider.toLowerCase().includes(searchText.toLowerCase())
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [products, searchText, statusFilter])

  const stats = useMemo(() => {
    return {
      total: products.length,
      interfaces: products.reduce((s, p) => s + p.interfaces.length, 0),
      issues: products.reduce(
        (s, p) => s + p.interfaces.reduce((x, a) => x + a.issues.length, 0),
        0
      ),
      accepted: products.filter((p) => p.status === 'accepted').length
    }
  }, [products])

  const handleOpenAdd = () => {
    setEditingProduct(null)
    form.resetFields()
    setAddModalOpen(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p)
    form.setFieldsValue(p)
    setAddModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingProduct) {
        await updateProduct(editingProduct.id, values)
        message.success('产品更新成功')
      } else {
        await addProduct(values)
        message.success('产品创建成功')
      }
      refresh()
      setAddModalOpen(false)
    } catch {}
  }

  const handleDelete = async (p: Product) => {
    await deleteProduct(p.id)
    refresh()
    message.success('产品已删除')
  }

  const handleViewDetail = (p: Product) => {
    setSelectedProduct(p.id)
  }

  const handleImport = async () => {
    const result = await window.electronAPI.openFileDialog({
      title: '导入产品数据',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return
    const filePath = result.filePaths[0]
    const fileResult = await window.electronAPI.readFile(filePath)
    if (!fileResult.success || !fileResult.data) {
      message.error('文件读取失败')
      return
    }
    try {
      const imported = await importJson(fileResult.data)
      refresh()
      message.success(`成功导入 ${imported.length} 个产品`)
    } catch (err: any) {
      message.error('导入失败: ' + err.message)
    }
  }

  const columns = [
    {
      title: '产品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (t: string, r: Product) => (
        <a onClick={() => handleViewDetail(r)} style={{ fontWeight: 500 }}>
          {t}
        </a>
      )
    },
    { title: '产品编码', dataIndex: 'code', key: 'code', width: 140 },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120 },
    { title: '提供方', dataIndex: 'provider', key: 'provider', width: 140 },
    {
      title: '接口数',
      key: 'interfaces',
      width: 90,
      align: 'center' as const,
      render: (_: any, r: Product) => (
        <Tag color="blue">{r.interfaces.length}</Tag>
      )
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: Product['status']) => {
        const info = statusMap[s]
        return <Tag icon={info.icon} color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (t: string) => new Date(t).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, r: Product) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(r)}>
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要删除该产品吗？"
            description="删除后将无法恢复"
            onConfirm={() => handleDelete(r)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic title="产品总数" value={stats.total} prefix={<FileUnknownOutlined style={{ color: '#1677ff' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="接口总数" value={stats.interfaces} prefix={<FileUnknownOutlined style={{ color: '#722ed1' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已通过产品" value={stats.accepted} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="问题总数" value={stats.issues} prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Search
              placeholder="搜索产品名称/编码/提供方"
              style={{ width: 320 }}
              allowClear
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              style={{ width: 140 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="all">全部状态</Option>
              <Option value="draft">草稿</Option>
              <Option value="pending">待验收</Option>
              <Option value="accepted">已通过</Option>
              <Option value="rejected">已驳回</Option>
            </Select>
          </Space>
          <Space>
            <Button icon={<ImportOutlined />} onClick={handleImport}>
              导入JSON
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>
              新增产品
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredProducts}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingProduct ? '编辑产品' : '新增产品'}
        open={addModalOpen}
        onOk={handleSubmit}
        onCancel={() => setAddModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="产品名称" name="name" rules={[{ required: true, message: '请输入产品名称' }]}>
            <Input placeholder="请输入产品名称" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="产品编码" name="code" rules={[{ required: true, message: '请输入产品编码' }]}>
                <Input placeholder="如：DP-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="分类" name="category">
                <Input placeholder="如：人口数据、企业数据" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="提供方" name="provider">
            <Input placeholder="数据提供方名称" />
          </Form.Item>
          <Form.Item label="产品描述" name="description">
            <Input.TextArea rows={3} placeholder="简要描述产品用途、覆盖范围等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProductList
