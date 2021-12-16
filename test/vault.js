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
  let vault;
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

    vault = await VestingVault.deploy(token.address, vestingStartDate, []);
    await vault.deployed();

    await token.approve(vault.address, ethers.constants.MaxUint256);
  });

  it('allow owner withdrawing for non-vault tokens', async () => {
    const GamingStars = await ethers.getContractFactory('GamingStars');
    const testToken = await GamingStars.deploy();
    await testToken.deployed();

    await expect(vault.withdrawToken(token.address)).to.be.revertedWith('cannot withdraw vault token');
    await expect(vault.connect(receiver1).withdrawToken(testToken.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await testToken.transfer(vault.address, 100);

    let ownerBalanceBefore = await testToken.balanceOf(owner.address);
    await vault.withdrawToken(testToken.address);
    let ownerBalanceAfter = await testToken.balanceOf(owner.address);
    expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.be.equal(100);
  });

  describe('when creating the vault', async () => {
    it('all fields are set correctly', async () => {
      expect(await token.owner()).to.equal(owner.address);
      expect(await token.name()).to.equal('Gaming Stars');
      expect(await token.symbol()).to.equal('GAMES');
      expect(await token.totalSupply()).to.equal(10_000_000);
      expect(await token.balanceOf(owner.address)).to.equal(10_000_000);

      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.token()).to.equal(token.address);

      expect(await vault.vestingStartDate()).to.be.closeTo(vestingStartDate, 2);
      expect(await vault.vestingEndDate()).to.be.closeTo(vestingEndDate, 2);
    });

    it('owner access control is set', async () => {
      await expect(vault.connect(receiver1).addAllocation(receiver2.address, 10_000, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(vault.connect(receiver1).revokeAllowance(receiver2.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('time access control is set', async () => {
      await jumpToTime(vestingStartDate);
      await expect(vault.addAllocation(receiver2.address, 10_000, 0)).to.be.revertedWith('must be before start date');
    });

    it('claimable amount is zero', async () => {
      expect(await vault.claimableAmount(owner.address)).to.equal(0);
      await expect(vault.claim()).to.be.revertedWith('no tokens to claim');
    });

    it('only owner can allocate allowance', async () => {
      await expect(vault.connect(receiver1).addAllocation(receiver2.address, 10_000, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await vault.addAllocation(receiver2.address, 10_000, true);
    });
  });

  describe('when creating an allocation', async () => {
    beforeEach(async () => {
      await vault.addAllocation(receiver1.address, 10_000, true);
      await vault.addAllocation(receiver2.address, 10, false);
    });

    it('requirements are met', async () => {
      await expect(vault.addAllocation(receiver1.address, 10_000, true)).to.be.revertedWith(
        'cannot overwrite previous allocation'
      );
      await expect(vault.addAllocation(signers[0].address, 0, true)).to.be.revertedWith('must be greater 0');
    });

    it('all fields are set correctly', async () => {
      let allocation1 = await vault.allocations(receiver1.address);
      expect(await allocation1.amount).to.equal(10_000);
      expect(await allocation1.claimed).to.equal(0);
      expect(await allocation1.revocable).to.equal(true);

      let allocation2 = await vault.allocations(receiver2.address);
      expect(await allocation2.amount).to.equal(10);
      expect(await allocation2.claimed).to.equal(0);
      expect(await allocation2.revocable).to.equal(false);
    });

    it('claimable amount is zero', async () => {
      expect(await vault.claimableAmount(receiver1.address)).to.equal(0);
      await expect(vault.connect(receiver1).claim()).to.be.revertedWith('no tokens to claim');
    });

    it('allowance can be revoked by owner', async () => {
      await expect(vault.revokeAllowance(receiver2.address)).to.be.revertedWith('allocation is not revocable');

      let ownerBalanceBefore = await token.balanceOf(owner.address);

      await vault.revokeAllowance(receiver1.address);

      expect((await vault.allocations(receiver1.address)).amount).to.equal(0);
      expect(await vault.claimableAmount(receiver1.address)).to.equal(0);

      await expect(vault.connect(receiver1).claim()).to.be.revertedWith('no tokens to claim');

      let ownerBalanceAfter = await token.balanceOf(owner.address);

      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(10_000);
    });

    it('allocation can be modified correctly', async () => {
      await expect(vault.connect(receiver1).modifyAllocation(receiver1.address, 300, false)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      let ownerBalanceBefore = await token.balanceOf(owner.address);
      await vault.modifyAllocation(receiver1.address, 300, false);
      let ownerBalanceAfter = await token.balanceOf(owner.address);

      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(10_000 - 300);

      let allocation1 = await vault.allocations(receiver1.address);
      expect(await allocation1.amount).to.equal(300);
      expect(await allocation1.revocable).to.equal(false);

      ownerBalanceBefore = await token.balanceOf(owner.address);
      await vault.modifyAllocation(receiver2.address, 600, false);
      ownerBalanceAfter = await token.balanceOf(owner.address);

      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(10 - 600);

      let allocation2 = await vault.allocations(receiver2.address);
      expect(await allocation2.amount).to.equal(600);
      expect(await allocation2.revocable).to.equal(false);
    });
  });

  describe('when creating batched allocations', async () => {
    it('all fields are set correctly', async () => {
      await vault.addAllocationBatch([
        { receiver: receiver1.address, amount: 10_000, claimed: 0, revocable: true },
        { receiver: receiver2.address, amount: 10, claimed: 0, revocable: false },
      ]);

      let allocation1 = await vault.allocations(receiver1.address);
      expect(await allocation1.amount).to.equal(10_000);
      expect(await allocation1.claimed).to.equal(0);
      expect(await allocation1.revocable).to.equal(true);

      let allocation2 = await vault.allocations(receiver2.address);
      expect(await allocation2.amount).to.equal(10);
      expect(await allocation2.claimed).to.equal(0);
      expect(await allocation2.revocable).to.equal(false);
    });
  });

  describe('when claiming', async () => {
    beforeEach(async () => {
      await vault.addAllocation(receiver1.address, 10_000, true);
      await jumpToTime(time.future1d);
    });

    it('amount is paid out daily', async () => {
      await jumpToTime(time.future10h);
      expect(await vault.claimableAmount(receiver1.address)).to.equal(0);

      await jumpToTime(time.future1d);
      expect((await vault.claimableAmount(receiver1.address)) > 0).to.be.true;
    });

    it('amount is correctly paid out over time', async () => {
      expect(await vault.claimableAmount(receiver1.address)).to.equal(0);

      let totalAllocation = (await vault.allocations(receiver1.address)).amount;

      await jumpToTime(time.future(vestingTerm / 3));
      let claimableAmount = parseInt((10_000 * parseInt(vestingTerm / 3 / time.delta1d) * time.delta1d) / vestingTerm);
      expect(await vault.claimableAmount(receiver1.address)).to.equal(claimableAmount);

      await vault.connect(receiver1).claim();
      expect(await token.balanceOf(receiver1.address)).to.equal(claimableAmount);
      expect((await vault.allocations(receiver1.address)).claimed).to.equal(claimableAmount);

      await jumpToTime(vestingEndDate);
      claimableAmount = totalAllocation.sub(claimableAmount);
      await vault.connect(receiver1).claim();
      expect((await vault.allocations(receiver1.address)).claimed).to.equal(totalAllocation);
      expect(await token.balanceOf(receiver1.address)).to.equal(totalAllocation);
      expect(await vault.claimableAmount(receiver1.address)).to.equal(0);

      await jumpToTime(time.future30d);
      expect(await vault.claimableAmount(receiver1.address)).to.equal(0);
    });
  });

  describe('when revoking', async () => {
    beforeEach(async () => {
      await vault.addAllocation(receiver1.address, 10_000, true);
      await jumpToTime(time.future1d);
    });

    it('amount is calculated correctly', async () => {
      let totalAllocation = (await vault.allocations(receiver1.address)).amount;
      let ownerBalanceBefore = await token.balanceOf(owner.address);

      await jumpToTime(time.future(vestingTerm / 3));
      let claimableAmount = parseInt((10_000 * parseInt(vestingTerm / 3 / time.delta1d) * time.delta1d) / vestingTerm);

      await vault.revokeAllowance(receiver1.address);
      expect(await token.balanceOf(receiver1.address)).to.equal(claimableAmount);
      expect((await vault.allocations(receiver1.address)).claimed).to.equal(claimableAmount);

      let ownerBalanceAfter = await token.balanceOf(owner.address);
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(totalAllocation.sub(claimableAmount));
    });

    it('ability to revoke can be removed', async () => {
      await expect(vault.connect(receiver2).removeRevocability(receiver1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      await vault.removeRevocability(receiver1.address);
      await expect(vault.revokeAllowance(receiver1.address)).to.be.revertedWith('allocation is not revocable');
    });
  });
});
