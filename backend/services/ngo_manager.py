"""
NGO Verification and Selection Manager
Handles pre-verified NGO wallets and recipient selection logic.
"""
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class NGO:
    id: str
    name: str
    address: str
    verified: bool
    disaster_types: List[str]
    regions: List[str]
    description: str

class NGOManager:
    """Manages pre-verified NGO wallets and selection logic."""
    
    def __init__(self, ngos_path: Optional[Path] = None):
        self.ngos_path = ngos_path or Path(__file__).resolve().parent.parent / "data" / "ngos.json"
        self._ngos: List[NGO] = []
        self._load_ngos()
    
    def _load_ngos(self) -> None:
        """Load NGOs from JSON file."""
        try:
            if not self.ngos_path.exists():
                logger.warning(f"NGO file not found at {self.ngos_path}, using empty list")
                self._ngos = []
                return
            
            with open(self.ngos_path, "r") as f:
                data = json.load(f)
            
            self._ngos = [
                NGO(
                    id=item["id"],
                    name=item["name"],
                    address=item["address"],
                    verified=item.get("verified", False),
                    disaster_types=item.get("disaster_types", []),
                    regions=item.get("regions", []),
                    description=item.get("description", ""),
                )
                for item in data
            ]
            logger.info(f"Loaded {len(self._ngos)} NGOs from {self.ngos_path}")
        except Exception as e:
            logger.error(f"Failed to load NGOs: {e}")
            self._ngos = []
    
    def is_verified(self, address: str) -> bool:
        """Check if an address belongs to a verified NGO."""
        address_lower = address.lower()
        for ngo in self._ngos:
            if ngo.verified and ngo.address.lower() == address_lower:
                return True
        return False
    
    def get_ngo_by_address(self, address: str) -> Optional[NGO]:
        """Get NGO by wallet address."""
        address_lower = address.lower()
        for ngo in self._ngos:
            if ngo.address.lower() == address_lower:
                return ngo
        return None
    
    def select_recipient(
        self, 
        disaster_type: str, 
        location: Tuple[float, float],
        severity: Optional[str] = None
    ) -> Optional[NGO]:
        """
        Select the most appropriate NGO for a given disaster.
        
        Selection logic:
        1. Must be verified
        2. Must support the disaster type
        3. Prefer region-specific NGOs if location matches
        4. Fall back to global NGOs
        """
        lat, lon = location
        disaster_lower = disaster_type.lower()
        
        # Determine region from coordinates
        region = self._get_region(lat, lon)
        
        # Filter: verified + supports disaster type
        candidates = [
            ngo for ngo in self._ngos
            if ngo.verified and any(
                dt.lower() in disaster_lower or disaster_lower in dt.lower()
                for dt in ngo.disaster_types
            )
        ]
        
        if not candidates:
            logger.warning(f"No verified NGOs found for disaster type: {disaster_type}")
            return None
        
        # Prefer region-specific NGOs
        region_candidates = [
            ngo for ngo in candidates
            if region in ngo.regions or "global" in ngo.regions
        ]
        
        if region_candidates:
            # Return first region match (in production, could use more sophisticated ranking)
            selected = region_candidates[0]
            logger.info(f"Selected NGO: {selected.name} (region match: {region})")
            return selected
        
        # Fallback to any global NGO
        global_ngos = [ngo for ngo in candidates if "global" in ngo.regions]
        if global_ngos:
            selected = global_ngos[0]
            logger.info(f"Selected NGO: {selected.name} (global fallback)")
            return selected
        
        # Last resort: any candidate
        selected = candidates[0]
        logger.info(f"Selected NGO: {selected.name} (any available)")
        return selected
    
    def _get_region(self, lat: float, lon: float) -> str:
        """Determine region from coordinates."""
        # Simple region mapping (can be enhanced)
        if 10 <= lat <= 50 and 100 <= lon <= 150:
            return "asia"
        elif 25 <= lat <= 50 and -130 <= lon <= -65:
            return "north_america"
        elif 25 <= lat <= 50 and -100 <= lon <= -70:
            return "us"
        elif -50 <= lat <= 50 and -180 <= lon <= 180:
            return "pacific"
        return "global"
    
    def validate_address(self, address: str) -> Tuple[bool, Optional[str]]:
        """
        Validate Ethereum address format and verification status.
        Returns (is_valid, error_message)
        """
        if not address:
            return False, "Address is empty"
        
        # Basic Ethereum address validation (0x + 40 hex chars)
        address = address.strip()
        if not address.startswith("0x"):
            return False, "Address must start with 0x"
        
        if len(address) != 42:
            return False, f"Address must be 42 characters (got {len(address)})"
        
        try:
            int(address[2:], 16)  # Check if hex
        except ValueError:
            return False, "Address contains invalid hex characters"
        
        if not self.is_verified(address):
            return False, f"Address {address} is not a verified NGO wallet"
        
        return True, None
    
    def list_all_verified(self) -> List[NGO]:
        """Get all verified NGOs."""
        return [ngo for ngo in self._ngos if ngo.verified]
