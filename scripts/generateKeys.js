const hre = require('hardhat');
const { ethers } = require('hardhat');

async function main() {
  for (let i = 0; i < 10; i++) {
    const wallet = ethers.Wallet.createRandom();
    console.log('address:', wallet.address, 'privKey:', wallet.privateKey);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
