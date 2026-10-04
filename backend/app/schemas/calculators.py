from typing import Any
from pydantic import BaseModel, Field


class MarginEstimateResponse(BaseModel):
    crop: str = Field(..., description="Crop commodity name")
    state: str = Field(..., description="State name")
    market: str | None = Field(None, description="Mandi market name if specified")
    field_size_acres: float = Field(..., description="Field size in acres")
    price_per_qtl: float = Field(..., description="Current modal market price in ₹/quintal")
    cost_c2_per_qtl: float = Field(..., description="Comprehensive cost of cultivation (C2) in ₹/quintal")
    cost_a2fl_per_qtl: float | None = Field(None, description="Paid-out cost + family labor (A2+FL) in ₹/quintal")
    margin_per_qtl: float = Field(..., description="Estimated net margin in ₹/quintal (price - cost_c2)")
    reference_yield_qtl_per_hectare: float = Field(..., description="DES state reference yield in qtl/ha")
    est_total_yield_qtl: float = Field(..., description="Estimated harvest in quintals based on field size")
    est_total_margin: float = Field(..., description="Estimated total net margin in ₹ across field")
    cost_year: str = Field(..., description="Survey year of DES reference data (e.g. 2022-23)")
    source: str = Field(..., description="Citation of reference cost data")
    notice: str = Field(
        default="State reference average, not farmer's actual cost. Derived from the DES Cost of Cultivation Scheme (C2 includes imputed land rental and capital interest).",
        description="Methodology and provenance notice"
    )


class StorageEstimateResponse(BaseModel):
    crop: str = Field(..., description="Crop commodity name")
    market: str = Field(..., description="Mandi market name")
    state: str = Field(..., description="State name")
    storable: bool = Field(..., description="True if crop can be commercially stored on-farm or warehouse")
    current_price_per_qtl: float | None = Field(None, description="Current modal price at harvest/intake in ₹/quintal")
    storage_cost_per_qtl_month: float = Field(..., description="Farmer-specified storage cost in ₹/qtl/month")
    storage_months: int = Field(..., description="Storage holding duration in months")
    typical_loss_pct_per_month: float | None = Field(None, description="Standard physical/moisture weight loss % per month")
    net_cost_per_qtl: float | None = Field(None, description="Cumulative storage fee + value lost from shrinkage per quintal")
    breakeven_price_per_qtl: float | None = Field(None, description="Required market price at sell-off to avoid loss (₹/qtl)")
    historical_price_change_pct: float | None = Field(None, description="Historical seasonal price trend change % over same interval")
    reason: str | None = Field(None, description="Detailed explanation if crop is non-storable or data is restricted")
    source: str = Field(..., description="Storage parameters citation")
    notice: str = Field(
        default="Reference holding estimate. Arithmetic is based on standard loss rates and farmer's storage fee input; actual prices vary by mandi quality and season.",
        description="Uncertainty and methodology disclaimer"
    )
