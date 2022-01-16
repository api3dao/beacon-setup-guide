import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import parseArgs from 'minimist';
import * as airnodeAbi from '@api3/airnode-abi';
import { getAirnodeRrp, createTemplate } from '@api3/airnode-admin';
import { cliPrint, runAndHandleErrors, getVersion, getDeployedContract, readIntegrationInfo } from '../src';

const main = async () => {
  const args = parseArgs(process.argv.slice(2), { string: ['apiName'] });
  if (!args.apiName) return cliPrint.error('Please specify an apiName');
  const templateFilePath = join(__dirname, '../airkeeper-deployment/templates.json');
  const integrationInfo = readIntegrationInfo();
  const AirnodeRrpContract = await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol');
  const AirnodeRrp = await getAirnodeRrp(integrationInfo.providerUrl, {
    airnodeRrpAddress: AirnodeRrpContract.address,
    signer: { mnemonic: integrationInfo.mnemonic },
  });

  const templates = JSON.parse(readFileSync(templateFilePath).toString());
  const createdTemplatesPath = join(__dirname, '../airkeeper-deployment', 'templates', `${getVersion()}`, args.apiName);
  if (!existsSync(createdTemplatesPath)) mkdirSync(createdTemplatesPath, { recursive: true });

  for await (const template of templates) {
    const templateId = await createTemplate(AirnodeRrp, template);
    cliPrint.info(`Template ${templateId} created`);
    const createdTemplatePath = join(createdTemplatesPath, templateId + '.json');
    let deployedTemplate: any = {};
    if (existsSync(createdTemplatePath)) deployedTemplate = JSON.parse(readFileSync(createdTemplatePath).toString());
    const chains = new Set(deployedTemplate.chains).add(integrationInfo.network);
    await writeFileSync(
      createdTemplatePath,
      JSON.stringify(
        {
          ...template,
          templateId,
          parameters: airnodeAbi.encode(template.parameters),
          decodedParameters: template.parameters,
          chains: Array.from(chains),
        },
        null,
        2
      )
    );
  }
};

runAndHandleErrors(main);
