const hre = require('hardhat');
const { ethers } = require('hardhat');
const { dispatchDistribution, attachContractsFromConfig } = require('./utils.js');

const allAllocations = require('../allAllocations.json');

// const tokenAddress = '0x6EE06c269812CB6369e2b1e4ae21851663faD5E1';
// const vaultAddress = '0xfA0C14A75fAB6548EAa6Dc21A293a251df9DeEBD';

const tokenAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const vaultAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

async function main() {
  const [owner, ...signers] = await ethers.getSigners();

  const { token, vault, batchTransfer } = attachContractsFromConfig();

  console.log('Sender address', owner.address);
  console.log('dispatching distribution');
  await dispatchDistribution(token, vault, allAllocations, batchTransfer);

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
