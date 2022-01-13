import { join } from 'path';
import { runAndHandleErrors, runShellCommand } from '../src';

const main = async () => {

  const airnodeDeploymentPath = join(__dirname, '../airnode-deployment');
  const secretsFilePath = join(__dirname, '../airnode-deployment/aws.env');
  const deployCommand = [
    `docker run -it --rm`,
    `-e USER_ID=$(id -u) -e GROUP_ID=$(id -g)`,
    `--env-file ${secretsFilePath}`,
    `-v ${airnodeDeploymentPath}:/app/config`,
    `-v ${airnodeDeploymentPath}:/app/output`,
    `api3/airnode-deployer:0.3.1 deploy`,
  ]
    .filter(Boolean)
    .join(' ');

  runShellCommand(deployCommand);
};

runAndHandleErrors(main);