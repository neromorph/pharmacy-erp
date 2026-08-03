import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

@Injectable()
export class ProductsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient()
    // Joins units and calculates total stock from batches
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_units (*),
        product_batches (current_qty)
      `)

    if (error) throw new InternalServerErrorException(error.message)

    // Map data to sum current_qty
    return data.map((p: any) => ({
      ...p,
      total_stock: p.product_batches.reduce(
        (sum: number, b: any) => sum + (b.current_qty || 0),
        0,
      ),
    }))
  }

  async create(createDto: any, user: any) {
    const supabase = this.supabaseService.getClient()
    const { units, ...productData } = createDto

    // RLS requires tenant_id on insert
    const { data: product, error: pErr } = await supabase
      .from('products')
      .insert([{ ...productData, tenant_id: user.tenantId }])
      .select()
      .single()

    if (pErr) throw new InternalServerErrorException(pErr.message)

    if (units && units.length > 0) {
      const unitsData = units.map((u: any) => ({ ...u, product_id: product.id }))
      const { error: uErr } = await supabase.from('product_units').insert(unitsData)
      if (uErr) throw new InternalServerErrorException(uErr.message)
    }

    return product
  }
}