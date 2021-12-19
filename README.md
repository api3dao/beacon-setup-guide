# beacon-setup-guide

## Setup

install the dependencies before running the scripts

```
yarn install
```

compile the contracts using the following command:

```
yarn build
```

## Instructions

The following instructions will guide you step by step on how to deploy and verify the rrp,beacon and authorizer contracts.

The deployment addresses will be saved under the `/deployments` folder

### 1. Setup the deployment 

The first step is to choose a network for deployment and provide the provider URL. You will also need a funded account to deploy necessary contracts that will be derived from the mnemonic in this step.

Run the following script to setup the integration

```
yarn setup-integration
```

### 2. (Optional) Print out the user account information

Run:
```
yarn print-account-details
```
This script will show you the address of the account derived from the specified mnemonic. This account will be used to deploy the contracts and make transactions, so make sure it is funded. The recommended amount is at least 0.2 ETH.

### 3. Deploy the RRP contract

The [RRP](https://docs.api3.org/airnode/v0.3/concepts/) contract is a contract through which the beacon triggers a request for Airnode. This contract is common for all Airnodes and beacons on a chain.

Run the following script to deploy RRP contract

```
yarn deploy-rrp
```

### 4. Deploy the AccessControlRegistry contract

The AccessControlRegistry contract is a Contract that allows users to manage independent, tree-shaped access control tables. The RequesterAuthorizerWithManager access control is implemented via the AccessControlRegistry

Run the following script to deploy AccessControlRegistry contract

```
yarn deploy-access-control-registry
```

### 5. Deploy the OwnableCallForwarder contract

The OwnableCallForwarder contract is a [Ownable](https://docs.openzeppelin.com/contracts/2.x/access-control#ownership-and-ownable) contract that can forward a call made by the owner to another contract. The manager of `RequesterAuthorizerWithManager` will be this contract which will make it easier to change the manager in the future using `transferOwnership()`.

Run the following script to deploy OwnableCallForwarder contract
```
yarn deploy-ownable-call-forwarder
```

By default the owner(referred to as the manager) is the account specified by the mnemonic, to change it run the following command instead

```
yarn deploy-ownable-call-forwarder --manager 0xAEB7E....E6E2B3
```


### 6. Deploy the RequesterAuthorizerWithManager contract

The RequesterAuthorizerWithManager contract implements a requester-based RRP authorizer and assigns the OwnableCallForwarder as the manager or in other words, the highest ranking admin across all Airnodes.

Run the following script to deploy RequesterAuthorizerWithManager contract
```
yarn deploy-requester-authorizer-with-manager
```

By default the adminRoleDescription is set to `admin`, to change it run the following command instead

```
yarn deploy-requester-authorizer-with-manager --adminRoleDescription "API3DAO"
```

### 7. Deploy the RRP Beacon Server contract

Run the following script to deploy the RRP beacon contract
```
yarn deploy-rrp-beacon-server
```

By default the manager of the rrp beacon server is the account specified by the mnemonic and the adminRoleDescription is set to "rrpbeacon admin" to change it run the following command instead

```
yarn deploy-rrp-beacon-server --manager 0xAEB7E....E6E2B3 --adminRoleDescription "API3DAO"
```

### 8. Whitelist the beacon on the RequesterAuthorizerWithManager

The beacon server needs to be whitelisted on RequesterAuthorizerWithManager for airnodes to be able to fullfil its request.

Run the following script to whitelist the beacon by the manager for the specified `airnode` and `endpoint`
```
yarn whitelist-rrp-beacon-server \
    --airnode 0xAEB7E....E6E2B3 \
    --endpointId 0xAEB7E....E6E2B3 \
    --status true  
```

By default the script assumes the manager to be the account specified by the mnemonic. If the owner of OwnableCallForwarder is different then a different mnemonic that contains the account of the manager can be specified as an argument

```
yarn whitelist-rrp-beacon-server \
    --managerMnemonic achieve climb ... label \
    --airnode 0xAEB7E....E6E2B3 \
    --endpointId 0xAEB7E....E6E2B3 \
    --status true  
```

## Explorer Verification

To verify the deployed contracts you need to first flatten the contracts using the following command

```
yarn flatten-contracts
```

This will generate a `/verify` folder with the contracts flattened into `.flat.sol` files. Navigate to the explorer page of the respective contract and find the `Verify and Publish` page (every explorer will have some variation on their contract page). Copy and paste the flattened contract code and select the solidity version that matches the version specified in `hardhat.config.ts`. Select MIT as the liscence and click on publish/verify






