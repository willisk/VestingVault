const hre = require('hardhat');
const { ethers } = require('hardhat');
const { centerTime } = require('./time.js');

var time = centerTime();

const vestingStartDate = time.future1d;

async function main() {
  const [owner, receiver1, receiver2, ...signers] = await ethers.getSigners();

  const allocations = [
    { address: receiver1.address, amount: 10_100, revocable: true },
    { address: receiver2.address, amount: 300, revocable: false },
  ];

  const VestingVault = await ethers.getContractFactory('VestingVault');
  const GamingStars = await ethers.getContractFactory('GamingStars');

  token = await GamingStars.deploy();
  await token.deployed();

  contract = await VestingVault.deploy(token.address, vestingStartDate);
  await contract.deployed();

  await token.approve(contract.address, ethers.constants.MaxUint256);

  console.log('Token deployed to:', token.address);
  console.log('Vault deployed to:', contract.address);

  for (let allocation of allocations) {
    await contract.addAllocation(allocation.address, allocation.amount, allocation.revocable);
    console.log('allocation added:', allocation);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
