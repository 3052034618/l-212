export interface KeyValuePair {
  key: string
  value: string
  enabled: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw'

export interface FieldDefinition {
  id: string
  name: string
  path: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
  required: boolean
  description: string
  enumValues?: string[]
  isSensitive: boolean
  status?: 'pass' | 'fail' | 'warning' | 'unchecked'
  failReason?: string
}

export interface TestCase {
  id: string
  name: string
  description: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  bodyType: BodyType
  bodyRaw: string
  bodyFormData: KeyValuePair[]
  bodyUrlEncoded: KeyValuePair[]
  fieldDefinitions: FieldDefinition[]
  createdAt: string
  updatedAt: string
  lastExecutedAt?: string
  lastCheckPassed?: boolean
  executionStatus?: 'idle' | 'executed' | 'checked'
}

export interface ResponseRecord {
  id: string
  testCaseId: string
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
  responseTime: number
  size: number
  timestamp: string
  error?: string
}

export interface RetestRecord {
  timestamp: string
  wasResolved: boolean
  nowResolved: boolean
  previousActual?: string
  newActual?: string
  previousExpected?: string
  comment?: string
  responseId?: string
  responseTimestamp?: string
}

export interface IssueItem {
  id: string
  type: 'missing_field' | 'wrong_type' | 'wrong_enum' | 'sensitive_data' | 'timeout' | 'status_error' | 'other'
  fieldPath?: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  expected?: string
  actual?: string
  resolved: boolean
  retestCount: number
  lastRetestAt?: string
  remark?: string
  retestHistory?: RetestRecord[]
  checkSignature?: string
}

export interface ApiInterface {
  id: string
  name: string
  description: string
  method: HttpMethod
  baseUrl: string
  path: string
  testCases: TestCase[]
  responses: ResponseRecord[]
  issues: IssueItem[]
  fieldDefinitions: FieldDefinition[]
  status: 'pending' | 'testing' | 'passed' | 'failed'
  conclusion?: string
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  name: string
  code: string
  category: string
  provider: string
  description: string
  interfaces: ApiInterface[]
  status: 'draft' | 'pending' | 'accepted' | 'rejected'
  conclusion?: string
  createdAt: string
  updatedAt: string
}

export interface AppDatabase {
  version: string
  products: Product[]
  lastModified: string
}

export interface AcceptanceReport {
  productId: string
  productName: string
  generatedAt: string
  totalInterfaces: number
  passedInterfaces: number
  failedInterfaces: number
  pendingInterfaces: number
  totalIssues: number
  unresolvedIssues: number
  executedTestCases: number
  passedTestCases: number
  totalTestCases: number
  acceptanceConclusion: 'accepted' | 'rejected' | 'pending'
  conclusionReason: string
  interfaces: Array<{
    interfaceId: string
    interfaceName: string
    status: 'pending' | 'testing' | 'passed' | 'failed'
    totalTestCases: number
    executedTestCases: number
    passedTestCases: number
    pendingTestCases: number
    unresolvedIssues: number
    totalIssues: number
    hasFieldDefinitions: boolean
    hasResponses: boolean
    lastTestedAt?: string
    lastRetestedAt?: string
    oldestUnresolvedDays?: number
    issues: IssueItem[]
  }>
}
