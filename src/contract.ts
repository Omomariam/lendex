export const CHAIN_ID = 968
export const CHAIN_HEX = '0x3c8'
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ''
export const RPC_URL = 'https://rpc.bohr.life'
export const EXPLORER_URL = 'https://scan.bohr.life'

export const CONTRACT_ABI = [
  'function createLoan(uint256 principal, uint256 interestBps, uint256 duration) payable returns (uint256)',
  'function fundLoan(uint256 id) payable',
  'function repayLoan(uint256 id) payable',
  'function claimDefault(uint256 id)',
  'function cancelLoan(uint256 id)',
  'function repaymentAmount(uint256 id) view returns (uint256)',
  'function getLoans() view returns ((address borrower,address lender,uint256 principal,uint256 collateral,uint256 interestBps,uint256 duration,uint256 fundedAt,uint8 status)[])',
]

export const addBotChain = async () => {
  if (!window.ethereum) throw new Error('No EVM wallet detected')
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] })
  } catch (error: unknown) {
    const code = (error as { code?: number }).code
    if (code !== 4902) throw error
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: CHAIN_HEX,
        chainName: 'BOT Chain Testnet',
        nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [EXPLORER_URL],
      }],
    })
  }
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}
