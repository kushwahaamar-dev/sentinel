import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

import httpx

from backend.config import Settings, get_settings

logger = logging.getLogger(__name__)

GDACS_RSS_URL = "https://www.gdacs.org/xml/rss.xml"
EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
OWM_ONECALL_URL = "https://api.openweathermap.org/data/3.0/onecall"
NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"

HIGH_RISK_ZONES: List[Dict[str, Any]] = [
    {"name": "Miami", "lat": 25.7617, "lon": -80.1918},
    {"name": "Tokyo", "lat": 35.6764, "lon": 139.6500},
    {"name": "Manila", "lat": 14.5995, "lon": 120.9842},
]

HIGH_RISK_ZONES_US: List[Dict[str, Any]] = [
    {"name": "Miami", "lat": 25.7617, "lon": -80.1918},
    {"name": "Houston", "lat": 29.7604, "lon": -95.3698},
    {"name": "New Orleans", "lat": 29.9511, "lon": -90.0715},
    {"name": "Tampa", "lat": 27.9506, "lon": -82.4572},
]

def _http_status_label(name: str, exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        if code in (401, 403):
            return f"{name}: Unauthorized (check API key / plan)"
        if code == 429:
            return f"{name}: Rate Limited"
        if code == 406:
            return f"{name}: Not Acceptable (bad Accept header)"
        return f"{name}: HTTP {code}"
    if isinstance(exc, (httpx.ReadTimeout, httpx.ConnectTimeout)):
        return f"{name}: Timeout"
    if isinstance(exc, (httpx.ConnectError, httpx.NetworkError)):
        return f"{name}: Signal Lost"
    return f"{name}: Signal Lost"


def _get_json_with_retries(
    client: httpx.Client,
    url: str,
    *,
    name: str,
    params: Optional[dict] = None,
    headers: Optional[dict] = None,
    retries: int = 2,
) -> dict:
    """Robust GET+JSON with small backoff for public APIs."""
    last_exc: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            resp = client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < retries:
                time.sleep(0.35 * (attempt + 1))
            continue
    raise last_exc  # type: ignore[misc]


def _parse_iso8601(value: str) -> Optional[datetime]:
    """Best-effort ISO8601 parser that accepts trailing Z."""
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


@dataclass
class SourceEvent:
    source: str
    disaster_type: str
    description: str
    location: Tuple[float, float]
    raw: Dict[str, Any] = field(default_factory=dict)
    severity: Optional[str] = None  # e.g., alert level or headline


@dataclass
class IngestionResult:
    mode: str
    events: List[SourceEvent] = field(default_factory=list)
    logs: List[str] = field(default_factory=list)


class IngestionSwitchboard:
    """Route between live sources and mock scenarios based on SENTINEL_MODE."""

    def __init__(self, settings: Optional[Settings] = None, client: Optional[httpx.Client] = None) -> None:
        self.settings = settings or get_settings()
        # Slightly higher default timeout reduces false "Signal Lost" in LIVE demos.
        # Keep defaults conservative; set per-source Accept headers when needed.
        self.client = client or httpx.Client(
            headers={
                "User-Agent": "UniversalSentinel/1.0 (contact: dev@universalsentinel.local)",
                "Accept": "*/*",
            },
            timeout=20,
        )

    def fetch_gdacs(self) -> Tuple[List[SourceEvent], str]:
        ns = {
            "gdacs": "http://www.gdacs.org",
            "geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",
            "georss": "http://www.georss.org/georss",
        }
        try:
            response = self.client.get(
                GDACS_RSS_URL,
                headers={
                    "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
                },
            )
            response.raise_for_status()
        except Exception as exc:
            logger.warning("GDACS signal lost: %s", exc)
            return [], _http_status_label("GDACS", exc)

        events: List[SourceEvent] = []
        try:
            root = ET.fromstring(response.text)
        except ET.ParseError as exc:
            logger.error("GDACS XML parse error: %s", exc)
            return events, "GDACS: Parse Error"

        for item in root.findall("./channel/item"):
            alert_level = (item.findtext("gdacs:alertlevel", default="", namespaces=ns) or "").strip()
            if alert_level not in {"Red", "Orange"}:
                continue

            point_text = item.findtext("georss:point", default="", namespaces=ns)
            try:
                lat_str, lon_str = point_text.split()
                lat, lon = float(lat_str), float(lon_str)
            except Exception:
                continue

            event_type = (item.findtext("gdacs:eventtype", default="unknown", namespaces=ns) or "").lower()
            description = item.findtext("description", default="").strip()

            events.append(
                SourceEvent(
                    source="gdacs",
                    disaster_type=event_type or "unknown",
                    description=description,
                    location=(lat, lon),
                    raw={
                        "alert_level": alert_level,
                        "title": item.findtext("title", default=""),
                        "link": item.findtext("link", default=""),
                    },
                    severity=alert_level,
                )
            )

        status = f"GDACS: {len(events)} significant alerts" if events else "GDACS: No Red/Orange alerts"
        return events, status

    def fetch_eonet(self) -> Tuple[List[SourceEvent], str]:
        params = {"status": "open", "category": "wildfires,volcanoes"}
        try:
            payload = _get_json_with_retries(
                self.client,
                EONET_URL,
                name="EONET",
                params=params,
                headers={"Accept": "application/json"},
                retries=2,
            )
        except Exception as exc:
            logger.warning("EONET signal lost: %s", exc)
            return [], _http_status_label("EONET", exc)

        now = datetime.now(timezone.utc)
        # Expand window to 7 days to catch more events (wildfires/volcanoes can persist)
        week_ago = now - timedelta(days=7)
        day_ago = now - timedelta(hours=24)

        events: List[SourceEvent] = []
        for event in payload.get("events", []):
            geometries = event.get("geometry", [])
            if not geometries:
                continue
                
            # Get the most recent geometry update
            latest_geom = max(geometries, key=lambda g: _parse_iso8601(g.get("date", "")) or datetime.min.replace(tzinfo=timezone.utc))
            latest_ts = _parse_iso8601(latest_geom.get("date", ""))
            
            # Include events updated within the last 7 days (more inclusive)
            if not latest_ts or latest_ts < week_ago:
                continue

            coords = latest_geom.get("coordinates", [])
            try:
                lon, lat = float(coords[0]), float(coords[1])
            except Exception:
                continue

            # Determine severity based on how recent the update is
            if latest_ts >= day_ago:
                severity = "active"
            else:
                severity = "recent"
            events.append(
                SourceEvent(
                    source="eonet",
                    disaster_type=event.get("categories", [{}])[0].get("id", "wildfire").lower(),
                    description=event.get("title", ""),
                    location=(lat, lon),
                    raw={"geometry": geometries, "id": event.get("id"), "link": event.get("link"), "latest_date": latest_geom.get("date")},
                    severity=severity,
                )
            )

        status = f"EONET: {len(events)} events" if events else "EONET: Quiet"
        return events, status

    def fetch_owm(self) -> Tuple[List[SourceEvent], str]:
        settings = self.settings
        if not settings.owm_api_key:
            return [], "OWM: Missing API key"

        events: List[SourceEvent] = []
        failures = 0
        last_exc: Optional[Exception] = None
        for zone in HIGH_RISK_ZONES:
            try:
                response = self.client.get(
                    OWM_ONECALL_URL,
                    params={"lat": zone["lat"], "lon": zone["lon"], "appid": settings.owm_api_key},
                )
                response.raise_for_status()
                data = response.json()
            except Exception as exc:
                logger.warning("OWM signal lost for %s: %s", zone["name"], exc)
                failures += 1
                last_exc = exc
                continue

            for alert in data.get("alerts", []) or []:
                headline = alert.get("event", "").lower()
                description = alert.get("description", "")
                if "warning" in headline or "evacuation" in description.lower():
                    events.append(
                        SourceEvent(
                            source="owm",
                            disaster_type="storm",
                            description=description or headline,
                            location=(zone["lat"], zone["lon"]),
                            raw={"sender": alert.get("sender_name"), "start": alert.get("start"), "end": alert.get("end")},
                            severity=alert.get("event"),
                        )
                    )

        if failures == len(HIGH_RISK_ZONES):
            status = _http_status_label("OWM", last_exc) if last_exc else "OWM: Signal Lost"
        else:
            status = f"OWM: {len(events)} alerts" if events else "OWM: No warnings"
        return events, status

    def fetch_nws(self) -> Tuple[List[SourceEvent], str]:
        """
        FREE replacement for OWM alerts: NOAA/NWS active alerts (US-only).
        First tries global active alerts, then falls back to point-specific queries.
        """
        events: List[SourceEvent] = []
        failures = 0
        last_exc: Optional[Exception] = None
        
        # First, try to get all active alerts (more comprehensive)
        try:
            payload = _get_json_with_retries(
                self.client,
                NWS_ALERTS_URL,
                name="NWS",
                params={},  # No point parameter = get all active alerts
                headers={"Accept": "application/geo+json, application/json;q=0.9"},
                retries=2,
            )
            
            features = payload.get("features", []) or []
            # Filter for significant alerts only (warnings, watches, not just advisories)
            for feat in features:
                props = (feat or {}).get("properties", {}) or {}
                headline = (props.get("headline") or props.get("event") or "").strip()
                description = (props.get("description") or "").strip()
                instruction = (props.get("instruction") or "").strip()
                severity = (props.get("severity") or "").strip().lower()
                sender = (props.get("senderName") or "NWS").strip()
                
                # Get location from geometry if available
                geom = feat.get("geometry", {})
                coords = None
                if geom and geom.get("type") == "Point":
                    coords = geom.get("coordinates", [])
                elif geom and geom.get("type") == "Polygon":
                    # Use centroid of polygon
                    rings = geom.get("coordinates", [])
                    if rings and rings[0]:
                        coords = [sum(c[0] for c in rings[0]) / len(rings[0]), 
                                 sum(c[1] for c in rings[0]) / len(rings[0])]

                hay = f"{headline} {description} {instruction}".lower()
                # Focus on warnings and watches (more significant than advisories)
                if any(k in hay for k in ["warning", "watch", "evac", "evacu", "hurricane", "tornado", "tropical storm", "storm surge", "severe thunderstorm", "flash flood"]) or severity in ["extreme", "severe"]:
                    if coords:
                        lat, lon = float(coords[1]), float(coords[0])
                    else:
                        # Fallback: use first high-risk zone if no coordinates
                        lat, lon = HIGH_RISK_ZONES_US[0]["lat"], HIGH_RISK_ZONES_US[0]["lon"]
                    
                    events.append(
                        SourceEvent(
                            source="nws",
                            disaster_type="storm",
                            description=headline or description or "NWS Alert",
                            location=(lat, lon),
                            raw={
                                "sender_name": sender,
                                "headline": headline,
                                "severity": severity,
                                "description": description,
                                "instruction": instruction,
                                "areaDesc": props.get("areaDesc"),
                                "id": props.get("id"),
                                "web": props.get("web"),
                            },
                            severity=severity or headline,
                        )
                    )
            
            # Limit to top 20 most significant alerts to avoid spam
            events = events[:20]
            status = f"NWS: {len(events)} significant alerts" if events else "NWS: No warnings"
            
        except Exception as exc:
            logger.warning("NWS global fetch failed, trying point-specific: %s", exc)
            last_exc = exc
            failures += 1
            
            # Fallback to point-specific queries
            for zone in HIGH_RISK_ZONES_US:
                try:
                    payload = _get_json_with_retries(
                        self.client,
                        NWS_ALERTS_URL,
                        name="NWS",
                        params={"point": f'{zone["lat"]},{zone["lon"]}'},
                        headers={"Accept": "application/geo+json, application/json;q=0.9"},
                        retries=1,
                    )
                    
                    features = payload.get("features", []) or []
                    for feat in features:
                        props = (feat or {}).get("properties", {}) or {}
                        headline = (props.get("headline") or props.get("event") or "").strip()
                        description = (props.get("description") or "").strip()
                        instruction = (props.get("instruction") or "").strip()
                        severity = (props.get("severity") or "").strip()
                        sender = (props.get("senderName") or "NWS").strip()

                        hay = f"{headline} {description} {instruction}".lower()
                        if any(k in hay for k in ["warning", "watch", "evac", "evacu", "hurricane", "tornado", "tropical storm", "storm surge"]):
                            events.append(
                                SourceEvent(
                                    source="nws",
                                    disaster_type="storm",
                                    description=headline or description or "NWS Alert",
                                    location=(zone["lat"], zone["lon"]),
                                    raw={
                                        "sender_name": sender,
                                        "headline": headline,
                                        "severity": severity,
                                        "description": description,
                                        "instruction": instruction,
                                        "areaDesc": props.get("areaDesc"),
                                        "id": props.get("id"),
                                        "web": props.get("web"),
                                    },
                                    severity=severity or headline,
                                )
                            )
                except Exception:
                    continue

            if failures and not events:
                status = _http_status_label("NWS", last_exc) if last_exc else "NWS: Signal Lost"
            else:
                status = f"NWS: {len(events)} alerts" if events else "NWS: No warnings"

        return events, status

    def load_mock_scenarios(self, path: Path) -> Tuple[List[SourceEvent], str]:
        if not path.exists():
            return [], "Mock: scenarios file missing"

        try:
            scenarios = json.loads(path.read_text())
        except Exception as exc:
            logger.error("Mock scenarios parse error: %s", exc)
            return [], "Mock: Parse Error"

        events: List[SourceEvent] = []
        for scenario in scenarios:
            events.append(
                SourceEvent(
                    source="mock",
                    disaster_type=scenario.get("type", "unknown"),
                    description=scenario.get("description", ""),
                    location=(scenario.get("lat", 0.0), scenario.get("lon", 0.0)),
                    raw=scenario,
                    severity=scenario.get("severity"),
                )
            )
        return events, f"Mock: {len(events)} scenarios loaded"

    def ingest(self, scenarios_path: Optional[Path] = None) -> IngestionResult:
        if self.settings.sentinel_mode == "MOCK":
            events, status = self.load_mock_scenarios(
                scenarios_path or Path(__file__).resolve().parent.parent / "data" / "scenarios.json"
            )
            return IngestionResult(mode="MOCK", events=events, logs=[status, "Awaiting simulation trigger"])

        events: List[SourceEvent] = []
        logs: List[str] = []

        gdacs_events, gdacs_status = self.fetch_gdacs()
        eonet_events, eonet_status = self.fetch_eonet()
        nws_events, nws_status = self.fetch_nws()

        events.extend(gdacs_events)
        events.extend(eonet_events)
        events.extend(nws_events)
        logs.extend([gdacs_status, eonet_status, nws_status])

        return IngestionResult(mode="LIVE", events=events, logs=logs)

    def close(self) -> None:
        try:
            self.client.close()
        except Exception:
            pass
