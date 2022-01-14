# beacon-setup-guide

## Setup

Start by installing the dependencies before running the scripts:

```
yarn install
```

then compile the contracts using the following command:

```
yarn build
```

## Instructions

The following instructions will guide you through deploying and verifying the Airnode RRP, Beacon and Authorizer
contracts.

The addresses of deployed contracts will be saved in the `/deployments` folder

### 1. Setup the Deployment

The first step is to choose a network for deployment and provide an EVM provider URL. You will also need a funded
account to deploy the necessary contracts that will be derived from the mnemonic in this step.

Run the following script to setup the integration:

```
yarn setup-integration
```

You may optionally edit the `integration-info.json` file.

### 2. (Optional) Print Out the User Account Information

Run:

```
yarn print-account-details
```

This script will print out the address of the account derived from the specified mnemonic. This account will be used to
deploy the contracts and make transactions in the following steps. We will be deploying at least 5 contracts, so please
make sure the address displayed is funded with at least 0.3 Eth (or whatever gas token the target chain uses).

## A Note Regarding Existing Contracts

Some contracts may have already been deployed, in cases where such contracts have been deployed the contract deployment
steps below will be unnecessary.

### 3. (Optional) Deploy the RRP Contract

The [RRP](https://docs.api3.org/airnode/v0.3/concepts/) contract is a contract through which the beacon triggers a
request to be fulfilled by an airnode. This contract is common for all airnodes and beacons on a chain.

Run the following script to deploy RRP contract:

```
yarn deploy-rrp
```

### 4. Deploy the AccessControlRegistry Contract

The AccessControlRegistry contract is a contract that allows users to manage independent, tree-shaped access control
tables. The RequesterAuthorizerWithManager contract access control is implemented via the AccessControlRegistry
contract.

Run the following script to deploy the AccessControlRegistry contract:

```
yarn deploy-access-control-registry
```

### 5. Deploy the OwnableCallForwarder Contract

The OwnableCallForwarder contract is a
[Ownable](https://docs.openzeppelin.com/contracts/2.x/access-control#ownership-and-ownable) contract that can forward a
call made by the owner to another contract. The manager of the `RequesterAuthorizerWithManager` contract will be this
contract which will make it easier to change the manager in future using the `transferOwnership()` call.

Run the following script to deploy the OwnableCallForwarder contract:

```
yarn deploy-ownable-call-forwarder
```

| parameter | type    | default value                 | description                                                            |
| --------- | ------- | ----------------------------- | ---------------------------------------------------------------------- |
| `manager` | address | account specified by mnemonic | the owner(referred to as the manager) of OwnableCallForwarder contract |

You can run this command with different parameters in the following way:

```
yarn deploy-ownable-call-forwarder --parameter parameterValue
```

By default the owner(referred to as the manager) is the account specified by the mnemonic.

### 6. Deploy the RequesterAuthorizerWithManager contract

The RequesterAuthorizerWithManager contract implements a requester-based RRP authorizer and assigns the
OwnableCallForwarder as the manager or in other words, the highest ranking admin across all airnodes.

Run the following script to deploy the RequesterAuthorizerWithManager contract:

```
yarn deploy-requester-authorizer-with-manager
```

| parameter              | type   | default value | description                       |
| ---------------------- | ------ | ------------- | --------------------------------- |
| `adminRoleDescription` | string | `"admin"`     | The description of the admin role |

You can run this command with different parameters in the following way:

```
yarn deploy-requester-authorizer-with-manager --parameter parameterValue
```

### 7. Deploy the RRP Beacon Server contract

Run the following script to deploy the RRP beacon contract:

```
yarn deploy-rrp-beacon-server
```

| parameter              | type    | default                       | description                                                                         |
| ---------------------- | ------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `adminRoleDescription` | string  | `"rrpbeacon admin"`           | The description of the admin role                                                   |
| `manager`              | address | account specified by mnemonic | The manager of the RRP Beacon Server (can whitelist users to read from the beacon ) |

By default the manager of the RRP beacon server is the account specified by the mnemonic, and the adminRoleDescription
is set to "rrpbeacon admin".

You can run this command with different parameters in the following way:

```
yarn deploy-rrp-beacon-server --parameter parameterValue
```

### 8. Whitelist the beacon on the RequesterAuthorizerWithManager

The beacon server needs to be whitelisted on the RequesterAuthorizerWithManager contract for airnodes to be able to
fulfill requests.

Run the following script to whitelist the beacon by the manager for the specified `airnode` and `endpoint`

```
yarn whitelist-rrp-beacon-server \
    --airnode 0xAEB7E....E6E2B3 \
    --endpointId 0xAEB7E....E6E2B3 \
    --status true
```

| parameter    | type    | default                       | description                                                                            |
| ------------ | ------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| `airnode`    | address | No default                    | The address of the airnode                                                             |
| `endpointId` | bytes32 | No default                    | The endpointId of the airnode                                                          |
| `status`     | boolean | No default                    | The Whitelist status of the beacon on the airnode                                      |
| `manager`    | address | account specified by mnemonic | The manager of the OwnableCallForwarder (can whitelist users to read from the beacon ) |

By default the script assumes the manager to be the account specified by the mnemonic in the integration-info.json file.
The mnemonic of the manager can be overridden by specifying it as an argument:

```
yarn whitelist-rrp-beacon-server \
    --managerMnemonic "achieve climb ... label" \
    --airnode 0xAEB7E....E6E2B3 \
    --endpointId 0xAEB7E....E6E2B3 \
    --status true
```

## Verification

To verify the deployed contracts you need to first flatten the contracts using the following command:

```
yarn flatten-contracts
```

This will generate a `/verify` folder with the contracts flattened into `.flat.sol` files. Navigate to the explorer page
of the respective contract and find the `Verify and Publish` page (note that explorers vary, this assumes an
Etherscan-based explorer). Copy and paste the flattened contract code and select the solidity version that matches the
version specified in `hardhat.config.ts`. Select MIT as the licence and click on publish/verify.

## Post Deployment

After all the contracts have been deployed a `deployments` folder will be created. These deployment files will need to
be merged into master via a pull request.

Checkout to a new branch, the recommended format is

```
git checkout -b contractVersion_chainName_deployment
```

so for if you're deploying v0.3 contracts on kovan the this command would look like:

```
git checkout -b 0.3_kovan_deployment
```

After checking out to the new branch, commit the files and push to github. On github create a pull request so others can
review the deployment.
