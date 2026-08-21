import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { SalesService } from './sales.service'
import { SupabaseService } from '../supabase/supabase.service'

// A fluent mock of the Supabase query builder.
// Route by table name; record update payloads for assertions.
interface TableState {
  single?: unknown
  list?: unknown[]
}
interface Tables {
  sales: TableState
  sale_items: TableState
  product_batches: TableState
}

function buildClientMock() {
  const updates: { table: string; payload: any }[] = []
  const tables: Tables = {
    sales: {},
    sale_items: {},
    product_batches: {},
  }

  const chain = (table: keyof Tables) => {
    const state = tables[table]
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => {
        if (state.single) return { data: state.single, error: null }
        return { data: null, error: null }
      },
      update: (payload: any) => {
        updates.push({ table, payload })
        return query
      },
      then: (resolve: any) => resolve({ data: state.list ?? [], error: null }),
    }
    return query
  }

  return {
    // SAFETY: the real service only calls from() with these three table names.
    from: (table: string) => chain(table as keyof Tables),
    tables,
    updates,
  }
}

describe('SalesService.voidSale', () => {
  let service: SalesService
  let clientMock: ReturnType<typeof buildClientMock>

  beforeEach(async () => {
    clientMock = buildClientMock()
    const mod = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => clientMock },
        },
      ],
    }).compile()

    service = mod.get(SalesService)
  })

  it('restores item quantities to their batches and marks the sale VOID', async () => {
    clientMock.tables['sales'].single = { id: 's1', status: 'PAID' }
    clientMock.tables['sale_items'].list = [
      { product_batch_id: 'b1', qty_sold: 3 },
      { product_batch_id: null, qty_sold: 2 },
    ]
    clientMock.tables['product_batches'].single = { id: 'b1', current_qty: 10 }

    const result = await service.voidSale('s1')

    expect(result).toEqual({ id: 's1', status: 'PAID' })
    // Only the item with a batch restores stock; the null-batch item is skipped.
    const batchUpdate = clientMock.updates.find((u) => u.table === 'product_batches')
    expect(batchUpdate?.payload).toEqual({ current_qty: 13 })
    const saleUpdate = clientMock.updates.find((u) => u.table === 'sales')
    expect(saleUpdate?.payload).toEqual({ status: 'VOID' })
    // Exactly one product_batches update for the one allocated item.
    const batchUpdates = clientMock.updates.filter((u) => u.table === 'product_batches')
    expect(batchUpdates).toHaveLength(1)
  })

  it('throws NotFoundException when the sale does not exist', async () => {
    await expect(service.voidSale('missing')).rejects.toThrow(NotFoundException)
  })

  it('throws ConflictException when the sale is not PAID', async () => {
    clientMock.tables['sales'].single = { id: 's1', status: 'DRAFT' }
    await expect(service.voidSale('s1')).rejects.toThrow(ConflictException)
  })
})