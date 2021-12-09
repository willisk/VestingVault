//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './IBEP20.sol';

import '@openzeppelin/contracts/access/Ownable.sol';

contract VestingDeployer {
    struct Allocation {
        address receiver;
        uint256 amountPerMille;
        bool revocable;
    }

    struct GroupedAllocation {
        string name;
        uint256 totalPerMille;
        uint256 initialPerMille;
        Allocation[] allocations;
    }

    address public vaultAddress;

    constructor(
        IBEP20 token,
        uint256 startDate,
        GroupedAllocation[] memory allAllocations
    ) {
        VestingVault vault = new VestingVault(token, startDate);
        vaultAddress = address(vault);

        if (allAllocations.length > 0) {
            uint256 totalSupply = token.totalSupply();
            token.transferFrom(msg.sender, address(this), totalSupply);
            token.approve(vaultAddress, totalSupply);

            for (uint256 i; i < allAllocations.length; i++) {
                GroupedAllocation memory groupAllocation = allAllocations[i];
                uint256 amountGroup = (totalSupply * groupAllocation.totalPerMille) / 1000;

                for (uint256 j; j < groupAllocation.allocations.length; j++) {
                    Allocation memory allocation = groupAllocation.allocations[j];

                    uint256 amount = (amountGroup * allocation.amountPerMille) / 1000;
                    uint256 initial = (amount * groupAllocation.initialPerMille) / 1000;
                    uint256 remainder = amount - initial;

                    if (initial > 0) token.transfer(allocation.receiver, initial);
                    vault.addAllocation(allocation.receiver, remainder, allocation.revocable);
                }
            }
        }

        vault.transferOwnership(msg.sender);
    }
}

/**
 * @dev BEP20 Vesting contract. Releases the tokens linearly over the duration `VESTING_TERM`.
 * Paid out every `PAYOUT_RATE`.
 *
 * Allocations are added by the owner by transferring the tokens to the contract. These will be
 * vested over the full duration. Allocations can be revocable, returning the tokens to the owner.
 *
 */
contract VestingVault is Ownable {
    event AllocationAdded(address indexed receiver, uint256 amount, bool revocable);

    IBEP20 public token;

    uint256 public VESTING_TERM = 2 * 365 days;
    uint256 public CLIFF_PERIOD = 1 * 30 days;
    uint256 public PAYOUT_RATE = 1 days;

    uint256 public vestingStartDate;
    uint256 public vestingEndDate;

    mapping(address => uint256) public totalClaimed;
    mapping(address => uint256) public totalAllocation;
    mapping(address => bool) public allowed;
    mapping(address => bool) public revocable;

    constructor(IBEP20 _token, uint256 _startDate) {
        require(_startDate >= block.timestamp, 'start date cannot lie in the past');
        token = _token;
        vestingStartDate = _startDate;
        vestingEndDate = vestingStartDate + VESTING_TERM;
    }

    // -------- view -------

    /**
     * @dev Calculates the amount that is claimable by caller.
     */
    function claimableAmount(address receiver) public view returns (uint256) {
        if (block.timestamp < vestingStartDate) return 0;

        uint256 timeDelta = block.timestamp - vestingStartDate;
        timeDelta = (timeDelta / PAYOUT_RATE) * PAYOUT_RATE;

        if (timeDelta > VESTING_TERM) timeDelta = VESTING_TERM;

        uint256 currentAllocation = (totalAllocation[receiver] * timeDelta) / VESTING_TERM;

        return currentAllocation - totalClaimed[receiver];
    }

    // -------- user api -------

    /**
     * @dev Invokes the claim to the tokens calculated by `claimableAmount`.
     *
     * Throws if receiver does not have any allocation, or no tokens to claim.
     * Throws on token transfer failure.
     */
    function claim() external {
        require(allowed[msg.sender], 'not allowed');

        uint256 claimable = claimableAmount(msg.sender);
        require(claimable > 0, 'no tokens to claim');

        totalClaimed[msg.sender] += claimable;
        require(token.transfer(msg.sender, claimable), 'could not transfer token');
    }

    // -------- admin -------

    /**
     * @dev Creates an allocation of `amount` to `receiver`.
     * `revocable` determines whether this allocation can be revoked by the owner.
     *
     * Requirements:
     *  - can only be called before `vestingStartDate`
     *  - `amount` must be greater 0
     *  - allocation must not override previous allocation
     */
    function addAllocation(
        address receiver,
        uint256 amount,
        bool _revocable
    ) public onlyOwner onlyBeforeStart {
        require(totalAllocation[receiver] == 0, 'must be unique allocation');
        require(amount > 0, 'amount must be greater 0');

        totalAllocation[receiver] = amount;
        allowed[receiver] = true;
        revocable[receiver] = _revocable;

        require(token.transferFrom(msg.sender, address(this), amount), 'could not transfer token');

        emit AllocationAdded(receiver, amount, _revocable);
    }

    /**
     * @dev Revokes allowance to a claim on allocation.
     * `revocable` determines whether this allocation can be revoked by the owner.
     *
     * Requirements:
     *  - allocation must be revocable
     */
    function revokeAllowance(address receiver) external onlyOwner {
        require(revocable[receiver], 'allocation is not revocable');

        uint256 claimableReceiver = claimableAmount(receiver);

        uint256 remainderOwner = totalAllocation[receiver] - claimableReceiver;

        allowed[receiver] = false;
        totalAllocation[receiver] = 0;

        if (claimableReceiver > 0) {
            totalClaimed[receiver] += claimableReceiver;
            require(token.transfer(receiver, claimableReceiver), 'could not transfer token');
        }

        require(token.transfer(msg.sender, remainderOwner), 'could not transfer token');
    }

    /**
     * @dev Removes the ability of the owner to revoke this allocation.
     */
    function removeRevocability(address receiver) external onlyOwner {
        require(allowed[receiver], 'receiver not allowed');

        revocable[receiver] = false;
    }

    /**
     * @dev Allows for tokens that were accidentally sent to the contract to be withdrawn.
     * Cannot be called for the token used for vesting.
     */
    function withdrawToken(IBEP20 _token) external onlyOwner {
        require(_token != token, 'cannot withdraw vault token');
        uint256 balance = _token.balanceOf(address(this));
        bool _success = _token.transfer(owner(), balance);
        require(_success, 'BEP20 Token could not be transferred');
    }

    // -------- modifier --------

    modifier onlyBeforeStart() {
        require(block.timestamp < vestingStartDate, 'must be before start date');
        _;
    }
}
