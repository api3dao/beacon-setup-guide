import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ethers, Wallet } from 'ethers';
import { parse as parseEnvFile } from 'dotenv';
import prompts, { PromptObject } from 'prompts';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { cliPrint } from './cli';
import { version } from '../package.json';

export interface IntegrationInfo {
  readonly apiName: string;
  readonly contact: string;
  readonly network: string;
  readonly mnemonic: string;
  readonly providerUrl: string;
}

/**
 * @returns The contents of the "integration-info.json" file (throws if it doesn't exist)
 */
export const readIntegrationInfo = (): IntegrationInfo =>
  JSON.parse(readFileSync(join(__dirname, '../integration-info.json')).toString());

/**
 *
 * @returns The version of the beacon deployment
 */
export const getVersion = (): string => version;

/**
 * @param filename
 * @returns The "filename" with the last extension removed
 */
export const removeExtension = (filename: string) => filename.split('.')[0];

export const promptQuestions = (questions: PromptObject[]) =>
  prompts(questions, {
    // https://github.com/terkelg/prompts/issues/27#issuecomment-527693302
    onCancel: () => {
      throw new Error('Aborted by the user');
    },
  });

/**
 * @returns The contents of the "aws.env" file (throws if it doesn't exist)
 */
export const readAwsSecrets = () => parseEnvFile(readFileSync(join(__dirname, '../airnode-deployment/aws.env')));

/**
 * @param secrets The lines of the secrets file
 * @returns All the lines joined followed by a new line symbol
 */
export const formatSecrets = (secrets: string[]) => secrets.join('\n') + '\n';

/**
 * @returns The contents of the "config.json" file for the current integration during Airnode deployment (throws if it doesn't exist)
 */
export const readConfigAirnode = () =>
  JSON.parse(readFileSync(join(__dirname, `../airnode-deployment/config.json`)).toString());

/**
 * @returns The contents of the "config.json" file for the current integration during Airkeeper deployment (throws if it doesn't exist)
 */
export const readConfigKeeper = () =>
  JSON.parse(readFileSync(join(__dirname, `../airnode-deployment/config.json`)).toString());

/**
 * @param interfaceMethod The interface of the method to be called
 * @param methodName the name of the method to be called
 * @param args the arguments to be passed to the method
 * @returns The callData of the method to be called with its arguments encoded
 */
export const generateCallData = (interfaceMethod: string, methodName: string, args: any[]) => {
  return (
    new ethers.utils.Interface([interfaceMethod]).getSighash(methodName) +
    (args && args.length > 0
      ? ethers.utils.defaultAbiCoder
          .encode(
            args.map((a) => a[0]),
            args.map((a) => a[1])
          )
          .replace(/^0x/, '')
      : '')
  );
};

// TODO This should be in a utils file or equivalent
export const fundAWallet = async (
  provider: ethers.providers.JsonRpcProvider,
  sourceWallet: Wallet,
  destinationAddress: string,
  lowThreshold = parseEther('0.09'),
  amountToSend = parseEther('0.1')
) => {
  const balance = await sourceWallet.getBalance();
  if (balance.lt(amountToSend)) throw new Error(`Sponsor account (${sourceWallet.address}) doesn't have enough funds!`);

  const destinationBalance = await provider.getBalance(destinationAddress);
  if (destinationBalance.gt(lowThreshold)) {
    cliPrint.info(
      `Destination wallet ${destinationAddress} has sufficient funds, so we won't send funds: ${formatEther(
        destinationBalance
      )} ETH`
    );
    return;
  }

  cliPrint.info(
    `Destination wallet ${destinationAddress} has less funds than threshold, so we will transfer funds to it: ${formatEther(
      destinationBalance
    )} ETH`
  );
  cliPrint.info(`Sending funds...`);
  const tx = await sourceWallet.sendTransaction({ to: destinationAddress, value: amountToSend });
  cliPrint.info('Waiting on confirmation');
  await tx.wait(1);
  cliPrint.info(`Successfully sent funds to sponsor wallet address: ${destinationAddress}.`);
  const destinationBalanceAfterTx = ethers.utils.formatEther(await provider.getBalance(destinationAddress));
  cliPrint.info(`Current balance: ${destinationBalanceAfterTx}`);
};

export const sanitiseFilename = (filename: string) => {
  const illegalRe = /[\/?<>\\:*|"]/g;
  // eslint-disable-next-line no-control-regex
  const controlRe = /[\x00-\x1f\x80-\x9f]/g;
  const reservedRe = /^\.+$/;
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

  return filename
    .replace(illegalRe, '_')
    .replace(controlRe, '_')
    .replace(reservedRe, '_')
    .replace(windowsReservedRe, '_')
    .toLocaleLowerCase();
};

export const getApiName = () => {
  const apiName = readdirSync(join(__dirname, '../airkeeper-deployment', 'templates', getVersion()))?.pop();
  if (!apiName) {
    throw new Error(
      `Unable to detect API name - please check ${join(__dirname, '../airkeeper-deployment', 'templates')}`
    );
  }

  return apiName;
};

interface FilePayload {
  readonly filename: string;
}

export const readJsonFile = (filePath: string) => JSON.parse(readFileSync(filePath).toString('utf8'));

export const readJsonDirectoryAsArray = (directoryPath: string): Partial<FilePayload>[] =>
  readdirSync(directoryPath).map((filename) => ({
    ...readJsonFile(join(directoryPath, filename)),
    filename,
  }));
