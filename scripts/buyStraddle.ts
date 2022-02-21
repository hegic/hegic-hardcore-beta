import { ethers, deployments } from "hardhat"
import { BigNumber as BN, Signer } from "ethers"
import { solidity } from "ethereum-waffle"
import chai from "chai"
import { HegicStrategyStraddle } from "../typechain/HegicStrategyStraddle"
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

    const [deployer, alice] = await ethers.getSigners()

    return {
      deployer,
      alice,
      hegicStraddleETH: (await ethers.getContract(
        "HegicStrategyStraddleETH",
      )) as HegicStrategyStraddle,
      hegicStraddleBTC: (await ethers.getContract(
        "HegicStrategyStraddleBTC",
      )) as HegicStrategyStraddle,
      USDC: (await ethers.getContract("USDC")) as ERC20,
      WETH: (await ethers.getContract("WETH")) as ERC20,
      WBTC: (await ethers.getContract("WBTC")) as ERC20,
      pricerETH: (await ethers.getContract(
        "PriceCalculatorStraddleETH",
      )) as PriceCalculator,
      pricerBTC: (await ethers.getContract(
        "PriceCalculatorStraddleBTC",
      )) as PriceCalculator,
      ethPriceFeed: (await ethers.getContract(
        "PriceProviderETH",
      )) as AggregatorV3Interface,
      btcPriceFeed: (await ethers.getContract(
        "PriceProviderBTC",
      )) as AggregatorV3Interface,
      HegicOperationalTreasury: (await ethers.getContract(
        "HegicOperationalTreasury",
      )) as HegicOperationalTreasury,
    }
  })
  let contracts: Awaited<ReturnType<typeof fixture>>

  contracts = await fixture()
  const { alice, deployer, hegicStraddleETH, hegicStraddleBTC, WETH, USDC, pricerETH } = contracts
  await hegicStraddleETH.setLimit(
    ethers.utils.parseUnits("1000000", await USDC.decimals()),
  )
  let balance_before = await USDC.balanceOf(await alice.getAddress())
  // await pricerETH.connect(deployer).setStrategy(hegicStraddleETH.address)
  await hegicStraddleETH
    .connect(alice)
    .buy(
      await alice.getAddress(),
      86400,
      BN.from(ethers.utils.parseUnits("0.0001", await WETH.decimals())),
      0,
  )
  let balance_after = await USDC.balanceOf(await alice.getAddress())
  let alice_spent = balance_after.sub(balance_before)
  console.log(ethers.utils.formatUnits(alice_spent, await USDC.decimals()))

  console.log("Buy straddle completed.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
