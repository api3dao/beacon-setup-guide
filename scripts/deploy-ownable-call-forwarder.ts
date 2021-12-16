import parseArgs from "minimist";
import { cliPrint, deployContract, runAndHandleErrors } from '../src';

const main = async () => {
    
  const args = parseArgs(process.argv.slice(2),{string:["manager"]});

  const OwnableCallForwarder = await deployContract('/contracts/OwnableCallForwarder.sol');
  cliPrint.info(`OwnableCallForwarder deployed to address: ${OwnableCallForwarder.address}`);

  if(args.manager) await OwnableCallForwarder.transferOwnership(args.manager);
};

runAndHandleErrors(main);
