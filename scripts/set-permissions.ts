import {
  cliPrint,
  getDeployedContract,
  getProvider,
  readIntegrationInfo,
  runAndHandleErrors
} from "../src";
import {deriveAirnodeXpub, deriveSponsorWalletAddress} from "@api3/airnode-admin";
import {AirnodeRrp, RrpBeaconServer} from "@api3/airnode-protocol";
import {ethers, Wallet} from "ethers";
import {parseEther} from "ethers/lib/utils";
import * as node from '@api3/airnode-node';

export const fundAWallet = async (provider: ethers.providers.JsonRpcProvider, sourceWallet: Wallet,
                                  destinationAddress: string, lowThreshold = parseEther('0.09'),
                                  amountToSend = parseEther('0.1')) => {
  const balance = await sourceWallet.getBalance();
  if (balance.lt(amountToSend)) throw new Error(`Sponsor account (${sourceWallet.address}) doesn't have enough funds!`);

  const destinationBalance = await provider.getBalance(destinationAddress);
  if (destinationBalance.gt(lowThreshold)) {
    console.log(`Destination wallet ${destinationAddress} has sufficient funds: ${destinationBalance.toString()}`);
    return;
  }

  console.log(`Destination wallet ${destinationAddress} does not have sufficient funds: ${destinationBalance.toString()}`);
  console.log(`Sending funds...`);
  const tx = await sourceWallet.sendTransaction({to: destinationAddress, value: amountToSend});
  console.log("Waiting on confirmation");
  await tx.wait(1);
  cliPrint.info(`Successfully sent funds to sponsor wallet address: ${destinationAddress}.`);
  const destinationBalanceAfterTx = ethers.utils.formatEther(await provider.getBalance(destinationAddress));
  cliPrint.info(`Current balance: ${destinationBalanceAfterTx}`);
};

export const deriveKeeperWalletPathFromSponsorAddress = (sponsorAddress: string): string => {
  const sponsorAddressBN = ethers.BigNumber.from(ethers.utils.getAddress(sponsorAddress));
  const paths = [];
  for (let i = 0; i < 6; i++) {
    const shiftedSponsorAddressBN = sponsorAddressBN.shr(31 * i);
    paths.push(shiftedSponsorAddressBN.mask(31).toString());
  }
  return `12345/${paths.join('/')}`;
};

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

const main = async () => {
  const provider = getProvider()
  const integrationInfo = await readIntegrationInfo();
  const airnodeRootWallet = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);
  const airnodeHDNode = ethers.utils.HDNode.fromMnemonic(integrationInfo.mnemonic);
  const keeperSponsor = new Wallet(airnodeHDNode.derivePath(`m/45'/60'/0'/0/0`)).connect(getProvider());

  const keeperSponsorWallet = deriveKeeperSponsorWallet(airnodeHDNode, keeperSponsor.address, provider).connect(
    provider
  );

  const airnodeRrpInstance = ((await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol')) as AirnodeRrp).connect(airnodeRootWallet);
  cliPrint.info(`Deployed AirnodeRrp: ${airnodeRrpInstance.address}`);

  const sponsor = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);
  const airnodeXpub = deriveAirnodeXpub(airnodeRootWallet.mnemonic.phrase);
  console.log(`Airnode XPub: ${airnodeXpub}`);

  const sponsorWalletAddress = await deriveSponsorWalletAddress(
    airnodeXpub,
    airnodeRootWallet.address,
    sponsor.address
  );

  const requestSponsorWallet = node.evm.deriveSponsorWallet(airnodeHDNode, sponsorWalletAddress).connect(provider);
  console.log({keeperSponsorWallet, requestSponsorWallet});

  await fundAWallet(provider, airnodeRootWallet, sponsorWalletAddress);
  await fundAWallet(provider, airnodeRootWallet, keeperSponsorWallet.address);

  console.log(`Giving the beacon updater permission to the request wallet ${keeperSponsorWallet}`);
  const beacon = (await getDeployedContract('@api3/airnode-protocol/contracts/rrp/requesters/RrpBeaconServer.sol'))
    .connect(sponsor.connect(getProvider())) as RrpBeaconServer;
  const tx = await beacon.setUpdatePermissionStatus(keeperSponsorWallet.address, true);
  console.log('Waiting for confirmation');
  await tx.wait(1);
  console.log('got confirmation');
};

runAndHandleErrors(main);
