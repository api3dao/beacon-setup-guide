import { join } from 'path';
import { cliPrint, readIntegrationInfo, runAndHandleErrors, runShellCommand } from '../src';

const main = async () => {
  
  const airnodeDeploymentPath = join(__dirname, '../airnode-deployment');
  const secretsFilePath = join(__dirname, '../airnode-deployment/aws.env');

  const deployCommand = [
    `docker run -it --rm`,
    `-e USER_ID=$(id -u) -e GROUP_ID=$(id -g)`,
    `--env-file ${secretsFilePath}`,
    `-v ${airnodeDeploymentPath}:/app/output`,
    `api3/airnode-deployer:latest remove -r output/receipt.json`,
  ]
    .filter(Boolean)
    .join(' ');

  runShellCommand(deployCommand);
};

runAndHandleErrors(main);