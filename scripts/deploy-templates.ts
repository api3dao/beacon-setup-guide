import { createTemplate, deriveAirnodeXpub, deriveSponsorWalletAddress } from '@api3/airnode-admin';
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
} from '../src';

const main = async () => {
  const provider = getProvider();
  const integrationInfo = await readIntegrationInfo();
  const airnodeRootWallet = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);

  const airnodeRrpInstance = (
    (await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol')) as AirnodeRrp
  ).connect(airnodeRootWallet);
  cliPrint.info(`The Deployed AirnodeRrp Contract's Address: ${airnodeRrpInstance.address}`);

  const pairs = ['eth_dai', 'dai_usd', 'usdc_usd', 'usdt_usd', 'usdt_eth', 'usdc_eth', 'eth_btc', 'eth_usd', 'btc_usd'];

  const tickerTemplate = {
    airnode: airnodeRootWallet.address,
    endpointId: '0x3718f9f03845bab74e16647b30034960eab7cb5fcff451651f3624fff6974026',
    parameters: [
      { name: '_path', type: 'bytes32', value: 'payload.vwap,' },
      { name: '_type', type: 'bytes32', value: 'int256,timestamp' },
      { name: '_times', type: 'bytes32', value: '1000000,' },
    ],
  };
  const fastGasTemplate = {
    airnode: airnodeRootWallet.address,
    endpointId: '0xba235f3d64620681803410e4a63999e103f2ffac3f6533bb3693b5c98c4c1810',
    parameters: [
      { name: '_path', type: 'bytes32', value: 'payload.fast.gasPrice,' },
      { name: '_type', type: 'bytes32', value: 'int256,timestamp' },
    ],
  };

  const templates = [
    ...pairs.map((pair) => ({
      ...tickerTemplate,
      parameters: [...tickerTemplate.parameters, { name: 'pair', type: 'bytes32', value: pair }],
    })),
    fastGasTemplate,
  ];

  const templatesWithIds = [];
  for (const templateIdx in templates) {
    cliPrint.info(
      `Creating template with these parameters: ${JSON.stringify(templates[templateIdx].parameters, null, 2)}`
    );
    const templateId = await createTemplate(airnodeRrpInstance, templates[templateIdx]);
    cliPrint.info(`Template ID/Hash: ${templateId}`);
    templatesWithIds.push({
      template: templates[templateIdx],
      templateId: templateId,
    });
  }

  // TODO this has been copied from set-permissions and should be abstracted
  const airnodeHDNode = ethers.utils.HDNode.fromMnemonic(integrationInfo.mnemonic);
  const keeperSponsor = new Wallet(airnodeHDNode.derivePath(`m/45'/60'/0'/0/0`)).connect(getProvider());

  const keeperSponsorWallet = deriveKeeperSponsorWallet(airnodeHDNode, keeperSponsor.address, provider).connect(
    provider
  );

  const sponsor = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);
  const airnodeXpub = deriveAirnodeXpub(airnodeRootWallet.mnemonic.phrase);
  cliPrint.info(`Airnode XPub: ${airnodeXpub}`);

  const sponsorWalletAddress = await deriveSponsorWalletAddress(
    airnodeXpub,
    airnodeRootWallet.address,
    sponsor.address
  );

  const requestSponsorWallet = node.evm.deriveSponsorWallet(airnodeHDNode, sponsorWalletAddress).connect(provider);
  cliPrint.info(`Keeper Sponsor Wallet: ${keeperSponsorWallet.address}`);
  cliPrint.info(`Request Sponsor Wallet: ${requestSponsorWallet.address}`);

  // TODO wallets here *must* be double-checked
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
      rrpBeaconServerKeeperJobs: templatesWithIds.map((template) => {
        return {
          templateId: template.templateId,
          parameters: [],
          oisTitle: template.oisTitle,
          endpointName: template.endpointName,
          deviationPercentage: '1',
          keeperSponsor: keeperSponsorWallet.address,
          requestSponsor: requestSponsorWallet.address,
        };
      }),
    },
  };

  console.log(JSON.stringify(airkeeperConfig, null, 2));
};

runAndHandleErrors(main);
