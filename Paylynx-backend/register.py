import json
import base64
from web3 import Web3

# ==========================================
# 👇 USER CONFIGURATION
# ==========================================

# 1. Your Wallet Private Key (MUST HAVE REAL MAINNET CELO!)
PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE" 


# ==========================================
# ⚙️ MAINNET CONFIGURATION (Do not change)
# ==========================================

# Celo Mainnet RPC (Real Money)
PRIVATE_KEY = "" 


# ==========================================
# ⚙️ SYSTEM CONFIGURATION
# ==========================================

# The Registry Address on Celo Alfajores
REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
RPC_URL = "https://forno.celo.org"


def main():
    # 1. Connect to Celo Mainnet
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    
    if not w3.is_connected():
        print("❌ Failed to connect to Celo Mainnet.")
        return

    try:
        account = w3.eth.account.from_key(PRIVATE_KEY)
        print(f"🔌 Connected to MAINNET with wallet: {account.address}")
        
        # Check Balance to prevent gas failure
        balance = w3.eth.get_balance(account.address)
        print(f"💰 Balance: {w3.from_wei(balance, 'ether')} CELO")
        
        if balance < w3.to_wei(0.005, 'ether'):
            print("❌ INSUFFICIENT FUNDS. You need at least 0.005 CELO to register.")
            return

    except Exception as e:
        print("❌ Invalid Private Key.")
        return

    # 2. METADATA (Paylynx)
    agent_metadata = {
        "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        "name": "Paylynx",
        "description": "A specialized AI agent for the Celo blockchain that allows users to send money globally using natural language. Users type requests like \"Send $50 to my mom in Nigeria\" or \"Transfer 100 EUR to my brother in Germany every month,\" and the agent parses the intent, optimizes the route, converts currencies via Celo stablecoins, and executes the transfer on-chain. Includes fee comparison to traditional remittance services, transaction receipts, and optional notifications. Designed for seamless, fast, and secure cross-border payments.",
        "image": "https://blob.8004scan.app/3f5dd4644d70b76ee49b32ccda844208ab82a34ca9a2a9cd9c6897980c91874c.jpg",
        "services": [
            {
            "name": "custom",
            "endpoint": "https://paylynx.onrender.com"
            },
            {
            "name": "OASF",
            "endpoint": "https://github.com/agntcy/oasf/",
            "skills": [
                "analytical_skills/mathematical_reasoning/math_word_problems",
                "analytical_skills/mathematical_reasoning/pure_math_operations",
                "analytical_skills/mathematical_reasoning/theorem_proving",
                "analytical_skills/coding_skills/code_templates",
                "analytical_skills/coding_skills/code_optimization",
                "governance_compliance/policy_mapping",
                "governance_compliance/audit_trail_summarization"
            ],
            "domains": [
                "technology/blockchain/blockchain",
                "technology/blockchain/cryptocurrency",
                "technology/blockchain/defi",
                "technology/blockchain/smart_contracts",
                "finance_and_business/finance",
                "finance_and_business/finance_and_business",
                "finance_and_business/banking",
                "finance_and_business/consumer_goods",
                "finance_and_business/investment_services",
                "finance_and_business/retail"
            ]
            }
        ],
        "registrations": [],
        "supportedTrusts": [],
        "active": True,
        "x402support": True
        }


   # 3. Encode Metadata
    print("📦 Packaging metadata...")
    json_str = json.dumps(agent_metadata)
    b64_str = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
    data_uri = f"data:application/json;base64,{b64_str}"

    # 4. Prepare Transaction
    abi = [{
        "inputs": [{"internalType": "string", "name": "agentURI", "type": "string"}],
        "name": "registerAgent",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }]

    contract = w3.eth.contract(address=REGISTRY_ADDRESS, abi=abi)

    try:
        print("📝 Sending MAINNET transaction...")
        
        tx = contract.functions.registerAgent(data_uri).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 2000000, 
            'gasPrice': w3.eth.gas_price
        })

        signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        print(f"🚀 Transaction Sent! Hash: {w3.to_hex(tx_hash)}")
        print(f"🔗 View on Explorer: https://celoscan.io/tx/{w3.to_hex(tx_hash)}")
        
        print("⏳ Waiting for confirmation...")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if receipt.status == 1:
            print("\n✅ SUCCESS! Paylynx is Live on Mainnet.")
            print("👉 Check the 'Logs' tab on CeloScan for your AgentID.")
        else:
            print("\n❌ Transaction Failed. Check your gas funds.")

    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()