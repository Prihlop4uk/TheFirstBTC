import os
import time
import logging
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Annotated, Optional, List

import httpx
import redis.asyncio as aioredis
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict

ROOT_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bitcoin_kids")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
REDIS_URL = os.environ.get("REDIS_URL", "").strip()

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

redis_client: Optional[aioredis.Redis] = None
if REDIS_URL:
    try:
        redis_client = aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    except Exception as e:
        logger.error("Redis init failed, falling back to in-memory limiter: %s", e)
        redis_client = None

app = FastAPI(title="Bitcoin Kids API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _validate_object_id(v) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


class Lead(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    contact: str
    age: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @classmethod
    def from_mongo(cls, doc: dict) -> "Lead":
        return cls(**doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data


class LeadCreate(BaseModel):
    name: str = Field(max_length=120)
    contact: str = Field(max_length=200)
    age: Optional[str] = Field(default="", max_length=40)
    # Honeypot: real users never fill this hidden field. Bots often do.
    website: Optional[str] = Field(default="", max_length=200)


# --- IP rate limiter: Redis-backed (shared/persistent) with in-memory fallback ---
RATE_LIMIT_MAX = 5          # max submissions
RATE_LIMIT_WINDOW = 600     # per 10 minutes
_rate_buckets: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited_memory(ip: str) -> bool:
    now = time.time()
    bucket = _rate_buckets[ip]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_MAX:
        return True
    bucket.append(now)
    return False


async def is_rate_limited(ip: str) -> bool:
    if redis_client is not None:
        try:
            key = f"rl:leads:{ip}"
            count = await redis_client.incr(key)
            if count == 1:
                await redis_client.expire(key, RATE_LIMIT_WINDOW)
            return count > RATE_LIMIT_MAX
        except Exception as e:
            logger.error("Redis rate-limit error, using memory fallback: %s", e)
    return _rate_limited_memory(ip)


async def notify_telegram(lead: Lead) -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured — lead saved but notification skipped.")
        return
    text = (
        "🎓 <b>Новая заявка на курс «Мой первый Биткоин Kids»</b>\n\n"
        f"👤 <b>Имя:</b> {lead.name}\n"
        f"📞 <b>Контакт:</b> {lead.contact}\n"
        f"🧒 <b>Возраст ребёнка:</b> {lead.age or '—'}\n"
        f"🕒 {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M UTC')}"
    )
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            resp = await hc.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            })
            if resp.status_code != 200:
                logger.error("Telegram send failed: %s %s", resp.status_code, resp.text)
    except Exception as e:
        logger.error("Telegram send error: %s", e)


@api.get("/")
async def root():
    return {"status": "ok", "service": "bitcoin-kids"}


@api.get("/health")
async def health():
    redis_ok = False
    if redis_client is not None:
        try:
            redis_ok = await redis_client.ping()
        except Exception:
            redis_ok = False
    return {
        "status": "ok",
        "telegram_configured": bool(TELEGRAM_TOKEN and TELEGRAM_CHAT_ID),
        "redis_connected": bool(redis_ok),
    }


@api.post("/leads", response_model=Lead)
async def create_lead(payload: LeadCreate, request: Request):
    ip = _client_ip(request)

    # Honeypot: if filled, silently accept without saving/notifying (fool the bot).
    if (payload.website or "").strip():
        logger.warning("Honeypot triggered from %s — spam ignored.", ip)
        return Lead(name="", contact="", age="")

    if await is_rate_limited(ip):
        logger.warning("Rate limit hit from %s.", ip)
        raise HTTPException(status_code=429, detail="Слишком много заявок. Попробуйте позже.")

    name = payload.name.strip()
    contact = payload.contact.strip()
    if not name or not contact:
        raise HTTPException(status_code=400, detail="Имя и контакт обязательны")
    lead = Lead(name=name, contact=contact, age=(payload.age or "").strip())
    res = await db.leads.insert_one(lead.to_mongo())
    lead.id = str(res.inserted_id)
    await notify_telegram(lead)
    return lead


@api.get("/leads", response_model=List[Lead])
async def list_leads():
    docs = await db.leads.find().sort("created_at", -1).to_list(500)
    return [Lead.from_mongo(d) for d in docs]


app.include_router(api)
