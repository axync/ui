'use client'

import { useState } from 'react'
import Layout from '@/components/Layout'
import { useWallet } from '@/hooks/useWallet'
import { formatAmount, formatAddress } from '@/utils/transactions'
import { ASSETS, AVAILABLE_CHAINS, getChainName } from '@/constants/config'

export default function Account() {
  const { address, accountState, loading, walletInstalled } = useWallet()
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Layout>
      <div className="max-w-[720px] mx-auto">
        <h2 className="text-xl font-bold mb-5 fi">Account</h2>

        {!walletInstalled ? (
          <div className="card text-center !p-10 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber/10 flex items-center justify-center text-amber text-xl">!</div>
            <p className="text-tx font-semibold">No wallet detected</p>
            <p className="text-sm text-tx3">Install MetaMask or another Web3 wallet to use Axync.</p>
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm inline-flex">
              Install MetaMask
            </a>
          </div>
        ) : !address ? (
          <div className="card text-center !p-10 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-bg3 flex items-center justify-center text-tx3 text-xl">&#x1F50C;</div>
            <p className="text-tx font-semibold">Wallet not connected</p>
            <p className="text-sm text-tx3">Click &quot;Connect Wallet&quot; in the top right to get started.</p>
          </div>
        ) : loading && !accountState ? (
          <div className="card !p-12 text-center">
            <div className="w-5 h-5 mx-auto border-2 border-lav border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-tx3 text-sm">Loading account...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Wallet Card */}
            <div className="card fi1">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold text-tx3 uppercase tracking-wider">Wallet</div>
                <span className="badge badge-green">Connected</span>
              </div>
              <div className="flex items-center gap-3.5 p-3.5 rounded-[10px] bg-bg border border-brd">
                <div className="w-10 h-10 rounded-[10px] bg-grad flex items-center justify-center text-lg text-bg font-bold">
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold font-mono">{formatAddress(address)}</div>
                  <div className="text-[11px] text-tx3">MetaMask &bull; Sepolia</div>
                </div>
                <button onClick={copyAddress} className="btn btn-sm btn-secondary">
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="mt-2 font-mono text-[10px] text-tx3 break-all px-1">{address}</div>
            </div>

            {/* Balances */}
            <div className="card fi2">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold text-tx3 uppercase tracking-wider">Balances</div>
              </div>
              {accountState && accountState.balances.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {accountState.balances.map((balance, index) => (
                    <div key={index} className="flex items-center justify-between p-3 px-3.5 rounded-[9px] bg-bg border border-brd">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold bg-[rgba(98,126,234,0.15)] text-[#627EEA]">
                          &Xi;
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold">{ASSETS.ETH.symbol}</div>
                          <div className="text-[10px] text-tx3">{getChainName(balance.chain_id)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold font-mono">
                          {formatAmount(BigInt(balance.amount))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-tx3">No balances yet</p>
              )}
            </div>

            {/* Settings */}
            <div className="card fi3">
              <div className="text-xs font-semibold text-tx3 uppercase tracking-wider mb-4">Settings</div>

              <div className="flex items-center justify-between py-3.5 border-b border-brd/40">
                <div>
                  <div className="text-[13px] font-medium">Default Network</div>
                  <div className="text-[11px] text-tx3">Preferred chain for new deals</div>
                </div>
                <select className="form-select !w-40 !py-1.5 !px-2.5 !text-[11px] !rounded-lg" defaultValue="11155111">
                  {AVAILABLE_CHAINS.map((chain) => (
                    <option key={chain.id} value={chain.id}>{chain.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between py-3.5 border-b border-brd/40">
                <div>
                  <div className="text-[13px] font-medium">ZK Proofs by Default</div>
                  <div className="text-[11px] text-tx3">Enable STARK&rarr;Groth16 for all deals</div>
                </div>
                <div className="toggle on" onClick={(e) => (e.currentTarget as HTMLElement).classList.toggle('on')}>
                  <div className="toggle-knob" />
                </div>
              </div>

              <div className="flex items-center justify-between py-3.5 border-b border-brd/40">
                <div>
                  <div className="text-[13px] font-medium">Deal Expiry Default</div>
                  <div className="text-[11px] text-tx3">Default expiration for new deals</div>
                </div>
                <select className="form-select !w-28 !py-1.5 !px-2.5 !text-[11px] !rounded-lg" defaultValue="24">
                  <option value="12">12 hours</option>
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="168">7 days</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div>
                  <div className="text-[13px] font-medium">Testnet Mode</div>
                  <div className="text-[11px] text-tx3">Using testnet contracts (Sepolia)</div>
                </div>
                <span className="badge badge-amber">Testnet</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
