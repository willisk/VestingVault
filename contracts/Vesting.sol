//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import 'hardhat/console.sol';
// import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
// import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
// import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './IBEP20.sol';

import '@openzeppelin/contracts/access/Ownable.sol';

contract VestingVault is Ownable {
    event AllocationAdded(address indexed receiver, uint256 amount);

    IBEP20 public token;

    uint256 public VESTING_TERM = 2 * 365 days;
    uint256 public CLIFF_PERIOD = 1 * 30 days;
    uint256 public PAYOUT_RATE = 1 days;

    uint256 public vestingStartDate;
    uint256 public vestingEndDate;
    uint256 public cliffDate;

    mapping(address => uint256) public totalClaimed;
    mapping(address => uint256) public totalAllocation;
    mapping(address => bool) public allowed;
    mapping(address => bool) public revocable;

    constructor(IBEP20 _token, uint256 _startDate) {
        require(_startDate >= block.timestamp, 'start date cannot lie in the past');
        token = _token;
        vestingStartDate = _startDate;
        vestingEndDate = vestingStartDate + VESTING_TERM;
        cliffDate = vestingStartDate + CLIFF_PERIOD;
    }

    // -------- view -------

    function claimableAmount(address receiver) public view returns (uint256) {
        if (block.timestamp < vestingStartDate) return 0;
        // if (block.timestamp < cliffDate) return 0; // XXX: not sure if cliff is necessary

        uint256 timeDelta = block.timestamp - vestingStartDate;
        timeDelta = (timeDelta / PAYOUT_RATE) * PAYOUT_RATE;

        if (timeDelta > VESTING_TERM) timeDelta = VESTING_TERM;

        uint256 currentAllocation = (totalAllocation[receiver] * timeDelta) / VESTING_TERM;

        return currentAllocation - totalClaimed[receiver];
    }

    // -------- user api -------

    function claim() external {
        require(allowed[msg.sender], 'not allowed');

        uint256 claimable = claimableAmount(msg.sender);
        require(claimable > 0, 'no tokens to claim');

        totalClaimed[msg.sender] += claimable;
        require(token.transfer(msg.sender, claimable), 'could not transfer token');
    }

    // -------- admin -------

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

    modifier onlyBeforeCliff() {
        require(block.timestamp < cliffDate, 'must be before cliff date');
        _;
    }

    modifier isAllowed(address receiver) {
        require(allowed[receiver], 'not allowed');
        _;
    }
}
