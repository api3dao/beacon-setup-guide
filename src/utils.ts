import { readFileSync } from 'fs';
import { join } from 'path';
import { ethers } from 'ethers';
import { parse as parseEnvFile } from 'dotenv';
import prompts, { PromptObject } from 'prompts';

export interface IntegrationInfo {
  network: string;
  mnemonic: string;
  providerUrl: string;
}

/**
 * @returns The contents of the "integration-info.json" file (throws if it doesn't exist)
 */
export const readIntegrationInfo = (): IntegrationInfo =>
  JSON.parse(readFileSync(join(__dirname, '../integration-info.json')).toString());

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
 * @returns The contents of the "config.json" file for the current integration (throws if it doesn't exist)
 */
 export const readConfig = () => {
  const integrationInfo = readIntegrationInfo();

  const config = JSON.parse(
    readFileSync(join(__dirname, `../airnode-deployment/config.json`)).toString()
  );
  return config;
};

/**
 * @param interfaceMethod The interface of the method to be called
 * @param methodName the name of the method to be called
 * @param args the arguments to be passed to the method
 * @returns The callData of the method to be called with its arguments encoded
 */
export const generateCallData = (interfaceMethod: string , methodName: string, args: any[]) => {
  return new ethers.utils.Interface([interfaceMethod]).getSighash(methodName) + 
    (args && args.length > 0 ? ethers.utils.defaultAbiCoder.encode(args.map(a => a[0]), args.map(a => a[1])).replace(/^0x/, '') : '');
}
