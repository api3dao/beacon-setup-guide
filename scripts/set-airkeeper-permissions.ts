import { deriveAirnodeXpub, deriveSponsorWalletAddress } from '@api3/airnode-admin';
import { AirnodeRrp, RrpBeaconServer } from '@api3/airnode-protocol';
import { ethers, Wallet } from 'ethers';
import * as node from '@api3/airnode-node';
import {
  cliPrint,
  deriveKeeperSponsorWallet,
  fundAWallet,
  getDeployedContract,
  getProvider,
  readIntegrationInfo,
  runAndHandleErrors,
} from '../src';

const main = async () => {
  const provider = getProvider();
  const integrationInfo = await readIntegrationInfo();
  const airnodeRootWallet = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);
  const airnodeHDNode = ethers.utils.HDNode.fromMnemonic(integrationInfo.mnemonic);
  const keeperSponsor = new Wallet(airnodeHDNode.derivePath(`m/45'/60'/0'/0/0`)).connect(getProvider());

  const keeperSponsorWallet = deriveKeeperSponsorWallet(airnodeHDNode, keeperSponsor.address, provider).connect(
    provider
  );

  const airnodeRrpInstance = (
    (await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol')) as AirnodeRrp
  ).connect(airnodeRootWallet);
  cliPrint.info(`Deployed AirnodeRrp: ${airnodeRrpInstance.address}`);

  const sponsor = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);
  const airnodeXpub = deriveAirnodeXpub(airnodeRootWallet.mnemonic.phrase);
  cliPrint.info(`Airnode XPub: ${airnodeXpub}`);

  const requestSponsorWallet = node.evm.deriveSponsorWallet(airnodeHDNode, sponsor.address).connect(getProvider());
  cliPrint.info(`Keeper Sponsor Wallet: ${keeperSponsorWallet.address}`);
  cliPrint.info(`Request Sponsor Wallet: ${requestSponsorWallet.address}`);

  await fundAWallet(provider, airnodeRootWallet, requestSponsorWallet.address);
  await fundAWallet(provider, airnodeRootWallet, keeperSponsorWallet.address);

  cliPrint.info(`Now checking if ${keeperSponsorWallet.address} has beacon updater permission...`);
  const beacon = (
    await getDeployedContract('@api3/airnode-protocol/contracts/rrp/requesters/RrpBeaconServer.sol')
  ).connect(sponsor.connect(getProvider())) as RrpBeaconServer;

  if (await beacon.sponsorToUpdateRequesterToPermissionStatus(sponsor.address, keeperSponsorWallet.address)) {
    cliPrint.info(`Beacon updater already has the updater permission.`);
  } else {
    cliPrint.info(`Giving the beacon updater permission to the request wallet ${keeperSponsorWallet.address}`);
    const tx = await beacon.setUpdatePermissionStatus(keeperSponsorWallet.address, true);
    cliPrint.info('Waiting for confirmation on-chain...');
    await tx.wait(1);
    cliPrint.info('Got on-chain confirmation!');

    cliPrint.info(`Double-checking that ${keeperSponsorWallet.address} has beacon updater permission...`);
    if (await beacon.sponsorToUpdateRequesterToPermissionStatus(sponsor.address, keeperSponsorWallet.address)) {
      cliPrint.info(`Beacon updater has the updater permission`);
    } else cliPrint.info(`Beacon updater DOES NOT have the updater permission, something went wrong.`);
  }

  cliPrint.info(`Now checking if RrpBeaconServer has has been sponsored`);

  const airnodeRrp = (await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol')).connect(
    sponsor.connect(getProvider())
  ) as AirnodeRrp;

  if (await airnodeRrp.sponsorToRequesterToSponsorshipStatus(sponsor.address, beacon.address)) {
    cliPrint.info(`RrpBeaconServer has been sponsored`);
    process.exit(0);
  }
  cliPrint.info(`Sponsoring RrpBeaconServer`);
  const tx = await airnodeRrp.setSponsorshipStatus(beacon.address, true);
  cliPrint.info('Waiting for confirmation on-chain...');
  await tx.wait(1);
  cliPrint.info('Got on-chain confirmation!');

  cliPrint.info(`Double-checking that RrpBeaconServer has been sponsored`);
  if (await airnodeRrp.sponsorToRequesterToSponsorshipStatus(sponsor.address, beacon.address)) {
    cliPrint.info(`RrpBeaconServer has been sponsored`);
  } else cliPrint.info(`RrpBeaconServer hasn't been sponsored, something went wrong`);
};

runAndHandleErrors(main);
