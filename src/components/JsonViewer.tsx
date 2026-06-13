import React from 'react'

interface JsonViewerProps {
  data: any
  collapsed?: boolean
}

const renderValue = (value: any, indent: number = 0): React.ReactNode => {
  const pad = '  '.repeat(indent)
  const nextPad = '  '.repeat(indent + 1)

  if (value === null || value === undefined) {
    return <span className="json-null">{String(value)}</span>
  }

  if (typeof value === 'string') {
    return <span className="json-string">"{value}"</span>
  }

  if (typeof value === 'number') {
    return <span className="json-number">{value}</span>
  }

  if (typeof value === 'boolean') {
    return <span className="json-boolean">{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span>[]</span>
    }
    return (
      <>
        <span>[</span>
        {'\n'}
        {value.map((item, idx) => (
          <React.Fragment key={idx}>
            <span>{nextPad}</span>
            {renderValue(item, indent + 1)}
            {idx < value.length - 1 ? ',' : ''}
            {'\n'}
          </React.Fragment>
        ))}
        <span>{pad}]</span>
      </>
    )
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 0) {
      return <span>{'{}'}</span>
    }
    return (
      <>
        <span>{'{'}</span>
        {'\n'}
        {keys.map((key, idx) => (
          <React.Fragment key={key}>
            <span>{nextPad}</span>
            <span className="json-key">"{key}"</span>
            <span>: </span>
            {renderValue(value[key], indent + 1)}
            {idx < keys.length - 1 ? ',' : ''}
            {'\n'}
          </React.Fragment>
        ))}
        <span>{pad}{'}'}</span>
      </>
    )
  }

  return <span>{String(value)}</span>
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  return (
    <div className="json-viewer">
      <code>{renderValue(data)}</code>
    </div>
  )
}

export default JsonViewer
