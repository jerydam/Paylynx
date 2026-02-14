import requests
import json

# Your Wallet Address
MY_WALLET = "0x3207D4728c32391405C7122E59CCb115A4af31eA"

def get_funds():
    url = "https://rpc.moderato.tempo.xyz"
    payload = {
        "jsonrpc": "2.0",
        "method": "tempo_fundAddress", # Special Tempo method
        "params": [MY_WALLET],
        "id": 1
    }
    
    print(f"🚰 Requesting funds for {MY_WALLET}...")
    response = requests.post(url, json=payload)
    
    print("Response:", response.json())

if __name__ == "__main__":
    get_funds()