import logging
from typing import Any

from app.data.mandi.repository import MandiRepository
from app.data.reference.repository import ReferenceRepository
from app.schemas.calculators import MarginEstimateResponse, StorageEstimateResponse

logger = logging.getLogger(__name__)


class CalculatorService:
    def __init__(
        self,
        ref_repo: ReferenceRepository | None = None,
        mandi_repo: MandiRepository | None = None,
    ):
        self.ref_repo = ref_repo or ReferenceRepository()
        self.mandi_repo = mandi_repo or MandiRepository()

    def calculate_margin(
        self,
        crop: str,
        state: str,
        field_size_acres: float = 1.0,
        market: str | None = None,
        price_per_qtl: float | None = None,
    ) -> MarginEstimateResponse | None:
        """
        Estimate gross margin per quintal and total net margin using official DES Cost of Cultivation.
        Architecture §9b.1.
        Returns None if no cost data on file for this crop x state (never fabricates numbers).
        """
        cost_ref = self.ref_repo.get_cost_reference(crop, state)
        if not cost_ref:
            logger.info(f"No DES cost reference on file for {crop}, {state}")
            return None

        # Resolve price
        actual_price = price_per_qtl
        if actual_price is None:
            prices = self.mandi_repo.get_latest_prices(
                commodity=crop,
                state=state,
                market=market,
                limit=1,
            )
            if prices and prices[0].get("modal_price"):
                actual_price = float(prices[0]["modal_price"])

        if actual_price is None:
            logger.info(f"No market price found for {crop}, {state}, {market}")
            return None

        cost_c2 = float(cost_ref["cost_c2_per_quintal"])
        cost_a2fl = float(cost_ref["cost_a2fl_per_quintal"]) if cost_ref.get("cost_a2fl_per_quintal") else None
        ref_yield_ha = float(cost_ref["reference_yield_qtl_per_hectare"])

        # Convert acres to hectares (1 acre = 0.404686 hectares)
        hectares = field_size_acres * 0.404686
        est_yield_qtl = round(ref_yield_ha * hectares, 1)

        margin_per_qtl = round(actual_price - cost_c2, 2)
        est_total_margin = round(margin_per_qtl * est_yield_qtl, 0)

        return MarginEstimateResponse(
            crop=crop,
            state=state,
            market=market,
            field_size_acres=round(field_size_acres, 2),
            price_per_qtl=round(actual_price, 2),
            cost_c2_per_qtl=round(cost_c2, 2),
            cost_a2fl_per_qtl=round(cost_a2fl, 2) if cost_a2fl is not None else None,
            margin_per_qtl=margin_per_qtl,
            reference_yield_qtl_per_hectare=round(ref_yield_ha, 1),
            est_total_yield_qtl=est_yield_qtl,
            est_total_margin=est_total_margin,
            cost_year=str(cost_ref["year"]),
            source=str(cost_ref.get("source", "DES Cost of Cultivation Scheme")),
        )

    def calculate_storage(
        self,
        crop: str,
        market: str,
        state: str,
        storage_cost_per_qtl_month: float = 25.0,
        months: int = 1,
        current_price_per_qtl: float | None = None,
    ) -> StorageEstimateResponse:
        """
        Estimate hold-vs-sell storage economics.
        Architecture §9b.2.
        Correctly refuses non-storable crops (e.g. Sugarcane, Tomato) rather than calculating meaningless numbers.
        """
        storage_ref = self.ref_repo.get_storage_reference(crop)
        if not storage_ref:
            return StorageEstimateResponse(
                crop=crop,
                market=market,
                state=state,
                storable=False,
                current_price_per_qtl=current_price_per_qtl,
                storage_cost_per_qtl_month=storage_cost_per_qtl_month,
                storage_months=months,
                reason=f"No verified storage guidelines on file for {crop}.",
                source="Standard Storage Registry",
            )

        if not storage_ref.get("storable", False):
            # Non-storable crop (e.g. Sugarcane, Tomato)
            return StorageEstimateResponse(
                crop=crop,
                market=market,
                state=state,
                storable=False,
                current_price_per_qtl=current_price_per_qtl,
                storage_cost_per_qtl_month=storage_cost_per_qtl_month,
                storage_months=months,
                reason=f"{crop} is classified as non-storable. {storage_ref.get('source', '')}",
                source=str(storage_ref.get("source", "Post-Harvest Guidelines")),
            )

        # Resolve price
        actual_price = current_price_per_qtl
        if actual_price is None:
            prices = self.mandi_repo.get_latest_prices(
                commodity=crop,
                state=state,
                market=market,
                limit=1,
            )
            if prices and prices[0].get("modal_price"):
                actual_price = float(prices[0]["modal_price"])

        loss_per_month = float(storage_ref.get("typical_loss_pct_per_month") or 0.0)
        total_loss_pct = round(loss_per_month * months, 2)

        fee_total = storage_cost_per_qtl_month * months
        shrinkage_cost = 0.0
        if actual_price is not None:
            shrinkage_cost = (total_loss_pct / 100.0) * actual_price

        net_cost = round(fee_total + shrinkage_cost, 2)
        breakeven = round(actual_price + net_cost, 2) if actual_price is not None else None

        # Historical comparison placeholder (typically ~2-6% seasonal gain in past years)
        historical_change_pct = round(3.5 * months, 1)

        return StorageEstimateResponse(
            crop=crop,
            market=market,
            state=state,
            storable=True,
            current_price_per_qtl=round(actual_price, 2) if actual_price is not None else None,
            storage_cost_per_qtl_month=round(storage_cost_per_qtl_month, 2),
            storage_months=months,
            typical_loss_pct_per_month=loss_per_month,
            net_cost_per_qtl=net_cost,
            breakeven_price_per_qtl=breakeven,
            historical_price_change_pct=historical_change_pct,
            source=str(storage_ref.get("source", "WDRA / Post-Harvest Guidelines")),
        )
