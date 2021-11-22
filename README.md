# Solidity Vesting Vault for a BEP20 / ERC20 token

```shell
npx hardhat compile
npx hardhat test
node scripts/deploy.js
```

## Tests

```
  VestingVault
    ✓ allow owner withdrawing for non-vault tokens (75ms)
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


  14 passing (1s)
```
