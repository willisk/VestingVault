const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber, utils } = require('ethers');

const BN = BigNumber.from;

const { centerTime } = require('../scripts/time.js');

var time = centerTime();

const jumpToTime = async (t) => {
  await network.provider.send('evm_mine', [t.toNumber()]);
  time = centerTime(t);
};

describe('VestingVault', () => {
  let contract;
  let token;

  let owner;
  let receiver1;
  let receiver2;
  let signers;

  const vestingTerm = time.delta2y;

  let vestingStartDate;
  let vestingEndDate;

  beforeEach(async function () {
    vestingStartDate = time.future1d;
    vestingEndDate = vestingStartDate.add(vestingTerm);

    [owner, receiver1, receiver2, ...signers] = await ethers.getSigners();

    const VestingVault = await ethers.getContractFactory('VestingVault');
    const GamingStars = await ethers.getContractFactory('GamingStars');

    token = await GamingStars.deploy();
    await token.deployed();

    contract = await VestingVault.deploy(token.address, vestingStartDate);
    await contract.deployed();

    await token.approve(contract.address, ethers.constants.MaxUint256);
  });

  it('allow owner withdrawing for non-vault tokens', async () => {
    const GamingStars = await ethers.getContractFactory('GamingStars');
    const testToken = await GamingStars.deploy();
    await testToken.deployed();

    await expect(contract.withdrawToken(token.address)).to.be.revertedWith('cannot withdraw vault token');
    await expect(contract.connect(receiver1).withdrawToken(testToken.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await testToken.transfer(contract.address, 100);

    let ownerBalanceBefore = await testToken.balanceOf(owner.address);
    await contract.withdrawToken(testToken.address);
    let ownerBalanceAfter = await testToken.balanceOf(owner.address);
    expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.be.equal(100);
  });

  describe('when creating the vault', async () => {
    it('all fields are set correctly', async () => {
      expect(await token.owner()).to.equal(owner.address);
      expect(await token.name()).to.equal('Gaming Stars');
      expect(await token.symbol()).to.equal('GAME');
      expect(await token.totalSupply()).to.equal(10_000_000);
      expect(await token.balanceOf(owner.address)).to.equal(10_000_000);

      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.token()).to.equal(token.address);

      expect(await contract.vestingStartDate()).to.be.closeTo(vestingStartDate, 2);
      expect(await contract.vestingEndDate()).to.be.closeTo(vestingEndDate, 2);
    });

    it('owner access control is set', async () => {
      await expect(contract.connect(receiver1).addAllocation(receiver2.address, 10_000, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(contract.connect(receiver1).revokeAllowance(receiver2.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('time access control is set', async () => {
      await jumpToTime(vestingStartDate);
      await expect(contract.addAllocation(receiver2.address, 10_000, 0)).to.be.revertedWith(
        'must be before start date'
      );
    });

    it('claimable amount is zero', async () => {
      expect(await contract.claimableAmount(owner.address)).to.equal(0);
      await expect(contract.claim()).to.be.revertedWith('not allowed');
    });

    it('only owner can allocate allowance', async () => {
      await expect(contract.connect(receiver1).addAllocation(receiver2.address, 10_000, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await contract.addAllocation(receiver2.address, 10_000, true);
    });
  });

  describe('when creating an allocation', async () => {
    beforeEach(async () => {
      await contract.addAllocation(receiver1.address, 10_000, true);
      await contract.addAllocation(receiver2.address, 10, false);
    });

    it('requirements are met', async () => {
      await expect(contract.addAllocation(receiver1.address, 10_000, true)).to.be.revertedWith(
        'must be unique allocation'
      );
      await expect(contract.addAllocation(signers[0].address, 0, true)).to.be.revertedWith('must be greater 0');
    });

    it('all fields are set correctly', async () => {
      expect(await contract.totalClaimed(receiver1.address)).to.equal(0);
      expect(await contract.totalAllocation(receiver1.address)).to.equal(10_000);
      expect(await contract.allowed(receiver1.address)).to.equal(true);
      expect(await contract.revocable(receiver1.address)).to.equal(true);

      expect(await contract.totalAllocation(receiver2.address)).to.equal(10);
      expect(await contract.allowed(receiver2.address)).to.equal(true);
      expect(await contract.revocable(receiver2.address)).to.equal(false);
    });

    it('claimable amount is zero', async () => {
      expect(await contract.claimableAmount(receiver1.address)).to.equal(0);
      await expect(contract.connect(receiver1).claim()).to.be.revertedWith('no tokens to claim');
    });

    it('allowance can be revoked by owner', async () => {
      await expect(contract.revokeAllowance(receiver2.address)).to.be.revertedWith('allocation is not revocable');

      let ownerBalanceBefore = await token.balanceOf(owner.address);

      await contract.revokeAllowance(receiver1.address);
      expect(await contract.totalAllocation(receiver1.address)).to.equal(0);
      expect(await contract.allowed(receiver1.address)).to.equal(false);

      expect(await contract.claimableAmount(receiver1.address)).to.equal(0);
      await expect(contract.connect(receiver1).claim()).to.be.revertedWith('not allowed');

      let ownerBalanceAfter = await token.balanceOf(owner.address);

      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(10_000);
    });
  });

  describe('when claiming', async () => {
    beforeEach(async () => {
      await contract.addAllocation(receiver1.address, 10_000, true);
      await jumpToTime(time.future1d);
    });

    it('amount is paid out daily', async () => {
      await jumpToTime(time.future10h);
      expect(await contract.claimableAmount(receiver1.address)).to.equal(0);

      await jumpToTime(time.future1d);
      expect((await contract.claimableAmount(receiver1.address)) > 0).to.be.true;
    });

    it('amount is correctly paid out over time', async () => {
      expect(await contract.claimableAmount(receiver1.address)).to.equal(0);

      let totalAllocation = await contract.totalAllocation(receiver1.address);

      await jumpToTime(time.future(vestingTerm / 3));
      let claimableAmount = parseInt((10_000 * parseInt(vestingTerm / 3 / time.delta1d) * time.delta1d) / vestingTerm);
      expect(await contract.claimableAmount(receiver1.address)).to.equal(claimableAmount);

      await contract.connect(receiver1).claim();
      expect(await token.balanceOf(receiver1.address)).to.equal(claimableAmount);
      expect(await contract.totalClaimed(receiver1.address)).to.equal(claimableAmount);

      await jumpToTime(vestingEndDate);
      claimableAmount = totalAllocation.sub(claimableAmount);
      await contract.connect(receiver1).claim();
      expect(await contract.totalClaimed(receiver1.address)).to.equal(totalAllocation);
      expect(await token.balanceOf(receiver1.address)).to.equal(totalAllocation);
      expect(await contract.claimableAmount(receiver1.address)).to.equal(0);

      await jumpToTime(time.future30d);
      expect(await contract.claimableAmount(receiver1.address)).to.equal(0);
    });
  });

  describe('when revoking', async () => {
    beforeEach(async () => {
      await contract.addAllocation(receiver1.address, 10_000, true);
      await jumpToTime(time.future1d);
    });

    it('amount is calculated correctly', async () => {
      let totalAllocation = await contract.totalAllocation(receiver1.address);
      let ownerBalanceBefore = await token.balanceOf(owner.address);

      await jumpToTime(time.future(vestingTerm / 3));
      let claimableAmount = parseInt((10_000 * parseInt(vestingTerm / 3 / time.delta1d) * time.delta1d) / vestingTerm);

      await contract.revokeAllowance(receiver1.address);
      expect(await token.balanceOf(receiver1.address)).to.equal(claimableAmount);
      expect(await contract.totalClaimed(receiver1.address)).to.equal(claimableAmount);

      let ownerBalanceAfter = await token.balanceOf(owner.address);
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(totalAllocation.sub(claimableAmount));
    });

    it('ability to revoke can be removed', async () => {
      await expect(contract.connect(receiver2).removeRevocability(receiver1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      await contract.removeRevocability(receiver1.address);
      await expect(contract.revokeAllowance(receiver1.address)).to.be.revertedWith('allocation is not revocable');
    });
  });
});
