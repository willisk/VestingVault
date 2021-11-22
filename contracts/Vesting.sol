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
    event AllocationAdded(address indexed receiver, uint256 amount);

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
    ) external onlyOwner onlyBeforeStart {
        require(totalAllocation[receiver] == 0, 'must be unique allocation');
        require(amount > 0, 'amount must be greater 0');

        totalAllocation[receiver] = amount;
        allowed[receiver] = true;
        revocable[receiver] = _revocable;

        require(token.transferFrom(msg.sender, address(this), amount), 'could not transfer token');

        emit AllocationAdded(receiver, amount);
    }

    /**
     * @dev Revokes allowance to a claim on allocation.
     * `revocable` determines whether this allocation can be revoked by the owner.
     *
     * Requirements:
     *  - allocation must be revocable
     *  - receiver must previously be allowed to withdraw from allocation
     */
    function revokeAllowance(address receiver) external onlyOwner {
        require(revocable[receiver], 'allocation is not revocable');
        require(allowed[receiver], 'receiver not allowed');

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
        // require(revocable[receiver], 'allocation is not revocable');
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

    modifier isAllowed(address receiver) {
        require(allowed[receiver], 'not allowed');
        _;
    }
}
