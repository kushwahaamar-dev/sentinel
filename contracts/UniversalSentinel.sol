// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/**
 * @title UniversalSentinel
 * @notice Minimal parametric insurance vault. Backend (risk officer) triggers payouts.
 */
contract UniversalSentinel {
    IERC20 public immutable asset;
    address public immutable treasury;
    address public riskOfficer;
    uint256 public maxPayout; // in asset units

    event RiskOfficerUpdated(address indexed newOfficer);
    event PayoutExecuted(address indexed to, uint256 amount, string reason);
    event Funded(address indexed from, uint256 amount);

    error Unauthorized();
    error AmountTooHigh();
    error TransferFailed();

    constructor(address asset_, address treasury_, address officer_, uint256 maxPayout_) {
        asset = IERC20(asset_);
        treasury = treasury_;
        riskOfficer = officer_;
        maxPayout = maxPayout_;
    }

    modifier onlyRiskOfficer() {
        if (msg.sender != riskOfficer) revert Unauthorized();
        _;
    }

    function setRiskOfficer(address newOfficer) external {
        if (msg.sender != treasury) revert Unauthorized();
        riskOfficer = newOfficer;
        emit RiskOfficerUpdated(newOfficer);
    }

    /// @notice Fund the vault from caller into contract custody.
    function fund(uint256 amount) external {
        if (!asset.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Funded(msg.sender, amount);
    }

    /// @notice Execute a payout to `to`. Capped by `maxPayout`.
    function disbursePayout(address to, uint256 amount, string calldata reason) external onlyRiskOfficer {
        if (amount > maxPayout) revert AmountTooHigh();
        if (!asset.transfer(to, amount)) revert TransferFailed();
        emit PayoutExecuted(to, amount, reason);
    }

    /// @notice Emergency sweep by treasury if needed.
    function emergencySweep(uint256 amount, address to) external {
        if (msg.sender != treasury) revert Unauthorized();
        if (!asset.transfer(to, amount)) revert TransferFailed();
    }

    function currentBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}
