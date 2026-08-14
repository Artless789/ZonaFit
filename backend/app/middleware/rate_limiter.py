from slowapi import Limiter
from slowapi.util import get_remote_address


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
)


class RateLimitConfig:
    DEFAULT = "100/minute"
    LOGIN = "10/minute"
    REGISTER = "5/minute"
    REPORTS = "30/minute"
