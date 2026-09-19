import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, parseEther } from 'ethers'
import { ArrowRight, Check, ChevronDown, Clock3, ExternalLink, History, Landmark, LockKeyhole, Plus, RefreshCw, ShieldCheck, WalletCards, X } from 'lucide-react'
import { addBotChain, CHAIN_ID, CONTRACT_ABI, CONTRACT_ADDRESS, EXPLORER_URL, RPC_URL } from './contract'

type Status = 'Open' | 'Active' | 'Repaid' | 'Defaulted' | 'Cancelled'
type Loan = { id: number; borrower: string; lender: string; principal: number; collateral: number; interest: number; duration: number; fundedAt: number; status: Status }
type Notice = { kind: 'success' | 'error' | 'info'; message: string } | null
type Filter = 'Open' | 'My loans' | 'History'
const statusNames: Status[] = ['Open', 'Active', 'Repaid', 'Defaulted', 'Cancelled']
const short = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'
const fmt = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value)

function friendlyError(error: unknown, fallback: string) {
  const raw = String((error as { shortMessage?: string; message?: string })?.shortMessage || (error as { message?: string })?.message || '').toLowerCase()
  if (raw.includes('user rejected') || raw.includes('user denied')) return 'You cancelled the request. Nothing was changed.'
  if (raw.includes('insufficient funds')) return 'Your wallet does not have enough BOT for this transaction and its network fee.'
  if (raw.includes('send exact principal')) return 'The funding amount no longer matches this request. Refresh and try again.'
  if (raw.includes('loan is not open')) return 'This request is no longer available to fund.'
  if (raw.includes('loan is not active')) return 'This loan is no longer active.'
  if (raw.includes('cannot fund own loan')) return 'You cannot fund a request created by your own wallet.'
  if (raw.includes('only borrower')) return 'Only the borrower wallet can perform this action.'
  if (raw.includes('only lender')) return 'Only the lender wallet can claim this collateral.'
  if (raw.includes('loan not overdue')) return 'This loan is not overdue yet.'
  if (raw.includes('loan is overdue')) return 'The repayment window has ended. The lender can now claim the collateral.'
  if (raw.includes('network') || raw.includes('rpc') || raw.includes('failed to fetch')) return 'BOT Chain is temporarily unreachable. Check your connection and try again.'
  return fallback
}

