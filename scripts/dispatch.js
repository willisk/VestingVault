const hre = require('hardhat');
const { ethers } = require('hardhat');
const { dispatchDistribution } = require('../scripts/utils.js');

const allAllocations = require('../allAllocations.json');

// const tokenAddress = '0x6EE06c269812CB6369e2b1e4ae21851663faD5E1';
// const vaultAddress = '0xfA0C14A75fAB6548EAa6Dc21A293a251df9DeEBD';

const tokenAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const vaultAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

async function main() {
  const [owner, ...signers] = await ethers.getSigners();

  console.log('Sender address', owner.address);

  const GamingStars = await ethers.getContractFactory('GamingStars');
  const VestingVault = await ethers.getContractFactory('VestingVault');
  const BatchTransfer = await ethers.getContractFactory('BatchTransfer');

  const token = await GamingStars.attach(tokenAddress);

  const totalSupply = await token.totalSupply();
  const symbol = await token.symbol();
  const name = await token.name();
  console.log(`\nToken '${name}' (${symbol})', supply`, totalSupply.toString(), 'attached to', token.address);

  const vault = await VestingVault.attach(vaultAddress);

  const vestingStartDateContract = await vault.vestingStartDate();
  const vestingEndDateContract = await vault.vestingEndDate();
  console.log('Vault attached to:', vault.address);
  console.log('Vault args:', token.address, vestingStartDateContract.toString());
  console.log(
    'Vesting term:',
    new Date(vestingStartDateContract.toNumber() * 1000),
    '-',
    new Date(vestingEndDateContract.toNumber() * 1000)
  );

  console.log('deploying batchTransfer');
  const batchTransfer = await BatchTransfer.deploy();
  await batchTransfer.deployed();

  console.log('dispatching distribution');
  await dispatchDistribution(token, vault, allAllocations, batchTransfer);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
