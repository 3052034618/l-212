import React, { useState, useMemo } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Descriptions,
  App as AntApp,
  Popconfirm,
  Tooltip,
  Breadcrumb,
  Empty,
  Divider,
  Row,
  Col
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  WarningOutlined
} from '@ant-design/icons'
import type { ApiInterface, Product } from '@/types'
import type { HttpMethod } from '@/types'
import { useAppStore } from '@/store/appStore'
import { addInterface, updateInterface, deleteInterface, updateProduct } from '@/lib/database'

const { Option } = Select
const { TextArea } = Input

const methodOptions: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

const statusMap: Record<ApiInterface['status'], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待测试', color: 'default', icon: <ClockCircleOutlined /> },
  testing: { label: '测试中', color: 'processing', icon: <ThunderboltOutlined spin /> },
  passed: { label: '通过', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { label: '未通过', color: 'error', icon: <CloseCircleOutlined /> }
}

const productStatusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '待验收' },
  { value: 'accepted', label: '已通过' },
  { value: 'rejected', label: '已驳回' }
]

const ProductDetail: React.FC = () => {
  const { message } = AntApp.useApp()
  const {
    getSelectedProduct,
    setSelectedProduct,
    setSelectedInterface,
    setMenuKey,
    refresh
  } = useAppStore()

  const product = getSelectedProduct()!
  const [interfaceModalOpen, setInterfaceModalOpen] = useState(false)
  const [editingInterface, setEditingInterface] = useState<ApiInterface | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [statusForm] = Form.useForm()

  const ifaceColumns = useMemo(() => [
    {
      title: '接口名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span>
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 90,
      render: (m: HttpMethod) => <span className={`method-tag method-${m}`}>{m}</span>
    },
    {
      title: '请求地址',
      key: 'url',
      render: (_: any, r: ApiInterface) => (
        <Tooltip title={`${r.baseUrl}${r.path}`}>
          <span style={{ fontFamily: 'Consolas, monospace', fontSize: 12, color: '#595959' }}>
            {r.baseUrl}
            <span style={{ color: '#1677ff' }}>{r.path}</span>
          </span>
        </Tooltip>
      )
    },
    {
      title: '测试用例',
      key: 'tc',
      width: 100,
      align: 'center' as const,
      render: (_: any, r: ApiInterface) => <Tag color="blue">{r.testCases.length}</Tag>
    },
    {
      title: '待解决问题',
      key: 'issues',
      width: 110,
      align: 'center' as const,
      render: (_: any, r: ApiInterface) => {
        const unresolved = r.issues.filter((i) => !i.resolved).length
        if (unresolved > 0) return <Tag color="red" icon={<WarningOutlined />}>{unresolved}</Tag>
        return <Tag color="green">{r.issues.length}个</Tag>
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: ApiInterface['status']) => {
        const info = statusMap[s]
        return <Tag icon={info.icon} color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, r: ApiInterface) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<ExperimentOutlined />}
            onClick={() => {
              setSelectedInterface(r.id)
              setMenuKey('workbench')
            }}
          >
            验收测试
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenInterface(r)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该接口？"
            onConfirm={() => handleDeleteInterface(r.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ], [])

  const handleOpenInterface = (iface?: ApiInterface) => {
    setEditingInterface(iface || null)
    form.resetFields()
    if (iface) {
      form.setFieldsValue(iface)
    } else {
      form.setFieldsValue({ method: 'GET' })
    }
    setInterfaceModalOpen(true)
  }

  const handleSubmitInterface = async () => {
    try {
      const values = await form.validateFields()
      if (editingInterface) {
        await updateInterface(product.id, editingInterface.id, values)
        message.success('接口更新成功')
      } else {
        await addInterface(product.id, values)
        message.success('接口创建成功')
      }
      refresh()
      setInterfaceModalOpen(false)
    } catch {}
  }

  const handleDeleteInterface = async (id: string) => {
    await deleteInterface(product.id, id)
    refresh()
    message.success('接口已删除')
  }

  const handleChangeStatus = async () => {
    try {
      const values = await statusForm.validateFields()
      await updateProduct(product.id, { status: values.status, conclusion: values.conclusion })
      refresh()
      message.success('产品状态已更新')
      setStatusModalOpen(false)
    } catch {}
  }

  const issuesSummary = useMemo(() => {
    const total = product.interfaces.reduce((s, a) => s + a.issues.length, 0)
    const unresolved = product.interfaces.reduce(
      (s, a) => s + a.issues.filter((i) => !i.resolved).length, 0
    )
    return { total, unresolved }
  }, [product])

  if (!product) {
    return <Empty description="产品不存在" />
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => setSelectedProduct(null)}
          style={{ paddingLeft: 0 }}
        >
          返回产品列表
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 12 }}>
              {product.name}
              <Tag
                icon={product.status === 'accepted' ? <CheckCircleOutlined /> :
                  product.status === 'rejected' ? <CloseCircleOutlined /> :
                    product.status === 'pending' ? <ClockCircleOutlined /> : <FileTextOutlined />}
                color={product.status === 'accepted' ? 'success' :
                  product.status === 'rejected' ? 'error' :
                    product.status === 'pending' ? 'processing' : 'default'}
                style={{ marginLeft: 12 }}
              >
                {productStatusOptions.find((o) => o.value === product.status)?.label}
              </Tag>
            </h2>
            <Descriptions column={4} size="small">
              <Descriptions.Item label="产品编码">{product.code}</Descriptions.Item>
              <Descriptions.Item label="分类">{product.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="提供方">{product.provider || '-'}</Descriptions.Item>
              <Descriptions.Item label="接口数量">{product.interfaces.length} 个</Descriptions.Item>
            </Descriptions>
            <p style={{ color: '#595959', marginTop: 12, marginBottom: 0 }}>
              {product.description || '暂无描述'}
            </p>
          </div>
          <Space>
            <Button icon={<FileTextOutlined />} onClick={() => {
              statusForm.setFieldsValue({ status: product.status, conclusion: product.conclusion || '' })
              setStatusModalOpen(true)
            }}>
              验收结论
            </Button>
            <Button
              icon={<ExperimentOutlined />}
              disabled={product.interfaces.length === 0}
              onClick={() => {
                if (product.interfaces.length > 0) {
                  setSelectedInterface(product.interfaces[0].id)
                  setMenuKey('workbench')
                }
              }}
            >
              进入工作台
            </Button>
          </Space>
        </div>
        <Divider style={{ margin: '16px 0' }} />
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>接口总数</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>{product.interfaces.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>已通过</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
              {product.interfaces.filter((i) => i.status === 'passed').length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>未通过</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#ff4d4f' }}>
              {product.interfaces.filter((i) => i.status === 'failed').length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>问题总数</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#8c8c8c' }}>{issuesSummary.total}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>待解决</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#ff7a45' }}>{issuesSummary.unresolved}</div>
          </div>
        </div>
      </Card>

      <Card
        title={
          <Space>
            <span>接口列表</span>
            <Tag color="blue">{product.interfaces.length}</Tag>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenInterface()}>
            新增接口
          </Button>
        }
      >
        {product.interfaces.length === 0 ? (
          <Empty
            description={
              <Space direction="vertical">
                <span>暂无接口，开始导入或创建第一个接口</span>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenInterface()}>
                  新增接口
                </Button>
              </Space>
            }
          />
        ) : (
          <Table
            columns={ifaceColumns}
            dataSource={product.interfaces}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Modal
        title={editingInterface ? '编辑接口' : '新增接口'}
        open={interfaceModalOpen}
        onOk={handleSubmitInterface}
        onCancel={() => setInterfaceModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item label="接口名称" name="name" rules={[{ required: true, message: '请输入接口名称' }]}>
                <Input placeholder="如：用户信息查询" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="请求方法" name="method" rules={[{ required: true }]}>
                <Select>
                  {methodOptions.map((m) => (
                    <Option key={m} value={m}>{m}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="Base URL" name="baseUrl" rules={[{ required: true, message: '请输入Base URL' }]}>
                <Input placeholder="如：https://api.example.com/v1" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="路径" name="path" rules={[{ required: true, message: '请输入接口路径' }]}>
                <Input placeholder="如：/user/info" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="接口描述" name="description">
            <TextArea rows={3} placeholder="功能说明、返回字段用途等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="填写验收结论"
        open={statusModalOpen}
        onOk={handleChangeStatus}
        onCancel={() => setStatusModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item label="验收状态" name="status" rules={[{ required: true }]}>
            <Select>
              {productStatusOptions.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="验收结论/备注" name="conclusion">
            <TextArea rows={4} placeholder="详细说明验收结论、存在的问题、整改要求等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProductDetail
