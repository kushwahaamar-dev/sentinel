import logging
from typing import Optional

from eth_account import Account
from web3 import Web3
from web3.contract.contract import Contract

from backend.config import get_settings

logger = logging.getLogger(__name__)

UNIVERSAL_SENTINEL_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "string", "name": "reason", "type": "string"},
        ],
        "name": "disbursePayout",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


class PayoutTransactor:
    """Signs and submits payout transactions to the UniversalSentinel contract."""

    def __init__(self, rpc_url: str, contract_address: str, chain_id: int, max_fee_gwei: float = 30.0) -> None:
        self.settings = get_settings()
        if not self.settings.sentinel_private_key:
            raise ValueError("SENTINEL_PRIVATE_KEY not configured")

        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.contract: Contract = self.w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=UNIVERSAL_SENTINEL_ABI)
        self.account = Account.from_key(self.settings.sentinel_private_key)
        self.chain_id = chain_id
        self.max_fee_gwei = max_fee_gwei

    def build_payout_tx(self, to_address: str, amount_units: int, reason: str, gas_limit: int = 300000) -> dict:
        tx = self.contract.functions.disbursePayout(
            Web3.to_checksum_address(to_address),
            amount_units,
            reason,
        ).build_transaction(
            {
                "from": self.account.address,
                "nonce": self.w3.eth.get_transaction_count(self.account.address),
                "gas": gas_limit,
                "maxFeePerGas": self.w3.to_wei(self.max_fee_gwei, "gwei"),
                "maxPriorityFeePerGas": self.w3.to_wei(1.5, "gwei"),
                "chainId": self.chain_id,
            }
        )
        return tx

    def sign_payout(self, to_address: str, amount_units: int, reason: str, gas_limit: int = 300000) -> str:
        tx = self.build_payout_tx(to_address, amount_units, reason, gas_limit)
        signed = self.account.sign_transaction(tx)
        logger.info("Signed payout tx to %s for %s units", to_address, amount_units)
        return signed.raw_transaction.hex()

    def send_payout(self, to_address: str, amount_units: int, reason: str, gas_limit: int = 300000) -> Optional[str]:
        try:
            raw_tx = self.sign_payout(to_address, amount_units, reason, gas_limit)
            tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
            return tx_hash.hex()
        except Exception as exc:
            logger.error("Failed to send payout tx: %s", exc)
            return None
