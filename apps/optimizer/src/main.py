from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import timedelta
from io import StringIO
from typing import Iterable
from urllib import request

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from sklearn.linear_model import LinearRegression

CHEAPER_MODEL_MAP = {
    "gpt-4o": "gpt-4o-mini",
    "gpt-4-turbo": "gpt-4o-mini",
    "claude-opus-4-6": "claude-sonnet-4-6",
    "claude-sonnet-4-6": "claude-haiku-4-5-20251001",
    "gemini-1.5-pro": "gemini-1.5-flash",
}

@dataclass
class RecommendationRow:
    workspace_id: str
    feature: str
    current_model: str
    suggested_model: str
    estimated_saving_usd: float
    rationale: str

class ClickHouseHttpClient:
    def __init__(self, url: str) -> None:
        self.url = url.rstrip("/")

    def query_df(self, sql: str) -> pd.DataFrame:
        endpoint = f"{self.url}/?default_format=CSVWithNames"
        response = request.urlopen(endpoint, data=sql.encode("utf-8"), timeout=30)
        payload = response.read().decode("utf-8")
        if not payload.strip():
            return pd.DataFrame()
        return pd.read_csv(StringIO(payload))

class Optimizer:
    def __init__(self, clickhouse_url: str, database_url: str) -> None:
        self.clickhouse = ClickHouseHttpClient(clickhouse_url)
        self.database_url = database_url

    def fetch_feature_usage(self) -> pd.DataFrame:
        sql = """
            SELECT workspace_id, feature, model,
              sum(tokens_prompt) AS prompt_tokens,
              sum(tokens_completion) AS completion_tokens,
              sum(tokens_total) AS total_tokens,
              sum(usd_cost) AS total_cost,
              count() AS total_calls,
              avg(latency_ms) AS avg_latency_ms
            FROM llm_events
            WHERE created_at >= now() - INTERVAL 30 DAY
            GROUP BY workspace_id, feature, model
        """
        return self.clickhouse.query_df(sql)

    def fetch_daily_costs(self) -> pd.DataFrame:
        sql = """
            SELECT workspace_id, toStartOfDay(created_at) AS day, sum(usd_cost) AS daily_cost
            FROM llm_events
            WHERE created_at >= now() - INTERVAL 30 DAY
            GROUP BY workspace_id, day
            ORDER BY day ASC
        """
        return self.clickhouse.query_df(sql)
    def build_recommendations(self, usage_df: pd.DataFrame) -> list[RecommendationRow]:
        if usage_df.empty:
            return []
        normalized = usage_df.copy()
        normalized["complexity_score"] = (
            (normalized["completion_tokens"] / normalized["total_tokens"].clip(lower=1)) * 0.6
            + (normalized["avg_latency_ms"] / normalized["avg_latency_ms"].clip(lower=1).max()) * 0.4
        )
        normalized["volume_score"] = normalized["total_calls"] * normalized["total_cost"]
        recommendations: list[RecommendationRow] = []
        for row in normalized.itertuples(index=False):
            suggested_model = CHEAPER_MODEL_MAP.get(row.model)
            if not suggested_model or row.complexity_score > 0.5 or row.volume_score < 50:
                continue
            estimated_saving = float(row.total_cost) * 0.28
            rationale = (
                f"Feature '{row.feature}' has low observed complexity ({row.complexity_score:.2f}) "
                f"and high volume ({int(row.total_calls)} calls / ${float(row.total_cost):.2f}), making it a strong downgrade candidate."
            )
            recommendations.append(RecommendationRow(row.workspace_id, row.feature, row.model, suggested_model, round(estimated_saving, 2), rationale))
        return recommendations

    def forecast_costs(self, daily_df: pd.DataFrame) -> pd.DataFrame:
        if daily_df.empty:
            return pd.DataFrame(columns=["workspace_id", "date", "projected_cost", "p95_upper", "p95_lower"])
        daily_df = daily_df.copy()
        daily_df["day"] = pd.to_datetime(daily_df["day"], utc=True)
        frames = []
        for workspace_id, group in daily_df.groupby("workspace_id"):
            group = group.sort_values("day").reset_index(drop=True)
            x = pd.DataFrame({"t": range(len(group))})
            y = group["daily_cost"]
            model = LinearRegression().fit(x, y)
            predictions = model.predict(x)
            residual_std = float((y - predictions).std() or 0)
            last_day = group["day"].iloc[-1]
            future_x = pd.DataFrame({"t": range(len(group), len(group) + 30)})
            future = model.predict(future_x)
            forecast = pd.DataFrame({
                "workspace_id": workspace_id,
                "date": [last_day + timedelta(days=index + 1) for index in range(30)],
                "projected_cost": future,
            })
            forecast["p95_upper"] = forecast["projected_cost"] + (1.96 * residual_std)
            forecast["p95_lower"] = (forecast["projected_cost"] - (1.96 * residual_std)).clip(lower=0)
            frames.append(forecast)
        return pd.concat(frames, ignore_index=True)

    def write_recommendations(self, recommendations: Iterable[RecommendationRow]) -> None:
        rows = list(recommendations)
        with psycopg2.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM recommendations")
                if rows:
                    execute_values(
                        cursor,
                        "INSERT INTO recommendations (workspace_id, feature, current_model, suggested_model, estimated_saving_usd, rationale) VALUES %s",
                        [(row.workspace_id, row.feature, row.current_model, row.suggested_model, row.estimated_saving_usd, row.rationale) for row in rows],
                    )
    def run_once(self) -> dict[str, int]:
        usage = self.fetch_feature_usage()
        recommendations = self.build_recommendations(usage)
        self.write_recommendations(recommendations)
        forecast = self.forecast_costs(self.fetch_daily_costs())
        return {"recommendations": len(recommendations), "forecast_rows": len(forecast)}


def main() -> None:
    clickhouse_url = os.environ.get("CLICKHOUSE_URL", "http://localhost:8123")
    database_url = os.environ["DATABASE_URL"]
    optimizer = Optimizer(clickhouse_url, database_url)
    print(json.dumps(optimizer.run_once()))


if __name__ == "__main__":
    main()

