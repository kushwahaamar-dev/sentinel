import json
import logging
from typing import Optional

from solana.keypair import Keypair
from solana.rpc.api import Client
from solana.transaction import Transaction
from solana.publickey import PublicKey
from solana.rpc.commitment import Confirmed
from spl.token.instructions import transfer_checked, TransferCheckedParams

from backend.config import get_settings

logger = logging.getLogger(__name__)


class SolanaPayoutClient:
    """
    Minimal Solana payout helper.
    Assumes USDC SPL token in a vault ATA; sends to recipient ATA.
    """

    def __init__(self) -> None:
        settings = get_settings()
        if not all(
            [
                settings.solana_rpc_url,
                settings.solana_program_id,
                settings.solana_usdc_mint,
                settings.solana_vault_ata,
                settings.solana_keypair,
            ]
        ):
            raise ValueError("Solana settings missing; check SOLANA_* env vars.")

        self.client = Client(settings.solana_rpc_url, commitment=Confirmed)
        self.program_id = PublicKey(settings.solana_program_id)
        self.mint = PublicKey(settings.solana_usdc_mint)
        self.vault_ata = PublicKey(settings.solana_vault_ata)
        self.payer = self._load_keypair(settings.solana_keypair)

    def _load_keypair(self, key: str) -> Keypair:
        try:
            # If base58 secret
            return Keypair.from_base58_string(key)
        except Exception:
            pass
        try:
            # If JSON array
            secret = json.loads(key)
            return Keypair.from_secret_key(bytes(secret))
        except Exception as exc:
            raise ValueError("Invalid SOLANA_PRIVATE_KEY format") from exc

    def send_payout(self, recipient_ata: str, amount_ui: float, decimals: int = 6) -> Optional[str]:
        """
        Transfer SPL USDC from vault ATA to recipient ATA.
        """
        try:
            recipient = PublicKey(recipient_ata)
            tx = Transaction()
            amount_units = int(amount_ui * (10**decimals))
            ix = transfer_checked(
                TransferCheckedParams(
                    program_id=self.program_id,
                    source=self.vault_ata,
                    mint=self.mint,
                    dest=recipient,
                    owner=self.payer.public_key,
                    amount=amount_units,
                    decimals=decimals,
                    signers=[],
                )
            )
            tx.add(ix)
            resp = self.client.send_transaction(tx, self.payer)
            sig = resp.value
            logger.info("Solana payout sent: %s", sig)
            return sig
        except Exception as exc:
            logger.error("Solana payout failed: %s", exc)
            return None
