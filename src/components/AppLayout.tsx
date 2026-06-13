import React, { useMemo } from 'react'
import { Layout, Menu, Breadcrumb, Typography, Badge } from 'antd'
import {
  AppstoreOutlined,
  FileTextOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  ExperimentOutlined
} from '@ant-design/icons'
import { useAppStore } from '@/store/appStore'
import ProductList from '@/pages/ProductList'
import ProductDetail from '@/pages/ProductDetail'
import InterfaceWorkbench from '@/pages/InterfaceWorkbench'
import ReportPage from '@/pages/ReportPage'

const { Sider, Content, Header } = Layout
const { Title } = Typography

const AppLayout: React.FC = () => {
  const {
    menuKey,
    setMenuKey,
    selectedProductId,
    selectedInterfaceId,
    products,
    getSelectedProduct,
    getSelectedInterface
  } = useAppStore()

  const product = getSelectedProduct()
  const api = getSelectedInterface()

  const menuItems = [
    { key: 'products', icon: <AppstoreOutlined />, label: '产品列表' },
    { key: 'workbench', icon: <ExperimentOutlined />, label: '接口工作台', disabled: !selectedInterfaceId },
    { key: 'reports', icon: <FileTextOutlined />, label: '验收报告' }
  ]

  const breadcrumbItems = useMemo(() => {
    const items: any[] = [{ title: '首页' }]
    if (menuKey === 'products') {
      items.push({ title: '产品列表' })
      if (selectedProductId) {
        items.push({ title: product?.name || '产品详情' })
      }
    } else if (menuKey === 'workbench') {
      items.push({ title: '产品列表' })
      if (selectedProductId) {
        items.push({ title: product?.name })
        if (selectedInterfaceId) {
          items.push({ title: api?.name || '接口工作台' })
        }
      }
    } else if (menuKey === 'reports') {
      items.push({ title: '验收报告' })
    }
    return items
  }, [menuKey, selectedProductId, selectedInterfaceId, product, api])

  const renderContent = () => {
    if (menuKey === 'products') {
      if (selectedProductId) {
        return <ProductDetail />
      }
      return <ProductList />
    }
    if (menuKey === 'workbench' && selectedInterfaceId) {
      return <InterfaceWorkbench />
    }
    if (menuKey === 'reports') {
      return <ReportPage />
    }
    return <ProductList />
  }

  const totalInterfaces = products.reduce((sum, p) => sum + p.interfaces.length, 0)
  const unresolvedIssues = products.reduce(
    (sum, p) => sum + p.interfaces.reduce((s, a) => s + a.issues.filter((i) => !i.resolved).length, 0),
    0
  )

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={232} style={{ background: '#001529', overflow: 'auto' }}>
        <div style={{ padding: '20px 16px 16px', textAlign: 'center' }}>
          <Title level={4} style={{ color: '#fff', margin: 0, fontSize: 16 }}>
            数据要素接口验收
          </Title>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4 }}>
            桌面客户端 v1.0
          </div>
        </div>
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-around'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{products.length}</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>产品数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{totalInterfaces}</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>接口数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Badge count={unresolvedIssues} size="small" color="#ff4d4f">
                <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, minWidth: 24 }}>
                  {unresolvedIssues || 0}
                </div>
              </Badge>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>待解决</div>
            </div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuKey]}
          items={menuItems}
          onClick={({ key }) => setMenuKey(key)}
          style={{ borderRight: 'none' }}
        />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 12,
          color: 'rgba(255,255,255,0.45)',
          fontSize: 11,
          textAlign: 'center'
        }}>
          © 2026 平台运营工具
        </div>
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          height: 56,
          lineHeight: '56px'
        }}>
          <Breadcrumb items={breadcrumbItems} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ color: '#8c8c8c', fontSize: 13 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
              本地数据存储安全
            </span>
          </div>
        </Header>
        <Content style={{ margin: 0, padding: 20, overflow: 'auto', background: '#f5f7fa' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
