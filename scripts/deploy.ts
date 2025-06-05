import { spawn } from "child_process";
import * as fs from "fs/promises";

(async () => {
    try {
        console.log("🚀 Deploying UFC NFT Contract using Aptos CLI...");
        
        // Check if build files exist
        try {
            await fs.access('build/UFC_NFT/bytecode_modules/ufc_nft.mv');
            console.log("✅ Build files found");
        } catch (error) {
            throw new Error("❌ Build files not found. Please run 'aptos move compile' first to build the contract.");
        }

        // Use Aptos CLI to publish
        console.log("📦 Publishing contract...");
        
        const publishProcess = spawn('aptos', ['move', 'publish', '--assume-yes'], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        publishProcess.on('close', (code) => {
            if (code === 0) {
                console.log("🎉 Contract published successfully!");
                console.log("📝 Your contract is now deployed on the Aptos blockchain");
                console.log("🔗 You can now use the TypeScript scripts to interact with it");
            } else {
                console.error(`❌ Publishing failed with exit code ${code}`);
                process.exit(1);
            }
        });

        publishProcess.on('error', (error) => {
            console.error("❌ Error running Aptos CLI:", error.message);
            console.log("\n💡 Make sure you have Aptos CLI installed:");
            console.log("   - macOS: brew install aptos");
            console.log("   - Other: Download from https://github.com/aptos-labs/aptos-core/releases");
            process.exit(1);
        });

    } catch (error) {
        console.error("❌ Deploy Error:", error);
        process.exit(1);
    }
})();