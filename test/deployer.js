const hre = require('hardhat');
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber, utils } = require('ethers');
const { getContractAddress } = require('@ethersproject/address');

const BN = BigNumber.from;

const { centerTime } = require('../scripts/time.js');
var time = centerTime();
const vestingStartDate = time.future1d;

const allAllocations = require('../allAllocations.json');

const zero = BN('0');
const oneMille = BN('1000');

describe('Allocations', () => {
  let token;
  let totalSupply;
  let vault;
  let owner;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    const GamingStars = await ethers.getContractFactory('GamingStars');
    const VestingVault = await ethers.getContractFactory('VestingVault');
    const VaultDeployer = await ethers.getContractFactory('VestingDeployer');

    token = await GamingStars.deploy();
    await token.deployed();
    totalSupply = await token.totalSupply();

    //NOTE: token should be ideally created in Vault itself, so it doesn't need pre-approval, but BEP20's 0.5.16 doesn't like to compile alongside 0.8.0 in hardhat
    const nonce = await owner.getTransactionCount();
    const deployerFutureAddress = getContractAddress({ from: owner.address, nonce: nonce + 1 });

    await token.approve(deployerFutureAddress, ethers.constants.MaxUint256);
    deployer = await VaultDeployer.deploy(token.address, vestingStartDate, allAllocations);
    await deployer.deployed();

    vault = await VestingVault.attach(await deployer.vaultAddress());
  });

  // it('contract data', async () => {
  //   const symbol = await token.symbol();
  //   const name = await token.name();
  //   const vestingStartDateContract = await vault.vestingStartDate();
  //   const vestingEndDateContract = await vault.vestingEndDate();

  //   console.log(`\nToken '${name}' (${symbol})', supply`, totalSupply.toString(), 'deployed to', token.address);
  //   console.log('Vault deployed to:', vault.address);
  //   console.log(
  //     'Vesting term:',
  //     new Date(vestingStartDateContract.toNumber() * 1000),
  //     '-',
  //     new Date(vestingEndDateContract.toNumber() * 1000)
  //   );
  // });

  it('correct ownership set', async () => {
    expect(await vault.owner()).to.equal(owner.address);
  });

  it('all allocations in JSON sum to 100%', async () => {
    let totalAllocationsPerMille = zero;

    for (let group of allAllocations) {
      const { name, totalPerMille, initialPerMille, allocations } = group;

      totalAllocationsPerMille = totalAllocationsPerMille.add(BN(totalPerMille));
      totalGroupAllocationPerMille = zero;

      for (let allocation of allocations) {
        const amount = BN(allocation.amountPerMille);
        totalGroupAllocationPerMille = totalGroupAllocationPerMille.add(amount);
      }

      expect(totalGroupAllocationPerMille).to.equal(oneMille);
    }

    expect(totalAllocationsPerMille).to.equal(oneMille);
  });

  it('all distributed allocations sum to totalSupply', async () => {
    let totalAllocations = zero;

    for (let group of allAllocations) {
      const { name, totalPerMille, initialPerMille, allocations } = group;
      let totalAllocationsGroup = zero;

      for (let allocation of allocations) {
        const { receiver } = allocation;
        const remainder = await vault.totalAllocation(receiver);
        const initial = await token.balanceOf(receiver);
        const amount = initial.add(remainder);

        totalAllocations = totalAllocations.add(amount);
        totalAllocationsGroup = totalAllocationsGroup.add(amount);
      }

      const totalGroup = totalSupply.mul(BN(totalPerMille)).div(BN('1000'));

      expect(totalAllocationsGroup).to.equal(totalGroup);
    }

    expect(totalAllocations).to.equal(totalSupply);
  });
});
