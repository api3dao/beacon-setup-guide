import { writeFileSync } from 'fs';
import { join } from 'path';
import { Config, LocalOrCloudProvider } from '@api3/airnode-node';
import { cliPrint, getDeployedContract, readChainId } from '../src';

export const createCloudProviderConfiguration = (generateExampleFile: boolean): LocalOrCloudProvider => {
  if (generateExampleFile) {
    return {
      type: 'local',
    };
  }

  return {
    type: 'aws',
    region: 'us-east-1',
  };
};

export const getAirnodeRrpAddress = async (generateExampleFile: boolean) => {
  if (generateExampleFile) return '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  const airnodeRrp = await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol');
  return airnodeRrp.address;
};

export const getChainId = async (generateExampleFile: boolean) =>
  (generateExampleFile ? 31337 : await readChainId()).toString();

export const createNodeVersion = () => {
  return '0.3.1';
};

export const generateConfigFile = (dirname: string, config: Config, generateExampleFile: boolean) => {
  const filename = generateExampleFile ? 'config.example.json' : 'config.json';
  writeFileSync(join(dirname, filename), JSON.stringify(config, null, 2) + '\n');

  cliPrint.info(`A '${filename}' has been created.`);
};
