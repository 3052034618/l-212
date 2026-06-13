import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { KeyValuePair, TestCase } from '@/types'

export interface RequestResult {
  success: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string>
  data?: any
  responseTime: number
  size?: number
  error?: string
  errorType?: 'timeout' | 'network' | 'cancel' | 'unknown'
}

const buildHeaders = (pairs: KeyValuePair[]): Record<string, string> => {
  const headers: Record<string, string> = {}
  pairs
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      headers[h.key.trim()] = h.value
    })
  return headers
}

const buildQueryString = (pairs: KeyValuePair[], existingUrl: string): string => {
  const enabled = pairs.filter((q) => q.enabled && q.key.trim())
  if (enabled.length === 0) return existingUrl

  const params = new URLSearchParams()
  enabled.forEach((q) => params.append(q.key.trim(), q.value))
  const separator = existingUrl.includes('?') ? '&' : '?'
  return `${existingUrl}${separator}${params.toString()}`
}

const buildBody = (tc: TestCase): { body: any; headers: Record<string, string> } => {
  const extraHeaders: Record<string, string> = {}
  let body: any = undefined

  switch (tc.bodyType) {
    case 'json':
      if (tc.bodyRaw.trim()) {
        try {
          body = JSON.parse(tc.bodyRaw)
        } catch {
          body = tc.bodyRaw
        }
      }
      extraHeaders['Content-Type'] = 'application/json'
      break
    case 'form-data':
      const fd = new FormData()
      tc.bodyFormData
        .filter((f) => f.enabled && f.key.trim())
        .forEach((f) => fd.append(f.key.trim(), f.value))
      body = fd
      break
    case 'x-www-form-urlencoded':
      const urlParams = new URLSearchParams()
      tc.bodyUrlEncoded
        .filter((f) => f.enabled && f.key.trim())
        .forEach((f) => urlParams.append(f.key.trim(), f.value))
      body = urlParams
      extraHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
      break
    case 'raw':
      body = tc.bodyRaw
      break
  }
  return { body, headers: extraHeaders }
}

export const sendRequest = async (tc: TestCase, timeoutMs: number = 30000): Promise<RequestResult> => {
  const startTime = Date.now()
  let endTime = startTime

  try {
    const { body, headers: bodyHeaders } = buildBody(tc)
    const config: AxiosRequestConfig = {
      method: tc.method.toLowerCase(),
      url: buildQueryString(tc.queryParams, tc.url),
      headers: { ...bodyHeaders, ...buildHeaders(tc.headers) },
      timeout: timeoutMs,
      validateStatus: () => true,
      transformResponse: [(data) => data]
    }

    if (body !== undefined) {
      config.data = body
    }

    const response: AxiosResponse = await axios(config)
    endTime = Date.now()

    let parsedData: any = response.data
    let size: number = 0
    if (typeof response.data === 'string') {
      size = new Blob([response.data]).size
      try {
        parsedData = JSON.parse(response.data)
      } catch {
        parsedData = response.data
      }
    } else {
      size = new Blob([JSON.stringify(response.data)]).size
    }

    const respHeaders: Record<string, string> = {}
    Object.keys(response.headers).forEach((k) => {
      respHeaders[k] = String(response.headers[k])
    })

    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
      data: parsedData,
      responseTime: endTime - startTime,
      size
    }
  } catch (err: any) {
    endTime = Date.now()
    let errorType: RequestResult['errorType'] = 'unknown'
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      errorType = 'timeout'
    } else if (err.code === 'ERR_NETWORK' || !err.response) {
      errorType = 'network'
    } else if (err.code === 'ERR_CANCELED') {
      errorType = 'cancel'
    }

    return {
      success: false,
      error: err.message || '请求失败',
      errorType,
      responseTime: endTime - startTime
    }
  }
}
