import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { createProduct, updateProduct } from './actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const CATEGORIES = ['BEBAS', 'BEBAS_TERBATAS', 'KERAS', 'PSIKOTROPIKA', 'NARKOTIKA']

const catClass: Record<string, string> = {
  BEBAS: 'bg-teal-600 text-white border-teal-600',
  BEBAS_TERBATAS: 'bg-amber-500 text-white border-amber-500',
  KERAS: 'bg-red-500 text-white border-red-500',
  PSIKOTROPIKA: 'bg-purple-500 text-white border-purple-500',
  NARKOTIKA: 'bg-red-700 text-white border-red-700',
}

const selectClass =
  'h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default async function ProductsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const canEdit = role === 'OWNER' || role === 'PHARMACIST' || role === 'INVENTORY'

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Products</h1>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-slate-900">New Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={createProduct}
              className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="base_unit">Base Unit</Label>
                <Input id="base_unit" name="base_unit" required placeholder="tablet / ml" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="e.g. Analgesic" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="min_stock_level">Min Stock</Label>
                <Input id="min_stock_level" name="min_stock_level" type="number" defaultValue={0} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rack_location">Rack</Label>
                <Input id="rack_location" name="rack_location" placeholder="A-2" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="regulatory_category">Regulatory Category</Label>
                <select name="regulatory_category" defaultValue="BEBAS" className={selectClass}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="kfa_code">KFA Code</Label>
                <Input id="kfa_code" name="kfa_code" placeholder="e.g. 93000515" />
                <p className="text-xs text-slate-500">
                  SATUSEHAT: products without KFA are skipped from submission.
                </p>
              </div>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="allow_fractional" className="flex items-center gap-2 text-sm">
                  <input
                    id="allow_fractional"
                    type="checkbox"
                    name="allow_fractional"
                    className="size-4 rounded border-slate-300"
                  />
                  Allow decimals
                </Label>
                <Button type="submit" className="ml-auto">
                  Add Product
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {!products || products.length === 0 ? (
        <p className="text-sm text-slate-500">No products yet</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Name / SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base Unit</TableHead>
                <TableHead>Min Stock</TableHead>
                <TableHead>Rack</TableHead>
                <TableHead>Fractional</TableHead>
                <TableHead>KFA</TableHead>
                {canEdit ? <TableHead></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any) => (
                <TableRow key={p.id} className="h-10">
                  <TableCell>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.sku}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={catClass[p.regulatory_category] || ''}>
                      {p.regulatory_category}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.base_unit}</TableCell>
                  <TableCell>{p.min_stock_level}</TableCell>
                  <TableCell>{p.rack_location || '-'}</TableCell>
                  <TableCell>{p.allow_fractional ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    {p.kfa_code || <span className="text-amber-600">none</span>}
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer text-sm text-primary">
                          Edit
                        </summary>
                        <form
                          action={updateProduct}
                          className="grid gap-x-4 gap-y-3 py-3 sm:grid-cols-2 lg:grid-cols-4"
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <div className="grid gap-1.5">
                            <Label htmlFor={`name-${p.id}`}>Name</Label>
                            <Input id={`name-${p.id}`} name="name" required defaultValue={p.name} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`sku-${p.id}`}>SKU</Label>
                            <Input id={`sku-${p.id}`} name="sku" required defaultValue={p.sku} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`base_unit-${p.id}`}>Base Unit</Label>
                            <Input
                              id={`base_unit-${p.id}`}
                              name="base_unit"
                              required
                              defaultValue={p.base_unit}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`category-${p.id}`}>Category</Label>
                            <Input id={`category-${p.id}`} name="category" defaultValue={p.category} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`min_stock_level-${p.id}`}>Min Stock</Label>
                            <Input
                              id={`min_stock_level-${p.id}`}
                              name="min_stock_level"
                              type="number"
                              defaultValue={p.min_stock_level}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`rack_location-${p.id}`}>Rack</Label>
                            <Input
                              id={`rack_location-${p.id}`}
                              name="rack_location"
                              defaultValue={p.rack_location ?? ''}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`regulatory_category-${p.id}`}>Regulatory Category</Label>
                            <select
                              name="regulatory_category"
                              defaultValue={p.regulatory_category}
                              className={selectClass}
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`fractional-${p.id}`}>Fractional</Label>
                            <label className="flex items-center gap-2">
                              <input
                                id={`fractional-${p.id}`}
                                type="checkbox"
                                name="allow_fractional"
                                defaultChecked={p.allow_fractional}
                                className="size-4 rounded border-slate-300"
                              />
                              Allow decimals
                            </label>
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`kfa_code-${p.id}`}>KFA Code</Label>
                            <Input
                              id={`kfa_code-${p.id}`}
                              name="kfa_code"
                              defaultValue={p.kfa_code ?? ''}
                              placeholder="e.g. 93000515"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button type="submit" variant="outline">
                              Save
                            </Button>
                          </div>
                        </form>
                      </details>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}