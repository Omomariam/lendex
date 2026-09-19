require('dotenv').config()
require('@nomicfoundation/hardhat-ethers')
require('@nomicfoundation/hardhat-chai-matchers')
require('@nomicfoundation/hardhat-verify')

module.exports = {
  solidity: {
    version: '0.8.28',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    botchainTestnet: {
      url: 'https://rpc.bohr.life',
      chainId: 968,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: { botchainTestnet: process.env.BLOCKSCOUT_API_KEY || 'unused' },
    customChains: [{
      network: 'botchainTestnet',
      chainId: 968,
      urls: {
        apiURL: 'https://scan.bohr.life/api',
        browserURL: 'https://scan.bohr.life',
      },
    }],
  },
}
