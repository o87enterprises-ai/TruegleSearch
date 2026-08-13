"""
Truegle OSINT service — the Python-only lookups, behind a small HTTP API.

WHY THIS EXISTS: the Node toolbelt already does everything Node can do keylessly
(RDAP, DNS, certificate transparency, Wayback, Gravatar, GitHub, a hand-written
handle check). The ceiling is the ecosystem — the serious OSINT libraries are
Python, and reimplementing holehe's 120 site checks in JavaScript would be
weeks of work to end up behind.

So this is an ADDITION, not a rewrite. Every Node lookup stays where it is.

WHAT THIS DELIBERATELY DOES NOT DO: anything that needs a residential IP. The
people-search sites (TruePeopleSearch, FastPeopleSearch, ThatsThem) block
datacenter ranges outright, and this runs on a free cloud host, so asking them
from here would just collect 403s. That is Tier 2's job — see
docs/OSINT-SERVICE-PLAN.md.

EVERY ENDPOINT IS BUDGETED. maigret across every site it knows takes minutes;
holehe hits ~120 sites. A request that runs to completion is worse than useless
if the caller has already given up, so each route takes a millisecond budget,
returns whatever finished inside it, and says `partial: true`. A partial answer
beats a timeout.

EVERY FAILURE IS A 200 WITH ok:false where the request itself was well-formed.
The Node caller treats each lookup as one more settled promise, so an upstream
being down costs one section of a report rather than the whole thing.
"""

import asyncio
import os
import time
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

VERSION = "1.0.0"

# The Space URL is public. Without this it is a free OSINT API for the whole
# internet, and the abuse lands on our IP reputation — which is the one asset
# these lookups actually depend on.
TOKEN = os.environ.get("OSINT_SERVICE_TOKEN", "")

app = FastAPI(title="Truegle OSINT", version=VERSION)


def auth(header: Optional[str]) -> None:
    if not TOKEN:
        # Refuse to run open rather than quietly becoming a public service.
        raise HTTPException(503, "OSINT_SERVICE_TOKEN is not configured")
    if header != f"Bearer {TOKEN}":
        raise HTTPException(401, "unauthorized")


def has(mod: str) -> bool:
    try:
        __import__(mod)
        return True
    except Exception:
        return False


# ── models ──────────────────────────────────────────────────────────────────
class EmailReq(BaseModel):
    email: str
    budget_ms: int = Field(20000, ge=1000, le=120000)


class UserReq(BaseModel):
    username: str
    limit: int = Field(80, ge=1, le=500)
    budget_ms: int = Field(25000, ge=1000, le=120000)


class PhoneReq(BaseModel):
    phone: str
    region: Optional[str] = None


class DomainReq(BaseModel):
    domain: str
    limit: int = Field(40, ge=1, le=200)
    budget_ms: int = Field(20000, ge=1000, le=120000)


@app.get("/health")
def health():
    return {
        "ok": True,
        "version": VERSION,
        "authConfigured": bool(TOKEN),
        "tools": {
            "holehe": has("holehe"),
            "maigret": has("maigret"),
            "dnstwist": has("dnstwist"),
            "phonenumbers": has("phonenumbers"),
        },
    }


# ── phone: offline, and the reason this service earns its keep on day one ────
#
# libphonenumber-js (what Node uses) ships validation and formatting but NOT the
# geocoding or carrier metadata — those are separate datasets the JS port leaves
# out. The Python library has both, offline, no network call at all. So this is
# strictly more than Node can produce, answers instantly, and cannot rate-limit.
# It is also the right endpoint to smoke-test the deployment with.
@app.post("/phone")
def phone(req: PhoneReq, authorization: Optional[str] = Header(None)):
    auth(authorization)
    try:
        import phonenumbers
        from phonenumbers import carrier, geocoder, number_type, PhoneNumberType
    except Exception as e:  # pragma: no cover - import guard
        return {"ok": False, "error": f"phonenumbers unavailable: {e}"}

    raw = (req.phone or "").strip()
    region = (req.region or "US").upper()
    try:
        # A bare national number needs a region; an explicit + carries its own.
        parsed = phonenumbers.parse(raw, None if raw.startswith("+") else region)
    except Exception as e:
        return {"ok": False, "error": f"could not parse: {e}"}

    kind = {
        PhoneNumberType.MOBILE: "mobile",
        PhoneNumberType.FIXED_LINE: "fixed_line",
        PhoneNumberType.FIXED_LINE_OR_MOBILE: "fixed_line_or_mobile",
        PhoneNumberType.VOIP: "voip",
        PhoneNumberType.TOLL_FREE: "toll_free",
        PhoneNumberType.PREMIUM_RATE: "premium_rate",
    }.get(number_type(parsed), "unknown")

    return {
        "ok": True,
        "valid": phonenumbers.is_valid_number(parsed),
        "possible": phonenumbers.is_possible_number(parsed),
        "e164": phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164),
        "international": phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL),
        "country": phonenumbers.region_code_for_number(parsed),
        "country_code": parsed.country_code,
        # The two fields Node cannot produce.
        "carrier": carrier.name_for_number(parsed, "en") or None,
        "location": geocoder.description_for_number(parsed, "en") or None,
        "line_type": kind,
        "assumed_region": None if raw.startswith("+") else region,
    }


