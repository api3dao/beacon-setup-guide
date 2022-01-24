import * as fs from 'fs';
import path, { join } from 'path';
import { readdirSync } from 'fs';
import tar from 'tar';
import { ethers } from 'ethers';
import * as abi from '@api3/airnode-abi';
import { deriveSponsorWalletAddress, verifyAirnodeXpub } from '@api3/airnode-admin';
import {
  cliPrint,
  deriveKeeperWalletPathFromSponsorAddress,
  getVersion,
  readIntegrationInfo,
  runAndHandleErrors,
  sanitiseFilename,
} from '../src';

// TODO types should be centralised
interface EthValue {
  amount: number;
  units: 'wei' | 'kwei' | 'mwei' | 'gwei' | 'szabo' | 'finney' | 'ether';
}

interface ChainDescriptor {
  readonly name: string;
  readonly apiProviderAirkeeperDeviationPercentage: number;
  readonly api3AirkeeperDeviationPercentage: number;
  readonly apiProviderUpdateRequesterMetadata: { address: string; threshold?: EthValue };
  readonly apiProviderAirnodeFulfillerMetadata: { address: string; threshold?: EthValue };
  readonly api3ProviderUpdateRequesterMetadata: { address: string; threshold?: EthValue };
}

interface BeaconDescriptor {
  readonly templateId: string;
  readonly parameters: string;
  readonly beaconId: string;
  readonly decodedParameters: { type: string; name: string; value: string }[];
  readonly chains: ChainDescriptor[];
}

export interface RrpBeaconServerKeeperTrigger {
  readonly templateId: string;
  readonly parameters: abi.InputParameter[];
  readonly endpointName: string;
  readonly oisTitle: string;
  readonly deviationPercentage: string;
  readonly keeperSponsor: string;
  readonly requestSponsor: string;
}

const writeBeaconDescriptor = (path: string, descriptor: BeaconDescriptor) => {
  fs.writeFileSync(path, JSON.stringify(descriptor, null, 2));
};

const readJsonFile = (filePath: string) => JSON.parse(fs.readFileSync(filePath).toString('utf8'));

const writeChains = (targetBasePath: string) => {
  const deployedChainsBasePath = join(__dirname, '../deployments', getVersion());
  const deployedChainContracts = readdirSync(deployedChainsBasePath).map((chainFilename) => {
    const chainName = path.parse(chainFilename).name;
    const contracts = readJsonFile(join(deployedChainsBasePath, chainFilename));
    const sanitisedContracts = {};

    for (const [key, value] of Object.entries(contracts)) {
      // eslint-disable-next-line functional/immutable-data
      sanitisedContracts[path.parse(key as string).name] = value;
    }

    return {
      ...sanitisedContracts,
      chainName,
    };
  });

  const keyedDeployedContracts = {};
  for (const chain of deployedChainContracts) {
    // eslint-disable-next-line functional/immutable-data
    keyedDeployedContracts[chain.chainName] = {
      ...chain,
      chainName: undefined,
    };
  }

  fs.writeFileSync(join(targetBasePath, 'chains.json'), JSON.stringify(keyedDeployedContracts, null, 2));
};

