'use client';

import { useMemo, useState } from 'react';
import { BUCKETS, companyName, pay, type Row } from './lib';

const ALL = 'all';
const UNLABELED = 'unlabeled';

export default function Radar({ rows }: { rows: Row[] }) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.bucket ?? UNLABELED] = (m[r.bucket ?? UNLABELED] ?? 0) + 1;
    return m;
  }, [rows]);
  const anyLabeled = rows.some((r) => r.bucket);
  const companies = useMemo(() => [...new Set(rows.map((r) => r.company))].sort((a, b) => companyName(a).localeCompare(companyName(b))), [rows]);

  const [bucket, setBucket] = useState(anyLabeled ? 'ai_pm_no_ml_required' : ALL);
  const [company, setCompany] = useState(ALL);
  const [q, setQ] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [payOnly, setPayOnly] = useState(false);
  const [sort, setSort] = useState<'company' | 'pay'>('company');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) =>
      (bucket === ALL || (r.bucket ?? UNLABELED) === bucket) &&
      (company === ALL || r.company === company) &&
      (!remoteOnly || r.remote) &&
      (!payOnly || r.payLow) &&
      (!needle || `${r.title} ${r.location ?? ''} ${companyName(r.company)}`.toLowerCase().includes(needle)));
    return out.sort(sort === 'pay'
      ? (a, b) => (b.payHigh ?? b.payLow ?? -1) - (a.payHigh ?? a.payLow ?? -1)
      : (a, b) => companyName(a.company).localeCompare(companyName(b.company)) || a.title.localeCompare(b.title));
  }, [rows, bucket, company, q, remoteOnly, payOnly, sort]);

  const chips = [
    { id: ALL, label: 'All', hint: 'Every posting', n: rows.length },
    ...BUCKETS.map((b) => ({ ...b, n: counts[b.id] ?? 0 })).filter((b) => anyLabeled && b.n > 0),
    ...(counts[UNLABELED] ? [{ id: UNLABELED, label: 'Not labeled yet', hint: 'Waiting for a labeled run', n: counts[UNLABELED] }] : []),
  ];

  return (
    <section>
      <div className="chips" role="tablist" aria-label="Role type">
        {chips.map((c) => (
          <button key={c.id} role="tab" aria-selected={bucket === c.id} title={c.hint}
            className={bucket === c.id ? 'chip on' : 'chip'} onClick={() => setBucket(c.id)}>
            {c.label} <span className="n">{c.n}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <input type="search" placeholder="Search title, company, location" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company">
          <option value={ALL}>All companies</option>
          {companies.map((c) => <option key={c} value={c}>{companyName(c)}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'company' | 'pay')} aria-label="Sort">
          <option value="company">Sort: company</option>
          <option value="pay">Sort: highest pay</option>
        </select>
        <label className="check"><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote listed</label>
        <label className="check"><input type="checkbox" checked={payOnly} onChange={(e) => setPayOnly(e.target.checked)} /> Pay listed</label>
      </div>

      <p className="count">{shown.length.toLocaleString()} {shown.length === 1 ? 'role' : 'roles'}</p>

      <table className="roles">
        <thead>
          <tr>
            <th>Role</th>
            <th>Company</th>
            <th>Location</th>
            <th>Pay</th>
            <th>AI scope</th>
            <th>Level</th>
            <th title="Jev's probability that hands-on ML experience is a must-have">ML required</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.url}>
              <td data-label="Role"><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a></td>
              <td data-label="Company">{companyName(r.company)}</td>
              <td data-label="Location">{r.location ?? '—'}{r.remote ? <span className="tag">Remote</span> : null}</td>
              <td data-label="Pay" className="num">{pay(r)}</td>
              <td data-label="AI scope">{r.aiScope ? r.aiScope.replace(/_/g, ' ') : '—'}</td>
              <td data-label="Level">{r.seniority ? r.seniority.split(' (')[0] : '—'}</td>
              <td data-label="ML required" className="num">{r.mlRequired == null ? '—' : `${Math.round(r.mlRequired * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p className="empty">No roles match these filters.</p>}
    </section>
  );
}
