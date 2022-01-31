import * as fs from 'fs';
import path, { join } from 'path';
import { readdirSync } from 'fs';
import tar from 'tar';
import { ethers } from 'ethers';
import * as abi from '@api3/airnode-abi';
import { PromptObject } from 'prompts';
import { ingestTemplateDescriptions } from './ingest-template-descriptions';
import {
  cliPrint,
  getApiName,
  getVersion,
  promptQuestions,
  readIntegrationInfo,
  readJsonFile,
  runAndHandleErrors,
} from '../src';

// TODO types should be centralised if possible
interface EthValue {
  amount: number;
  units: 'wei' | 'kwei' | 'mwei' | 'gwei' | 'szabo' | 'finney' | 'ether';
}

export interface AddressMetadata {
  address: string;
  threshold?: EthValue;
}

export interface ChainDescriptor {
  readonly name: string;
  readonly api3AirkeeperSponsor?: AddressMetadata;
  readonly apiProviderAirkeeperSponsor?: AddressMetadata;
  readonly sponsor: AddressMetadata; // aka address used to derive Airnode controlled wallet
  readonly apiProviderAirkeeperDeviationPercentage: number;
  readonly api3AirkeeperDeviationPercentage: number;
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
  const apiName = getApiName();
  if (!apiName) {
    cliPrint.error(`Can't determine apiName - the target folder is empty.`);
  }

  const questions: PromptObject[] = [
    {
      type: 'select',
      name: 'enterNames',
      message: [
        'Consumers of your data feeds will benefit from data feed templates having descriptive names.',
        'Would you like to enter these names now?',
      ].join('\n'),
      choices: [
        { title: 'yes', value: 'yes' },
        { title: 'no', value: 'no' },
      ],
    },
  ];
  if ((await promptQuestions(questions)).enterNames === 'yes') {
    await ingestTemplateDescriptions();
  } else {
    cliPrint.info('You have chosen to not enter template names. You can enter these at a later stage ');
    cliPrint.info('by running "yarn name-templates"');
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

  fs.writeFileSync(join(targetBasePath, 'apiMetadata.json'), JSON.stringify(apiMetadata, null, 2));

  const templates = fs.readdirSync(templatesBasePath).map((sourceFile) => {
    return {
      ...readJsonFile(join(templatesBasePath, sourceFile)),
      sourceFile,
      name: path.parse(sourceFile).name,
    };
  });

  const promisedBulkPayload = await Promise.all(
    jobs.map(async ({ templateId, parameters, deviationPercentage, keeperSponsor, requestSponsor }) => {
      const templateObj = templates.find((template) => template.templateId === templateId);

      const encodedParameters = abi.encode(parameters);
      const beaconId = ethers.utils.solidityKeccak256(['bytes32', 'bytes'], [templateId, encodedParameters]);
      const beaconDescriptor = {
        templateId,
        templateName: templateObj.name,
        parameters: templateObj.parameters,
        decodedParameters: templateObj.decodedParameters,
        beaconId: beaconId,
        chains: await Promise.all(
          templateObj.chains.map(async (chainName: string): Promise<ChainDescriptor> => {
            return {
              name: chainName,
              sponsor: { address: requestSponsor },
              apiProviderAirkeeperDeviationPercentage: parseFloat(deviationPercentage),
              api3AirkeeperDeviationPercentage: parseFloat(deviationPercentage) * 2,
              apiProviderAirkeeperSponsor: { address: keeperSponsor },
            };
          })
        ),
      };

      await writeBeaconDescriptor(join(beaconsBasePath, templateObj.name), beaconDescriptor);
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
      templateName: template.name,
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
