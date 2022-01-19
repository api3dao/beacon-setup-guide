import { join } from 'path';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import parseArgs from 'minimist';
import { deriveAirnodeXpub } from '@api3/airnode-admin';
import { ethers, Wallet } from 'ethers';
import * as node from '@api3/airnode-node';
import {
  cliPrint,
  deriveKeeperSponsorWallet,
  getDeployedContract,
  getProvider,
  readIntegrationInfo,
  runAndHandleErrors,
  readConfigAirnode,
  getVersion,
} from '../src';

const main = async () => {
  const args = parseArgs(process.argv.slice(2), { string: ['sponsorMnemonic', 'keeperSponsorMnemonic', 'apiName'] });
  if (!args.apiName) return cliPrint.error('Please specify an apiName');
  const integrationInfo = readIntegrationInfo();
  const configJson = readConfigAirnode();
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

  const templatePath = join(__dirname, '../airkeeper-deployment', 'templates', `${getVersion()}`, args.apiName);
  const templates = readdirSync(templatePath).map((file) => {
    return {
      templateId: file,
      ...JSON.parse(readFileSync(join(templatePath, file)).toString()),
    };
  });

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
        const oisTitle = configJson.triggers.rrp.find((trigger) => trigger.endpointId === template.endpointId).oisTitle;
        const endpointName = configJson.triggers.rrp.find(
          (trigger) => trigger.endpointId === template.endpointId
        ).endpointName;
        return {
          templateId: template.templateId,
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
