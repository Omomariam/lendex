const fs = require('fs')

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying LendEx with:', deployer.address)
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'BOT')
  const LendEx = await ethers.getContractFactory('LendEx')
  const contract = await LendEx.deploy()
  await contract.waitForDeployment()
  const address = await contract.getAddress()
  const deployment = { address, chainId: 968, network: 'BOT Chain Testnet', deployedAt: new Date().toISOString() }
  fs.writeFileSync('deployment.json', JSON.stringify(deployment, null, 2))
  console.log('LendEx deployed to:', address)
  console.log('Explorer:', `https://scan.bohr.life/address/${address}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
