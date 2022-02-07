import { HardhatRuntimeEnvironment } from "hardhat/types"
import { utils } from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const { deployments, getNamedAccounts } = hre
  const { deploy, get, execute } = deployments
  const { deployer } = await getNamedAccounts()
  const STRATEGY_ROLE = utils.keccak256(utils.toUtf8Bytes("STRATEGY_ROLE"))

  const Pool = await get("HegicOperationalTreasury")
  const PriceProviderETH = await get("PriceProviderETH")
  const PriceProviderBTC = await get("PriceProviderBTC")

  const paramsETH = {
    pool: Pool.address,
    priceProvider: PriceProviderETH.address,
    spotDecimals: 18,
    IVRate0: 80000,
    IVRate1: 87000,
    roundedDecimals: 10,
    Percent: 110,
    limit: 100000e6,
  }

  const paramsBTC = {
    pool: Pool.address,
    priceProvider: PriceProviderBTC.address,
    spotDecimals: 8,
    IVRate0: 8000e12,
    IVRate1: 8000e12,
    roundedDecimals: 11,
    Percent: 110,
    limit: 100000e6,
  }

  const WETHOTMPricer = await deploy("PriceCalculatorOtmETH", {
    contract: "OtmAdaptivePriceCalculator",
    from: deployer,
    log: true,
    args: [paramsETH.IVRate0, paramsETH.IVRate1, paramsETH.roundedDecimals, paramsETH.Percent, paramsETH.priceProvider, paramsETH.pool],
  })

  const WBTCOTMPricer = await deploy("PriceCalculatorOtmBTC", {
    contract: "OtmAdaptivePriceCalculator",
    from: deployer,
    log: true,
    args: [paramsBTC.IVRate0, paramsBTC.IVRate1, paramsBTC.roundedDecimals, paramsBTC.Percent, paramsBTC.priceProvider, paramsBTC.pool],
  })


  const strategyCallETH = await deploy("HegicOtmStrategyCallETH", {
    contract: "HegicStrategyCall",
    from: deployer,
    log: true,
    args: [
      paramsETH.pool,
      paramsETH.priceProvider,
      WETHOTMPricer.address,
      paramsETH.spotDecimals,
      paramsETH.limit,
    ],
  })
  await execute(
    "HegicOperationalTreasury",
    { log: true, from: deployer },
    "grantRole",
    STRATEGY_ROLE,
    strategyCallETH.address,
  )

  const strategyPutETH = await deploy("HegicOtmStrategyPutETH", {
    contract: "HegicStrategyPut",
    from: deployer,
    log: true,
    args: [
      paramsETH.pool,
      paramsETH.priceProvider,
      WETHOTMPricer.address,
      paramsETH.spotDecimals,
      paramsETH.limit,
    ],
  })
  await execute(
    "HegicOperationalTreasury",
    { log: true, from: deployer },
    "grantRole",
    STRATEGY_ROLE,
    strategyPutETH.address,
  )

  const strategyCallBTC = await deploy("HegicOtmStrategyCallBTC", {
    contract: "HegicStrategyCall",
    from: deployer,
    log: true,
    args: [
      paramsBTC.pool,
      paramsBTC.priceProvider,
      WBTCOTMPricer.address,
      paramsBTC.spotDecimals,
      paramsBTC.limit,
    ],
  })
  await execute(
    "HegicOperationalTreasury",
    { log: true, from: deployer },
    "grantRole",
    STRATEGY_ROLE,
    strategyCallBTC.address,
  )

  const strategyPutBTC = await deploy("HegicOtmStrategyPutBTC", {
    contract: "HegicStrategyPut",
    from: deployer,
    log: true,
    args: [
      paramsBTC.pool,
      paramsBTC.priceProvider,
      WBTCOTMPricer.address,
      paramsBTC.spotDecimals,
      paramsBTC.limit,
    ],
  })
  await execute(
    "HegicOperationalTreasury",
    { log: true, from: deployer },
    "grantRole",
    STRATEGY_ROLE,
    strategyPutBTC.address,
  )

}

deployment.tags = ["single-test", "single-otm"]
deployment.dependencies = ["operational-treasury", "options-manager", "single-prices"]

export default deployment
