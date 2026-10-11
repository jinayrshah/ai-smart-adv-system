"""
Plain-language weather descriptions for provider condition codes.

Open-Meteo uses WMO code table 4677 (0-99, documented on open-meteo.com/en/docs);
OpenWeatherMap uses its own condition ids (200-804). Both are mapped here so the
advisory prompt and the UI never fall back to an invented "Partly cloudy".
"""

_WMO: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog with rime",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail",
}


def describe_weather_code(code: int | None) -> str | None:
    if code is None:
        return None
    try:
        code = int(code)
    except (TypeError, ValueError):
        return None
    if code in _WMO:
        return _WMO[code]
    # OpenWeatherMap condition ids
    if 200 <= code < 300:
        return "Thunderstorm"
    if 300 <= code < 400:
        return "Drizzle"
    if 500 <= code < 600:
        return "Rain"
    if 600 <= code < 700:
        return "Snow"
    if 700 <= code < 800:
        return "Haze or mist"
    if code == 800:
        return "Clear sky"
    if 801 <= code <= 804:
        return "Cloudy"
    return None
