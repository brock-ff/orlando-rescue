import { BigNumber } from "ethers";

// thanks to Scott Bigelow & Kendrick Tan for [this](https://github.com/flashbots/searcher-sponsored-tx/blob/main/src/utils.ts)
export async function checkSimulation(
    flashbotsProvider,
    signedBundle
  ) {
    const simulationResponse = await flashbotsProvider.simulate(
      signedBundle,
      "latest"
    );
  
    if ("results" in simulationResponse) {
      for (let i = 0; i < simulationResponse.results.length; i++) {
        const txSimulation = simulationResponse.results[i];
        if ("error" in txSimulation) {
          throw new Error(
            `TX #${i} : ${txSimulation.error} ${txSimulation.revert}`
          );
        }
      }
  
      if (simulationResponse.coinbaseDiff.eq(0)) {
        throw new Error("Does not pay coinbase");
      }
  
      const gasUsed = simulationResponse.results.reduce(
        (acc, txSimulation) => acc + txSimulation.gasUsed,
        0
      );
  
      const gasPrice = simulationResponse.coinbaseDiff.div(gasUsed);
      return gasPrice;
    }
  
    console.error(
      `Similuation failed, error code: ${simulationResponse.error.code}`
    );
    console.error(simulationResponse.error.message);
    throw new Error("Failed to simulate response");
}

export const ETHER = BigNumber.from(10).pow(18);
export const GWEI = BigNumber.from(10).pow(9);
