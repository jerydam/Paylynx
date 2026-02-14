# config.py - Blockchain Configuration
# Active Network: Tempo Testnet (Moderato)

from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv()

# ════════════════════════════════════════════════════════════════
# RPC CONFIGURATION with Fallback
# ════════════════════════════════════════════════════════════════

RPC_ENDPOINTS = [
    "https://rpc.moderato.tempo.xyz",  # Tempo testnet RPC (primary)
    os.getenv("ALCHEMY_RPC_URL"),
    os.getenv("QUICKNODE_RPC_URL"),
    "https://sepolia.base.org",  # Base Sepolia fallback
]

def get_web3_with_fallback():
    """Try connecting to RPC endpoints in order until one works"""
    for rpc in RPC_ENDPOINTS:
        if not rpc:
            continue
        try:
            w3_instance = Web3(Web3.HTTPProvider(
                rpc, 
                request_kwargs={
                    'timeout': 10,
                    'headers': {'User-Agent': 'Paylynx/1.0'}
                }
            ))
            if w3_instance.is_connected():
                print(f"✅ Connected to RPC: {rpc[:50]}...")
                return w3_instance
        except Exception as e:
            print(f"❌ Failed to connect to {rpc[:50]}: {str(e)}")
            continue
    
    raise Exception("❌ All RPC endpoints failed. Check your network configuration.")

# Initialize Web3
w3 = get_web3_with_fallback()

# ════════════════════════════════════════════════════════════════
# NETWORK CONFIGURATIONS
# ════════════════════════════════════════════════════════════════

NETWORKS = {
    # TEMPO TESTNET (MODERATO) - Primary Network
    "tempo-testnet": {
        "CHAIN_ID": 42431,
        "NAME": "Tempo Testnet (Moderato)",
        "RPC_URL": "https://rpc.moderato.tempo.xyz", 
        "EXPLORER": "https://explore.tempo.xyz",
        "CURRENCY": "USD",  # Tempo uses stablecoins for gas!
        "USDC_ADDRESS": "0x20c0000000000000000000000000000000000000",  # pathUSD (Testnet Stablecoin)
        "NATIVE_TOKEN": "pathUSD",
        "FAUCET": "https://docs.tempo.xyz/faucet",
    },
    
    # BASE SEPOLIA TESTNET - Official Circle USDC
    "base-sepolia": {
        "CHAIN_ID": 84532,
        "NAME": "Base Sepolia Testnet",
        "USDC_ADDRESS": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # ✅ Official Circle USDC
        "EXPLORER": "https://sepolia.basescan.org",
        "NATIVE_TOKEN": "ETH",
        "RPC_URL": "https://sepolia.base.org",
        "FAUCET": "https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet",
    },
    
    # BASE MAINNET - Native USDC
    "base": {
        "CHAIN_ID": 8453,
        "NAME": "Base Mainnet",
        "USDC_ADDRESS": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # Official Circle USDC on Base
        "EXPLORER": "https://basescan.org",
        "NATIVE_TOKEN": "ETH",
        "RPC_URL": os.getenv("BASE_RPC_URL", "https://mainnet.base.org"),
    },
    
    # CELO MAINNET - Native USDC
    "celo": {
        "CHAIN_ID": 42220,
        "NAME": "Celo Mainnet",
        "USDC_ADDRESS": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",  # Official Circle USDC
        "EXPLORER": "https://celoscan.io",
        "NATIVE_TOKEN": "CELO",
        "RPC_URL": "https://forno.celo.org",
    },
    
    # CELO ALFAJORES TESTNET
    "celo-testnet": {
        "CHAIN_ID": 44787,
        "NAME": "Celo Alfajores Testnet",
        "USDC_ADDRESS": "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",  # Testnet USDC
        "EXPLORER": "https://alfajores.celoscan.io",
        "NATIVE_TOKEN": "CELO",
        "RPC_URL": "https://alfajores-forno.celo-testnet.org",
    },
}

# ════════════════════════════════════════════════════════════════
# ACTIVE NETWORK SELECTION
# ════════════════════════════════════════════════════════════════

# Set via environment variable or default to Tempo testnet
ACTIVE_NETWORK = os.getenv("ACTIVE_NETWORK", "tempo-testnet")

