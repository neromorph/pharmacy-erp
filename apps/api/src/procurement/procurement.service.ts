import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import {
  CreateSupplierDto,
  CreatePurchaseOrderDto,
  ReceiveGoodsDto,
} from './dto/procurement.dto'

@Injectable()
export class ProcurementService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getClient()
  }

  // Inserts pass tenant_id so RLS (tenant check) succeeds.
  async createSupplier(createDto: CreateSupplierDto, user: any) {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ ...createDto, tenant_id: user.tenantId }])
      .select()
      .single()
    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async listSuppliers() {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true })
    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  // Create PO header (DRAFT) then its items.
  async createPurchaseOrder(createDto: CreatePurchaseOrderDto, user: any) {
    const supabase = this.getClient()
    const { supplier_id, po_number, notes, items } = createDto

    const { data: po, error: hErr } = await supabase
      .from('purchase_orders')
      .insert([
        {
          tenant_id: user.tenantId,
          supplier_id,
          po_number,
          status: 'DRAFT',
          notes,
          created_by: user.id,
        },
      ])
      .select()
      .single()
    if (hErr) throw new InternalServerErrorException(hErr.message)

    if (items && items.length > 0) {
      const rows = items.map((it) => ({
        tenant_id: user.tenantId,
        purchase_order_id: po.id,
        product_id: it.product_id,
        qty_ordered: it.qty_ordered,
        unit_price: it.unit_price,
        line_total: it.qty_ordered * it.unit_price,
      }))
      const { error: iErr } = await supabase.from('purchase_order_items').insert(rows)
      if (iErr) throw new InternalServerErrorException(iErr.message)
    }

    return po
  }

  // DRAFT -> PENDING_APPROVAL. Creator orders the PO.
  async submitPurchaseOrder(id: string) {
    return this.updateStatus(id, 'PENDING_APPROVAL')
  }

  private async updateStatus(id: string, status: string) {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  // PENDING_APPROVAL -> APPROVED (Owner/Pharmacist direct, or after approval).
  async approvePurchaseOrder(id: string, user: any) {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'APPROVED', approved_at: new Date().toISOString(), approved_by: user.id })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  // APPROVED -> RECEIVED. Writes goods receipt, receipt items, and stock batches.
  async receiveGoods(id: string, receiveDto: ReceiveGoodsDto, user: any) {
    const supabase = this.getClient()
    const now = new Date().toISOString()

    // Guard: refuse receiving a PO already in a final state.
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single()
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`)
    if (po.status !== 'APPROVED') {
      throw new InternalServerErrorException('Only an APPROVED purchase order can be received')
    }

    const receipt = {
      tenant_id: user.tenantId,
      purchase_order_id: id,
      receipt_number: receiveDto.receipt_number,
      invoice_number: receiveDto.invoice_number,
      notes: receiveDto.notes,
      received_by: user.id,
    }
    const { data: gr, error: gErr } = await supabase
      .from('goods_receipts')
      .insert([receipt])
      .select()
      .single()
    if (gErr) throw new InternalServerErrorException(gErr.message)

    for (const it of receiveDto.items) {
      const itemRow = {
        tenant_id: user.tenantId,
        goods_receipt_id: gr.id,
        purchase_order_item_id: it.purchase_order_item_id,
        product_id: it.product_id,
        batch_number: it.batch_number,
        expiry_date: it.expiry_date,
        qty_received: it.qty_received,
        unit_cost: it.unit_cost,
        line_total: it.qty_received * it.unit_cost,
      }
      const { error: giErr } = await supabase.from('goods_receipt_items').insert([itemRow])
      if (giErr) throw new InternalServerErrorException(giErr.message)

      // Stock batch: the FEFO entry point.
      const batch = {
        tenant_id: user.tenantId,
        product_id: it.product_id,
        batch_number: it.batch_number,
        expiry_date: it.expiry_date,
        current_qty: it.qty_received,
      }
      const { error: bErr } = await supabase.from('product_batches').insert([batch])
      if (bErr) throw new InternalServerErrorException(bErr.message)
    }

    // Mark PO received.
    const { error: poErr } = await supabase
      .from('purchase_orders')
      .update({ status: 'RECEIVED', received_at: now, received_by: user.id })
      .eq('id', id)
    if (poErr) throw new InternalServerErrorException(poErr.message)

    return { purchase_order_id: id, goods_receipt_id: gr.id }
  }
}