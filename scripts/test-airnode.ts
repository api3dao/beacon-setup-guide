import { ethers } from "ethers";
import {
  deriveSponsorWalletAddress,
  deriveAirnodeXpub,
} from "@api3/airnode-admin";
import {
  readIntegrationInfo,
  getProvider,
  deployContract,
  getAirnodeWallet,
  getDeployedContract,
  readConfig,
  runAndHandleErrors,
  runShellCommand,
  cliPrint,
} from "../src";

const main = async () => {
  const integrationInfo = readIntegrationInfo();
  const airnodeRrp = await getDeployedContract(
    "@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol"
  );

  const requester = await deployContract(`contracts/Requester.sol`, [
    airnodeRrp.address,
  ]);
  cliPrint.info(`Requester deployed to address: ${requester.address}`);

  const airnodeWallet = getAirnodeWallet();
  const provider = getProvider();
  const sponsor = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic).connect(
    provider
  );
  // NOTE: When doing this manually, you can use the 'derive-airnode-xpub' from the admin CLI package
  const airnodeXpub = deriveAirnodeXpub(airnodeWallet.mnemonic.phrase);

  // Derive the sponsor wallet address programatically
  // NOTE: When doing this manually, you can use the 'derive-sponsor-wallet-address' from the admin CLI package
  const sponsorWalletAddress = await deriveSponsorWalletAddress(
    airnodeXpub,
    airnodeWallet.address,
    sponsor.address
  );

  // Fund the derived sponsor wallet using sponsor account
  const balance = await sponsor.getBalance();
  const amountToSend = ethers.utils.parseEther("0.1");
  if (balance.lt(amountToSend))
    throw new Error(
      `Sponsor account (${sponsor.address}) doesn't have enough funds!`
    );
  const tx = await sponsor.sendTransaction({
    to: sponsorWalletAddress,
    value: amountToSend,
  });
  await tx.wait();

  // Print out the sponsor wallet address and balance
  const sponsorWalletRawBalance = await provider.getBalance(
    sponsorWalletAddress
  );
  const sponsorWalletBalance = ethers.utils.formatEther(
    sponsorWalletRawBalance
  );
  cliPrint.info(
    `Successfully sent funds to sponsor wallet address: ${sponsorWalletAddress}.`
  );
  cliPrint.info(`Current balance: ${sponsorWalletBalance}`);

  const command = [
    `yarn airnode-admin sponsor-requester`,
    `--provider-url ${integrationInfo.providerUrl}`,
    `--airnode-rrp ${airnodeRrp.address}`,
    `--requester-address ${requester.address}`,
    `--sponsor-mnemonic "${integrationInfo.mnemonic}"`,
  ].join(" ");
  runShellCommand(command);


  cliPrint.info('Making request...');
  const requestId = await makeRequest();
  cliPrint.info('Waiting for fulfillment...');
  await fulfilled(requestId);
  cliPrint.info('Request fulfilled');

  // Import the function to print the response from the chosen integration. See the respective "request-utils.ts" for
  // details.
  const { printResponse } = await import(`../airnode-deployment/request-utils`);
  await printResponse(requestId);
};

const fulfilled = async (requestId: string) => {
  const airnodeRrp = await getDeployedContract(
    "@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol"
  );
  const provider = getProvider();
  return new Promise((resolve) =>
    provider.once(airnodeRrp.filters.FulfilledRequest(null, requestId), resolve)
  );
};

export const makeRequest = async (): Promise<string> => {
  const integrationInfo = readIntegrationInfo();
  const requester = await getDeployedContract(`contracts/Requester.sol`);
  const airnodeRrp = await getDeployedContract(
    "@api3/airnode-protocol/contracts/rrp/AirnodeRrp.sol"
  );
  const airnodeWallet = getAirnodeWallet();
  const sponsor = ethers.Wallet.fromMnemonic(integrationInfo.mnemonic);
  // NOTE: The request is always made to the first endpoint listed in the "triggers.rrp" inside config.json
  const endpointId = readConfig().triggers.rrp[0].endpointId;
  // NOTE: When doing this manually, you can use the 'derive-sponsor-wallet-address' from the admin CLI package
  const sponsorWalletAddress = await deriveSponsorWalletAddress(
    // NOTE: When doing this manually, you can use the 'derive-airnode-xpub' from the admin CLI package
    deriveAirnodeXpub(airnodeWallet.mnemonic.phrase),
    airnodeWallet.address,
    sponsor.address
  );

  // Import the function to get encoded parameters for the Airnode. See the respective "request-utils.ts" for details.
  const { getEncodedParameters } = await import(
    `../airnode-deployment/request-utils`
  );
  // Trigger the Airnode request

  const receipt = await requester.makeRequest(
    airnodeWallet.address,
    endpointId,
    sponsor.address,
    sponsorWalletAddress,
    await getEncodedParameters()
  );

  // Wait until the transaction is mined
  return new Promise((resolve) =>
    getProvider().once(receipt.hash, (tx) => {
      const parsedLog = airnodeRrp.interface.parseLog(tx.logs[0]);
      resolve(parsedLog.args.requestId);
    })
  );
};

runAndHandleErrors(main);
