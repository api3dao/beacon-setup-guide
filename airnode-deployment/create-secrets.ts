import { getCommonSecrets, writeSecrets } from './secrets-utils';
import { runAndHandleErrors } from '../src';

const createSecrets = async (generateExampleFile = false) => {
  const secrets = await getCommonSecrets(generateExampleFile);

  writeSecrets(__dirname, secrets, generateExampleFile);
};

runAndHandleErrors(createSecrets);
