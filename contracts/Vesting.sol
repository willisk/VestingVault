//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './IBEP20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

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
    event AllocationModified(address indexed receiver, uint256 amount, bool revocable);

    struct Allocation {
        address receiver;
        uint256 amount;
        uint256 claimed;
        bool revocable;
    }

    IBEP20 public token;

    uint256 public VESTING_TERM = 2 * 365 days;
    uint256 public CLIFF_PERIOD = 1 * 30 days;
    uint256 public PAYOUT_RATE = 1 days;

    uint256 public vestingStartDate;
    uint256 public vestingEndDate;

    mapping(address => Allocation) public allocations;

    // mapping(address => uint256) public totalClaimed;
    // mapping(address => uint256) public totalAllocation;
    // mapping(address => bool) public allowed;
    // mapping(address => bool) public revocable;

    constructor(IBEP20 _token, uint256 _startDate) {
        require(_startDate >= block.timestamp, 'start date cannot lie in the past');
        token = _token;
        vestingStartDate = _startDate;
        vestingEndDate = vestingStartDate + VESTING_TERM;
    }

    // -------- view -------

    /**
     * @dev Returns the amount that is claimable by caller.
     */
    function claimableAmount(address receiver) public view returns (uint256) {
        Allocation storage allocation = allocations[receiver];

        return calculateReward(allocation.amount, allocation.claimed);
    }

    /**
     * @dev Calculates the reward amount
     */
    function calculateReward(uint256 amount, uint256 claimed) public view returns (uint256) {
        if (block.timestamp < vestingStartDate) return 0;

        uint256 timeDelta = block.timestamp - vestingStartDate;
        timeDelta = (timeDelta / PAYOUT_RATE) * PAYOUT_RATE;

        if (timeDelta > VESTING_TERM) timeDelta = VESTING_TERM;

        uint256 totalPayout = (amount * timeDelta) / VESTING_TERM;

        return totalPayout - claimed;
    }

    // -------- user api -------

    /**
     * @dev Invokes the claim to the tokens calculated by `claimableAmount`.
     *
     * Throws if receiver does not have any allocation, or no tokens to claim.
     * Throws on token transfer failure.
     */
    function claim() external {
        Allocation storage allocation = allocations[msg.sender];

        uint256 reward = calculateReward(allocation.amount, allocation.claimed);
        require(reward > 0, 'no tokens to claim');

        allocation.claimed += reward;
        require(token.transfer(msg.sender, reward), 'could not transfer token');
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
        Allocation storage allocation = allocations[receiver];

        require(allocation.amount == 0, 'cannot overwrite previous allocation');
        require(amount > 0, 'amount must be greater 0');

        allocation.amount = amount;
        allocation.revocable = _revocable;

        require(token.transferFrom(msg.sender, address(this), amount), 'could not transfer token');

        emit AllocationAdded(receiver, amount, _revocable);
    }

    /**
     * @dev Creates allocations in batches
     */
    function addAllocationBatch(Allocation[] memory _allocations) external onlyOwner onlyBeforeStart {
        // XXX: passing in claimed in _allocations is unnecessary
        for (uint256 i; i < _allocations.length; i++) {
            Allocation memory allocation = _allocations[i];
            addAllocation(allocation.receiver, allocation.amount, allocation.revocable); // XXX: duplicate modifier checks
        }
    }

    function modifyAllocation(
        address receiver,
        uint256 amount,
        bool _revocable
    ) public onlyOwner onlyBeforeStart {
        Allocation storage allocation = allocations[receiver];

        require(allocation.amount != 0, 'no allocation found');
        require(amount > 0, 'amount must be greater 0');

        uint256 oldAmount = allocation.amount;

        if (amount > oldAmount) {
            uint256 additional = amount - oldAmount;
            require(token.transferFrom(msg.sender, address(this), additional), 'could not transfer token');
        } else {
            uint256 surplus = oldAmount - amount;
            require(token.transfer(msg.sender, surplus), 'could not transfer token');
        }

        allocation.amount = amount;
        allocation.revocable = _revocable;

        emit AllocationModified(receiver, amount, _revocable);
    }

    /**
     * @dev Revokes allowance to a claim on allocation.
     * `revocable` determines whether this allocation can be revoked by the owner.
     *
     * Requirements:
     *  - allocation must be revocable
     */
    function revokeAllowance(address receiver) external onlyOwner {
        Allocation storage allocation = allocations[receiver];

        require(allocation.revocable, 'allocation is not revocable');

        uint256 claimableReceiver = calculateReward(allocation.amount, allocation.claimed);
        uint256 remainderOwner = allocation.amount - claimableReceiver;

        allocation.amount = 0;
        allocation.revocable = false;

        if (claimableReceiver > 0) {
            allocation.claimed += claimableReceiver; // could delete for gas refund
            require(token.transfer(receiver, claimableReceiver), 'could not transfer token');
        }

        require(token.transfer(msg.sender, remainderOwner), 'could not transfer token');
    }

    /**
     * @dev Removes the ability of the owner to revoke this allocation.
     */
    function removeRevocability(address receiver) external onlyOwner {
        Allocation storage allocation = allocations[receiver];

        require(allocation.revocable, 'allocation already unable to be revoked');

        allocation.revocable = false;
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
