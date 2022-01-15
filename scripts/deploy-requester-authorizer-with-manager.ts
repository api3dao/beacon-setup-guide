import parseArgs from 'minimist';
import { cliPrint, deployContract, runAndHandleErrors, getUserWallet, getDeployedContract } from '../src';

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  let adminRoleDescription = args.adminRoleDescription || 'admin';

  const OwnableCallForwarder = await getDeployedContract('/contracts/OwnableCallForwarder.sol');
  const AccessControlRegistry = await getDeployedContract(
    '@api3/airnode-protocol/contracts/access-control-registry/AccessControlRegistry.sol'
  );
  const RequesterAuthorizerWithManager = await deployContract(
    '@api3/airnode-protocol/contracts/authorizers/RequesterAuthorizerWithManager.sol',
    [AccessControlRegistry.address, adminRoleDescription, OwnableCallForwarder.address]
  );
  cliPrint.info(`RequesterAuthorizerWithManager deployed to address: ${RequesterAuthorizerWithManager.address}`);
};

runAndHandleErrors(main);
