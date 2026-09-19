const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('LendEx', function () {
  async function deploy() {
    const [borrower, lender, other] = await ethers.getSigners()
    const contract = await (await ethers.getContractFactory('LendEx')).deploy()
    return { contract, borrower, lender, other }
  }

  it('creates, funds and repays a fixed-term loan', async function () {
    const { contract, borrower, lender } = await deploy()
    const principal = ethers.parseEther('10')
    const collateral = ethers.parseEther('15')
    await expect(contract.connect(borrower).createLoan(principal, 800, 30 * 86400, { value: collateral }))
      .to.emit(contract, 'LoanCreated')
    await expect(contract.connect(lender).fundLoan(0, { value: principal })).to.emit(contract, 'LoanFunded')
    expect((await contract.getLoan(0)).status).to.equal(1)
    const due = await contract.repaymentAmount(0)
    await expect(contract.connect(borrower).repayLoan(0, { value: due }))
      .to.emit(contract, 'LoanRepaid').withArgs(0, due)
    expect((await contract.getLoan(0)).status).to.equal(2)
  })

  it('lets only the lender claim collateral after default', async function () {
    const { contract, borrower, lender, other } = await deploy()
    await contract.connect(borrower).createLoan(ethers.parseEther('2'), 500, 3600, { value: ethers.parseEther('3') })
    await contract.connect(lender).fundLoan(0, { value: ethers.parseEther('2') })
    await ethers.provider.send('evm_increaseTime', [3601]); await ethers.provider.send('evm_mine')
    await expect(contract.connect(other).claimDefault(0)).to.be.revertedWith('Only lender')
    await expect(contract.connect(lender).claimDefault(0)).to.emit(contract, 'LoanDefaulted')
    expect((await contract.getLoan(0)).status).to.equal(3)
  })

  it('returns collateral when an unfunded request is cancelled', async function () {
    const { contract, borrower } = await deploy()
    await contract.connect(borrower).createLoan(ethers.parseEther('2'), 500, 86400, { value: ethers.parseEther('3') })
    await expect(contract.connect(borrower).cancelLoan(0)).to.emit(contract, 'LoanCancelled')
    expect((await contract.getLoan(0)).status).to.equal(4)
  })
})
