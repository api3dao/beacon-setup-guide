import { execSync } from 'child_process';
import { join } from 'path';
import { copySync, existsSync, mkdirSync, readFileSync, writeFileSync, removeSync } from 'fs-extra';
import replace from 'replace-in-file';
import { readIntegrationInfo, removeExtension } from '../src/utils';
import { version } from '../package.json';
import { runAndHandleErrors } from '../src';

const main = async () => {
  const airnodeProtocolPath = join(__dirname, '../node_modules', '@api3/airnode-protocol');
  const network = readIntegrationInfo().network;

  const deploymentPath = join(__dirname, '../deployments', `${version}`, network + '.json');
  const deployment = JSON.parse(readFileSync(deploymentPath).toString());

  const verificationPath = join(__dirname, '../verify', `${version}`);
  if (!existsSync(verificationPath)) mkdirSync(verificationPath, { recursive: true });

  copySync(airnodeProtocolPath, join(verificationPath, '@api3/airnode-protocol'));

  Object.keys(deployment).forEach((key) => {
    let contractPath = join(verificationPath, key + '.sol');
    if (!existsSync(contractPath)) contractPath = join(__dirname, '../', key + '.sol');
    if (!existsSync(contractPath)) throw new Error(`Contract ${key} not found`);
    const contractName = contractPath.split('\\').pop().split('/').pop();
    const flatContractPath = join(verificationPath, removeExtension(contractName) + '.flat.sol');
    console.log('contractName', contractName);
    execSync(`hardhat flatten ${contractPath} > ${flatContractPath}`);

    replace.sync({
      files: flatContractPath,
      from: /.*SPDX-License-Identifier.*\n/g,
      to: '',
    });

    const flatContract = readFileSync(flatContractPath).toString().split('\n');
    flatContract.splice(0, 0, '// SPDX-License-Identifier: MIT');
    writeFileSync(flatContractPath, flatContract.join('\n'));
  });

  removeSync(join(verificationPath, '@api3'));
};

runAndHandleErrors(main);
