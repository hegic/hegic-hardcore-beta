import {HardhatRuntimeEnvironment} from "hardhat/types"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const {deploy, get} = deployments
  const {deployer} = await getNamedAccounts()

  const params = {
    BTCPrice: 50000e8,
    ETHPrice: 2500e8,
  }

  await deploy("PriceProviderBTC", {
    contract: "PriceProviderMock",
    from: deployer,
    log: true,
    args: [params.BTCPrice, 8],
  })

  await deploy("PriceProviderETH", {
    contract: "PriceProviderMock",
    from: deployer,
    log: true,
    args: [params.ETHPrice, 8],
  })
}

deployment.tags = ["test-single", "single-prices"]
// deployment.dependencies = ["tokens-single", "options-manager"]

export default deployment
