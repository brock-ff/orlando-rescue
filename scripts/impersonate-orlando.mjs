import hre from "hardhat";
import contracts from "../src/contracts.mjs";
const ethers = hre.ethers;

const victimAddress = "0xfcF4710e3078c3b28dcCc90adf3a1faFf6dD3a7A";
// pulled from accounts list printed by `npx hardhat node`; has 1000ETH
const donorAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
// one of my 1337 addresses
const recipientAddress = "0x1333756bb3CEC30c8F321A016bd80E8f3dc4a589";

// ERC20s
const aWethAddress = "0x030ba81f1c18d280636f32af80b9aad02cf0854e";
const vdUsdcAddress = "0x619beb58998ed2278e08620f97007e1116d5d25b";
const duckAddress = "0xc0ba369c8db6eb3924965e5c4fd0b4c1b91e305f";

// DUCK staking info
const duckStakingAddress = "0x3a9280f3a7ac4dda31161d6df2f8139ae303d0ab";
const duckStakedAmount = "2005000000000000000000";
const duckStakingAbi = [{"inputs":[{"internalType":"address","name":"_duckTokenAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EmergencyWithdrawn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"DUCK","outputs":[{"internalType":"contract ERC20Burnable","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_userAddress","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"calculateWithdrawFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"canEmergencyWithdraw","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getTiers","outputs":[{"internalType":"uint256[10]","name":"buf","type":"uint256[10]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_userAddress","type":"address"}],"name":"getUserTier","outputs":[{"internalType":"uint8","name":"res","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"_status","type":"bool"}],"name":"updateEmergencyWithdrawStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint8","name":"_tierId","type":"uint8"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"updateTier","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_key","type":"uint256"},{"internalType":"uint256","name":"_percent","type":"uint256"}],"name":"updateWithdrawFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userInfo","outputs":[{"internalType":"uint256","name":"staked","type":"uint256"},{"internalType":"uint256","name":"stakedTime","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"withdrawFeePercent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];

const impersonate = async (address) => {
    return await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address]
    });
  }
  
const stopImpersonating = async (address) => {
    return await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [address],
    });
}

// send some ETH to victim account (for simplicity)
const fundVictimAccount = async () => {
    await impersonate(donorAddress);
    const donorSigner = ethers.provider.getSigner(donorAddress);
    let fundVictimTx = {
      value: "0x400000000000000000",
      to: victimAddress,
    };
    let res = await donorSigner.sendTransaction(fundVictimTx);
    console.log("donor-fund result", res);
    await stopImpersonating(donorAddress);
}

async function main() {
    // give victim account some test moneys
    await fundVictimAccount();

    // impersonate victim account
    await impersonate(victimAddress);
    const victimSigner = ethers.provider.getSigner(victimAddress);

    // instantiate contracts
    const duckContract = new ethers.Contract(duckAddress, contracts.anyERC20.abi, victimSigner);
    const duckStakingContract = new ethers.Contract(duckStakingAddress, duckStakingAbi, victimSigner);
    const aWethContract = new ethers.Contract(aWethAddress, contracts.anyERC20.abi, victimSigner);
    const vdUsdcContract = new ethers.Contract(vdUsdcAddress, contracts.anyERC20.abi, victimSigner);

    console.log("ETH BALANCE (Victim)", await ethers.provider.getBalance(victimAddress));
    console.log("ETH BALANCE (Safe Wallet)", await ethers.provider.getBalance(recipientAddress));
    
    // redeemable token balances
    const duckBalance = await duckContract.balanceOf(victimAddress);
    const duckStakeBalance = (await duckStakingContract.userInfo(victimAddress))["staked"];
    const aWethBalance = await aWethContract.balanceOf(victimAddress);
    const vdUsdcBalance = await vdUsdcContract.balanceOf(victimAddress);
    
    console.log("DUCK BALANCE", duckBalance);
    console.log("DUCK STAKE BALANCE", duckStakeBalance);
    console.log("aWETH BALANCE", aWethBalance);
    console.log("vdUSDC BALANCE", vdUsdcBalance);
    
    // unstake duck from duckstarter
    await duckStakingContract.withdraw(duckStakeBalance);
    const newDuckBalance = await duckContract.balanceOf(victimAddress);
    console.log("NEW DUCK BALANCE", newDuckBalance);

    // simulate transfers
    // DUCK
    await duckContract.transfer(recipientAddress, newDuckBalance);
    const recipientDuckBalance = await duckContract.balanceOf(recipientAddress);
    console.log("RECIPIENT DUCK BALANCE", recipientDuckBalance);
    // aWETH
    await aWethContract.transfer(recipientAddress, aWethBalance);
    const recipientAWethBalance = await aWethContract.balanceOf(recipientAddress);
    console.log("RECIPIENT aWETH BALANCE", recipientAWethBalance);
    // vdUSDC
    await vdUsdcContract.transfer(recipientAddress, vdUsdcBalance);
    const recipientVdUsdcBalance = await vdUsdcContract.balanceOf(recipientAddress);
    console.log("RECIPIENT vdUSDC BALANCE", recipientVdUsdcBalance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
