import parseArgs from 'minimist';
import { cliPrint, deployContract, runAndHandleErrors, getUserWallet, getDeployedContract } from '../src';

const main = async () => {
  const args = parseArgs(process.argv.slice(2), { string: ['manager'] });

  const managerAddress = args.manager || getUserWallet().address;
  const adminRoleDescription = args.adminRoleDescription || 'rrpbeacon admin';

  const AirnodeRrp = await getDeployedContract('@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol');
  const AccessControlRegistry = await getDeployedContract(
    '@api3/airnode-protocol/contracts/access-control-registry/AccessControlRegistry.sol'
  );
  const RrpBeaconServer = await deployContract('@api3/airnode-protocol/contracts/rrp/requesters/RrpBeaconServer.sol', [
    AccessControlRegistry.address,
    adminRoleDescription,
    managerAddress,
    AirnodeRrp.address,
  ]);
  console.log(RrpBeaconServer);
  cliPrint.info(`RrpBeaconServer deployed to address: ${RrpBeaconServer.address}`);
};

runAndHandleErrors(main);
