import path, { join } from 'path';
import fs from 'fs';
import { cliPrint, getApiName, getVersion, promptQuestions, readJsonDirectoryAsArray, sanitiseFilename } from '../src';

export const ingestTemplateDescriptions = async () => {
  const apiName = getApiName();

  const templatesBasePath = join(__dirname, '../airkeeper-deployment', 'templates', getVersion(), apiName);
  const originalTemplates = readJsonDirectoryAsArray(templatesBasePath);

  for (const templateIdx in originalTemplates) {
    const template = originalTemplates[templateIdx];
    cliPrint.info(`Template ${parseInt(templateIdx) + 1} of ${originalTemplates.length}`);
    cliPrint.info(
      JSON.stringify(
        {
          ...template,
          parameters: undefined,
          chains: undefined,
          filename: undefined,
        },
        null,
        2
      )
    );

    const file = path.parse(template.filename);
    const newName = sanitiseFilename(
      (
        await promptQuestions([
          {
            type: 'text',
            name: 'name',
            message: 'Please enter a name for the above template (press enter to accept displayed name):',
            initial: file.name,
          },
        ])
      ).name
    );
    const filename = `${newName}.${file.ext.substring(1)}`;

    const newTemplate = {
      ...template,
      filename,
    };

    fs.writeFileSync(
      join(templatesBasePath, `${newTemplate.filename}.tmp`),
      JSON.stringify(
        {
          ...newTemplate,
          filename: undefined,
        },
        null,
        2
      )
    );
    fs.rmSync(join(templatesBasePath, template.filename));
    fs.renameSync(
      join(templatesBasePath, `${newTemplate.filename}.tmp`),
      join(templatesBasePath, `${newTemplate.filename}`)
    );
  }
};
