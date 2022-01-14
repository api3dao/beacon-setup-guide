import { readFileSync } from 'fs';
import { join } from 'path';
import { ethers } from 'ethers';
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