function useLiveLoans(notify: (notice: Notice) => void) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const load = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true)
      const provider = new JsonRpcProvider(RPC_URL)
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const rows = await contract.getLoans()
      setLoans(rows.map((row: any, id: number) => ({ id, borrower: row.borrower, lender: row.lender, principal: Number(formatEther(row.principal)), collateral: Number(formatEther(row.collateral)), interest: Number(row.interestBps) / 100, duration: Number(row.duration) / 86400, fundedAt: Number(row.fundedAt), status: statusNames[Number(row.status)] })).reverse())
      setUpdatedAt(new Date())
    } catch (error) {
      if (!quiet) notify({ kind: 'error', message: friendlyError(error, 'Live loan data could not be loaded. Please try again.') })
    } finally { if (!quiet) setLoading(false) }
  }, [notify])
  useEffect(() => { load(); const timer = window.setInterval(() => load(true), 8_000); return () => window.clearInterval(timer) }, [load])
  return { loans, loading, updatedAt, reload: load }
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname === '/app' ? 'app' : 'home')
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [connecting, setConnecting] = useState(false)
  const notify = useCallback((next: Notice) => { setNotice(next); if (next) window.setTimeout(() => setNotice(null), 4_500) }, [])
  const live = useLiveLoans(notify)
  const navigate = useCallback((next: 'home' | 'app') => { window.history.pushState({}, '', next === 'app' ? '/app' : '/'); setRoute(next); window.scrollTo({ top: 0 }) }, [])
  const connect = useCallback(async (openApp = false) => {
    if (!window.ethereum) { notify({ kind: 'error', message: 'No compatible wallet was found. Install MetaMask, Bitget Wallet, or TokenPocket to continue.' }); return }
    try {
      setConnecting(true); await addBotChain()
      const provider = new BrowserProvider(window.ethereum as any); const accounts = await provider.send('eth_requestAccounts', []); const network = await provider.getNetwork()
      setAccount(accounts[0]); setChainId(Number(network.chainId)); if (openApp) navigate('app')
    } catch (error) { notify({ kind: 'error', message: friendlyError(error, 'Your wallet could not be connected. Please try again.') }) }
    finally { setConnecting(false) }
  }, [navigate, notify])
  useEffect(() => {
    if (!window.ethereum) return
    const restore = async () => { try { const provider = new BrowserProvider(window.ethereum as any); const accounts = await provider.send('eth_accounts', []); const network = await provider.getNetwork(); setAccount(accounts[0] || ''); setChainId(Number(network.chainId)) } catch { /* disconnected */ } }
    restore()
    const accountsChanged = (...args: unknown[]) => setAccount(((args[0] as string[]) || [])[0] || '')
    const chainChanged = (...args: unknown[]) => setChainId(parseInt(args[0] as string, 16))
    const popState = () => setRoute(window.location.pathname === '/app' ? 'app' : 'home')
    window.ethereum.on?.('accountsChanged', accountsChanged); window.ethereum.on?.('chainChanged', chainChanged); window.addEventListener('popstate', popState)
    return () => { window.ethereum?.removeListener?.('accountsChanged', accountsChanged); window.ethereum?.removeListener?.('chainChanged', chainChanged); window.removeEventListener('popstate', popState) }
  }, [])
  return <div className="app-shell"><div className="prototype-strip"><span>BOT Chain Testnet</span><span className="strip-copy">Experimental contract • Test assets only</span></div>{route === 'home' ? <Landing loans={live.loans} loading={live.loading} account={account} connecting={connecting} connect={() => connect(true)} openApp={() => navigate('app')}/> : account ? <LendingApp account={account} chainId={chainId} loans={live.loans} loading={live.loading} updatedAt={live.updatedAt} reload={live.reload} notify={notify} goHome={() => navigate('home')}/> : <WalletGate connecting={connecting} connect={() => connect(false)} goHome={() => navigate('home')}/>} {notice && <div className={`toast ${notice.kind}`}>{notice.kind === 'success' ? <Check/> : notice.kind === 'error' ? <X/> : <Clock3/>}<span>{notice.message}</span></div>}</div>
}

function Brand({ onClick }: { onClick?: () => void }) { return <button className="brand brand-button" onClick={onClick}><span className="brand-mark"><span/></span><span>Lend<span>Ex</span></span></button> }

function Landing({ loans, loading, account, connecting, connect, openApp }: { loans: Loan[]; loading: boolean; account: string; connecting: boolean; connect: () => void; openApp: () => void }) {
  const open = loans.filter(l => l.status === 'Open'); const active = loans.filter(l => l.status === 'Active'); const volume = open.reduce((sum, loan) => sum + loan.principal, 0)
  return <><header className="nav-wrap"><nav className="nav container"><Brand/><div className="nav-links"><a href="#terms">How it works</a><a href="#network">Network</a><a href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">Contract <ExternalLink size={13}/></a></div><button className="btn btn-wallet" onClick={account ? openApp : connect} disabled={connecting}><WalletCards size={17}/>{connecting ? 'Connecting…' : account ? `Open app · ${short(account)}` : 'Connect wallet'}</button></nav></header><main><section className="landing-hero container"><div className="landing-copy"><div className="eyebrow"><span className="eyebrow-icon"><Landmark size={14}/></span>Peer-to-peer lending on BOT Chain</div><h1>Fixed-term loans,<br/><span>settled onchain.</span></h1><p>Create or fund collateral-backed BOT loans. Terms, balances, and status come directly from the deployed testnet contract.</p><div className="hero-actions"><button className="btn btn-primary" onClick={account ? openApp : connect} disabled={connecting}>{account ? 'Open lending app' : 'Connect wallet to enter'}<ArrowRight size={17}/></button><a className="btn btn-ghost" href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">View contract <ExternalLink size={15}/></a></div></div><div className="contract-card"><div className="card-label">LIVE CONTRACT</div><div className="contract-address"><span>{short(CONTRACT_ADDRESS)}</span><a href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a></div><div className="contract-rule"/><div className="live-stat"><span>Open requests</span><strong>{loading ? '—' : open.length}</strong></div><div className="live-stat"><span>Available to fund</span><strong>{loading ? '—' : `${fmt(volume)} BOT`}</strong></div><div className="live-stat"><span>Active loans</span><strong>{loading ? '—' : active.length}</strong></div><div className="live-indicator"><i/> Reading BOT Chain testnet in real time</div></div></section><section className="landing-stats"><div className="container"><span>Network <strong>BOT Chain Testnet</strong></span><span>Chain ID <strong>968</strong></span><span>Asset <strong>BOT</strong></span><span>Custody <strong>Smart contract</strong></span></div></section><section className="terms-section container" id="terms"><div className="section-heading"><span className="kicker">LOAN LIFECYCLE</span><h2>One contract. Four clear states.</h2></div><div className="step-grid"><Step n="01" title="Request" text="The borrower sets the principal, fixed interest, term, and deposits BOT collateral."/><Step n="02" title="Fund" text="A lender accepts the published terms. The principal transfers to the borrower."/><Step n="03" title="Repay" text="The borrower pays principal plus interest before the due date and receives the collateral."/><Step n="04" title="Default" text="If the term expires unpaid, only the lender can claim the locked collateral."/></div></section><section className="network-section" id="network"><div className="container"><div><span className="kicker">NETWORK</span><h2>Deployed on BOT Chain Testnet.</h2><p>This prototype uses native BOT for both principal and collateral.</p></div><div className="network-links"><a href="https://botchain.ai" target="_blank" rel="noreferrer">botchain.ai <ExternalLink size={14}/></a><a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">scan.botchain.ai <ExternalLink size={14}/></a></div></div></section></main><SiteFooter/></>
}

