import { createClient } from '../../utils/supabase/server'
import { getUserRole } from '../../utils/auth'
import { createProduct, updateProduct } from './actions'

const CATEGORIES = ['BEBAS', 'BEBAS_TERBATAS', 'KERAS', 'PSIKOTROPIKA', 'NARKOTIKA']

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 14 }

const fieldStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 14,
  background: 'var(--surface)',
  width: '100%',
  boxSizing: 'border-box',
}
const boxStyle: React.CSSProperties = {
  background: 'var(--card)',
  padding: 16,
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: 20,
}

function catColor(cat: string) {
  switch (cat) {
    case 'BEBAS': return '#0d9488'
    case 'BEBAS_TERBATAS': return '#f59e0b'
    case 'KERAS': return '#ef4444'
    case 'PSIKOTROPIKA': return '#8b5cf6'
    case 'NARKOTIKA': return '#dc2626'
    default: return '#64748b'
  }
}
const catBadge = (cat: string) => ({
  background: catColor(cat),
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 4,
})

export default async function ProductsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const canEdit = role === 'OWNER' || role === 'PHARMACIST' || role === 'INVENTORY'

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Products</h1>

      {canEdit ? (
        <div style={boxStyle}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>New Product</h2>
          <form action={createProduct} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
              <input name="name" required style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SKU</label>
              <input name="sku" required style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Base Unit</label>
              <input name="base_unit" required placeholder="tablet / ml" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category</label>
              <input name="category" placeholder="e.g. Analgesic" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Min Stock</label>
              <input name="min_stock_level" type="number" defaultValue={0} style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Rack</label>
              <input name="rack_location" placeholder="A-2" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Regulatory Category</label>
              <select name="regulatory_category" defaultValue="BEBAS" style={fieldStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Fractional</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <input type="checkbox" name="allow_fractional" />
                Allow decimals
              </label>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>KFA Code</label>
              <input name="kfa_code" placeholder="e.g. 93000515" style={fieldStyle} />
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>SATUSEHAT: products without KFA are skipped from submission.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                style={{ background: 'var(--primary)', color: '#fff', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer' }}
              >
                Add Product
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!products || products.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No products yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Name / SKU</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Base Unit</th>
              <th style={thStyle}>Min Stock</th>
              <th style={thStyle}>Rack</th>
              <th style={thStyle}>Fractional</th>
              <th style={thStyle}>KFA</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.sku}</div>
                </td>
                <td style={tdStyle}><span style={catBadge(p.regulatory_category)}>{p.regulatory_category}</span></td>
                <td style={tdStyle}>{p.base_unit}</td>
                <td style={tdStyle}>{p.min_stock_level}</td>
                <td style={tdStyle}>{p.rack_location || '-'}</td>
                <td style={tdStyle}>{p.allow_fractional ? 'Yes' : 'No'}</td>
                <td style={tdStyle}>{p.kfa_code || <span style={{ color: '#d97706' }}>none</span>}</td>
                {canEdit ? (
                  <td style={tdStyle}>
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: 13 }}>Edit</summary>
                      <form action={updateProduct} style={{ display: 'grid', gap: 10, padding: '12px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <input type="hidden" name="id" value={p.id} />
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
                          <input name="name" required defaultValue={p.name} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SKU</label>
                          <input name="sku" required defaultValue={p.sku} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Base Unit</label>
                          <input name="base_unit" required defaultValue={p.base_unit} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category</label>
                          <input name="category" defaultValue={p.category} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Min Stock</label>
                          <input name="min_stock_level" type="number" defaultValue={p.min_stock_level} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Rack</label>
                          <input name="rack_location" defaultValue={p.rack_location ?? ''} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Regulatory Category</label>
                          <select name="regulatory_category" defaultValue={p.regulatory_category} style={fieldStyle}>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Fractional</label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                            <input type="checkbox" name="allow_fractional" defaultChecked={p.allow_fractional} />
                            Allow decimals
                          </label>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>KFA Code</label>
                          <input name="kfa_code" defaultValue={p.kfa_code ?? ''} placeholder="e.g. 93000515" style={fieldStyle} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button
                            type="submit"
                            style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer' }}
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    </details>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}