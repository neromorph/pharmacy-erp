import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { createDoctor, updateDoctor, deleteDoctor } from './actions'

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 14 }
const boxStyle: React.CSSProperties = {
  background: 'var(--card)',
  padding: 16,
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: 20,
}
const fieldStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 14,
  background: 'var(--surface)',
  width: '100%',
  boxSizing: 'border-box',
}

export default async function DoctorsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const isOwner = role === 'OWNER'

  const { data: doctors } = await supabase
    .from('doctors')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Doctors</h1>
        <Link href="/" style={{ color: 'var(--primary)', fontSize: 14 }}>Back</Link>
      </div>

      {isOwner ? (
        <div style={boxStyle}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>New Doctor</h2>
          <form action={createDoctor} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
              <input name="name" required style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SIP Number</label>
              <input name="sip_number" placeholder="SIP.02.xxxx" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Phone</label>
              <input name="phone" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" style={{ background: 'var(--primary)', color: '#fff', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer' }}>
                Add Doctor
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!doctors || doctors.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No doctors yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>SIP Number</th>
              <th style={thStyle}>Phone</th>
              {isOwner ? <th style={thStyle}></th> : null}
            </tr>
          </thead>
          <tbody>
            {doctors.map((d: any) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>{d.name}</td>
                <td style={tdStyle}>{d.sip_number || '-'}</td>
                <td style={tdStyle}>{d.phone || '-'}</td>
                {isOwner ? (
                  <td style={tdStyle}>
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: 13 }}>Edit</summary>
                      <form action={updateDoctor} style={{ display: 'grid', gap: 10, padding: '12px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <input type="hidden" name="id" value={d.id} />
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
                          <input name="name" required defaultValue={d.name} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SIP Number</label>
                          <input name="sip_number" defaultValue={d.sip_number ?? ''} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Phone</label>
                          <input name="phone" defaultValue={d.phone ?? ''} style={fieldStyle} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                          <button type="submit" style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer' }}>Save</button>
                        </div>
                      </form>
                      <form action={deleteDoctor} style={{ marginTop: 8 }}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" style={{ background: 'transparent', color: '#ef4444', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
                          Remove
                        </button>
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