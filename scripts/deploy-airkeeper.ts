import { join } from 'path';
import { runAndHandleErrors, runShellCommand } from '../src';

const main = async () => {
  const airkeeperDeploymentPath = join(__dirname, '../airkeeper-deployment');
  const secretsFilePath = join(__dirname, '../airkeeper-deployment/aws.env');
  const deployCommand = [
    `docker run -it --rm`,
    `--env-file ${secretsFilePath}`,
    `--env COMMAND=deploy`,
    `-v ${airkeeperDeploymentPath}:/airkeeper/config`,
    `-v ${airkeeperDeploymentPath}:/airkeeper/output`,
    `aquarat/airkeeper`,
  ].join(' ');

  runShellCommand(deployCommand);
};

runAndHandleErrors(main);
