"""Backend tests for Bitcoin Kids leads API."""
import os

import pytest
import requests

BASE_URL: str = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://ecab7e7e-17ba-4dd9-ab52-65009c120ad5.preview.emergentagent.com",
).rstrip("/")


@pytest.fixture(scope="module")
def api() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _create_lead(api: requests.Session, **overrides: str) -> requests.Response:
    payload = {"name": "TEST_Родитель", "contact": "+7 999 111-22-33", "age": "10 лет"}
    payload.update(overrides)
    return api.post(f"{BASE_URL}/api/leads", json=payload)


def _count_leads(api: requests.Session) -> int:
    r = api.get(f"{BASE_URL}/api/leads")
    assert r.status_code == 200
    return len(r.json())


# ---- Health ----
def test_health_returns_status_and_telegram_flag(api: requests.Session) -> None:
    r = api.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert isinstance(data["telegram_configured"], bool)


# ---- Leads: create ----
def test_create_lead_returns_id_and_echoes_fields(api: requests.Session) -> None:
    r = _create_lead(api)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("_id"), f"missing _id in response: {data}"
    assert data["name"] == "TEST_Родитель"
    assert data["contact"] == "+7 999 111-22-33"
    assert data["age"] == "10 лет"
    assert data.get("created_at")


def test_create_lead_increments_count(api: requests.Session) -> None:
    before = _count_leads(api)
    r = _create_lead(api)
    assert r.status_code == 200, r.text
    assert _count_leads(api) == before + 1


def test_created_lead_is_retrievable_in_list(api: requests.Session) -> None:
    r = _create_lead(api)
    assert r.status_code == 200, r.text
    created_id = r.json()["_id"]
    listing = api.get(f"{BASE_URL}/api/leads")
    assert listing.status_code == 200
    ids = [d.get("_id") for d in listing.json()]
    assert created_id in ids


# ---- Leads: validation ----
def test_create_lead_empty_name_returns_400(api: requests.Session) -> None:
    r = api.post(f"{BASE_URL}/api/leads", json={"name": "", "contact": "+79990000000"})
    assert r.status_code == 400


def test_create_lead_empty_contact_returns_400(api: requests.Session) -> None:
    r = api.post(f"{BASE_URL}/api/leads", json={"name": "TEST_x", "contact": "   "})
    assert r.status_code == 400


def test_create_lead_missing_fields_returns_422(api: requests.Session) -> None:
    r = api.post(f"{BASE_URL}/api/leads", json={"name": "TEST_x"})
    assert r.status_code in (400, 422)


# ---- Reachability ----
def test_leads_endpoint_reachable_via_public_url(api: requests.Session) -> None:
    r = api.get(f"{BASE_URL}/api/leads")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
