import { Contract, providers, Wallet, utils, BigNumber } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
dotenv.config();

import contracts from "./contracts.mjs";
import { checkSimulation, ETHER } from "./util.mjs";
const MINER_REWARD_IN_WEI = ETHER.div(1000).mul(12); // 0.012 ETH

// wallets
const authSigner = new Wallet(process.env.BUNDLE_SIGNER_REPUTATION_KEY);
const victimSigner = new Wallet(process.env.VICTIM_KEY); // TODO: get actual victim key; just copying BUNDLE_SIGNER_REPUTATION_KEY in .env to prevent errors
const donorSigner = new Wallet(process.env.DONOR_KEY);

// EOA addresses
const donorAddress = process.env.DONOR_ADDRESS;
const recipientAddress = process.env.SAFE_RECIPIENT_ADDRESS; // TODO: get actual safe address; using `flashbots_recipient` from metamask
const victimAddress = process.env.VICTIM_ADDRESS;

// providers
const provider = new providers.JsonRpcProvider({url: process.env.ETH_RPC_HTTP}, 1); // mainnet
const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner);

// contracts
const stakingContract = new Contract(contracts.staking.address, contracts.staking.abi, provider);
const lpTokenContract = new Contract(contracts.lpToken.address, contracts.lpToken.abi, provider);
const rewardTokenContract = new Contract(contracts.rewardToken.address, contracts.rewardToken.abi, provider);
const nftContract1 = new Contract(contracts.nft.address_cro17, contracts.nft.abi, provider);
const nftContract2 = new Contract(contracts.nft.address_cro30, contracts.nft.abi, provider);
const checkAndSendContract = new Contract(contracts.checkAndSend.address, contracts.checkAndSend.abi, provider);

// print starting ETH balances
console.log(`VICTIM WALLET\t(${victimAddress}) ${utils.formatEther(await provider.getBalance(victimAddress))} ETH`);
console.log(`SAFE WALLET\t(${recipientAddress}) ${utils.formatEther(await provider.getBalance(recipientAddress))} ETH`);
console.log(`DONOR WALLET\t(${donorAddress}) ${utils.formatEther(await provider.getBalance(donorAddress))} ETH`);

// print token balances before calling exit
const lpBalance = await lpTokenContract.balanceOf(victimAddress);
const rewardBalance = await rewardTokenContract.balanceOf(victimAddress);
const nftBalance1 = await nftContract1.balanceOf(victimAddress);
const nftBalance2 = await nftContract2.balanceOf(victimAddress);
console.log("\n*** Pre-exit Balances ***");
console.log("LP Balance     (SLP)", utils.formatEther(lpBalance));
console.log("Reward Balance (ACLX)", utils.formatEther(rewardBalance));
console.log("NFT Balance    (CRO17)", utils.formatUnits(nftBalance1, 0));
console.log("NFT Balance    (CRO30)", utils.formatUnits(nftBalance2, 0));

// transactions: unstake & transfer
const newLpBalance = BigNumber.from("0x0d96717d43a701ab");        // pre-calculated with hardhat // TODO: re-run since these should increase over time)
const newRewardBalance = BigNumber.from("0x16e97954af45d4b9");    // pre-calculated with hardhat // TODO: re-run since these should increase over time)
const zeroGasTxs = [
    { // unstake
        ...(await stakingContract.populateTransaction.exit(2)), // 2 is the pool ID where the funds are
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(180000),
    },
    { // transfer SLP tokens (in wallet after exit)
        ...(await lpTokenContract.populateTransaction.transfer(recipientAddress, newLpBalance)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(80000),
    },
    { // transfer ALCX tokens (in wallet after exit)
        ...(await rewardTokenContract.populateTransaction.transfer(recipientAddress, newRewardBalance)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(80000),
    },
    { // transfer CRO17 tokens (already in wallet)
        ...(await nftContract1.populateTransaction.transfer(recipientAddress, nftBalance1)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(80000),
    },
    { // transfer CRO30 tokens (already in wallet)
        ...(await nftContract2.populateTransaction.transfer(recipientAddress, nftBalance2)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(80000),
    },
];

// build donor transaction
const checkTargets = [
    lpTokenContract.address, 
    rewardTokenContract.address, 
    nftContract1.address, 
    nftContract2.address
];
const checkPayloads = [
    lpTokenContract.interface.encodeFunctionData('balanceOf', [recipientAddress]),
    rewardTokenContract.interface.encodeFunctionData('balanceOf', [recipientAddress]),
    nftContract1.interface.encodeFunctionData('balanceOf', [recipientAddress]),
    nftContract2.interface.encodeFunctionData('balanceOf', [recipientAddress]),
];
// we can assume recipient has 0 balance across the board; it should be a fresh account
const checkMatches = [
    lpTokenContract.interface.encodeFunctionResult('balanceOf', [newLpBalance]),
    rewardTokenContract.interface.encodeFunctionResult('balanceOf', [newRewardBalance]),
    nftContract1.interface.encodeFunctionResult('balanceOf', [nftBalance1]),
    nftContract2.interface.encodeFunctionResult('balanceOf', [nftBalance2]),
];
const donorTx = {
    ...(await checkAndSendContract.populateTransaction.check32BytesAndSendMulti(checkTargets, checkPayloads, checkMatches)),
    value: MINER_REWARD_IN_WEI,
    gasPrice: BigNumber.from(0),
    gasLimit: BigNumber.from(400000),
};

// flashbots bundle
const bundle = [
    ...zeroGasTxs.map(transaction => {
        return {
            transaction,
            signer: victimSigner,
        }
    }),
    {
        transaction: donorTx,
        signer: donorSigner,
    }
];
const signedBundle = await flashbotsProvider.signBundle(bundle);
const gasPrice = await checkSimulation(flashbotsProvider, signedBundle);
console.log("simulation gasPrice", gasPrice);

// print new balances to compare
// console.log("\n*** Post-exit Balances ***");
// const newLpBalance = await lpTokenContract.balanceOf(victimAddress);
// const newRewardBalance = await rewardTokenContract.balanceOf(victimAddress);
// console.log("LP Balance     (SLP)", utils.formatEther(newLpBalance));
// console.log("Reward Balance (ACLX)", utils.formatEther(newRewardBalance));
