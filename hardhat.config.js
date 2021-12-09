require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('dotenv').config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
    ],
  },
  networks: {
    bscTest: {
      url: process.env.PROVIDER_BSC_TEST,
      accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
    },
    kovan: {
      url: process.env.PROVIDER_KOVAN,
      accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
      gasPrice: 10,
    },
    fuji: {
      url: process.env.PROVIDER_FUJI,
      accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
      // gasPrice: 10,
    },
  },
  mocha: {
    timeout: 0,
  },
  etherscan: {
    // apiKey: process.env.ETHERSCAN_KEY,
    apiKey: process.env.BSCSCAN_KEY,
    // apiKey: process.env.SNOWTRACE_KEY,
  },
};
