import {HardhatRuntimeEnvironment} from "hardhat/types"
import {BigNumber as BN, utils} from "ethers"

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
    IVRates: [BN.from(80000), BN.from(87000), BN.from(92000), BN.from(97000)],
    borders: [11, 20, 30],

    roundedDecimals: 10,
    percent: 110,
    limit: 1000000e6,
    currency: "ETH",
  }

  const paramsBTC = {
    pool: Pool.address,
    priceProvider: PriceProviderBTC.address,
    spotDecimals: 8,
    IVRates: [
      BN.from("0"),
      BN.from("0"),
      BN.from("0"),
      BN.from("0"),
    ],
    borders: [11, 20, 30],
    roundedDecimals: 11,
    percent: 110,
    limit: 1000000e6,
    currency: "BTC",
  }

  async function deployOTM(params: typeof paramsETH) {
    const type = params.percent > 100 ? "CALL" : "PUT"
    const pricerName = `PriceCalculatorOTM_${type}_${params.percent}_${params.currency}`
    const strategyName = `HegicStrategyOTM_${type}_${params.percent}_${params.currency}`

    const pricer = await deploy(pricerName, {
      contract: "OtmPriceCalculator",
      from: deployer,
      log: true,
      args: [
        params.IVRates,
        params.borders,
        params.percent,
        params.priceProvider,
        params.roundedDecimals,
      ],
    })

    const strategy = await deploy(strategyName, {
      contract: params.percent > 100 ? "HegicStrategyCall" : "HegicStrategyPut",
      from: deployer,
      log: true,
      args: [
        params.pool,
        params.priceProvider,
        pricer.address,
        params.spotDecimals,
        params.limit,
      ],
    })
    await execute(
      "HegicOperationalTreasury",
      {log: true, from: deployer},
      "grantRole",
      STRATEGY_ROLE,
      strategy.address,
    )
  }

  await deployOTM({
    ...paramsETH,
    IVRates: [
      BN.from("13000"),
      BN.from("22000"),
      BN.from("25500"),
      BN.from("35000"),
    ],
    percent: 70,
  })
  await deployOTM({
    ...paramsETH,
    IVRates: [
      BN.from("29500"),
      BN.from("39000"),
      BN.from("45000"),
      BN.from("56000"),
    ],
    percent: 80,
  })
  await deployOTM({
    ...paramsETH,
    IVRates: [
      BN.from("77000"),
      BN.from("90000"),
      BN.from("105000"),
      BN.from("110000"),
    ],
    percent: 90,
  })
  await deployOTM({
    ...paramsETH,
    IVRates: [
      BN.from("60000"),
      BN.from("80000"),
      BN.from("95000"),
      BN.from("105000"),
    ],
    percent: 110,
  })
  await deployOTM({
    ...paramsETH,
    IVRates: [
      BN.from("19000"),
      BN.from("32000"),
      BN.from("45000"),
      BN.from("50000"),
    ],
    percent: 120,
  })
  await deployOTM({
    ...paramsETH,
    IVRates: [
      BN.from("12000"),
      BN.from("19000"),
      BN.from("25000"),
      BN.from("37000"),
    ],
    percent: 130,
  })

  await deployOTM({
    ...paramsBTC,
    IVRates: [
      BN.from("1200000000000000"),
      BN.from("2000000000000000"),
      BN.from("2500000000000000"),
      BN.from("3100000000000000"),
    ],
    percent: 70,
  })
  await deployOTM({
    ...paramsBTC,
    IVRates: [
      BN.from("2400000000000000"),
      BN.from("3400000000000000"),
      BN.from("3900000000000000"),
      BN.from("4800000000000000"),
    ],
    percent: 80,
  })
  await deployOTM({
    ...paramsBTC,
    IVRates: [
      BN.from("6200000000000000"),
      BN.from("7700000000000000"),
      BN.from("9100000000000000"),
      BN.from("10200000000000000"),
    ],
    percent: 90,
  })
  await deployOTM({
    ...paramsBTC,
    IVRates: [
      BN.from("5400000000000000"),
      BN.from("8300000000000000"),
      BN.from("9100000000000000"),
      BN.from("10200000000000000"),
    ],
    percent: 110,
  })
  await deployOTM({
    ...paramsBTC,
    IVRates: [
      BN.from("1900000000000000"),
      BN.from("2700000000000000"),
      BN.from("3800000000000000"),
      BN.from("5200000000000000"),
    ],
    percent: 120,
  })
  await deployOTM({
    ...paramsBTC,
    IVRates: [
      BN.from("600000000000000"),
      BN.from("1190000000000000"),
      BN.from("2190000000000000"),
      BN.from("2790000000000000"),
    ],
    percent: 130,
  })
}

deployment.tags = ["single-test", "single-otm"]
deployment.dependencies = [
  "operational-treasury",
  "options-manager",
  "single-prices",
]

export default deployment
