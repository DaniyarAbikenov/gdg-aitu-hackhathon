"""AI cost tracking for administrators: tokens per task and an estimate from configured prices."""

from datetime import UTC, datetime, timedelta
from typing import Any

from app.application.auth import Auth
from app.application.ports import AiUsageLog
from app.domain.models import Session

RETENTION_DAYS = 180


class AiUsageReport:
    def __init__(self, log: AiUsageLog, auth: Auth, input_price: float, output_price: float):
        """Prices are USD per million tokens, as configured; 0 means unknown."""
        self.log, self.auth = log, auth
        self.input_price, self.output_price = input_price, output_price

    def summary(self, session: Session, days: int) -> dict[str, Any]:
        self.auth.require_admin(session)
        report = self.log.summary(datetime.now(UTC) - timedelta(days=days))
        priced = self.input_price > 0 or self.output_price > 0
        for row in report["operations"] + report["daily"]:
            row["cost_usd"] = self.cost(row) if priced else None
        totals = {
            key: sum(row[key] for row in report["operations"])
            for key in ("calls", "failed", "input_tokens", "output_tokens")
        }
        totals["cost_usd"] = self.cost(totals) if priced else None
        return {"days": days, "priced": priced, "totals": totals, **report}

    def cost(self, row: dict[str, Any]) -> float:
        return round(
            (row["input_tokens"] * self.input_price + row["output_tokens"] * self.output_price)
            / 1_000_000,
            4,
        )
