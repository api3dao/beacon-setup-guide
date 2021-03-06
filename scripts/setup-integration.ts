import { writeFileSync } from 'fs';
import { join } from 'path';
import { PromptObject } from 'prompts';
import { cliPrint, IntegrationInfo, promptQuestions, runAndHandleErrors, sanitiseFilename } from '../src';

// NOTE: We could add "initial" field with the contents of current integration-info.json, but we already use the
// "initial value" semantics for hinting mnemonic and provider URL.
const questions: PromptObject[] = [
  {
    type: 'text',
    name: 'apiName',
    message: [
      'Please enter a short name for your deployment:',
      '',
      'The name should be filesystem-safe, eg. no special characters',
    ].join('\n'),
    initial: 'Amberdata',
    format: sanitiseFilename,
  },
  {
    type: 'text',
    name: 'contact',
    message: [
      'Please enter an email address as a primary contact should API3 need to communicate with your organisation',
      'in an emergency (eg. your API has gone down or is malfunctioning):',
    ].join('\n'),
    initial: 'john@data-provider.com',
  },
  {
    type: 'text',
    name: 'network',
    message: 'Select target blockchain network',
    initial: () => 'ropsten / localhost',
  },
  {
    type: 'text',
    name: 'mnemonic',
    message: [
      'Since you chose testnet network, we need an account with testnet funds to connect to the blockchain.',
      '',
      'IMPORTANT: DO NOT ENTER A MNEMONIC LINKED WITH MAINNET ACCOUNTS!!!',
      '',
      'Enter the testnet mnemonic phrase:',
    ].join('\n'),
    initial: (_prev, values) =>
      // The default hardhat mnemonic. See: https://hardhat.org/hardhat-network/reference/#config
      values.network === 'localhost' ? 'test test test test test test test test test test test junk' : '',
  },
  {
    type: 'text',
    name: 'providerUrl',
    message: 'Enter a provider URL:',
    initial: (_prev, values) => {
      // Hardhat network runs by default run on http://127.0.0.1:8545/
      if (values.network === 'localhost') return 'http://127.0.0.1:8545/';
      if (values.network === 'ropsten') return 'https://eth-ropsten.gateway.pokt.network/v1/lb/<APP_ID>';
      return '';
    },
  },
];

/**
 * Ask the user for the integration choice and return them as an object.
 */
const chooseIntegration = async (): Promise<IntegrationInfo> => {
  const response = await promptQuestions(questions);
  return response as IntegrationInfo;
};

const main = async () => {
  const integration = await chooseIntegration();
  writeFileSync(join(__dirname, '../integration-info.json'), JSON.stringify(integration, null, 2));
  cliPrint.info(`A file 'integration-info.json' was created!`);
};

runAndHandleErrors(main);
