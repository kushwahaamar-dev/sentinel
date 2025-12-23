from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from environment variables."""

    sentinel_mode: Literal["LIVE", "MOCK"] = Field(
        default="MOCK", alias="SENTINEL_MODE", description="Toggle between live APIs and mock scenarios."
    )
    gemini_api_key: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")
    owm_api_key: Optional[str] = Field(default=None, alias="OWM_API_KEY")
    sentinel_private_key: Optional[str] = Field(default=None, alias="SENTINEL_PRIVATE_KEY")
    etherscan_base_url: str = Field(
        default="https://etherscan.io/tx/",
        alias="ETHERSCAN_BASE_URL",
        description="Used to build clickable payout links.",
    )
    # Blockchain configuration (optional - if not set, uses mock transactions)
    rpc_url: Optional[str] = Field(default=None, alias="RPC_URL", description="Ethereum RPC endpoint (e.g., Sepolia testnet)")
    contract_address: Optional[str] = Field(default=None, alias="CONTRACT_ADDRESS", description="UniversalSentinel contract address")
    chain_id: Optional[int] = Field(default=None, alias="CHAIN_ID", description="Chain ID (e.g., 11155111 for Sepolia)")
    # Solana / Phantom path
    solana_rpc_url: Optional[str] = Field(default=None, alias="SOLANA_RPC_URL")
    solana_program_id: Optional[str] = Field(default=None, alias="SOLANA_PROGRAM_ID")
    solana_usdc_mint: Optional[str] = Field(default=None, alias="SOLANA_USDC_MINT")
    solana_vault_ata: Optional[str] = Field(default=None, alias="SOLANA_VAULT_ATA")
    solana_keypair: Optional[str] = Field(
        default=None,
        alias="SOLANA_PRIVATE_KEY",
        description="Base58 or JSON array for signing payouts server-side.",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
