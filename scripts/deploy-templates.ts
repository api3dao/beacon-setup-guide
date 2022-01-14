import {
  cliPrint,
  getDeployedContract,
  getProvider,
  readIntegrationInfo,
  runAndHandleErrors
} from "../src";
import {createTemplate} from "@api3/airnode-admin";
import {AirnodeRrp} from "@api3/airnode-protocol";
import {ethers} from "ethers";

const main = async () => {
  const provider = getProvider()
  const integrationInfo = await readIntegrationInfo();
  const airnodeRootWallet = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(provider);

  const airnodeRrpInstance = ((await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol')) as AirnodeRrp)
    .connect(airnodeRootWallet);
  cliPrint.info(`The Deployed AirnodeRrp Contract's Address: ${airnodeRrpInstance.address}`);

  const pairs = [
    'eth_dai',
    'dai_usd',
    'usdc_usd',
    'usdt_usd',
    'usdt_eth',
    'usdc_eth',
    'eth_btc',
    'eth_usd',
    'btc_usd'
  ];

  const tickerTemplate = {
    "airnode": airnodeRootWallet.address,
    "endpointId": "0x3718f9f03845bab74e16647b30034960eab7cb5fcff451651f3624fff6974026",
    "parameters": [
      {"name": "_path", "type": "bytes32", "value": "payload.vwap,"},
      {"name": "_type", "type": "bytes32", "value": "int256,timestamp"},
      {"name": "_times", "type": "bytes32", "value": "1000000,"}
    ]
  };
  const fastGasTemplate = {
    "airnode": airnodeRootWallet.address,
    "endpointId": "0xba235f3d64620681803410e4a63999e103f2ffac3f6533bb3693b5c98c4c1810",
    "parameters": [
      {"name": "_path", "type": "bytes32", "value": "payload.fast.gasPrice,"},
      {"name": "_type", "type": "bytes32", "value": "int256,timestamp"}
    ]
  };

  const templates = [...pairs.map(pair =>
    ({
      ...tickerTemplate,
      parameters: [
        ...tickerTemplate.parameters,
        {"name": "pair", "type": "bytes32", "value": pair},
      ]
    })
  ),
    fastGasTemplate
  ];

  for (const template of templates) {
    cliPrint.info(`Creating template with these parameters: ${JSON.stringify(template.parameters, null, 2)}`);
    const templateId = await createTemplate(airnodeRrpInstance, template);
    cliPrint.info(`Template ID/Hash: ${templateId}`);
  }
};

runAndHandleErrors(main);
