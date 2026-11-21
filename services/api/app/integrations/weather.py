from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict

import httpx

from services.common.cache import get_cache
from services.common.config import get_settings


class WeatherProvider(ABC):
    @abstractmethod
    async def get_forecast(self, lat: float, lng: float) -> Dict[str, Any]:
        ...


class MockNEWeatherProvider(WeatherProvider):
    async def get_forecast(self, lat: float, lng: float) -> Dict[str, Any]:
        high_alt = lat > 27.2
        return {
            "lat": lat,
            "lng": lng,
            "temp_c": 9 if high_alt else 21,
            "feels_like_c": 6 if high_alt else 21,
            "condition": "Crisp mountain mist" if high_alt else "Mild & partly cloudy",
            "humidity_pct": 74,
            "rain_chance_pct": 15,
            "advisory": "Pack thermal layers for evening ridge winds." if high_alt else "Light rain shell recommended.",
            "source": "demo_ne_weather_provider",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }


class HttpWeatherProvider(WeatherProvider):
    def __init__(self, api_key: str, base_url: str) -> None:
        self._key = api_key
        self._base = base_url.rstrip("/")

    async def get_forecast(self, lat: float, lng: float) -> Dict[str, Any]:
        if not self._base:
            return await MockNEWeatherProvider().get_forecast(lat, lng)
        cache = get_cache()
        ck = f"cache:weather:{round(lat, 2)}:{round(lng, 2)}"
        cached = cache.get_json(ck)
        if cached is not None:
            return cached
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    self._base,
                    params={"lat": lat, "lon": lng, "appid": self._key, "units": "metric"},
                )
                resp.raise_for_status()
                data = resp.json()
                cache.set_json(ck, data, ttl_seconds=600)
                return data
        except Exception:
            return await MockNEWeatherProvider().get_forecast(lat, lng)


def get_weather_provider() -> WeatherProvider:
    settings = get_settings()
    if settings.weather_api_key.strip():
        return HttpWeatherProvider(settings.weather_api_key, settings.weather_api_base_url)
    return MockNEWeatherProvider()
