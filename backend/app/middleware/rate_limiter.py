from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_real_client_ip(request: Request) -> str:
    """
    Determina la direccion IP real del cliente considerando proxies inversos,
    Cloudflare (CF-Connecting-IP), balanceadores (X-Forwarded-For) o conexion directa.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    xff = request.headers.get("x-forwarded-for")
    if xff:
        client_ip = xff.split(",")[0].strip()
        if client_ip:
            return client_ip

    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()

    return get_remote_address(request)


limiter = Limiter(
    key_func=get_real_client_ip,
    default_limits=["100/minute"],
)


class RateLimitConfig:
    DEFAULT = "100/minute"
    LOGIN = "20/minute"
    REFRESH = "60/minute"
    REGISTER = "10/minute"
    REPORTS = "30/minute"
