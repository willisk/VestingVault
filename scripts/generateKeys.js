const hre = require('hardhat');
const { ethers } = require('hardhat');

async function main() {
  const marketing = ethers.Wallet.createRandom();
  const treasury = ethers.Wallet.createRandom();

  console.log('public addresses');
  console.log(marketing.address);
  console.log(treasury.address);

  console.log();
  console.log('PRIVATE_KEY_MARKETING =', marketing.privateKey);
  console.log('PRIVATE_KEY_TREASURY =', treasury.privateKey);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
