import { ethers } from 'ethers';
import parseArgs from 'minimist';
import { cliPrint, runAndHandleErrors, getUserWallet, getDeployedContract, generateCallData } from '../src';

const main = async () => {
  const args = parseArgs(process.argv.slice(2), {
    string: ['managerMnemonic', 'airnode', 'endpointId'],
    boolean: ['status'],
  });

  const managerWallet = (args.managerMnemonic && ethers.Wallet.fromMnemonic(args.managerMnemonic)) || getUserWallet();

  const RequesterAuthorizerWithManager = await getDeployedContract(
    '@api3/airnode-protocol/contracts/authorizers/RequesterAuthorizerWithManager.sol'
  );

  const RrpBeaconServer = await getDeployedContract(
    '@api3/airnode-protocol/contracts/rrp/requesters/RrpBeaconServer.sol'
  );

  const OwnableCallForwarder = await getDeployedContract('/contracts/OwnableCallForwarder.sol', managerWallet);

  const callData = generateCallData(
    'function setIndefiniteWhitelistStatus(address,bytes32,address,bool)',
    'setIndefiniteWhitelistStatus',
    [
      ['address', args.airnode],
      ['bytes32', args.endpointId],
      ['address', RrpBeaconServer.address],
      ['bool', args.status],
    ]
  );

  await OwnableCallForwarder.forwardCall(RequesterAuthorizerWithManager.address, callData);

  cliPrint.info(`indefinite whitelist status of address:${RrpBeaconServer.address} has been set to status:${args.status}
    for endpoint:${args.endpointId} on airnode:${args.airnode} by manager:${managerWallet.address}`);
};

runAndHandleErrors(main);
