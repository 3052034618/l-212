import { v4 as uuidv4 } from 'uuid'
import type { AppDatabase, Product, ApiInterface, TestCase, ResponseRecord, IssueItem, FieldDefinition } from '@/types'

declare global {
  interface Window {
    electronAPI: {
      getDataDir: () => Promise<string>
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; message?: string }>
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; message?: string }>
      openFileDialog: (options: any) => Promise<any>
      saveFileDialog: (options: any) => Promise<any>
      openExternal: (url: string) => Promise<void>
    }
  }
}

const DB_FILE = 'acceptance-db.json'

const initialDb: AppDatabase = {
  version: '1.0.0',
  products: [],
  lastModified: new Date().toISOString()
}

let dataDir: string = ''
let dbCache: AppDatabase | null = null

export const initDatabase = async () => {
  dataDir = await window.electronAPI.getDataDir()
  const dbPath = `${dataDir}/${DB_FILE}`
  const result = await window.electronAPI.readFile(dbPath)

  if (result.success && result.data) {
    try {
      dbCache = JSON.parse(result.data) as AppDatabase
    } catch {
      dbCache = { ...initialDb }
      await saveDatabase()
    }
  } else {
    dbCache = { ...initialDb }
    await saveDatabase()
  }
  return dbCache
}

const saveDatabase = async () => {
  if (!dbCache) return
  dbCache.lastModified = new Date().toISOString()
  const dbPath = `${dataDir}/${DB_FILE}`
  await window.electronAPI.writeFile(dbPath, JSON.stringify(dbCache, null, 2))
}

export const getDatabase = (): AppDatabase => {
  if (!dbCache) throw new Error('Database not initialized')
  return dbCache
}

export const generateId = () => uuidv4()

export const getProducts = (): Product[] => {
  return getDatabase().products
}

export const getProduct = (id: string): Product | undefined => {
  return getDatabase().products.find((p) => p.id === id)
}

export const addProduct = async (
  data: Omit<Product, 'id' | 'interfaces' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<Product> => {
  const db = getDatabase()
  const product: Product = {
    id: generateId(),
    ...data,
    interfaces: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.products.unshift(product)
  await saveDatabase()
  return product
}

export const updateProduct = async (id: string, data: Partial<Product>): Promise<void> => {
  const db = getDatabase()
  const idx = db.products.findIndex((p) => p.id === id)
  if (idx >= 0) {
    db.products[idx] = { ...db.products[idx], ...data, updatedAt: new Date().toISOString() }
    await saveDatabase()
  }
}

export const deleteProduct = async (id: string): Promise<void> => {
  const db = getDatabase()
  db.products = db.products.filter((p) => p.id !== id)
  await saveDatabase()
}

export const addInterface = async (
  productId: string,
  data: Omit<ApiInterface, 'id' | 'testCases' | 'responses' | 'issues' | 'fieldDefinitions' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<ApiInterface> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  if (!product) throw new Error('Product not found')

  const api: ApiInterface = {
    id: generateId(),
    ...data,
    testCases: [],
    responses: [],
    issues: [],
    fieldDefinitions: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  product.interfaces.unshift(api)
  product.updatedAt = new Date().toISOString()
  if (product.status === 'draft') {
    product.status = 'pending'
  }
  await saveDatabase()
  return api
}

export const updateInterface = async (
  productId: string,
  interfaceId: string,
  data: Partial<ApiInterface>
): Promise<void> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  if (!product) return
  const idx = product.interfaces.findIndex((i) => i.id === interfaceId)
  if (idx >= 0) {
    product.interfaces[idx] = {
      ...product.interfaces[idx],
      ...data,
      updatedAt: new Date().toISOString()
    }
    product.updatedAt = new Date().toISOString()
    await saveDatabase()
  }
}

export const deleteInterface = async (productId: string, interfaceId: string): Promise<void> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  if (!product) return
  product.interfaces = product.interfaces.filter((i) => i.id !== interfaceId)
  product.updatedAt = new Date().toISOString()
  await saveDatabase()
}

export const getInterface = (productId: string, interfaceId: string): ApiInterface | undefined => {
  const product = getProduct(productId)
  return product?.interfaces.find((i) => i.id === interfaceId)
}

export const addTestCase = async (
  productId: string,
  interfaceId: string,
  data: Partial<TestCase> & { name: string }
): Promise<TestCase> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  if (!api) throw new Error('Interface not found')

  const now = new Date().toISOString()
  const tc: TestCase = {
    id: generateId(),
    name: data.name,
    description: data.description || '',
    method: data.method || api.method,
    url: data.url || `${api.baseUrl}${api.path}`,
    headers: data.headers || [],
    queryParams: data.queryParams || [],
    bodyType: data.bodyType || 'none',
    bodyRaw: data.bodyRaw || '',
    bodyFormData: data.bodyFormData || [],
    bodyUrlEncoded: data.bodyUrlEncoded || [],
    fieldDefinitions: data.fieldDefinitions || [],
    createdAt: now,
    updatedAt: now
  }
  api.testCases.push(tc)
  await saveDatabase()
  return tc
}

export const updateTestCase = async (
  productId: string,
  interfaceId: string,
  testCaseId: string,
  data: Partial<TestCase>
): Promise<void> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  const tc = api?.testCases.find((t) => t.id === testCaseId)
  if (!tc) return
  Object.assign(tc, data, { updatedAt: new Date().toISOString() })
  await saveDatabase()
}

