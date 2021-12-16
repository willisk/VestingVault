//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './IBEP20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract BatchTransfer {
    function dispatch(
        IBEP20 token,
        address[] memory receivers,
        uint256[] memory amounts
    ) external {
        for (uint256 i; i < receivers.length; i++)
            require(token.transferFrom(msg.sender, receivers[i], amounts[i]), 'Token could not be transferred');
    }
}
