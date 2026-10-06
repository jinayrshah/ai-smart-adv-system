"""
Advisory Feedback Audit & Review Job.
Architecture_Advisory.md §19, Implementationplan_Advisory.md Phase 7.

Weekly manual agronomic audit job:
Queries all advisory responses marked with negative feedback (feedback = -1),
inspects the exact context_snapshot used during generation, retrieved citations,
confidence ratings, and identifies potential knowledge gaps in PoP documents or calculation engines.
"""

import argparse
import json
import logging
import sys
from typing import Any

from app.data.advisory.query_repo import get_query_repo

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("review_advisory_feedback")


def format_table_row(query: dict[str, Any]) -> str:
    qid = query.get("id", "N/A")
    created = str(query.get("created_at", "N/A"))[:19]
    conf = query.get("confidence", "N/A")
    prompt = query.get("user_query", "")
    if len(prompt) > 40:
        prompt = prompt[:37] + "..."

    ctx = query.get("context_snapshot", {})
    crop = ctx.get("crop", "N/A")
    stage = "N/A"
    if "growth_stage" in ctx and isinstance(ctx["growth_stage"], dict):
        stage = ctx["growth_stage"].get("stage_name", "N/A")

    return f"| {qid:<6} | {created:<19} | {crop:<10} | {stage:<14} | {conf:<12} | {prompt:<40} |"


def review_feedback(limit: int = 25, output_format: str = "table", output_file: str | None = None) -> list[dict[str, Any]]:
    repo = get_query_repo()
    stats = repo.get_feedback_summary()
    flagged = repo.get_flagged_queries(limit=limit)

    summary_header = f"""
================================================================================
🌾 ADVISORY FEEDBACK AUDIT REPORT (Manual Agronomic Review)
================================================================================
Total Advisory Queries Logged:  {stats['total_queries']}
Positive Feedback (+1 Thumbs Up): {stats['upvotes']}
Negative Feedback (-1 Flagged):   {stats['downvotes']}
Unrated Queries:                {stats['unrated']}
Overall Farmer Satisfaction:    {stats['satisfaction_rate_pct']}%
Queries Reviewed in this Run:   {len(flagged)} (Limit: {limit})
================================================================================
"""

    if output_format == "json":
        data = {
            "summary": stats,
            "flagged_queries": flagged,
        }
        json_output = json.dumps(data, indent=2, ensure_ascii=False)
        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(json_output)
            print(f"Audit report saved to {output_file}")
        else:
            print(json_output)
        return flagged

    # Table format
    print(summary_header)
    if not flagged:
        print("✅ No negative feedback queries found. All rated responses met farmer satisfaction standards.\n")
        return flagged

    print(f"| {'ID':<6} | {'Created At':<19} | {'Crop':<10} | {'Stage':<14} | {'Confidence':<12} | {'Farmer Prompt':<40} |")
    print("|" + "-" * 8 + "|" + "-" * 21 + "|" + "-" * 12 + "|" + "-" * 16 + "|" + "-" * 14 + "|" + "-" * 42 + "|")
    for q in flagged:
        print(format_table_row(q))
    print("=" * 80 + "\n")

    print("🔍 DETAILED DISCREPANCY BREAKDOWN:")
    for idx, q in enumerate(flagged, 1):
        ctx = q.get("context_snapshot", {})
        resp = q.get("response_text", "")
        chunks = q.get("retrieved_chunk_ids", [])
        print(f"\n--- [Case #{idx}] Query ID: {q.get('id')} ---")
        print(f"Timestamp:   {q.get('created_at')}")
        print(f"Crop / Farm: {ctx.get('crop')} (Farm ID: {q.get('farm_id')}, Farmer ID: {q.get('farmer_id')})")
        print(f"Prompt:      \"{q.get('user_query')}\"")
        print(f"Confidence:  {q.get('confidence')}")

        if "irrigation" in ctx and isinstance(ctx["irrigation"], dict):
            irrig = ctx["irrigation"]
            print(f"Water Need:  ETc {irrig.get('etc_7d_mm')}mm, Rain {irrig.get('rain_7d_mm')}mm, Deficit {irrig.get('deficit_mm')}mm")

        if "soil_flags" in ctx and ctx["soil_flags"]:
            print(f"Soil Flags:  {ctx['soil_flags']}")

        print(f"Retrieved Chunks: {chunks}")
        print(f"Response:    \"{resp[:200]}...\"" if len(resp) > 200 else f"Response:    \"{resp}\"")

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(summary_header)
            f.write(json.dumps(flagged, indent=2, ensure_ascii=False))
        print(f"\nAudit details exported to {output_file}")

    return flagged


def main() -> None:
    parser = argparse.ArgumentParser(description="Review flagged advisory queries with feedback = -1")
    parser.add_argument("--limit", type=int, default=25, help="Maximum number of flagged queries to inspect")
    parser.add_argument("--format", choices=["table", "json"], default="table", help="Output display format")
    parser.add_argument("--output", type=str, default=None, help="Optional file path to write results")
    args = parser.parse_args()

    review_feedback(limit=args.limit, output_format=args.format, output_file=args.output)


if __name__ == "__main__":
    main()
