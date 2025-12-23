import json
import logging
from typing import Any, Dict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

import google.generativeai as genai

from backend.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()
_gemini_configured = False

if settings.gemini_api_key:
    try:
        genai.configure(api_key=settings.gemini_api_key)
        _gemini_configured = True
        logger.info("Gemini API configured successfully")
    except Exception as e:
        logger.warning(f"Gemini configuration failed: {e}")
else:
    logger.warning("GEMINI_API_KEY not set; AI decisions will use mock responses.")


def get_ai_decision(disaster_type: str, raw_data: Dict[str, Any], location: str) -> Dict[str, Any]:
    """
    Returns AI decision with strict YES/NO authorization.
    Internal structure includes reasoning for logging, but final authorization is binary.
    """
    # Mock Mode Bypass
    if settings.sentinel_mode == "MOCK":
        logger.info("MOCK MODE: Returning deterministic AI decision.")
        dt_lower = disaster_type.lower()
        
        # Deterministic logic for demo
        if "quake" in dt_lower or "earthquake" in dt_lower or "eq" in dt_lower:
            return {
                "authorization": "YES",
                "decision": "PAYOUT",
                "confidence_score": 98,
                "reasoning": "Magnitude 8.2 earthquake centered in Tokyo metropolitan area. Population density exceeds 14M. USGS confirms P-wave detection. Catastrophic infrastructure damage projected. Parametric trigger: ACTIVATED.",
                "payout_amount_usdc": "8200"
            }
        elif "fire" in dt_lower or "volcano" in dt_lower or "wildfire" in dt_lower:
            return {
                "authorization": "YES",
                "decision": "PAYOUT",
                "confidence_score": 94,
                "reasoning": "NASA EONET thermal imaging confirms 450°C anomaly at Yellowstone caldera. 12km ash plume verified by NOAA. Seismic swarm activity persisting >24h. Population at risk: 150K within 50km radius. Parametric trigger: ACTIVATED.",
                "payout_amount_usdc": "5600"
            }
        elif "storm" in dt_lower or "hurricane" in dt_lower or "cyclone" in dt_lower or "typhoon" in dt_lower:
            return {
                "authorization": "YES",
                "decision": "PAYOUT",
                "confidence_score": 92,
                "reasoning": "Category 5 hurricane with 180mph sustained winds making landfall. NHC tracking confirms direct path to Miami-Dade (pop. 2.7M). Storm surge 15ft projected. Mandatory evacuation zones A/B/C activated. Parametric trigger: ACTIVATED.",
                "payout_amount_usdc": "9500"
            }
        elif "flood" in dt_lower or "fl" == dt_lower or "ts" == dt_lower or "tsunami" in dt_lower:
            return {
                "authorization": "YES",
                "decision": "PAYOUT",
                "confidence_score": 87,
                "reasoning": "Flood/tsunami event confirmed by multiple sensors. Coastal population centers at significant risk. Emergency response protocols activated. Parametric trigger: ACTIVATED.",
                "payout_amount_usdc": "7200"
            }
        else:
            return {
                "authorization": "NO",
                "decision": "DENY",
                "confidence_score": 25,
                "reasoning": f"Event type '{disaster_type}' does not meet parametric thresholds. Severity insufficient for autonomous payout. Manual review recommended.",
                "payout_amount_usdc": "0"
            }

    # If Gemini not configured, use intelligent fallback based on disaster type
    if not _gemini_configured:
        logger.info("LIVE MODE: No Gemini API key, using intelligent fallback")
        return _intelligent_fallback(disaster_type, raw_data, location)

    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = f"""
    ROLE: You are the Chief Risk Officer for an Autonomous Insurance Fund.

    INPUT DATA:
    - Type: {disaster_type}
    - Raw Telemetry: {json.dumps(raw_data, default=str)}
    - Location: {location}

    TASK:
    Analyze the telemetry. Cross-reference with your internal knowledge of the location's population density and infrastructure.

    CRITERIA FOR PAYOUT:
    1. Is this a CATASTROPHIC event? (Not just 'bad', but 'system-critical')
    2. Is it near a populated area (>50,000 people)?
    3. Is the confidence of the data source high?

    OUTPUT FORMAT (JSON ONLY):
    {{
        "authorization": "YES" or "NO",
        "decision": "PAYOUT" or "DENY",
        "confidence_score": 0-100,
        "reasoning": "One sentence summary of why.",
        "payout_amount_usdc": "Calculated amount based on severity (max 10000)"
    }}
    
    CRITICAL: The "authorization" field must be EXACTLY "YES" or "NO". 
    Only "YES" authorizes fund release. Any other value defaults to "NO".
    """

    def call_gemini():
        return model.generate_content(prompt)

    # Use ThreadPoolExecutor for timeout (Gemini SDK doesn't support timeout directly)
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(call_gemini)
            response = future.result(timeout=15)  # 15 second timeout
    except FuturesTimeoutError:
        logger.error("Gemini request timed out after 15 seconds")
        return _intelligent_fallback(disaster_type, raw_data, location)
    except Exception as exc:
        logger.error("Gemini generation failed: %s", exc)
        return _intelligent_fallback(disaster_type, raw_data, location)

    try:
        # Cleanup potential markdown code blocks
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        parsed = json.loads(text)
        
        # Enforce strict YES/NO authorization
        auth = str(parsed.get("authorization", "")).strip().upper()
        if auth not in ("YES", "NO"):
            logger.warning(f"Invalid authorization value: '{auth}', defaulting to NO")
            auth = "NO"
        
        # Ensure decision matches authorization
        decision = "PAYOUT" if auth == "YES" else "DENY"
        parsed["authorization"] = auth
        parsed["decision"] = decision
        
        # If authorization is NO, ensure payout is 0
        if auth == "NO":
            parsed["payout_amount_usdc"] = "0"
        
        return parsed
    except Exception as exc:
        logger.error("Gemini JSON parse error: %s; response=%s", exc, response.text)
        return _intelligent_fallback(disaster_type, raw_data, location)


