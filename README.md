# Solidity Vesting Vault for a BEP20 / ERC20 token

```shell
npx hardhat compile
npx hardhat test
node scripts/deploy.js
```

## Generate Addresses

```shell
npx hardhat run scripts/generateKeys.js
```

## Verify allocations

```shell
npx hardhat test
```

## Deploy

```shell
npx hardhat run scripts/deploy.js --network bscTest
```

update `vault-args.js`

```shell
npx hardhat verify 0x75c9e83F219d19fdF67c89e83C9AeC5fA618cE77 --network bscTest --contract contracts/GamingStars.sol:GamingStars
npx hardhat verify 0x2Ce1b7c17f65eA736176bCD4Dc81E87907cF0cCe --network bscTest --constructor-args vault-args.js
```

## Tests

```
  Allocations
    ✓ correct ownership set
    ✓ all allocations in JSON sum to 100%
    ✓ all distributed allocations sum to totalSupply

  VestingVault
    ✓ allow owner withdrawing for non-vault tokens (50ms)
    when creating the vault
      ✓ all fields are set correctly
      ✓ owner access control is set
      ✓ time access control is set
      ✓ claimable amount is zero
      ✓ only owner can allocate allowance
    when creating an allocation
      ✓ requirements are met
      ✓ all fields are set correctly
      ✓ claimable amount is zero
      ✓ allowance can be revoked by owner
    when claiming
      ✓ amount is paid out daily
      ✓ amount is correctly paid out over time
    when revoking
      ✓ amount is calculated correctly
      ✓ ability to revoke can be removed


  17 passing (2s)
```
