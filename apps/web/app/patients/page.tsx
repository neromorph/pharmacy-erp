import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'
import { getUserRole } from '../../utils/auth'
import { createPatient, updatePatient, deletePatient } from './actions'

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

function fmtDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID')
}

export default async function PatientsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const canEdit = role === 'OWNER' || role === 'PHARMACIST'
  const isOwner = role === 'OWNER'

  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Patients</h1>
        <Link href="/" style={{ color: 'var(--primary)', fontSize: 14 }}>Back</Link>
      </div>

      {canEdit ? (
        <div style={boxStyle}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>New Patient</h2>
          <form action={createPatient} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
              <input name="name" required style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Address</label>
              <input name="address" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Phone</label>
              <input name="phone" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Birth Date</label>
              <input name="birth_date" type="date" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>No. Peserta BPJS</label>
              <input name="bpjs_number" placeholder="e.g. 0001234567890" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>NIK</label>
              <input name="nik" placeholder="16-digit national ID" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" style={{ background: 'var(--primary)', color: '#fff', padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer' }}>
                Add Patient
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!patients || patients.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No patients yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Address</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Birth Date</th>
              <th style={thStyle}>No. Peserta BPJS</th>
              <th style={thStyle}>NIK</th>
              {canEdit ? <th style={thStyle}></th> : null}
            </tr>
          </thead>
          <tbody>
            {patients.map((p: any) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{p.address || '-'}</td>
                <td style={tdStyle}>{p.phone || '-'}</td>
                <td style={tdStyle}>{fmtDate(p.birth_date)}</td>
                <td style={tdStyle}>{p.bpjs_number || '-'}</td>
                <td style={tdStyle}>{p.nik || '-'}</td>
                {canEdit ? (
                  <td style={tdStyle}>
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: 13 }}>Edit</summary>
                      <form action={updatePatient} style={{ display: 'grid', gap: 10, padding: '12px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <input type="hidden" name="id" value={p.id} />
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
                          <input name="name" required defaultValue={p.name} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Address</label>
                          <input name="address" defaultValue={p.address ?? ''} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Phone</label>
                          <input name="phone" defaultValue={p.phone ?? ''} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Birth Date</label>
                          <input name="birth_date" type="date" defaultValue={p.birth_date ?? ''} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>No. Peserta BPJS</label>
                          <input name="bpjs_number" defaultValue={p.bpjs_number ?? ''} style={fieldStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>NIK</label>
                          <input name="nik" defaultValue={p.nik ?? ''} placeholder="16-digit national ID" style={fieldStyle} />
                          {p.ihs_number ? (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                              IHS: {p.ihs_number}
                            </p>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button type="submit" style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 14, cursor: 'pointer' }}>Save</button>
                        </div>
                      </form>
                      {isOwner ? (
                        <form action={deletePatient} style={{ marginTop: 8 }}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" style={{ background: 'transparent', color: '#ef4444', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
                            Remove
                          </button>
                        </form>
                      ) : null}
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