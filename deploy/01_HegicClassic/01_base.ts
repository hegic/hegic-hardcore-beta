import {HardhatRuntimeEnvironment} from "hardhat/types"
import {HegicPool} from "../../typechain/HegicPool"
import {OptionsManager} from "../../typechain/OptionsManager"

const ETHIVRate = 7e11

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts, ethers} = hre
  const {deploy, get} = deployments
  const {deployer} = await getNamedAccounts()

  const HEGIC = await get("HEGIC")
  const USDC = await get("USDC")
  const WETH = await get("WETH")
  const WBTC = await get("WBTC")
  const BTCPriceProvider = await get("WBTCPriceProvider")
  const ETHPriceProvider = await get("ETHPriceProvider")

  const OptionsManager = await deploy("OptionsManager", {
    from: deployer,
    log: true,
  })

  await deploy("Exerciser", {
    from: deployer,
    log: true,
    args: [OptionsManager.address],
  })

  const WBTCStaking = await deploy("WBTCStaking", {
    contract: "HegicStaking",
    from: deployer,
    log: true,
    args: [HEGIC.address, WBTC.address, "WBTC Staking", "WBTC S"],
  })

  const WETHStaking = await deploy("WETHStaking", {
    contract: "HegicStaking",
    from: deployer,
    log: true,
    args: [HEGIC.address, WETH.address, "WBTC Staking", "WETH S"],
  })

  const USDCStaking = await deploy("USDCStaking", {
    contract: "HegicStaking",
    from: deployer,
    log: true,
    args: [HEGIC.address, USDC.address, "USDC Staking", "USDC S"],
  })

  const HegicAtmCall_WETH = await deploy("HegicWETHCALL", {
    contract: "HegicCALL",
    from: deployer,
    log: true,
    args: [
      WETH.address,
      "Hegic ETH ATM Calls Pool",
      "ETHCALLSPOOL",
      OptionsManager.address,
      ethers.constants.AddressZero,
      WETHStaking.address,
      ETHPriceProvider.address,
    ],
  })

  const HegicAtmPut_WETH = await deploy("HegicWETHPUT", {
    contract: "HegicPUT",
    from: deployer,
    log: true,
    args: [
      USDC.address,
      "Hegic ETH ATM Puts Pool",
      "ETHPUTSPOOL",
      OptionsManager.address,
      ethers.constants.AddressZero,
      USDCStaking.address,
      ETHPriceProvider.address,
      18,
      6,
    ],
  })

  const HegicAtmCall_WBTC = await deploy("HegicWBTCCALL", {
    contract: "HegicCALL",
    from: deployer,
    log: true,
    args: [
      WBTC.address,
      "Hegic WBTC ATM Calls Pool",
      "WBTCCALLSPOOL",
      OptionsManager.address,
      ethers.constants.AddressZero,
      WBTCStaking.address,
      BTCPriceProvider.address,
    ],
  })

  const HegicAtmPut_WBTC = await deploy("HegicWBTCPUT", {
    contract: "HegicPUT",
    from: deployer,
    log: true,
    args: [
      USDC.address,
      "Hegic WBTC ATM Puts Pool",
      "WBTCPUTSPOOL",
      OptionsManager.address,
      ethers.constants.AddressZero,
      USDCStaking.address,
      BTCPriceProvider.address,
      8,
      6,
    ],
  })
  //
  // const HegicAtmStraddle_WETH = await deploy("HegicWETHSTRADDLE", {
  //   contract: "HegicSTRADDLE",
  //   from: deployer,
  //   log: true,
  //   args: [
  //     USDC.address,
  //     "Hegic ETH ATM Staddle Pool",
  //     "ETHSTRADDLEPOOL",
  //     OptionsManager.address,
  //     ethers.constants.AddressZero,
  //     WETHStaking.address,
  //     ETHPriceProvider.address,
  //     18,
  //   ],
  // })
  //
  // const HegicAtmStrap_WETH = await deploy("HegicWETHSTRAP", {
  //   contract: "HegicSTRAP",
  //   from: deployer,
  //   log: true,
  //   args: [
  //     USDC.address,
  //     "Hegic ETH ATM Staddle Pool",
  //     "ETHSTRAPPOOL",
  //     OptionsManager.address,
  //     ethers.constants.AddressZero,
  //     WETHStaking.address,
  //     ETHPriceProvider.address,
  //     18,
  //   ],
  // })
  //
  // const HegicAtmStrip_WETH = await deploy("HegicWETHSTRIP", {
  //   contract: "HegicSTRIP",
  //   from: deployer,
  //   log: true,
  //   args: [
  //     USDC.address,
  //     "Hegic ETH ATM Staddle Pool",
  //     "ETHSTRIPPOOL",
  //     OptionsManager.address,
  //     ethers.constants.AddressZero,
  //     WETHStaking.address,
  //     ETHPriceProvider.address,
  //     18,
  //   ],
  // })

  // const WETHSTRADDLEPricer = await deploy("ETHStraddlePriceCalculator", {
  //   contract: "PriceCalculator",
  //   from: deployer,
  //   log: true,
  //   args: [ETHIVRate, ETHPriceProvider.address],
  // })
  //
  // const WETHSTRAPPricer = await deploy("ETHStrapPriceCalculator", {
  //   contract: "PriceCalculator",
  //   from: deployer,
  //   log: true,
  //   args: [ETHIVRate, ETHPriceProvider.address],
  // })
  //
  // const WETHSTRIPPricer = await deploy("ETHStripPriceCalculator", {
  //   contract: "PriceCalculator",
  //   from: deployer,
  //   log: true,
  //   args: [ETHIVRate, ETHPriceProvider.address],
  // })
  //
  // const HegicAtmStraddle_WETHInstance = (await ethers.getContract(
  //   "HegicWETHSTRADDLE",
  // )) as HegicPool
  //
  // const HegicAtmStrap_WETHInstance = (await ethers.getContract(
  //   "HegicWETHSTRAP",
  // )) as HegicPool
  //
  // const HegicAtmStrip_WETHInstance = (await ethers.getContract(
  //   "HegicWETHSTRIP",
  // )) as HegicPool

  const optionsManagerInstance = (await ethers.getContract(
    "OptionsManager",
  )) as OptionsManager

  await optionsManagerInstance.grantRole(
    await optionsManagerInstance.HEGIC_POOL_ROLE(),
    HegicAtmCall_WETH.address,
  )

  await optionsManagerInstance.grantRole(
    await optionsManagerInstance.HEGIC_POOL_ROLE(),
    HegicAtmPut_WETH.address,
  )

  await optionsManagerInstance.grantRole(
    await optionsManagerInstance.HEGIC_POOL_ROLE(),
    HegicAtmCall_WBTC.address,
  )

  await optionsManagerInstance.grantRole(
    await optionsManagerInstance.HEGIC_POOL_ROLE(),
    HegicAtmPut_WBTC.address,
  )
  //
  // await optionsManagerInstance.grantRole(
  //   await optionsManagerInstance.HEGIC_POOL_ROLE(),
  //   HegicAtmStraddle_WETH.address,
  // )
  //
  // await optionsManagerInstance.grantRole(
  //   await optionsManagerInstance.HEGIC_POOL_ROLE(),
  //   HegicAtmStrap_WETH.address,
  // )
  //
  // await optionsManagerInstance.grantRole(
  //   await optionsManagerInstance.HEGIC_POOL_ROLE(),
  //   HegicAtmStrip_WETH.address,
  // )
  //
  // await HegicAtmStraddle_WETHInstance.setPriceCalculator(
  //   WETHSTRADDLEPricer.address,
  // )
  //
  // await HegicAtmStrap_WETHInstance.setPriceCalculator(WETHSTRAPPricer.address)
  // await HegicAtmStrip_WETHInstance.setPriceCalculator(WETHSTRIPPricer.address)
}

deployment.tags = ["test", "base"]
deployment.dependencies = ["tokens"]
export default deployment
