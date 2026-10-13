import { useEffect, useMemo, useState } from 'react'
import './App.css'

const RATE = 3 // ₹ per liter
const DELIVERY_FEE = 20 // flat delivery charge
const TANK_CAPACITY = 1000
const CANS = [
  { size: 2, name: 'Bottle' },
  { size: 5, name: 'Small can' },
  { size: 10, name: 'Large can' },
]
const inr = (n) => '₹' + n.toLocaleString('en-IN')

function loadStock() {
  const saved = Number(localStorage.getItem('aquapure-stock'))
  return saved > 0 ? saved : TANK_CAPACITY
}

// Water-jar (can) outline: neck, shoulders, body
const CAN_PATH =
  'M84 18 H116 V34 C116 46 170 46 170 80 V238 Q170 262 146 262 H54 Q30 262 30 238 V80 C30 46 84 46 84 34 Z'

// Shows exactly how the bill is calculated, row by row
function Breakdown({ qty, extraLiters, liters, subtotal, delivery, total }) {
  const rows = CANS.filter((c) => qty[c.size] > 0).map((c) => ({
    key: c.size,
    title: `${qty[c.size]} × ${c.size} L ${c.name.toLowerCase()}`,
    litres: qty[c.size] * c.size,
    formula: `${qty[c.size]} × ${c.size} L = ${qty[c.size] * c.size} L`,
  }))
  if (extraLiters > 0)
    rows.push({ key: 'extra', title: 'Loose litres (own container)', litres: extraLiters, formula: `${extraLiters} L` })

  return (
    <div className="calc">
      <h3>Your order · how it adds up</h3>
      {liters === 0 ? (
        <p className="empty">Add a can above and the calculation will appear here.</p>
      ) : (
        <>
          <ul>
            {rows.map((r) => (
              <li key={r.key}>
                <div>
                  <strong>{r.title}</strong>
                  <code>{r.formula}</code>
                  <code>{r.litres} L × {inr(RATE)} = {inr(r.litres * RATE)}</code>
                </div>
                <b key={`${r.key}-${r.litres}`}>{inr(r.litres * RATE)}</b>
              </li>
            ))}
          </ul>
          <div className="formula">
            <div><span>Total litres</span><code>{rows.map((r) => r.litres).join(' + ')} = {liters} L</code></div>
            <div><span>Water cost</span><code>{liters} L × {inr(RATE)} = {inr(subtotal)}</code></div>
            {delivery > 0 && <div><span>Delivery charge</span><code>+ {inr(delivery)} flat</code></div>}
            <div className="net">
              <span>Net pay</span>
              <code>{delivery > 0 ? `${inr(subtotal)} + ${inr(delivery)} = ` : ''}<strong>{inr(total)}</strong></code>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function App() {
  const [step, setStep] = useState(1)
  const [qty, setQty] = useState({ 2: 0, 5: 0, 10: 0 })
  const [extra, setExtra] = useState('')
  const [mode, setMode] = useState('pickup')
  const [pay, setPay] = useState('upi')
  const [form, setForm] = useState({ name: '', phone: '', address: '', upi: '' })
  const [errors, setErrors] = useState({})
  const [processing, setProcessing] = useState(false)
  const [bill, setBill] = useState(null)
  const [progress, setProgress] = useState(0)
  const [stock, setStock] = useState(loadStock)

  const extraLiters = Math.max(0, Math.floor(Number(extra) || 0))
  const liters = CANS.reduce((s, c) => s + c.size * qty[c.size], 0) + extraLiters
  const subtotal = liters * RATE
  const delivery = mode === 'delivery' && liters > 0 ? DELIVERY_FEE : 0
  const total = subtotal + delivery
  const overStock = liters > stock
  const level = Math.max(0, ((stock - liters) / TANK_CAPACITY) * 100)

  const lines = useMemo(() => {
    const rows = CANS.filter((c) => qty[c.size] > 0).map((c) => ({
      label: `${qty[c.size]} × ${c.size} L ${c.name.toLowerCase()}`,
      amount: qty[c.size] * c.size * RATE,
    }))
    if (extraLiters > 0) rows.push({ label: `${extraLiters} L loose (own container)`, amount: extraLiters * RATE })
    return rows
  }, [qty, extraLiters])

  const change = (size, d) => setQty((q) => ({ ...q, [size]: Math.max(0, q[size] + d) }))
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function validate() {
    const e = {}
    if (form.name.trim().length < 2) e.name = 'Enter your name'
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number'
    if (mode === 'delivery' && form.address.trim().length < 8) e.address = 'Enter your full delivery address'
    if (pay === 'upi' && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(form.upi.trim())) e.upi = 'Enter a valid UPI ID, like name@upi'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function placeOrder() {
    if (!validate()) return
    setProcessing(true)
    setTimeout(() => {
      const now = new Date()
      setBill({
        id: 'AP-' + String(now.getTime()).slice(-6),
        date: now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        lines, liters, subtotal, delivery, total, mode, pay,
        customer: { ...form },
        ref: pay === 'upi' ? 'UPI' + Math.random().toString(36).slice(2, 10).toUpperCase() : null,
      })
      const left = stock - liters
      setStock(left)
      localStorage.setItem('aquapure-stock', String(left))
      setProgress(0)
      setProcessing(false)
      setStep(3)
    }, 1600)
  }

  // dispensing animation after the bill is generated
  useEffect(() => {
    if (step !== 3 || progress >= 100) return
    const t = setTimeout(() => setProgress((p) => Math.min(100, p + 4)), 120)
    return () => clearTimeout(t)
  }, [step, progress])

  function newOrder() {
    setQty({ 2: 0, 5: 0, 10: 0 })
    setExtra('')
    setBill(null)
    setErrors({})
    setStep(1)
  }

  function refillTank() {
    setStock(TANK_CAPACITY)
    localStorage.setItem('aquapure-stock', String(TANK_CAPACITY))
  }

  const done = progress >= 100

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="drop" aria-hidden="true" />
          <div>
            <h1>AquaPure</h1>
            <p>Purified drinking water, filled fresh</p>
          </div>
        </div>
        <ol className="steps" aria-label="Order progress">
          {['Choose water', 'Pay', 'Bill'].map((s, i) => (
            <li key={s} className={step === i + 1 ? 'on' : step > i + 1 ? 'past' : ''}>{s}</li>
          ))}
        </ol>
      </header>

      <main className="layout">
        {/* Water tank – the live stock gauge */}
        <aside className="tank-card">
          <div className="can-tank" role="img" aria-label={`Can holds ${Math.max(0, stock - liters)} liters after your order`}>
            <svg viewBox="0 0 220 280" aria-hidden="true">
              <defs>
                <clipPath id="canClip"><path d={CAN_PATH} /></clipPath>
              </defs>
              <path className="can-glass" d={CAN_PATH} />
              <g clipPath="url(#canClip)">
                <g className="can-level" style={{ transform: `translateY(${262 - (level / 100) * 228}px)` }}>
                  <rect className="can-fill" x="0" y="6" width="220" height="300" />
                  <path className="can-wave" d="M-200 6 q25 -12 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V40 H-200 Z" />
                </g>
              </g>
              <path className="can-ridge" d="M30 118 H170 M30 205 H170" />
              <path className="can-shine" d="M48 90 V228" />
              <path className="can-outline" d={CAN_PATH} />
              <rect className="can-cap" x="78" y="2" width="44" height="18" rx="5" />
            </svg>
            <div className="tank-text">
              <strong>{Math.max(0, stock - liters)} L</strong>
              <span>left in can</span>
            </div>
          </div>
          <div className="rate">
            <span>Rate</span>
            <strong>{inr(RATE)} / litre</strong>
          </div>
          <p className="tank-note">
            {liters > 0 ? `Your order takes ${liters} L out of the tank.` : 'Pick your cans and watch the tank drop.'}
          </p>
          {stock < 100 && <button className="link" onClick={refillTank}>Tank is low – mark as refilled</button>}
        </aside>

        <section className="panel">
          {step === 1 && (
            <>
              <h2>How much water do you need?</h2>
              <div className="cans">
                {CANS.map((c) => (
                  <div key={c.size} className={'can' + (qty[c.size] ? ' picked' : '')}>
                    <div className={`can-shape s${c.size}`} aria-hidden="true">{c.size} L</div>
                    <div className="can-info">
                      <strong>{c.name}</strong>
                      <span>{inr(c.size * RATE)} each</span>
                    </div>
                    <div className="stepper">
                      <button onClick={() => change(c.size, -1)} disabled={!qty[c.size]} aria-label={`Remove one ${c.size} litre`}>−</button>
                      <output>{qty[c.size]}</output>
                      <button onClick={() => change(c.size, 1)} aria-label={`Add one ${c.size} litre`}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              <label className="field">
                <span>Need a different amount? Litres in your own container</span>
                <input type="number" min="0" inputMode="numeric" placeholder="e.g. 20" value={extra} onChange={(e) => setExtra(e.target.value)} />
              </label>

              <div className="modes" role="radiogroup" aria-label="Pickup or delivery">
                <button role="radio" aria-checked={mode === 'pickup'} className={mode === 'pickup' ? 'sel' : ''} onClick={() => setMode('pickup')}>
                  <strong>Pick up</strong><span>Collect at the station · Free</span>
                </button>
                <button role="radio" aria-checked={mode === 'delivery'} className={mode === 'delivery' ? 'sel' : ''} onClick={() => setMode('delivery')}>
                  <strong>Home delivery</strong><span>+ {inr(DELIVERY_FEE)} delivery charge</span>
                </button>
              </div>

              <Breakdown qty={qty} extraLiters={extraLiters} liters={liters} subtotal={subtotal} delivery={delivery} total={total} />

              {overStock && <p className="error">Only {stock} L left in the tank. Reduce your order.</p>}

              <div className="sum">
                <div><span>{liters} L</span><strong>{inr(total)}</strong></div>
                <button className="cta" disabled={liters === 0 || overStock} onClick={() => setStep(2)}>Continue to payment</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Your details and payment</h2>
              <div className="grid">
                <label className="field">
                  <span>Full name</span>
                  <input value={form.name} onChange={setField('name')} autoComplete="name" />
                  {errors.name && <em className="error">{errors.name}</em>}
                </label>
                <label className="field">
                  <span>Mobile number</span>
                  <input value={form.phone} onChange={setField('phone')} inputMode="numeric" maxLength={10} autoComplete="tel" />
                  {errors.phone && <em className="error">{errors.phone}</em>}
                </label>
              </div>
              {mode === 'delivery' && (
                <label className="field">
                  <span>Delivery address</span>
                  <textarea rows="2" value={form.address} onChange={setField('address')} autoComplete="street-address" />
                  {errors.address && <em className="error">{errors.address}</em>}
                </label>
              )}

              <div className="modes" role="radiogroup" aria-label="Payment method">
                <button role="radio" aria-checked={pay === 'upi'} className={pay === 'upi' ? 'sel' : ''} onClick={() => setPay('upi')}>
                  <strong>UPI</strong><span>Pay now from any UPI app</span>
                </button>
                <button role="radio" aria-checked={pay === 'cash'} className={pay === 'cash' ? 'sel' : ''} onClick={() => setPay('cash')}>
                  <strong>Cash</strong><span>{mode === 'delivery' ? 'Pay on delivery' : 'Pay at the counter'}</span>
                </button>
              </div>

              {pay === 'upi' && (
                <label className="field">
                  <span>UPI ID</span>
                  <input placeholder="name@upi" value={form.upi} onChange={setField('upi')} autoCapitalize="none" />
                  {errors.upi && <em className="error">{errors.upi}</em>}
                </label>
              )}

              <Breakdown qty={qty} extraLiters={extraLiters} liters={liters} subtotal={subtotal} delivery={delivery} total={total} />

              <div className="sum">
                <button className="ghost" onClick={() => setStep(1)} disabled={processing}>Back</button>
                <button className="cta" onClick={placeOrder} disabled={processing}>
                  {processing ? (pay === 'upi' ? 'Confirming UPI payment…' : 'Placing order…') : pay === 'upi' ? `Pay ${inr(total)}` : 'Place order'}
                </button>
              </div>
            </>
          )}

          {step === 3 && bill && (
            <>
              <div className="status">
                <div className="bar"><i style={{ width: `${progress}%` }} /></div>
                <p>
                  {!done
                    ? 'Filling your cans…'
                    : bill.mode === 'delivery'
                      ? 'Your water is on its way.'
                      : 'Your water is ready. Collect it at the counter.'}
                </p>
              </div>

              <article className="bill" id="bill">
                <header>
                  <div><h3>AquaPure</h3><small>Purified drinking water</small></div>
                  <div className="meta"><strong>{bill.id}</strong><small>{bill.date}</small></div>
                </header>
                <p className="to">
                  {bill.customer.name} · {bill.customer.phone}
                  {bill.mode === 'delivery' && <><br />{bill.customer.address}</>}
                </p>
                <table>
                  <tbody>
                    {bill.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td>{inr(l.amount)}</td></tr>)}
                    <tr className="sub"><td>Water total ({bill.liters} L × {inr(RATE)})</td><td>{inr(bill.subtotal)}</td></tr>
                    {bill.delivery > 0 && <tr><td>Delivery charge</td><td>{inr(bill.delivery)}</td></tr>}
                  </tbody>
                  <tfoot><tr><td>Total</td><td>{inr(bill.total)}</td></tr></tfoot>
                </table>
                <p className="paid">
                  {bill.pay === 'upi' ? `Paid by UPI · Ref ${bill.ref}` : `Cash – ${bill.mode === 'delivery' ? 'collect on delivery' : 'pay at the counter'}`}
                </p>
              </article>

              <div className="sum noprint">
                <button className="ghost" onClick={() => window.print()}>Print bill</button>
                <button className="cta" onClick={newOrder}>New order</button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
