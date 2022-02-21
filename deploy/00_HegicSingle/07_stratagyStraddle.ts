import {HardhatRuntimeEnvironment} from "hardhat/types"
import {utils} from "ethers"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const {deploy, get, execute} = deployments
  const {deployer} = await getNamedAccounts()
  const STRATEGY_ROLE = utils.keccak256(utils.toUtf8Bytes("STRATEGY_ROLE"))

  const Pool = await get("HegicOperationalTreasury")
  const PriceProviderETH = await get("PriceProviderETH")
  const PriceProviderBTC = await get("PriceProviderBTC")

  const paramsETH = {
    pool: Pool.address,
    priceProvider: PriceProviderETH.address,
    spotDecimals: 18,
    IVRate: 340000,
    limit: 1000000e6,
  }

  const paramsBTC = {
    pool: Pool.address,
    priceProvider: PriceProviderBTC.address,
    spotDecimals: 8,
    IVRate: "41000000000000000",
    limit: 100000e6,
  }

  const WETHSTRADDLEPricer = await deploy("PriceCalculatorStraddleETH", {
    contract: "PriceCalculator",
    from: deployer,
    log: true,
    args: [paramsETH.IVRate, paramsETH.priceProvider],
  })

  const WBTCSTRADDLEPricer = await deploy("PriceCalculatorStraddleBTC", {
    contract: "PriceCalculator",
    from: deployer,
    log: true,
    args: [paramsBTC.IVRate, paramsBTC.priceProvider],
  })

  const strategyETH = await deploy("HegicStrategyStraddleETH", {
    contract: "HegicStrategyStraddle",
    from: deployer,
    log: true,
    args: [
      paramsETH.pool,
      paramsETH.priceProvider,
      WETHSTRADDLEPricer.address,
      paramsETH.spotDecimals,
      paramsETH.limit,
    ],
  })
  await execute(
    "HegicOperationalTreasury",
    {log: true, from: deployer},
    "grantRole",
    STRATEGY_ROLE,
    strategyETH.address,
  )

  const strategyBTC = await deploy("HegicStrategyStraddleBTC", {
    contract: "HegicStrategyStraddle",
    from: deployer,
    log: true,
    args: [
      paramsBTC.pool,
      paramsBTC.priceProvider,
      WBTCSTRADDLEPricer.address,
      paramsBTC.spotDecimals,
      paramsBTC.limit,
    ],
  })
  await execute(
    "HegicOperationalTreasury",
    {log: true, from: deployer},
    "grantRole",
    STRATEGY_ROLE,
    strategyBTC.address,
  )
}

deployment.tags = ["single-test", "single-straddle"]
deployment.dependencies = [
  "operational-treasury",
  "options-manager",
  "single-prices",
]

export default deployment
