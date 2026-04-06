import pandas as pd

from src.main import Optimizer


class NoopOptimizer(Optimizer):
    def __init__(self) -> None:
        super().__init__("http://localhost:8123", "postgresql://tokenlens:secret@localhost:5432/tokenlens")

    def write_recommendations(self, recommendations):
        self.written = list(recommendations)


def test_build_recommendations_prefers_cheaper_models_for_low_complexity_features():
    optimizer = NoopOptimizer()
    usage = pd.DataFrame([
        {
            "workspace_id": "ws_1",
            "feature": "summaries",
            "model": "gpt-4o",
            "prompt_tokens": 100000,
            "completion_tokens": 10000,
            "total_tokens": 110000,
            "total_cost": 420.0,
            "total_calls": 1200,
            "avg_latency_ms": 220,
        }
    ])

    recommendations = optimizer.build_recommendations(usage)

    assert len(recommendations) == 1
    assert recommendations[0].suggested_model == "gpt-4o-mini"
    assert recommendations[0].estimated_saving_usd > 0


def test_forecast_costs_returns_thirty_days_per_workspace():
    optimizer = NoopOptimizer()
    daily = pd.DataFrame([
        {"workspace_id": "ws_1", "day": f"2026-03-{day:02d}T00:00:00Z", "daily_cost": 10 + day}
        for day in range(1, 11)
    ])

    forecast = optimizer.forecast_costs(daily)

    assert len(forecast) == 30
    assert set(["workspace_id", "date", "projected_cost", "p95_upper", "p95_lower"]).issubset(forecast.columns)