export const deleteTestCase = async (
  productId: string,
  interfaceId: string,
  testCaseId: string
): Promise<void> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  if (!api) return
  api.testCases = api.testCases.filter((t) => t.id !== testCaseId)
  await saveDatabase()
}

export const addResponse = async (
  productId: string,
  interfaceId: string,
  response: Omit<ResponseRecord, 'id' | 'timestamp'>
): Promise<ResponseRecord> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  if (!api) throw new Error('Interface not found')

  const rec: ResponseRecord = {
    ...response,
    id: generateId(),
    timestamp: new Date().toISOString()
  }
  api.responses.unshift(rec)
  if (api.responses.length > 50) {
    api.responses = api.responses.slice(0, 50)
  }
  await saveDatabase()
  return rec
}

export const addIssue = async (
  productId: string,
  interfaceId: string,
  issue: Omit<IssueItem, 'id' | 'resolved' | 'retestCount'>
): Promise<IssueItem> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  if (!api) throw new Error('Interface not found')

  const item: IssueItem = {
    ...issue,
    id: generateId(),
    resolved: false,
    retestCount: 0
  }
  api.issues.unshift(item)
  await saveDatabase()
  return item
}

export const updateIssue = async (
  productId: string,
  interfaceId: string,
  issueId: string,
  data: Partial<IssueItem>
): Promise<void> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  const issue = api?.issues.find((i) => i.id === issueId)
  if (!issue) return
  Object.assign(issue, data)
  await saveDatabase()
}

export const deleteIssue = async (
  productId: string,
  interfaceId: string,
  issueId: string
): Promise<void> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  if (!api) return
  api.issues = api.issues.filter((i) => i.id !== issueId)
  await saveDatabase()
}

export const updateFieldDefinitions = async (
  productId: string,
  interfaceId: string,
  fields: FieldDefinition[]
): Promise<void> => {
  await updateInterface(productId, interfaceId, { fieldDefinitions: fields })
}

export const syncIssuesFromCheck = async (
  productId: string,
  interfaceId: string,
  newIssues: IssueItem[]
): Promise<{ added: number; removed: number; kept: number; reopened: number }> => {
  const db = getDatabase()
  const product = db.products.find((p) => p.id === productId)
  const api = product?.interfaces.find((i) => i.id === interfaceId)
  if (!api || !product) return { added: 0, removed: 0, kept: 0, reopened: 0 }

  const fieldRelatedTypes: IssueItem['type'][] = [
    'missing_field',
    'wrong_type',
    'wrong_enum',
    'sensitive_data'
  ]

  const newIssuesBySig = new Map<string, IssueItem>()
  for (const ni of newIssues) {
    if (fieldRelatedTypes.includes(ni.type) && ni.checkSignature) {
      newIssuesBySig.set(ni.checkSignature, ni)
    }
  }
  const newSigSet = new Set(newIssuesBySig.keys())

  let removed = 0
  let reopened = 0
  const preservedIssues: IssueItem[] = []
  for (const existing of api.issues) {
    if (!fieldRelatedTypes.includes(existing.type)) {
      preservedIssues.push(existing)
      continue
    }
    const sig =
      existing.checkSignature ||
      (existing.type + '::' + (existing.fieldPath || '__global__'))
    if (newSigSet.has(sig)) {
      const latest = newIssuesBySig.get(sig)!
      const wasResolved = existing.resolved
      const previousActual = existing.actual
      const previousExpected = existing.expected
      const merged: IssueItem = {
        ...existing,
        resolved: false,
        description: latest.description,
        expected: latest.expected,
        actual: latest.actual,
        severity: latest.severity,
        checkSignature: latest.checkSignature
      }
      if (wasResolved) {
        reopened++
        merged.retestCount = (merged.retestCount || 0) + 1
        merged.retestHistory = [
          ...(merged.retestHistory || []),
          {
            timestamp: new Date().toISOString(),
            wasResolved: true,
            nowResolved: false,
            previousActual,
            newActual: latest.actual,
            previousExpected,
            comment: '字段校验复检：问题再次出现，已重新挂回待解决'
          }
        ]
      }
      preservedIssues.push(merged)
    } else {
      removed++
    }
  }

  const existingSigs = new Set(
    preservedIssues.map(
      (i) => i.checkSignature || (i.type + '::' + (i.fieldPath || '__global__'))
    )
  )
  let added = 0
  for (const ni of newIssues) {
    const sig = ni.checkSignature
    if (sig && !existingSigs.has(sig)) {
      preservedIssues.unshift(ni)
      added++
    }
  }

  api.issues = preservedIssues
  product.updatedAt = new Date().toISOString()
  await saveDatabase()
  return { added, removed, kept: preservedIssues.length - added, reopened }
}

export const importJson = async (jsonStr: string): Promise<Product[]> => {
  const data = JSON.parse(jsonStr)
  const db = getDatabase()
  const imported: Product[] = []

  if (Array.isArray(data)) {
    for (const item of data) {
      const p: Product = {
        id: generateId(),
        name: item.name || '未命名产品',
        code: item.code || '',
        category: item.category || '',
        provider: item.provider || '',
        description: item.description || '',
        interfaces: (item.interfaces || []).map((api: any) => ({
          id: generateId(),
          name: api.name || '未命名接口',
          description: api.description || '',
          method: api.method || 'GET',
          baseUrl: api.baseUrl || '',
          path: api.path || '',
          testCases: [],
          responses: [],
          issues: [],
          fieldDefinitions: [],
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      db.products.unshift(p)
      imported.push(p)
    }
  }
  await saveDatabase()
  return imported
}