def _intelligent_fallback(disaster_type: str, raw_data: Dict[str, Any], location: str) -> Dict[str, Any]:
    """
    Intelligent fallback when Gemini is unavailable.
    Uses rule-based analysis of the raw data to make decisions.
    """
    dt_lower = disaster_type.lower()
    severity = str(raw_data.get("severity", raw_data.get("alert_level", ""))).lower()
    
    # Check for high-severity indicators
    is_red_alert = severity in ["red", "severe", "extreme", "warning"]
    is_orange_alert = severity in ["orange", "moderate", "watch"]
    
    # Earthquake analysis
    if "quake" in dt_lower or "earthquake" in dt_lower or "eq" in dt_lower:
        magnitude = raw_data.get("magnitude", 0)
        if magnitude >= 7.0 or is_red_alert:
            return {
                "authorization": "YES",
                "decision": "PAYOUT",
                "confidence_score": 85,
                "reasoning": f"Significant seismic event detected at {location}. Severity: {severity}. Population centers potentially affected.",
                "payout_amount_usdc": str(min(10000, int(magnitude * 1000) if magnitude else 6500))
            }
    
    # Fire/Volcano analysis
    if "fire" in dt_lower or "volcano" in dt_lower or "wildfire" in dt_lower:
        if is_red_alert or "active" in str(raw_data).lower():
            return {
                "authorization": "YES",
                "decision": "PAYOUT",
                "confidence_score": 82,
                "reasoning": f"Thermal anomaly/fire event confirmed at {location}. Alert level: {severity}. Immediate risk to infrastructure.",
                "payout_amount_usdc": "5500"
            }
    
    # Storm/Hurricane analysis
    if "storm" in dt_lower or "hurricane" in dt_lower or "cyclone" in dt_lower or "tsunami" in dt_lower or "flood" in dt_lower or "fl" == dt_lower:
        if is_red_alert or "evacuation" in str(raw_data).lower() or "warning" in str(raw_data).lower():
            return {
                "authorization": "YES",
                "decision": "PAYOUT",
                "confidence_score": 88,
                "reasoning": f"Severe weather event at {location}. Official warnings issued. Population at significant risk.",
                "payout_amount_usdc": "7200"
            }
    
    # Default: deny if thresholds not met
    return {
        "authorization": "NO",
        "decision": "DENY",
        "confidence_score": 45,
        "reasoning": f"Event at {location} does not meet catastrophic thresholds. Severity level: {severity or 'unknown'}. Monitoring continues.",
        "payout_amount_usdc": "0"
    }
