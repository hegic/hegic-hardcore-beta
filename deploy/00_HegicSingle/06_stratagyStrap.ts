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
    IVRate: 550000,
    limit: 1000000e6,
  }

  const paramsBTC = {
    pool: Pool.address,
    priceProvider: PriceProviderBTC.address,
    spotDecimals: 8,
    IVRate: "61000000000000000",
    limit: 1000000e6,
  }

  const WETHSTRAPPricer = await deploy("PriceCalculatorStrapETH", {
    contract: "PriceCalculator",
    from: deployer,
    log: true,
    args: [paramsETH.IVRate, paramsETH.priceProvider],
  })

  const WBTCSTRAPPricer = await deploy("PriceCalculatorStrapBTC", {
    contract: "PriceCalculator",
    from: deployer,
    log: true,
    args: [paramsBTC.IVRate, paramsBTC.priceProvider],
  })

  const strategyETH = await deploy("HegicStrategyStrapETH", {
    contract: "HegicStrategyStrap",
    from: deployer,
    log: true,
    args: [
      paramsETH.pool,
      paramsETH.priceProvider,
      WETHSTRAPPricer.address,
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

  const strategyBTC = await deploy("HegicStrategyStrapBTC", {
    contract: "HegicStrategyStrap",
    from: deployer,
    log: true,
    args: [
      paramsBTC.pool,
      paramsBTC.priceProvider,
      WBTCSTRAPPricer.address,
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

deployment.tags = ["single-test", "single-strap"]
deployment.dependencies = [
  "operational-treasury",
  "options-manager",
  "single-prices",
]

export default deployment
