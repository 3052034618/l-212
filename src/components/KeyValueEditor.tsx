import React from 'react'
import { Table, Button, Input, Space, Checkbox } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { KeyValuePair } from '@/types'

interface KeyValueEditorProps {
  value: KeyValuePair[]
  onChange: (val: KeyValuePair[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  addButtonText?: string
}

const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  value,
  onChange,
  keyPlaceholder = '参数名',
  valuePlaceholder = '参数值',
  addButtonText = '添加参数'
}) => {
  const addRow = () => {
    onChange([...value, { key: '', value: '', enabled: true }])
  }

  const updateRow = (idx: number, patch: Partial<KeyValuePair>) => {
    const next = [...value]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }

  const removeRow = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const columns = [
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 60,
      align: 'center' as const,
      render: (v: boolean, _: any, idx: number) => (
        <Checkbox checked={v} onChange={(e) => updateRow(idx, { enabled: e.target.checked })} />
      )
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (v: string, _: any, idx: number) => (
        <Input
          value={v}
          placeholder={keyPlaceholder}
          onChange={(e) => updateRow(idx, { key: e.target.value })}
          size="small"
        />
      )
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (v: string, _: any, idx: number) => (
        <Input
          value={v}
          placeholder={valuePlaceholder}
          onChange={(e) => updateRow(idx, { value: e.target.value })}
          size="small"
        />
      )
    },
    {
      title: '操作',
      key: 'op',
      width: 70,
      align: 'center' as const,
      render: (_: any, __: any, idx: number) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeRow(idx)}
        />
      )
    }
  ]

  return (
    <div>
      <Table
        size="small"
        columns={columns}
        dataSource={value.map((item, idx) => ({ ...item, _k: idx }))}
        rowKey="_k"
        pagination={false}
        showHeader={true}
      />
      <div style={{ marginTop: 8 }}>
        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addRow} block>
          {addButtonText}
        </Button>
      </div>
    </div>
  )
}

export default KeyValueEditor