function WalletGate({ connecting, connect, goHome }: { connecting: boolean; connect: () => void; goHome: () => void }) { return <main className="gate"><div className="gate-card"><Brand onClick={goHome}/><div className="gate-icon"><WalletCards/></div><h1>Connect your wallet</h1><p>The lending app reads your positions and submits transactions through your wallet. It never stores your keys.</p><button className="btn btn-primary full" onClick={connect} disabled={connecting}>{connecting ? 'Waiting for wallet…' : 'Connect on BOT Chain'}<ArrowRight size={17}/></button><button className="text-button" onClick={goHome}>Return to landing page</button></div></main> }

function LendingApp({ account, chainId, loans, loading, updatedAt, reload, notify, goHome }: { account: string; chainId: number | null; loans: Loan[]; loading: boolean; updatedAt: Date | null; reload: (quiet?: boolean) => Promise<void>; notify: (n: Notice) => void; goHome: () => void }) {
  const [filter, setFilter] = useState<Filter>('Open'); const [createOpen, setCreateOpen] = useState(false); const [busyId, setBusyId] = useState<number | null>(null)
  const visible = useMemo(() => loans.filter(loan => filter === 'Open' ? loan.status === 'Open' : filter === 'My loans' ? [loan.borrower, loan.lender].some(a => a.toLowerCase() === account.toLowerCase()) : ['Repaid', 'Defaulted', 'Cancelled'].includes(loan.status)), [loans, filter, account])
  const openVolume = loans.filter(l => l.status === 'Open').reduce((sum, loan) => sum + loan.principal, 0)
  const transact = async (loan: Loan, action: 'fund' | 'repay' | 'default' | 'cancel') => {
    try {
      setBusyId(loan.id); if (chainId !== CHAIN_ID) await addBotChain(); const provider = new BrowserProvider(window.ethereum as any); const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, await provider.getSigner())
      let tx; if (action === 'fund') tx = await contract.fundLoan(loan.id, { value: parseEther(String(loan.principal)) }); else if (action === 'repay') tx = await contract.repayLoan(loan.id, { value: await contract.repaymentAmount(loan.id) }); else if (action === 'default') tx = await contract.claimDefault(loan.id); else tx = await contract.cancelLoan(loan.id)
      notify({ kind: 'info', message: 'Your transaction was submitted. Waiting for BOT Chain to confirm it.' }); await tx.wait(); await reload(); notify({ kind: 'success', message: action === 'fund' ? 'The loan is funded.' : action === 'repay' ? 'The loan is repaid and your collateral was returned.' : action === 'default' ? 'The collateral was transferred to your wallet.' : 'The request was cancelled and your collateral was returned.' })
    } catch (error) { notify({ kind: 'error', message: friendlyError(error, 'The transaction could not be completed. Check the loan status and try again.') }) } finally { setBusyId(null) }
  }
  return <><header className="nav-wrap app-nav"><nav className="nav container"><Brand onClick={goHome}/><div className="app-nav-title">LENDING MARKET</div><div className="nav-actions"><div className="network-chip"><i/><span>BOT Testnet</span></div><div className="account-chip"><span>{short(account)}</span></div></div></nav></header><main className="dashboard container"><div className="dashboard-head"><div><span className="kicker">LIVE CONTRACT MARKET</span><h1>Loan requests</h1><p>All figures below are read directly from BOT Chain testnet.</p></div><button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={17}/>Create request</button></div><div className="dashboard-stats"><div><span>Open requests</span><strong>{loans.filter(l => l.status === 'Open').length}</strong></div><div><span>Available principal</span><strong>{fmt(openVolume)} <small>BOT</small></strong></div><div><span>Active loans</span><strong>{loans.filter(l => l.status === 'Active').length}</strong></div><div><span>Your positions</span><strong>{loans.filter(l => [l.borrower, l.lender].some(a => a.toLowerCase() === account.toLowerCase())).length}</strong></div></div><div className="market-panel"><div className="market-toolbar"><div className="tabs">{(['Open', 'My loans', 'History'] as Filter[]).map(tab => <button key={tab} className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)}>{tab}</button>)}</div><button className="icon-button" onClick={() => reload()} title="Refresh live data"><RefreshCw size={16}/></button></div><div className="table-head"><span>Borrower</span><span>Amount</span><span>Fixed interest</span><span>Duration</span><span>Collateral</span><span>Status</span><span/></div><div className="loan-list">{loading ? <div className="empty"><span className="spinner"/><strong>Loading from BOT Chain</strong></div> : visible.length ? visible.map(loan => <LoanRow key={loan.id} loan={loan} account={account} busy={busyId === loan.id} onAction={transact}/>) : <div className="empty"><History size={22}/><strong>No matching loans</strong><span>{filter === 'Open' ? 'There are no open requests right now.' : 'Completed positions will appear here.'}</span></div>}</div><div className="table-foot"><span>{updatedAt ? `Last synced ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connecting to BOT Chain'}</span><a href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">View contract <ExternalLink size={13}/></a></div></div><div className="risk"><ShieldCheck/><div><strong>Testnet prototype</strong><p>This unaudited contract uses test BOT only. Do not use assets with real-world value.</p></div><a href="https://faucet.botchain.ai" target="_blank" rel="noreferrer">Get test BOT <ExternalLink size={14}/></a></div></main><SiteFooter/>{createOpen && <CreateModal close={() => setCreateOpen(false)} account={account} chainId={chainId} reload={reload} notify={notify}/>}</>
}

function LoanRow({ loan, account, busy, onAction }: { loan: Loan; account: string; busy: boolean; onAction: (l: Loan, a: 'fund' | 'repay' | 'default' | 'cancel') => void }) {
  const mine = loan.borrower.toLowerCase() === account.toLowerCase(); const lender = loan.lender.toLowerCase() === account.toLowerCase(); const overdue = loan.status === 'Active' && Date.now() / 1000 > loan.fundedAt + loan.duration * 86400
  let action: 'fund' | 'repay' | 'default' | 'cancel' | null = null; if (loan.status === 'Open') action = mine ? 'cancel' : 'fund'; else if (loan.status === 'Active' && mine && !overdue) action = 'repay'; else if (loan.status === 'Active' && lender && overdue) action = 'default'
  const label = action === 'fund' ? 'Fund' : action === 'repay' ? 'Repay' : action === 'default' ? 'Claim' : action === 'cancel' ? 'Cancel' : '—'
  return <div className="loan-row"><div className="borrower-cell"><div className="avatar small">{loan.borrower.slice(2, 4).toUpperCase()}</div><span>{short(loan.borrower)}<small>Loan #{String(loan.id + 1).padStart(3, '0')}</small></span></div><strong>{fmt(loan.principal)} <small>BOT</small></strong><span className="rate">{loan.interest.toFixed(2)}%</span><span>{loan.duration} days</span><span>{fmt(loan.collateral)} <small>BOT</small></span><span className={`status-pill ${loan.status.toLowerCase()}`}><i/>{loan.status}</span><button disabled={!action || busy} onClick={() => action && onAction(loan, action)}>{busy ? 'Waiting…' : label}{action && <ArrowRight size={14}/>}</button></div>
}

function CreateModal({ close, account, chainId, reload, notify }: { close: () => void; account: string; chainId: number | null; reload: (quiet?: boolean) => Promise<void>; notify: (n: Notice) => void }) {
  const [amount, setAmount] = useState(''); const [interest, setInterest] = useState(''); const [duration, setDuration] = useState('30'); const [collateral, setCollateral] = useState(''); const [busy, setBusy] = useState(false); const ratio = Number(amount) ? Number(collateral) / Number(amount) * 100 : 0; const valid = Number(amount) > 0 && Number(collateral) > 0 && Number(interest) >= 0 && Number(interest) <= 100 && ratio >= 100
  const submit = async () => { if (!valid) return; try { setBusy(true); if (chainId !== CHAIN_ID) await addBotChain(); const provider = new BrowserProvider(window.ethereum as any); const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, await provider.getSigner()); const tx = await contract.createLoan(parseEther(amount), Math.round(Number(interest) * 100), Number(duration) * 86400, { value: parseEther(collateral) }); notify({ kind: 'info', message: 'Your request was submitted. Waiting for BOT Chain to confirm it.' }); await tx.wait(); await reload(); close(); notify({ kind: 'success', message: 'Your loan request is now open.' }) } catch (error) { notify({ kind: 'error', message: friendlyError(error, 'Your request could not be created. Check the values and try again.') }) } finally { setBusy(false) } }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}><div className="modal"><div className="modal-head"><div><span className="kicker">NEW LOAN</span><h2>Create request</h2></div><button onClick={close}><X/></button></div><p className="modal-intro">Collateral leaves your wallet when this transaction is confirmed and remains locked until repayment, default, or cancellation.</p><div className="form-grid"><label>Borrow amount<div><input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00"/><span>BOT</span></div></label><label>Fixed interest<div><input value={interest} onChange={e => setInterest(e.target.value)} inputMode="decimal" placeholder="0.00"/><span>%</span></div></label><label>Duration<div className="select-wrap"><select value={duration} onChange={e => setDuration(e.target.value)}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select><ChevronDown/></div></label><label>Collateral<div><input value={collateral} onChange={e => setCollateral(e.target.value)} inputMode="decimal" placeholder="0.00"/><span>BOT</span></div></label></div><div className="summary"><div><span>Collateral ratio</span><strong className={ratio >= 100 ? 'green' : 'amber'}>{Number.isFinite(ratio) ? ratio.toFixed(0) : '0'}%</strong></div><div><span>Total repayment</span><strong>{fmt(Number(amount || 0) * (1 + Number(interest || 0) / 100))} BOT</strong></div><div><span>Connected wallet</span><strong>{short(account)}</strong></div></div>{ratio > 0 && ratio < 100 && <div className="field-error">Collateral must be at least equal to the amount borrowed.</div>}<div className="modal-note"><LockKeyhole size={16}/><span>Your wallet will show the exact collateral and network fee before you approve.</span></div><button className="btn btn-primary full" onClick={submit} disabled={busy || !valid}>{busy ? 'Waiting for confirmation…' : 'Create request'}<ArrowRight size={17}/></button></div></div>
}

function Step({ n, title, text }: { n: string; title: string; text: string }) { return <div className="step-card"><span className="step-n">{n}</span><h3>{title}</h3><p>{text}</p></div> }
function SiteFooter() { return <footer className="footer container"><Brand/><p>Experimental peer-to-peer lending on BOT Chain.</p><div className="footer-links"><span>BOT Chain</span><a href="https://botchain.ai" target="_blank" rel="noreferrer">botchain.ai</a><a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">scan.botchain.ai</a></div></footer> }
