const { ethers } = require('hardhat');

const { centerTime } = require('./time.js');
var time = centerTime();
const vestingStartDate = time.future1d;

const allAllocations = require('../allAllocations.json');
const { dispatchDistribution } = require('./utils.js');

// const admin = '0x56BEe757266812646a0DD07d93232210529CFeE8'; // holds vault ownership, founder

async function main() {
  const [owner, ...signers] = await ethers.getSigners();

  console.log('Sender address', owner.address);

  const GamingStars = await ethers.getContractFactory('GamingStars');
  const VestingVault = await ethers.getContractFactory('VestingVault');
  const BatchTransfer = await ethers.getContractFactory('BatchTransfer');

  const token = await GamingStars.deploy();
  await token.deployed();
  // console.log('Owner address Contract', await token.owner());

  const totalSupply = await token.totalSupply();
  const symbol = await token.symbol();
  const name = await token.name();
  console.log(`\nToken '${name}' (${symbol})', supply`, totalSupply.toString(), 'deployed to', token.address);

  // const nonce = await owner.getTransactionCount();
  // const vaultFutureAddress = getContractAddress({ from: owner.address, nonce: nonce + 1 });

  // const tx = await token.approve(vaultFutureAddress, ethers.constants.MaxUint256);
  // await tx.wait();
  const vault = await VestingVault.deploy(token.address, vestingStartDate);
  await vault.deployed();

  const vestingStartDateContract = await vault.vestingStartDate();
  const vestingEndDateContract = await vault.vestingEndDate();
  console.log('Vault deployed to:', vault.address);
  console.log('StartDate timestamp', vestingStartDate.toString());
  console.log(
    'Vesting term:',
    new Date(vestingStartDateContract.toNumber() * 1000),
    '-',
    new Date(vestingEndDateContract.toNumber() * 1000)
  );

  const batchTransfer = await BatchTransfer.deploy();
  await batchTransfer.deployed();
  console.log('BatchTransfer deployed to:', batchTransfer.address);

  console.log({
    tokenAddress: token.address,
    vaultAddress: vault.address,
    batchTransferAddress: batchTransfer.address,
  });
  // console.log('dispatching distribution');
  // await dispatchDistribution(token, vault, allAllocations);
  // console.log('done');

  // await token.transferOwnership(admin);
  // const newOwnerToken = await token.owner();
  // console.log('\nToken Ownership transferred, new owner:', newOwnerToken);

  // await vault.transferOwnership(admin);
  // const newOwnerVault = await vault.owner();
  // console.log('Vault Ownership transferred, new owner:', newOwnerVault);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