const main = async () => {
  const api3Xpub =
    'xpub6D1iGXrgPrJgY22N6bGFBC5TBpGedTNgWv6YH9vi1R76vS8F4SJLvwRipJDVHwssNjVYwJQCSkkQu4re3eUKV7NGYL4xW1zxXqTC5JEm9Rd';
  const apiName = fs.readdirSync(join(__dirname, '../airkeeper-deployment', 'templates', getVersion())).pop();

  if (!apiName) {
    cliPrint.error(`Can't determine apiName - the target folder is empty.`);
  }

  const templatesBasePath = join(__dirname, '../airkeeper-deployment', 'templates', getVersion(), apiName);

  const todaysDate = new Date().toISOString().split('T')[0];

  const targetBasePath = join(__dirname, '../', apiName);
  const targetTemplatesPath = join(targetBasePath, `templates`);
  const targetConfigBasePath = join(targetBasePath, `deployments`, todaysDate);
  const beaconsBasePath = join(targetBasePath, `beacons`);

  fs.rmdirSync(targetBasePath, { recursive: true });
  fs.mkdirSync(targetConfigBasePath, { recursive: true });
  fs.mkdirSync(beaconsBasePath);
  fs.mkdirSync(join(targetBasePath, `ois`));
  fs.mkdirSync(targetTemplatesPath);

  writeChains(targetBasePath);

  fs.readdirSync(templatesBasePath).map((sourceFile) => {
    const targetFile = join(targetTemplatesPath, sourceFile);
    fs.copyFileSync(join(templatesBasePath, sourceFile), targetFile);
  });

  const airnodeConfigObj = JSON.parse(
    fs.readFileSync(join(__dirname, '../airnode-deployment', 'config.json')).toString('utf8')
  );
  const targetOisPath = join(targetBasePath, 'ois', `${airnodeConfigObj.ois[0].version}.json`);
  const targetConfigJsonPath = join(targetConfigBasePath, 'config.json');
  fs.writeFileSync(targetOisPath, JSON.stringify(airnodeConfigObj.ois[0], null, 2));
  fs.writeFileSync(targetConfigJsonPath, JSON.stringify(airnodeConfigObj, null, 2));

  const targetAirkeeperConfigJsonPath = join(targetConfigBasePath, 'airkeeper.json');
  fs.copyFileSync(join(__dirname, '../airkeeper-deployment', 'airkeeper.json'), targetAirkeeperConfigJsonPath);

  const airkeeperConfigObj = JSON.parse(
    fs.readFileSync(join(__dirname, '../airkeeper-deployment', 'airkeeper.json')).toString('utf8')
  );
  const jobs = airkeeperConfigObj?.triggers?.rrpBeaconServerKeeperJobs as RrpBeaconServerKeeperTrigger[];
  if (!jobs) {
    cliPrint.error('Unable to locate airkeeper.json trigger/keeper jobs.');
    process.exit(1);
  }

  const receiptObj = readJsonFile(join(__dirname, '../airnode-deployment', 'receipt.json'));
  const apiMetadata = {
    xpub: receiptObj.airnodeWallet.airnodeXpub,
    active: true,
    airnode: receiptObj.airnodeWallet.airnodeAddress,
    contact: readIntegrationInfo().contact,
  };

  const templates = fs.readdirSync(templatesBasePath).map((sourceFile) => {
    return {
      ...readJsonFile(join(templatesBasePath, sourceFile)),
      sourceFile,
    };
  });

  const promisedBulkPayload = await Promise.all(
    jobs.map(async ({ templateId, parameters, endpointName, deviationPercentage, keeperSponsor, requestSponsor }) => {
      const templateObj = templates.find((template) => template.sourceFile === `${templateId}.json`);

      const hdNode = verifyAirnodeXpub(apiMetadata.xpub, templateObj.airnode);
      const keeperSponsorPath = deriveKeeperWalletPathFromSponsorAddress(keeperSponsor);
      const apiProviderUpdateRequester = hdNode.derivePath(keeperSponsorPath).address;

      const api3HdNode = ethers.utils.HDNode.fromExtendedKey(api3Xpub);
      const api3AirnodeAddress = api3HdNode.derivePath('0/0').address;
      const encodedParameters = abi.encode(parameters);
      const beaconId = ethers.utils.solidityKeccak256(['bytes32', 'bytes'], [templateId, encodedParameters]);
      const beaconDescriptor = {
        templateId,
        parameters: templateObj.parameters,
        decodedParameters: templateObj.decodedParameters,
        beaconId: beaconId,
        chains: await Promise.all(
          templateObj.chains.map(async (chainName: string): Promise<ChainDescriptor> => {
            return {
              name: chainName,
              apiProviderAirkeeperDeviationPercentage: parseFloat(deviationPercentage),
              api3AirkeeperDeviationPercentage: parseFloat(deviationPercentage) * 2,
              apiProviderUpdateRequesterMetadata: { address: apiProviderUpdateRequester },
              apiProviderAirnodeFulfillerMetadata: {
                address: await deriveSponsorWalletAddress(apiMetadata.xpub, templateObj.airnode, requestSponsor),
              },
              api3ProviderUpdateRequesterMetadata: {
                address: await deriveSponsorWalletAddress(api3Xpub, api3AirnodeAddress, requestSponsor),
              },
            };
          })
        ),
      };

      await writeBeaconDescriptor(
        join(beaconsBasePath, `${templateId}-${sanitiseFilename(endpointName)}.json`),
        beaconDescriptor
      );
      return beaconDescriptor;
    })
  );

  const fullDocumentationPayload = promisedBulkPayload.map((descriptor) => {
    const template = templates.find((template) => template.templateId === descriptor.templateId);
    const extraTemplateData = airnodeConfigObj.triggers.rrp.find(
      (trigger) => trigger.endpointId === template.endpointId
    );

    return {
      ...descriptor,
      template,
      extraTemplateData,
    };
  });

  const liteDocumentationPayload = promisedBulkPayload.map((descriptor) => {
    const template = templates.find((template) => template.templateId === descriptor.templateId);
    const extraTemplateData = airnodeConfigObj.triggers.rrp.find(
      (trigger) => trigger.endpointId === template.endpointId
    );

    return {
      templateParameters: template.decodedParameters
        .filter((template) => template.name.indexOf('_') === -1 || template.name.indexOf('_path') > -1)
        .map(({ name, value }) => ({ name, value })),
      templateId: template.templateId,
      oisTitle: extraTemplateData.oisTitle,
      endpointName: extraTemplateData.endpointName,
      beaconId: descriptor.beaconId,
    };
  });

  fs.writeFileSync(join(targetBasePath, 'documentation_full.json'), JSON.stringify(fullDocumentationPayload, null, 2));
  fs.writeFileSync(
    join(targetBasePath, 'documentation_beacons_lite.json'),
    JSON.stringify(liteDocumentationPayload, null, 2)
  );

  const gzipArchivePath = `${targetBasePath}.tgz`;
  fs.rmSync(gzipArchivePath, { force: true });
  await tar.c(
    {
      gzip: true,
      file: gzipArchivePath,
      portable: true,
      preservePaths: false,
    },
    [apiName]
  );
  fs.rmdirSync(targetBasePath, { recursive: true });
  cliPrint.warning(`An archive file has been saved at ${gzipArchivePath}
Please send this file to your API3 representative - and thank you for your deployment.`);
};

runAndHandleErrors(main);