# ── email: account existence across ~120 sites ───────────────────────────────
@app.post("/email")
async def email(req: EmailReq, authorization: Optional[str] = Header(None)):
    auth(authorization)
    started = time.monotonic()
    try:
        import httpx
        from holehe.core import import_submodules, get_functions
    except Exception as e:
        return {"ok": False, "error": f"holehe unavailable: {e}"}

    addr = (req.email or "").strip().lower()
    if "@" not in addr:
        return {"ok": False, "error": "invalid email"}

    out: list = []
    try:
        modules = import_submodules("holehe.modules")
        funcs = get_functions(modules)
        async with httpx.AsyncClient(timeout=10) as client:
            # holehe's own runner has no overall deadline, so drive it here and
            # cut the whole batch at the budget rather than per-site.
            tasks = [f(addr, client, out) for f in funcs]
            done, pending = await asyncio.wait(
                [asyncio.create_task(t) for t in tasks],
                timeout=req.budget_ms / 1000,
            )
            for p in pending:
                p.cancel()
        partial = len(pending) > 0
    except Exception as e:
        return {"ok": False, "error": str(e)}

    found = [r for r in out if r.get("exists") is True]
    return {
        "ok": True,
        "email": addr,
        "checked": len(out),
        "found": [
            {
                "site": r.get("name"),
                "exists": True,
                "email_recovery": r.get("emailrecovery"),
                "phone_recovery": r.get("phoneNumber"),
                "others": r.get("others"),
            }
            for r in found
        ],
        "partial": partial,
        "took_ms": int((time.monotonic() - started) * 1000),
    }


# ── username: hundreds of sites instead of the fourteen Node hand-writes ─────
@app.post("/username")
async def username(req: UserReq, authorization: Optional[str] = Header(None)):
    auth(authorization)
    started = time.monotonic()
    try:
        import maigret
        from maigret.sites import MaigretDatabase
    except Exception as e:
        return {"ok": False, "error": f"maigret unavailable: {e}"}

    handle = (req.username or "").strip()
    if not handle:
        return {"ok": False, "error": "invalid username"}

    try:
        db = MaigretDatabase().load_from_path(
            os.path.join(os.path.dirname(maigret.__file__), "resources/data.json")
        )
        # Ranked subset, not everything it knows: the full set is thousands of
        # sites and minutes of wall clock, which no request can wait for.
        sites = db.ranked_sites_dict(top=req.limit)
        results = await asyncio.wait_for(
            maigret.search(
                username=handle,
                site_dict=sites,
                timeout=10,
                logger=None,
                no_progressbar=True,
            ),
            timeout=req.budget_ms / 1000,
        )
        partial = False
    except asyncio.TimeoutError:
        return {
            "ok": True, "username": handle, "checked": 0, "found": [],
            "partial": True, "note": "budget exhausted before any site answered",
            "took_ms": int((time.monotonic() - started) * 1000),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

    found = []
    for site, data in (results or {}).items():
        status = data.get("status")
        if status and getattr(status, "status", None) and str(status.status).endswith("CLAIMED"):
            found.append({"site": site, "url": data.get("url_user")})

    return {
        "ok": True,
        "username": handle,
        "checked": len(results or {}),
        "found": found,
        "partial": partial,
        "took_ms": int((time.monotonic() - started) * 1000),
    }


# ── domain: lookalikes that actually resolve ─────────────────────────────────
@app.post("/domain")
def domain(req: DomainReq, authorization: Optional[str] = Header(None)):
    auth(authorization)
    started = time.monotonic()
    try:
        import dnstwist
    except Exception as e:
        return {"ok": False, "error": f"dnstwist unavailable: {e}"}

    name = (req.domain or "").strip().lower()
    if "." not in name:
        return {"ok": False, "error": "invalid domain"}

    try:
        fuzz = dnstwist.Fuzzer(name)
        fuzz.generate()
        # Only the permutations, capped — resolving every one is the slow part.
        candidates = [d for d in fuzz.domains][: req.limit]
        registered = []
        for d in candidates:
            if (time.monotonic() - started) * 1000 > req.budget_ms:
                return {
                    "ok": True, "domain": name, "checked": len(registered),
                    "registered": registered, "partial": True,
                    "took_ms": int((time.monotonic() - started) * 1000),
                }
            try:
                import socket
                addr = socket.gethostbyname(d["domain-name"])
                registered.append({"domain": d["domain-name"], "dns_a": addr, "fuzzer": d.get("fuzzer")})
            except Exception:
                pass  # NXDOMAIN is the common case and is not an error
    except Exception as e:
        return {"ok": False, "error": str(e)}

    return {
        "ok": True,
        "domain": name,
        "checked": len(candidates),
        "registered": registered,
        "partial": False,
        "took_ms": int((time.monotonic() - started) * 1000),
    }
