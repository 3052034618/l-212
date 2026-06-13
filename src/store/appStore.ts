import { create } from 'zustand'
import type { Product, ApiInterface, TestCase, ResponseRecord } from '@/types'
import { initDatabase, getProducts, getDatabase } from '@/lib/database'

interface AppState {
  initialized: boolean
  products: Product[]
  selectedProductId: string | null
  selectedInterfaceId: string | null
  selectedTestCaseId: string | null
  lastResponse: ResponseRecord | null
  menuKey: string
  init: () => Promise<void>
  refresh: () => void
  setSelectedProduct: (id: string | null) => void
  setSelectedInterface: (id: string | null) => void
  setSelectedTestCase: (id: string | null) => void
  setLastResponse: (r: ResponseRecord | null) => void
  setMenuKey: (key: string) => void
  getSelectedProduct: () => Product | undefined
  getSelectedInterface: () => ApiInterface | undefined
  getSelectedTestCase: () => TestCase | undefined
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  products: [],
  selectedProductId: null,
  selectedInterfaceId: null,
  selectedTestCaseId: null,
  lastResponse: null,
  menuKey: 'products',

  init: async () => {
    await initDatabase()
    set({ initialized: true, products: getProducts() })
  },

  refresh: () => {
    set({ products: [...getDatabase().products] })
  },

  setSelectedProduct: (id) => {
    set({ selectedProductId: id, selectedInterfaceId: null, selectedTestCaseId: null })
  },

  setSelectedInterface: (id) => {
    set({ selectedInterfaceId: id, selectedTestCaseId: null })
  },

  setSelectedTestCase: (id) => set({ selectedTestCaseId: id }),

  setLastResponse: (r) => set({ lastResponse: r }),

  setMenuKey: (key) => set({ menuKey: key }),

  getSelectedProduct: () => {
    const { products, selectedProductId } = get()
    return products.find((p) => p.id === selectedProductId)
  },

  getSelectedInterface: () => {
    const product = get().getSelectedProduct()
    return product?.interfaces.find((i) => i.id === get().selectedInterfaceId)
  },

  getSelectedTestCase: () => {
    const api = get().getSelectedInterface()
    return api?.testCases.find((t) => t.id === get().selectedTestCaseId)
  }
}))
