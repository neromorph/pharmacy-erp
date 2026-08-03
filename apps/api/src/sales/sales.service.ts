import { Injectable, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { CreateSaleDto, PaySaleDto } from './dto/sales.dto'

@Injectable()
export class SalesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getClient()
  }

  // Create a DRAFT sale header, then its line items.
  async createSale(createDto: CreateSaleDto, user: any) {
    const supabase = this.getClient()
    const { sale_number, items } = createDto

    if (!items || items.length === 0) {
      throw new InternalServerErrorException('A sale must have at least one item')
    }

    const { data: sale, error: hErr } = await supabase
      .from('sales')
      .insert([
        {
          tenant_id: user.tenantId,
          sale_number,
          status: 'DRAFT',
          cashier_id: user.id,
        },
      ])
      .select()
      .single()
    if (hErr) throw new InternalServerErrorException(hErr.message)

    const lines = items.map((it) => ({
      tenant_id: user.tenantId,
      sale_id: sale.id,
      product_id: it.product_id,
      qty_sold: it.qty_sold,
      unit_price: it.unit_price,
      line_total: it.qty_sold * it.unit_price,
    }))
    const { error: iErr } = await supabase.from('sale_items').insert(lines)
    if (iErr) throw new InternalServerErrorException(iErr.message)

    return sale
  }

  // List sales for the current tenant, newest first.
  async listSales() {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items (*)')
      .order('created_at', { ascending: false })
    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  // Get one sale with its items and payments.
  async getSale(id: string) {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items (*), sale_payments (*)')
      .eq('id', id)
      .single()
    if (error) throw new NotFoundException(error.message)
    return data
  }

  // FEFO allocation: consume the oldest expiring batch first.
  // Return [{ product_batch_id, qty }] covering qtyNeeded.
  async allocateFefoBatches(tenantId: string, productId: string, qtyNeeded: number) {
    const supabase = this.getClient()
    const { data: batches, error } = await supabase
      .from('product_batches')
      .select('id, current_qty')
      .eq('product_id', productId)
      .gt('current_qty', 0)
      .order('expiry_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw new InternalServerErrorException(error.message)

    const allocations: { product_batch_id: string; qty: number }[] = []
    let remaining = qtyNeeded

    for (const batch of batches) {
      if (remaining <= 0) break
      const take = Math.min(Number(batch.current_qty), remaining)
      allocations.push({ product_batch_id: batch.id, qty: take })
      remaining -= take
    }

    if (remaining > 0) {
      throw new ConflictException('Insufficient stock to fulfill the sale')
    }

    return allocations
  }

  // Pay a DRAFT sale: record payment, deduct FEFO batches, mark PAID.
  async paySale(id: string, payDto: PaySaleDto, user: any) {
    const supabase = this.getClient()

    const { data: sale } = await supabase.from('sales').select('*').eq('id', id).single()
    if (!sale) throw new NotFoundException(`Sale ${id} not found`)
    if (sale.status !== 'DRAFT') {
      throw new ConflictException('Only a DRAFT sale can be paid')
    }

    const { data: saleItems, error: itemErr } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', id)
    if (itemErr) throw new InternalServerErrorException(itemErr.message)

    // Compute per-product quantities, then allocate batches per product.
    const perProduct = new Map<string, number>()
    for (const item of saleItems) {
      const key = item.product_id
      perProduct.set(key, (perProduct.get(key) || 0) + Number(item.qty_sold))
    }

    const allocated: Record<string, { product_batch_id: string; qty: number }[]> = {}
    for (const [productId, qty] of perProduct.entries()) {
      allocated[productId] = await this.allocateFefoBatches(user.tenantId, productId, qty)
    }

    // Backfill batch info on the product's sale_items rows after allocation.
    // ponytail: uses the first allocated batch per product line; real multi-batch
    // split (several sale_items rows consuming one batch) needs row-level mapping.
    for (const [productId, allocs] of Object.entries(allocated)) {
      if (allocs.length === 0) continue
      const first = allocs[0]
      const { data: batch, error: binfoErr } = await supabase
        .from('product_batches')
        .select('batch_number, expiry_date')
        .eq('id', first.product_batch_id)
        .single()
      if (binfoErr) throw new InternalServerErrorException(binfoErr.message)
      const { error: bfillErr } = await supabase
        .from('sale_items')
        .update({
          product_batch_id: first.product_batch_id,
          batch_number: batch.batch_number,
          expiry_date: batch.expiry_date,
        })
        .eq('sale_id', id)
        .eq('product_id', productId)
      if (bfillErr) throw new InternalServerErrorException(bfillErr.message)
    }

    // Record payment.
    const { data: payment, error: pErr } = await supabase
      .from('sale_payments')
      .insert([
        {
          tenant_id: user.tenantId,
          sale_id: id,
          payment_method: payDto.payment_method,
          amount: payDto.paid_amount,
          reference_number: payDto.reference_number,
        },
      ])
      .select()
      .single()
    if (pErr) throw new InternalServerErrorException(pErr.message)

    // Deduct batch quantities by allocation.
    for (const allocations of Object.values(allocated)) {
      for (const alloc of allocations) {
        const { data: batch, error: fErr } = await supabase
          .from('product_batches')
          .select('current_qty')
          .eq('id', alloc.product_batch_id)
          .single()
        if (fErr) throw new InternalServerErrorException(fErr.message)

        const newQty = Number(batch.current_qty) - alloc.qty
        const { error: bErr } = await supabase
          .from('product_batches')
          .update({ current_qty: newQty })
          .eq('id', alloc.product_batch_id)
        if (bErr) throw new InternalServerErrorException(bErr.message)
      }
    }

    const subtotal = Number(sale.subtotal)
    const discountTotal = Number(sale.discount_total)
    const taxTotal = Number(sale.tax_total)
    const grandTotal = subtotal - discountTotal + taxTotal
    const changeAmount = payDto.paid_amount - grandTotal

    const { error: uErr } = await supabase
      .from('sales')
      .update({
        status: 'PAID',
        paid_amount: payDto.paid_amount,
        change_amount: changeAmount,
        grand_total: grandTotal,
        sold_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (uErr) throw new InternalServerErrorException(uErr.message)

    return { sale, payment }
  }

  // Mark a sale as VOID.
  async voidSale(id: string) {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('sales')
      .update({ status: 'VOID' })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new InternalServerErrorException(error.message)
    return data
  }
}