import { HardhatRuntimeEnvironment } from "hardhat/types"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const { deployments, getNamedAccounts, network } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy("USDC", {
    contract: "ERC20Mock",
    from: deployer,
    log: true,
    args: ["USDC (Mock)", "USDC", 6],
  })

  await deploy("WETH", {
    contract: "ERC20Mock",
    from: deployer,
    log: true,
    args: ["WETH (Mock)", "WETH", 18],
  })

  await deploy("WBTC", {
    contract: "ERC20Mock",
    from: deployer,
    log: true,
    args: ["WBTC (Mock)", "WBTC", 8],
  })

  await deploy("HEGIC", {
    contract: "ERC20Mock",
    from: deployer,
    log: true,
    args: ["HEGIC (Mock)", "HEGIC", 18],
  })
}

deployment.tags = ["test-single", "single-tokens"]
export default deployment