if ACTIVE_NETWORK not in NETWORKS:
    raise ValueError(
        f"Invalid ACTIVE_NETWORK: {ACTIVE_NETWORK}. "
        f"Must be one of: {list(NETWORKS.keys())}"
    )

active_config = NETWORKS[ACTIVE_NETWORK]

print("\n" + "="*60)
print(f"🌐 ACTIVE NETWORK: {active_config['NAME']}")
print(f"   Chain ID: {active_config['CHAIN_ID']}")
print(f"   USDC Address: {active_config['USDC_ADDRESS']}")
print(f"   Explorer: {active_config['EXPLORER']}")
print(f"   Native Token: {active_config.get('NATIVE_TOKEN', 'Unknown')}")
print("="*60 + "\n")

# ════════════════════════════════════════════════════════════════
# TOKEN ABI - Compatible with both standard ERC20 and Tempo tokens
# ════════════════════════════════════════════════════════════════

ERC20_ABI = [
    # Standard ERC20 functions
    {
        "name": "name",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "string"}]
    },
    {
        "name": "symbol",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "string"}]
    },
    {
        "name": "decimals",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "uint8"}]
    },
    {
        "name": "totalSupply",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "uint256"}]
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"type": "address", "name": "account"}],
        "outputs": [{"type": "uint256"}]
    },
    {
        "name": "transfer",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"type": "address", "name": "to"},
            {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool"}]
    },
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"type": "address", "name": "spender"},
            {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool"}]
    },
    {
        "name": "allowance",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"type": "address", "name": "owner"},
            {"type": "address", "name": "spender"}
        ],
        "outputs": [{"type": "uint256"}]
    },
    {
        "name": "transferFrom",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"type": "address", "name": "from"},
            {"type": "address", "name": "to"},
            {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool"}]
    },
    # Tempo-specific functions
    {
        "name": "transferWithMemo",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"type": "address", "name": "to"},
            {"type": "uint256", "name": "amount"},
            {"type": "bytes32", "name": "memo"}
        ],
        "outputs": []
    },
    {
        "name": "currency",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "string"}]
    },
    # Events
    {
        "name": "Transfer",
        "type": "event",
        "inputs": [
            {"type": "address", "name": "from", "indexed": True},
            {"type": "address", "name": "to", "indexed": True},
            {"type": "uint256", "name": "amount"}
        ]
    },
    {
        "name": "Approval",
        "type": "event",
        "inputs": [
            {"type": "address", "name": "owner", "indexed": True},
            {"type": "address", "name": "spender", "indexed": True},
            {"type": "uint256", "name": "amount"}
        ]
    },
]

# ════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ════════════════════════════════════════════════════════════════

def get_usdc_contract():
    """Get USDC contract instance for the active network"""
    return w3.eth.contract(
        address=w3.to_checksum_address(active_config["USDC_ADDRESS"]),
        abi=ERC20_ABI
    )

def get_balance(address: str) -> float:
    """Get USDC balance for an address"""
    try:
        contract = get_usdc_contract()
        balance_wei = contract.functions.balanceOf(
            w3.to_checksum_address(address)
        ).call()
        decimals = contract.functions.decimals().call()
        return balance_wei / (10 ** decimals)
    except Exception as e:
        print(f"Error getting balance: {str(e)}")
        return 0.0

def validate_address(address: str) -> bool:
    """Validate if an address is a valid Ethereum address"""
    try:
        w3.to_checksum_address(address)
        return True
    except:
        return False

# ════════════════════════════════════════════════════════════════
# VERIFY CONFIGURATION ON STARTUP
# ════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n🧪 Testing Configuration...\n")
    
    # Test Web3 connection
    print(f"✅ Web3 Connected: {w3.is_connected()}")
    print(f"   Chain ID: {w3.eth.chain_id}")
    
    # Test USDC contract
    try:
        contract = get_usdc_contract()
        name = contract.functions.name().call()
        symbol = contract.functions.symbol().call()
        decimals = contract.functions.decimals().call()
        
        print(f"\n✅ USDC Contract Loaded:")
        print(f"   Name: {name}")
        print(f"   Symbol: {symbol}")
        print(f"   Decimals: {decimals}")
        print(f"   Address: {active_config['USDC_ADDRESS']}")
    except Exception as e:
        print(f"\n❌ USDC Contract Error: {str(e)}")
    
    print("\n" + "="*60 + "\n")