import { cliPrint, deployContract, runAndHandleErrors } from '../src';

const main = async () => {
  const AccessControlRegistry = await deployContract('@api3/airnode-protocol/contracts/access-control-registry/AccessControlRegistry.sol');
  cliPrint.info(`AccessControlRegistry deployed to address: ${AccessControlRegistry.address}`);
};

runAndHandleErrors(main);
