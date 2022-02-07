import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicStrategyCall} from "../../typechain/HegicStrategyCall"
import {HegicStrategyPut} from "../../typechain/HegicStrategyPut"
import {WethMock} from "../../typechain/WethMock"
import {OtmPriceCalculator} from "../../typechain/OtmPriceCalculator"
import {AggregatorV3Interface} from "../../typechain/AggregatorV3Interface"
import {Erc20Mock as ERC20} from "../../typechain/Erc20Mock"
import {Facade} from "../../typechain/Facade"
import {HegicOperationalTreasury} from "../../typechain/HegicOperationalTreasury"

function round(spotPrice: number, percent: number, decimals: number) {
  let otmStrike = ((spotPrice / 1e8) * percent) / 100
  let remainder = otmStrike % decimals
  let strike
  remainder >= decimals / 2
    ? (strike = Math.round(otmStrike / decimals) * decimals)
    : (strike = Math.floor(otmStrike / decimals) * decimals)
  return strike * 1e8
}

chai.use(solidity)
const {expect} = chai

const fixture = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture(["single-otm"])

  const [deployer, alice] = await ethers.getSigners()

  return {
    deployer,
    alice,
    hegicOtmCallETH: (await ethers.getContract(
      "HegicOtmStrategyCallETH",
    )) as HegicStrategyCall,
    hegicOtmCallBTC: (await ethers.getContract(
      "HegicOtmStrategyCallBTC",
    )) as HegicStrategyCall,
    hegicOtmPutETH: (await ethers.getContract(
      "HegicOtmStrategyPutETH",
    )) as HegicStrategyPut,
    hegicOtmPutBTC: (await ethers.getContract(
      "HegicOtmStrategyPutBTC",
    )) as HegicStrategyPut,

    USDC: (await ethers.getContract("USDC")) as ERC20,
    WETH: (await ethers.getContract("WETH")) as ERC20,
    WBTC: (await ethers.getContract("WBTC")) as ERC20,

    pricerETH: (await ethers.getContract(
      "PriceCalculatorOtmETH",
    )) as OtmPriceCalculator,
    pricerBTC: (await ethers.getContract(
      "PriceCalculatorOtmBTC",
    )) as OtmPriceCalculator,
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

describe("HegicPoolOTM", async () => {
  let contracts: Awaited<ReturnType<typeof fixture>>

  beforeEach(async () => {
    contracts = await fixture()
    const {
      alice,
      deployer,
      hegicOtmCallETH,
      hegicOtmPutETH,
      hegicOtmCallBTC,
      hegicOtmPutBTC,
    } = contracts

    await contracts.USDC.mintTo(
      contracts.HegicOperationalTreasury.address,
      ethers.utils.parseUnits("1000000000", await contracts.USDC.decimals()),
    )
    await contracts.HegicOperationalTreasury.addTokens()

    await contracts.USDC.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits(
        "10000000000000",
        await contracts.USDC.decimals(),
      ),
    )

    await contracts.USDC.connect(alice).approve(
      hegicOtmCallETH.address,
      ethers.constants.MaxUint256,
    )
    await contracts.USDC.connect(alice).approve(
      hegicOtmPutETH.address,
      ethers.constants.MaxUint256,
    )
    await contracts.USDC.connect(alice).approve(
      hegicOtmCallBTC.address,
      ethers.constants.MaxUint256,
    )
    await contracts.USDC.connect(alice).approve(
      hegicOtmPutBTC.address,
      ethers.constants.MaxUint256,
    )

    await contracts.ethPriceFeed.setPrice(5000e8)
    await contracts.btcPriceFeed.setPrice(50000e8)
  })

  describe("ETH CALL POOL", async () => {
    it("exercised amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(214.452e6)
      expect(balance_diff).to.be.eq(-option_cost)
      await ethPriceFeed.setPrice(8000e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      let txExercise = await hegicOtmCallETH.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(BN.from(15525000000))
    })

    it("exercised amount if price below option strike", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await ethPriceFeed.setPrice(3499e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      await expect(hegicOtmCallETH.connect(alice).exercise(0)).to.be.reverted
    })

    it("expired", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await ethPriceFeed.setPrice(3519e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7])

      await expect(hegicOtmCallETH.connect(alice).exercise(0)).to.be.reverted
    })

    it("options aren't buying is period less then 7 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 6 + 86399
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmCallETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("options aren't buying is period more then 45 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 45 + 1
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmCallETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("second OTM IV rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      await pricerETH.connect(deployer).setImpliedVolRate0(80000)
      await pricerETH.connect(deployer).setImpliedVolRate1(800000)
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 20
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(3626.64e6)
      expect(balance_diff).to.be.eq(-option_cost)
    })

    it("locked amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
        HegicOperationalTreasury,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          strike,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(
          hegicOtmCallETH.address,
        ),
      ).to.be.eq(BN.from(214.452e6))
    })

    it("utilization rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      await hegicOtmCallETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate1(BN.from("800000"))
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("400", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_before.sub(balance_alice_after)
      expect(balance_diff).to.be.above(BN.from(514880e6))
    })

    it("exceeds the limit", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      await hegicOtmCallETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate1(BN.from("800000"))
      await pricerETH.connect(deployer).setUtilizationRate(0)
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      await ethPriceFeed.setPrice(currentPrice)
      expect(
        hegicOtmCallETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("776.9", await WETH.decimals())),
            strike,
          ),
      ).to.be.revertedWith("HegicStrategy: The limit is exceeded")
    })

    it("Should calculate correct profitOf", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
      } = contracts
      await hegicOtmCallETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate1(BN.from("800000"))
      await pricerETH.connect(deployer).setUtilizationRate(0)
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 100)
      let new_eth_price = 4500e8
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("10", await WETH.decimals())),
          strike,
        )
      await ethPriceFeed.setPrice(new_eth_price)
      expect(await hegicOtmCallETH.profitOf(0)).to.be.eq(
        ethers.utils.parseUnits("10000", await USDC.decimals()),
      )
    })

    it("Should lock correct amount of USDC (K value)", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmCallETH,
        pricerETH,
        HegicOperationalTreasury,
      } = contracts
      await hegicOtmCallETH.setLimit(
        ethers.utils.parseUnits("100000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate1(BN.from("800000"))
      await pricerETH.connect(deployer).setUtilizationRate(0)
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmCallETH.address)
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmCallETH.setK(200)
      await hegicOtmCallETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("10", await WETH.decimals())),
          strike,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(
          hegicOtmCallETH.address,
        ),
      ).to.be.eq(BN.from(25744e6))
    })
  })

  describe("ETH PUT POOL", async () => {
    it("exercised amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmPutETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(214.452e6)
      expect(balance_diff).to.be.eq(-option_cost)
      await ethPriceFeed.setPrice(2000e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      let txExercise = await hegicOtmPutETH.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(BN.from(3105000000))
    })

    it("exercised amount percent = 80", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      let percent = 80
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmPutETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(214.452e6)
      expect(balance_diff).to.be.eq(-option_cost)
      await ethPriceFeed.setPrice(2000e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      let txExercise = await hegicOtmPutETH.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(BN.from(2070000000))
    })

    it("exercised amount if price higher option strike", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmPutETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await ethPriceFeed.setPrice(2901e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      await expect(hegicOtmPutETH.connect(alice).exercise(0)).to.be.reverted
    })

    it("expired", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmPutETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await ethPriceFeed.setPrice(2000e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7])

      await expect(hegicOtmPutETH.connect(alice).exercise(0)).to.be.reverted
    })

    it("options aren't buying is period less then 7 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 6 + 86399
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmPutETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("options aren't buying is period more then 45 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 45 + 1
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmPutETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WETH.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("second OTM IV rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      await pricerETH.connect(deployer).setImpliedVolRate0(80000)
      await pricerETH.connect(deployer).setImpliedVolRate1(800000)
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 20
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmPutETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(3626.64e6)
      expect(balance_diff).to.be.eq(-option_cost)
    })

    it("locked amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
        HegicOperationalTreasury,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmPutETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          strike,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(hegicOtmPutETH.address),
      ).to.be.eq(BN.from(214.452e6))
    })

    it("utilization rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      await hegicOtmPutETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate1(BN.from("800000"))
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(currentPrice)
      await hegicOtmPutETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("400", await WETH.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_before.sub(balance_alice_after)
      expect(balance_diff).to.be.above(BN.from(514880e6))
    })

    it("exceeds the limit", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicOtmPutETH,
        pricerETH,
      } = contracts
      await hegicOtmPutETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate1(BN.from("800000"))
      await pricerETH.connect(deployer).setUtilizationRate(0)
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 100)
      await pricerETH.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerETH.connect(deployer).setStrategy(hegicOtmPutETH.address)
      await ethPriceFeed.setPrice(currentPrice)
      expect(
        hegicOtmPutETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("776.9", await WETH.decimals())),
            strike,
          ),
      ).to.be.revertedWith("HegicStrategy: The limit is exceeded")
    })
  })

  describe("BTC CALL POOL", async () => {
    it("exercised amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      let percent = 110
      let currentPrice = 40000e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmCallBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1.45", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(901.32e6)
      expect(balance_diff).to.be.eq(-option_cost)
      await btcPriceFeed.setPrice(55499e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      let txExercise = await hegicOtmCallBTC.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(BN.from(16673.55e6))
    })

    it("exercised amount if price below option strike", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      let percent = 110
      let currentPrice = 32000e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmCallBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await btcPriceFeed.setPrice(3499e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      await expect(hegicOtmCallBTC.connect(alice).exercise(0)).to.be.reverted
    })

    it("expired", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmCallBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await btcPriceFeed.setPrice(3519e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7])

      await expect(hegicOtmCallBTC.connect(alice).exercise(0)).to.be.reverted
    })

    it("options aren't buying is period less then 7 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 6 + 86399
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmCallBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("options aren't buying is period more then 45 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 45 + 1
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmCallBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("second OTM IV rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate0(BN.from("8000000000000000"))
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate1(BN.from("80000000000000000"))
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 20
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmCallBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(36266.4e6)
      expect(balance_diff).to.be.eq(-option_cost)
    })

    it("locked amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
        HegicOperationalTreasury,
      } = contracts
      let percent = 110
      let currentPrice = 40000e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmCallBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1.45", await WBTC.decimals())),
          strike,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(
          hegicOtmCallBTC.address,
        ),
      ).to.be.eq(BN.from(901.32e6))
    })

    it("utilization rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      await hegicOtmCallBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate1(BN.from("80000000000000000"))
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmCallBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("50", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_before.sub(balance_alice_after)
      expect(balance_diff).to.be.above(BN.from(643600e6))
    })

    it("exceeds the limit", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      await hegicOtmPutBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate1(BN.from("80000000000000000"))
      await pricerBTC.connect(deployer).setUtilizationRate(0)
      let percent = 110
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      await btcPriceFeed.setPrice(currentPrice)
      expect(
        hegicOtmPutBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("77.7", await WBTC.decimals())),
            strike,
          ),
      ).to.be.revertedWith("HegicStrategy: The limit is exceeded")
    })
  })

  describe("BTC PUT POOL", async () => {
    it("exercised amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      let percent = 90
      let currentPrice = 40125e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmPutBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1.45", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(901.32e6)
      expect(balance_diff).to.be.eq(-option_cost)
      await btcPriceFeed.setPrice(33000e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      let txExercise = await hegicOtmPutBTC.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(BN.from(4350e6))
    })

    it("exercised amount if price higher option strike", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      let percent = 90
      let currentPrice = 32155e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmPutBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await btcPriceFeed.setPrice(29001e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7 - 30 * 60 + 1])

      await expect(hegicOtmPutBTC.connect(alice).exercise(0)).to.be.reverted
    })

    it("expired", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 7
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmPutBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      await btcPriceFeed.setPrice(2000e8)

      await ethers.provider.send("evm_increaseTime", [86400 * 7])

      await expect(hegicOtmPutBTC.connect(alice).exercise(0)).to.be.reverted
    })

    it("options aren't buying is period less then 7 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 6 + 86399
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmPutBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("options aren't buying is period more then 45 days", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 45 + 1
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await expect(
        hegicOtmPutBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
            strike,
          ),
      ).to.be.reverted
    })

    it("second OTM IV rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate0(BN.from("8000000000000000"))
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate1(BN.from("80000000000000000"))
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 20
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmPutBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("3.45", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_after.sub(balance_alice_before)
      let option_cost = BN.from(36266.4e6)
      expect(balance_diff).to.be.eq(-option_cost)
    })

    it("locked amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
        HegicOperationalTreasury,
      } = contracts
      let percent = 90
      let currentPrice = 40125e8
      let period = 86400 * 7
      let strike =
        Math.round(
          Number((((currentPrice / 1000) * percent) / 100e8).toFixed()),
        ) * 1000e8
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmPutBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("1.45", await WBTC.decimals())),
          strike,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(hegicOtmPutBTC.address),
      ).to.be.eq(BN.from(901.32e6))
    })

    it("Should lock correct amount of USDC (K value)", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
        HegicOperationalTreasury,
      } = contracts
      await hegicOtmPutBTC.setLimit(
        ethers.utils.parseUnits("100000", await contracts.USDC.decimals()),
      )
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate1(BN.from("80000000000000000"))
      await pricerBTC.connect(deployer).setUtilizationRate(0)
      let percent = 90
      let currentPrice = 32000e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmPutBTC.setK(200)
      await hegicOtmPutBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("2", await WBTC.decimals())),
          strike,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(hegicOtmPutBTC.address),
      ).to.be.eq(BN.from(51488e6))
    })

    it("utilization rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmPutBTC,
        pricerBTC,
      } = contracts
      await hegicOtmPutBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate1(BN.from("80000000000000000"))
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmPutBTC.address)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(currentPrice)
      await hegicOtmPutBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          period,
          BN.from(ethers.utils.parseUnits("50", await WBTC.decimals())),
          strike,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_before.sub(balance_alice_after)
      expect(balance_diff.toString()).to.be.above(BN.from(643600e6))
    })

    it("exceeds the limit", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicOtmCallBTC,
        pricerBTC,
      } = contracts
      await hegicOtmCallBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate1(BN.from("80000000000000000"))
      await pricerBTC.connect(deployer).setUtilizationRate(0)
      let percent = 90
      let currentPrice = 3200e8
      let period = 86400 * 30
      let strike = round(currentPrice, percent, 1000)
      await pricerBTC.connect(deployer).setStrikePercentage(BN.from(percent))
      await pricerBTC.connect(deployer).setStrategy(hegicOtmCallBTC.address)
      await btcPriceFeed.setPrice(currentPrice)
      expect(
        hegicOtmCallBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            period,
            BN.from(ethers.utils.parseUnits("77.7", await WBTC.decimals())),
            strike,
          ),
      ).to.be.revertedWith("HegicStrategy: The limit is exceeded")
    })
  })
})
