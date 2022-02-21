import { ethers, deployments } from "hardhat"
import { BigNumber as BN, Signer } from "ethers"
import { solidity } from "ethereum-waffle"
import chai from "chai"
import { HegicStrategyCall } from "../typechain/HegicStrategyCall"
import { WethMock } from "../typechain/WethMock"
import { OtmPriceCalculator } from "../typechain/OtmPriceCalculator"
import { AggregatorV3Interface } from "../typechain/AggregatorV3Interface"
import { Erc20Mock as ERC20 } from "../typechain/Erc20Mock"
import { HegicOperationalTreasury } from "../typechain/HegicOperationalTreasury"

function round(spotPrice: number, percent: number, decimals: number) {
  let otmStrike = ((spotPrice / 1e8) * percent) / 100
  let remainder = otmStrike % decimals
  let strike
  remainder >= decimals / 2
    ? (strike = Math.round(otmStrike / decimals) * decimals)
    : (strike = Math.floor(otmStrike / decimals) * decimals)
  return strike * 1e8
}

const hre = require("hardhat");

async function main() {
  chai.use(solidity)
  const { expect } = chai

  const fixture = deployments.createFixture(async ({ deployments }) => {

    const [deployer, alice] = await ethers.getSigners()

    return {
      deployer,
      alice,
      hegicOtmCallETH: (await ethers.getContract(
        "HegicStrategyOTM_CALL_110_ETH",
      )) as HegicStrategyCall,
      USDC: (await ethers.getContract("USDC")) as ERC20,
      WETH: (await ethers.getContract("WETH")) as ERC20,
      OtmPriceCalculator_ETH: (await ethers.getContract(
        "PriceCalculatorOTM_CALL_110_ETH",
      )) as OtmPriceCalculator,
      ethPriceFeed: (await ethers.getContract(
        "PriceProviderETH",
      )) as AggregatorV3Interface,
      HegicOperationalTreasury: (await ethers.getContract(
        "HegicOperationalTreasury",
      )) as HegicOperationalTreasury,
    }
  })
  let contracts: Awaited<ReturnType<typeof fixture>>

  contracts = await fixture()
  const { alice, deployer, hegicOtmCallETH, WETH, USDC, OtmPriceCalculator_ETH, ethPriceFeed } = contracts
  await hegicOtmCallETH.setLimit(
    ethers.utils.parseUnits("1000000", await USDC.decimals()),
  )
  let balance_before = await USDC.balanceOf(await alice.getAddress())
  let currentPrice = 3200e8
  let percent = 110
  await ethPriceFeed.setPrice(currentPrice)
  let strike = round(currentPrice, percent, 100)
  // await pricerETH.connect(deployer).setStrategy(hegicStraddleETH.address)
  await hegicOtmCallETH
    .connect(alice)
    .buy(
      await alice.getAddress(),
      86400*10,
      BN.from(ethers.utils.parseUnits("10", await WETH.decimals())),
      strike,
  )
  console.log("Option Strike", ethers.utils.formatUnits(strike, 8))
  let balance_after = await USDC.balanceOf(await alice.getAddress())
  let alice_spent = balance_after.sub(balance_before)
  console.log("ETH-CALL-110 Total Cost (USD)", ethers.utils.formatUnits(alice_spent, await USDC.decimals()))
  let new_eth_price = 4200e8
  let balance_before_exercise = await USDC.balanceOf(await alice.getAddress())
  console.log("Alice balance before exercise" ,ethers.utils.formatUnits(balance_before_exercise, await USDC.decimals()))
  await ethPriceFeed.setPrice(new_eth_price)
  console.log("New ETH Price", ethers.utils.formatUnits(new_eth_price, 8))
  await hegicOtmCallETH
    .connect(alice)
    .exercise(29)
  let balance_after_exercise = await USDC.balanceOf(await alice.getAddress())
  console.log("Alice balance after exercise" ,ethers.utils.formatUnits(balance_after_exercise, await USDC.decimals()))
  let alice_balance_after_exercise = balance_after_exercise.sub(balance_before_exercise)
  console.log("Profit after Exercise", ethers.utils.formatUnits(alice_balance_after_exercise, await USDC.decimals()))
  console.log("ETH-CALL-110 completed.")

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
