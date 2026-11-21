from __future__ import annotations

from typing import Any, Dict

SUPPORTED_LANGS = ("en", "hi", "as", "bn")


def localize(value: Any, lang: str = "en") -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return (
            value.get(lang)
            or value.get("en")
            or next((str(v) for v in value.values() if v), "")
        )
    return str(value)


def localize_doc(doc: Dict[str, Any], lang: str = "en") -> Dict[str, Any]:
    """Return a copy of a document with convenience localized scalar keys derived from *_i18n."""
    out = dict(doc)
    for key, val in doc.items():
        if key.endswith("_i18n") and isinstance(val, dict):
            base_key = key[:-5]
            if base_key not in out or not out[base_key]:
                out[base_key] = localize(val, lang)
    return out
