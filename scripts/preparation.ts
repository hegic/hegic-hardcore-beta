import { ethers, deployments } from "hardhat"
import { BigNumber as BN, Signer } from "ethers"
import { solidity } from "ethereum-waffle"
import chai from "chai"
import { HegicStrategyStrip } from "../typechain/HegicStrategyStrip"
import { WethMock } from "../typechain/WethMock"
import { PriceCalculator } from "../typechain/PriceCalculator"
import { AggregatorV3Interface } from "../typechain/AggregatorV3Interface"
import { Erc20Mock as ERC20 } from "../typechain/Erc20Mock"
import { HegicOperationalTreasury } from "../typechain/HegicOperationalTreasury"

const hre = require("hardhat");

async function main() {
  chai.use(solidity)
  const { expect } = chai

  const fixture = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(["single-straddle"])

    const [deployer, alice] = await ethers.getSigners()

    return {
      deployer,
      alice,
      hegicStraddleETH: (await ethers.getContract(
        "HegicStrategyStraddleETH",
      )) as HegicStrategyStrip,
      hegicStraddleBTC: (await ethers.getContract(
        "HegicStrategyStraddleBTC",
      )) as HegicStrategyStrip,
      USDC: (await ethers.getContract("USDC")) as ERC20,
      WETH: (await ethers.getContract("WETH")) as ERC20,
      WBTC: (await ethers.getContract("WBTC")) as ERC20,
      pricerETH: (await hre.ethers.getContract(
        "PriceCalculatorStraddleETH",
      )) as PriceCalculator,
      pricerBTC: (await hre.ethers.getContract(
        "PriceCalculatorStraddleBTC",
      )) as PriceCalculator,
      ethPriceFeed: (await hre.ethers.getContract(
        "PriceProviderETH",
      )) as AggregatorV3Interface,
      btcPriceFeed: (await hre.ethers.getContract(
        "PriceProviderBTC",
      )) as AggregatorV3Interface,
      HegicOperationalTreasury: (await hre.ethers.getContract(
        "HegicOperationalTreasury",
      )) as HegicOperationalTreasury,
    }
  })
  let contracts: Awaited<ReturnType<typeof fixture>>

  contracts = await fixture()
  const { alice, deployer, hegicStraddleETH, hegicStraddleBTC } = contracts

  await contracts.USDC.mintTo(
    contracts.HegicOperationalTreasury.address,
    hre.ethers.utils.parseUnits(
      "1000000000000000",
      await contracts.USDC.decimals(),
    ),
  )
  await contracts.HegicOperationalTreasury.addTokens()

  await contracts.USDC.mintTo(
    await alice.getAddress(),
    hre.ethers.utils.parseUnits(
      "1000000000000000",
      await contracts.USDC.decimals(),
    ),
  )

  await contracts.USDC.connect(alice).approve(
    hegicStraddleETH.address,
    hre.ethers.constants.MaxUint256,
  )
  await contracts.USDC.connect(alice).approve(
    hegicStraddleBTC.address,
    hre.ethers.constants.MaxUint256,
  )
  await contracts.ethPriceFeed.setPrice(5000e8)
  await contracts.btcPriceFeed.setPrice(50000e8)


  console.log("Preparation completed!")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
