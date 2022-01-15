import parseArgs from 'minimist';
import { createTemplate, deriveAirnodeXpub, deriveSponsorWalletAddress } from '@api3/airnode-admin';
import { encode } from '@api3/airnode-abi';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { AirnodeRrp } from '@api3/airnode-protocol';
import { ethers, Wallet } from 'ethers';
import * as node from '@api3/airnode-node';
import {
  cliPrint,
  deriveKeeperSponsorWallet,
  getDeployedContract,
  getProvider,
  readIntegrationInfo,
  runAndHandleErrors,
  getVersion,
  readConfigKeeper,
} from '../src';

const main = async () => {
  const args = parseArgs(process.argv.slice(2), { string: ['sponsorMnemonic', 'keeperSponsorMnemonic'] });

  const integrationInfo = readIntegrationInfo();
  const configJson = readConfigKeeper();
  const airnodeHDNode = ethers.utils.HDNode.fromMnemonic(integrationInfo.mnemonic);
  const keeperSponsor =
    (args.keeperSponsorMnemonic && ethers.Wallet.fromMnemonic(args.keeperSponsorMnemonic)) ||
    new Wallet(airnodeHDNode.derivePath(`m/45'/60'/0'/0/0`)).connect(getProvider());
  const keeperSponsorWallet = deriveKeeperSponsorWallet(airnodeHDNode, keeperSponsor.address, getProvider()).connect(
    getProvider()
  );
  const sponsor =
    (args.sponsorMnemonic && ethers.Wallet.fromMnemonic(args.sponsorMnemonic)) ||
    ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(getProvider());
  const airnodeXpub = deriveAirnodeXpub(integrationInfo.mnemonic);
  cliPrint.info(`Airnode XPub: ${airnodeXpub}`);

  const requestSponsorWallet = node.evm.deriveSponsorWallet(airnodeHDNode, sponsor.address).connect(getProvider());
  cliPrint.info(`Keeper Sponsor Wallet: ${keeperSponsorWallet.address}`);
  cliPrint.info(`Request Sponsor Wallet: ${requestSponsorWallet.address}`);

  const templatePath = join(__dirname, '../airkeeper-deployment', 'templates.json');
  if (!existsSync(templatePath)) return cliPrint.error('Templates.json do not exist');
  const templates = JSON.parse(readFileSync(templatePath).toString());

  // TODO: Match chains in config.json with chains in airkeeperConfig
  const airkeeperConfig = {
    chains: [
      {
        contracts: {
          RrpBeaconServer: (
            await getDeployedContract('@api3/airnode-protocol/contracts/rrp/requesters/RrpBeaconServer.sol')
          ).address,
        },
      },
    ],
    triggers: {
      rrpBeaconServerKeeperJobs: templates.map((template) => {
        const templateId = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['address', 'bytes32', 'bytes'],
            [template.airnode, template.endpointId, encode(template.parameters)]
          )
        );
        const oisTitle = configJson.triggers.rrp.filter((trigger) => trigger.endpointId === template.endpointId)[0]
          .oisTitle;
        const endpointName = configJson.triggers.rrp.filter((trigger) => trigger.endpointId === template.endpointId)[0]
          .endpointName;
        return {
          templateId,
          parameters: [],
          oisTitle: oisTitle,
          endpointName: endpointName,
          deviationPercentage: '1',
          keeperSponsor: keeperSponsor.address,
          requestSponsor: sponsor.address,
        };
      }),
    },
  };

  const airkeeperConfigPath = join(__dirname, '../airkeeper-deployment', 'airkeeper.json');
  await writeFileSync(airkeeperConfigPath, JSON.stringify(airkeeperConfig, null, 2));
};

runAndHandleErrors(main);
