# LendEx

Experimental peer-to-peer lending prototype on BOT Chain Testnet. Borrowers create fixed-term requests backed by native BOT collateral; lenders fund requests directly onchain.

> **Testnet only.** The contract is unaudited. Never use real assets.

## Run locally

```bash
npm install
npm run dev
```

The configured contract is deployed and verified on BOT Chain Testnet (chain ID `968`) at [`0x1089B5e9fE6e397fB003A5eb183998A263C42A79`](https://scan.bohr.life/address/0x1089B5e9fE6e397fB003A5eb183998A263C42A79).

## Validate

```bash
npm run build
npm run contract:test
```

## Contract lifecycle

1. A borrower creates a request and deposits native BOT collateral.
2. A lender funds the exact principal; it is sent directly to the borrower.
3. Before the due date, the borrower repays principal plus fixed interest. The lender is paid and collateral returns to the borrower.
4. After the due date, the lender may claim the locked collateral if the loan remains unpaid.
5. An unfunded request can be cancelled by its borrower.

Network settings and the deployment private key stay in `.env`. The UI only embeds the public contract address via `VITE_CONTRACT_ADDRESS`.
