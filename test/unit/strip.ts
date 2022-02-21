import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicStrategyStrip} from "../../typechain/HegicStrategyStrip"
import {WethMock} from "../../typechain/WethMock"
import {PriceCalculator} from "../../typechain/PriceCalculator"
import {AggregatorV3Interface} from "../../typechain/AggregatorV3Interface"
import {Erc20Mock as ERC20} from "../../typechain/Erc20Mock"
import {HegicOperationalTreasury} from "../../typechain/HegicOperationalTreasury"

chai.use(solidity)
const {expect} = chai

const fixture = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture(["single-strip"])

  const [deployer, alice] = await ethers.getSigners()

  return {
    deployer,
    alice,
    hegicStripETH: (await ethers.getContract(
      "HegicStrategyStripETH",
    )) as HegicStrategyStrip,
    hegicStripBTC: (await ethers.getContract(
      "HegicStrategyStripBTC",
    )) as HegicStrategyStrip,
    USDC: (await ethers.getContract("USDC")) as ERC20,
    WETH: (await ethers.getContract("WETH")) as ERC20,
    WBTC: (await ethers.getContract("WBTC")) as ERC20,
    pricerETH: (await ethers.getContract(
      "PriceCalculatorStripETH",
    )) as PriceCalculator,
    pricerBTC: (await ethers.getContract(
      "PriceCalculatorStripBTC",
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

describe("HegicPoolStrip", async () => {
  let contracts: Awaited<ReturnType<typeof fixture>>

  beforeEach(async () => {
    contracts = await fixture()
    const {
      alice,
      hegicStripETH,
      hegicStripBTC,
      pricerBTC,
      pricerETH,
    } = contracts

    await pricerETH.setPeriodLimits(1 * 24 * 3600, 30 * 24 * 3600)
    await pricerBTC.setPeriodLimits(1 * 24 * 3600, 30 * 24 * 3600)

    await contracts.USDC.mintTo(
      contracts.HegicOperationalTreasury.address,
      ethers.utils.parseUnits(
        "1000000000000000",
        await contracts.USDC.decimals(),
      ),
    )
    await contracts.HegicOperationalTreasury.addTokens()

    await contracts.USDC.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits(
        "1000000000000000",
        await contracts.USDC.decimals(),
      ),
    )

    await contracts.USDC.connect(alice).approve(
      hegicStripETH.address,
      ethers.constants.MaxUint256,
    )
    await contracts.USDC.connect(alice).approve(
      hegicStripBTC.address,
      ethers.constants.MaxUint256,
    )
    await contracts.ethPriceFeed.setPrice(5000e8)
    await contracts.btcPriceFeed.setPrice(50000e8)
  })

  describe("ETH", async () => {
    it("call exercised amount", async () => {
      const {
        alice,
        USDC,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        pricerETH,
        deployer,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 5000e8
      let new_price = 7000e8
      await ethPriceFeed.setPrice(strike_price)
      await hegicStripETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          24 * 3600,
          BN.from(ethers.utils.parseUnits("0.3535", await WETH.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [24 * 3600 - 30 * 60 + 1])
      let txExercise = await hegicStripETH.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(707e6)
    })

    it("put exercised amoun", async () => {
      const {
        alice,
        USDC,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        pricerETH,
        deployer,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 5000e8
      let new_price = 3000e8
      await ethPriceFeed.setPrice(strike_price)
      await hegicStripETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          24 * 3600,
          BN.from(ethers.utils.parseUnits("0.3535", await WETH.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [24 * 3600 - 30 * 60 + 1])
      let txExercise = await hegicStripETH.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(1414e6)
    })

    it("null exercised amount", async () => {
      const {
        alice,
        USDC,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        pricerETH,
        deployer,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 9000e8
      let new_price = 9000e8
      await ethPriceFeed.setPrice(strike_price)
      await hegicStripETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          24 * 3600,
          BN.from(ethers.utils.parseUnits("0.3535", await WETH.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [24 * 3600 - 30 * 60 + 1])
      await expect(hegicStripETH.connect(alice).exercise(0)).to.be.reverted
    })

    it("itm expired exercised amount", async () => {
      const {
        alice,
        USDC,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        pricerETH,
        deployer,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 3000e8
      let new_price = 8000e8
      await ethPriceFeed.setPrice(strike_price)
      await hegicStripETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          24 * 3600,
          BN.from(ethers.utils.parseUnits("0.3535", await WETH.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await ethPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [24 * 3600])
      await expect(hegicStripETH.connect(alice).exercise(0)).to.be.reverted
    })

    it("less then min period", async () => {
      const {
        alice,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        pricerETH,
        deployer,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      let strike_price = 3000e8
      let new_price = 8000e8
      await ethPriceFeed.setPrice(strike_price)
      await expect(
        hegicStripETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            86399,
            BN.from(ethers.utils.parseUnits("0.3535", await WETH.decimals())),
            0,
          ),
      ).to.be.revertedWith("PriceCalculator: The period is too short")
    })

    it("more then max period", async () => {
      const {
        alice,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        pricerETH,
        deployer,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      let strike_price = 3000e8
      let new_price = 8000e8
      await ethPriceFeed.setPrice(strike_price)
      await expect(
        hegicStripETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            86400 * 30 + 1,
            BN.from(ethers.utils.parseUnits("0.3535", await WETH.decimals())),
            0,
          ),
      ).to.be.revertedWith("PriceCalculator: The period is too long")
    })

    it("locked amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        HegicOperationalTreasury,
        pricerETH,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate(BN.from("800000"))
      let strike_price = 5000e8
      let new_price = 7000e8
      await ethPriceFeed.setPrice(strike_price)
      await hegicStripETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          86400 * 9,
          BN.from(ethers.utils.parseUnits("3.45", await WETH.decimals())),
          0,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(hegicStripETH.address),
      ).to.be.eq(BN.from(2431.56e6))
    })

    it("utilization rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        HegicOperationalTreasury,
        pricerETH,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate(BN.from("800000"))
      let strike_price = 5000e8
      let new_price = 7000e8
      await ethPriceFeed.setPrice(strike_price)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await hegicStripETH
        .connect(alice)
        .buy(
          await alice.getAddress(),
          86400 * 30,
          BN.from(ethers.utils.parseUnits("400", await WETH.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      let balance_diff = balance_alice_before.sub(balance_alice_after)
      expect(balance_diff).to.be.eq(BN.from(514880e6))
    })

    it("exceeds the limit", async () => {
      const {
        alice,
        deployer,
        WETH,
        ethPriceFeed,
        hegicStripETH,
        pricerETH,
      } = contracts
      await hegicStripETH.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )
      await pricerETH.connect(deployer).setImpliedVolRate(BN.from("800000"))
      let strike_price = 5000e8
      await ethPriceFeed.setPrice(strike_price)
      expect(
        hegicStripETH
          .connect(alice)
          .buy(
            await alice.getAddress(),
            86400 * 30,
            BN.from(ethers.utils.parseUnits("776.9", await WETH.decimals())),
            0,
          ),
      ).to.be.revertedWith("HegicStrategy: The limit is exceeded")
    })
  })

  describe("BTC", async () => {
    it("call exercised amount", async () => {
      const {
        alice,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        pricerBTC,
        deployer,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 40000e8
      let new_price = 50000e8
      await btcPriceFeed.setPrice(strike_price)
      await hegicStripBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          86400,
          BN.from(ethers.utils.parseUnits("1.54", await WBTC.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [86400 - 30 * 60 + 1])
      let txExercise = await hegicStripBTC.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(15400e6)
    })

    it("put exercised amoun", async () => {
      const {
        alice,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        pricerBTC,
        deployer,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 50000e8
      let new_price = 40000e8
      await btcPriceFeed.setPrice(strike_price)
      await hegicStripBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          24 * 3600,
          BN.from(ethers.utils.parseUnits("1.54", await WBTC.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [24 * 3600 - 30 * 60 + 1])
      let txExercise = await hegicStripBTC.connect(alice).exercise(0)
      let balance_alice_after_exercise = await USDC.balanceOf(
        await alice.getAddress(),
      )
      let exercised_amount = balance_alice_after_exercise.sub(
        balance_alice_after,
      )
      expect(exercised_amount).to.be.eq(30800e6)
    })

    it("null exercised amount", async () => {
      const {
        alice,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        pricerBTC,
        deployer,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 9000e8
      let new_price = 9000e8
      await btcPriceFeed.setPrice(strike_price)
      await hegicStripBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          24 * 3600,
          BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [24 * 3600 - 30 * 60 + 1])
      await expect(hegicStripBTC.connect(alice).exercise(0)).to.be.reverted
    })

    it("itm expired exercised amount", async () => {
      const {
        alice,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        pricerBTC,
        deployer,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      let strike_price = 3000e8
      let new_price = 8000e8
      await btcPriceFeed.setPrice(strike_price)
      await hegicStripBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          24 * 3600,
          BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
          0,
        )
      let balance_alice_after = await USDC.balanceOf(await alice.getAddress())
      await btcPriceFeed.setPrice(new_price)

      await ethers.provider.send("evm_increaseTime", [24 * 3600])
      await expect(hegicStripBTC.connect(alice).exercise(0)).to.be.reverted
    })

    it("less then min period", async () => {
      const {
        alice,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        pricerBTC,
        deployer,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      let strike_price = 3000e8
      let new_price = 8000e8
      await btcPriceFeed.setPrice(strike_price)
      await expect(
        hegicStripBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            86399,
            BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
            0,
          ),
      ).to.be.revertedWith("PriceCalculator: The period is too short")
    })

    it("more then max period", async () => {
      const {
        alice,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        pricerBTC,
        deployer,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      let strike_price = 3000e8
      let new_price = 8000e8
      await btcPriceFeed.setPrice(strike_price)
      await expect(
        hegicStripBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            86400 * 30 + 1,
            BN.from(ethers.utils.parseUnits("1", await WBTC.decimals())),
            0,
          ),
      ).to.be.revertedWith("PriceCalculator: The period is too long")
    })

    it("locked amount", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        HegicOperationalTreasury,
        pricerBTC,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate(BN.from("80000000000000000"))
      let strike_price = 5000e8
      let new_price = 7000e8
      await btcPriceFeed.setPrice(strike_price)
      await hegicStripBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          86400 * 9,
          BN.from(ethers.utils.parseUnits("3.45", await WBTC.decimals())),
          0,
        )
      expect(
        await HegicOperationalTreasury.lockedByStrategy(hegicStripBTC.address),
      ).to.be.eq(BN.from(24315.6e6))
    })

    it("utilization rate", async () => {
      const {
        alice,
        deployer,
        USDC,
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        HegicOperationalTreasury,
        pricerBTC,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate(BN.from("80000000000000000"))
      let strike_price = 5000e8
      let new_price = 7000e8
      await btcPriceFeed.setPrice(strike_price)
      let balance_alice_before = await USDC.balanceOf(await alice.getAddress())
      await hegicStripBTC
        .connect(alice)
        .buy(
          await alice.getAddress(),
          86400 * 30,
          BN.from(ethers.utils.parseUnits("50", await WBTC.decimals())),
          0,
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
        WBTC,
        btcPriceFeed,
        hegicStripBTC,
        HegicOperationalTreasury,
        pricerBTC,
      } = contracts
      await hegicStripBTC.setLimit(
        ethers.utils.parseUnits("1000000", await contracts.USDC.decimals()),
      )

      await pricerBTC
        .connect(deployer)
        .setImpliedVolRate(BN.from("80000000000000000"))
      let strike_price = 5000e8
      let new_price = 7000e8
      await btcPriceFeed.setPrice(strike_price)
      expect(
        hegicStripBTC
          .connect(alice)
          .buy(
            await alice.getAddress(),
            86400 * 30,
            BN.from(ethers.utils.parseUnits("77.7", await WBTC.decimals())),
            0,
          ),
      ).to.be.revertedWith("HegicStrategy: The limit is exceeded")
    })
  })
})
