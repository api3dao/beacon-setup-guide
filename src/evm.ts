import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { ethers } from 'ethers';
import { readIntegrationInfo, removeExtension } from './utils';
import { cliPrint } from './cli';
import { version } from '../package.json';

/**
 * @returns The ethers provider connected to the provider URL specified in the "integration-info.json".
 */
export const getProvider = () => {
  const integrationInfo = readIntegrationInfo();
  return new ethers.providers.JsonRpcProvider(integrationInfo.providerUrl);
};

/**
 * Reads the mnemonic and provider URL from "integration-info.json" and returns the connected wallet.
 *
 * @returns The connected wallet.
 */
export const getUserWallet = () => {
  const integrationInfo = readIntegrationInfo();
  const provider = getProvider();
  return ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);
};

/**
 * Reads the compiled solidity artifact necessary for contract deployment.
 *
 * @param artifactsFolderPath
 * @returns The compiled artifact
 */
const getArtifact = (artifactsFolderPath: string) => {
  const fullArtifactsPath = join(__dirname, '../artifacts/', artifactsFolderPath);
  const files = readdirSync(fullArtifactsPath);
  const artifactName = files.find((f) => !f.endsWith('.dbg.json'))!;
  const artifactPath = join(fullArtifactsPath, artifactName);
  return require(artifactPath);
};

/**
 * Deploys the contract specified by the path to the artifact and constructor arguments. This method will also write the
 * address of the deployed contract which can be used to connect to the contract.
 *
 * @param artifactsFolderPath
 * @param args Arguments for the contract constructor to be deployed
 * @returns The deployed contract
 */
export const deployContract = async (artifactsFolderPath: string, args: any[] = []) => {
  try {
    const existingContract = await getDeployedContract(artifactsFolderPath);
    if (existingContract.address) {
      cliPrint.info(`An existing instance of this contract is present - re-using existing deployment.`);
      return existingContract;
    }
  } catch (e) {
    /* do nothing */
  }
  const artifact = getArtifact(artifactsFolderPath);

  // Deploy the contract
  const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, await getUserWallet());
  const contract = await contractFactory.deploy(...args);
  await contract.deployed();

  // Make sure the deployments folder exist
  const deploymentsPath = join(__dirname, '../deployments', `${version}`);
  if (!existsSync(deploymentsPath)) mkdirSync(deploymentsPath, { recursive: true });

  // Try to load the existing deployments file for this network - we want to preserve deployments of other contracts
  const network = readIntegrationInfo().network;
  const deploymentPath = join(deploymentsPath, network + '.json');
  let deployment: any = {};
  if (existsSync(deploymentPath)) deployment = JSON.parse(readFileSync(deploymentPath).toString());

  // The key name for this contract is the path of the artifact without the '.sol' extension
  const deploymentName = removeExtension(artifactsFolderPath);
  // Write down the address of deployed contract
  writeFileSync(deploymentPath, JSON.stringify({ ...deployment, [deploymentName]: contract.address }, null, 2));

  return contract;
};

/**
 * Connect to the already deployed contract specified by the path to the compiled contract artifact.
 *
 * @param artifactsFolderPath
 * @returns The deployed contract
 */
export const getDeployedContract = async (artifactsFolderPath: string, wallet: ethers.Wallet = getUserWallet()) => {
  const artifact = getArtifact(artifactsFolderPath);

  const network = readIntegrationInfo().network;
  const deploymentPath = join(__dirname, '../deployments', `${version}`, network + '.json');
  const deployment = JSON.parse(readFileSync(deploymentPath).toString());
  const deploymentName = removeExtension(artifactsFolderPath);

  return new ethers.Contract(deployment[deploymentName], artifact.abi, wallet);
};

/**
 * @returns The chain id of the chosen network
 */
export const readChainId = async () => {
  const network = await getProvider().getNetwork();
  return network.chainId;
};

// TODO This is from Airkeeper
export const deriveKeeperWalletPathFromSponsorAddress = (sponsorAddress: string): string => {
  const sponsorAddressBN = ethers.BigNumber.from(ethers.utils.getAddress(sponsorAddress));
  const paths = [];
  for (let i = 0; i < 6; i++) {
    const shiftedSponsorAddressBN = sponsorAddressBN.shr(31 * i);
    paths.push(shiftedSponsorAddressBN.mask(31).toString());
  }
  return `12345/${paths.join('/')}`;
};

// TODO This is from Airkeeper
export const deriveKeeperSponsorWallet = (
  airnodeHdNode: ethers.utils.HDNode,
  sponsorAddress: string,
  provider: ethers.providers.Provider
): ethers.Wallet => {
  const sponsorWalletHdNode = airnodeHdNode.derivePath(
    `m/44'/60'/0'/${deriveKeeperWalletPathFromSponsorAddress(sponsorAddress)}`
  );
  return new ethers.Wallet(sponsorWalletHdNode.privateKey).connect(provider);
};
