// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Minimal constant-product AMM (Uniswap V2 style) for the AUDIT sandbox.
///         The deployer seeds liquidity; anyone can swap.
contract MinimalAMM {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BIPS = 30; // 0.3%
    uint256 public constant BIPS = 10_000;

    IERC20 public immutable token0;
    IERC20 public immutable token1;
    address public immutable deployer;

    uint256 public reserve0;
    uint256 public reserve1;
    bool public initialized;

    event AddLiquidity(address indexed user, uint256 amount0, uint256 amount1);
    event Swap(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 amountOut, uint256 price);

    modifier onlyDeployer() {
        require(msg.sender == deployer, "only deployer");
        _;
    }

    constructor(address token0_, address token1_) {
        require(token0_ != token1_, "same token");
        token0 = IERC20(token0_);
        token1 = IERC20(token1_);
        deployer = msg.sender;
    }

    /// @notice Seed initial liquidity. Tokens must already be in this contract.
    function initializeLiquidity(uint256 amount0, uint256 amount1) external onlyDeployer returns (uint256, uint256) {
        require(!initialized, "already initialized");
        require(amount0 > 0 && amount1 > 0, "zero amount");
        initialized = true;
        reserve0 = amount0;
        reserve1 = amount1;
        emit AddLiquidity(msg.sender, amount0, amount1);
        return (reserve0, reserve1);
    }

    function getReserves() external view returns (uint256 r0, uint256 r1) {
        return (reserve0, reserve1);
    }

    /// @notice Price of token0 in units of token1, scaled by 1e18.
    function getPrice() external view returns (uint256) {
        if (reserve1 == 0) return 0;
        return (reserve0 * 1e18) / reserve1;
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "zero in");
        require(reserveIn > 0 && reserveOut > 0, "zero reserve");
        uint256 amountInWithFee = amountIn * (BIPS - FEE_BIPS);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * BIPS + amountInWithFee;
        return numerator / denominator;
    }

    /// @notice Exact-input swap. User must approve this contract first.
    function swap(IERC20 tokenIn, uint256 amountIn, uint256 minOut) external returns (uint256 amountOut) {
        bool isToken0In = address(tokenIn) == address(token0);
        require(isToken0In || address(tokenIn) == address(token1), "unknown token");
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 reserveIn = isToken0In ? reserve0 : reserve1;
        uint256 reserveOut = isToken0In ? reserve1 : reserve0;
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= minOut, "slippage");

        IERC20 outToken = isToken0In ? token1 : token0;
        outToken.safeTransfer(msg.sender, amountOut);

        if (isToken0In) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }

        emit Swap(msg.sender, address(tokenIn), amountIn, amountOut, (reserve0 * 1e18) / reserve1);
    }
}
