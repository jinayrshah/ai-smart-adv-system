from app.data.types import MandiRecord


def flag_quality(record: MandiRecord) -> MandiRecord:
    """
    Evaluate record price validity and assign a quality flag:
    - 'missing_price': modal_price is None or <= 0
    - 'nonpositive': min_price or max_price is <= 0
    - 'order_violation': min > max, modal < min, or modal > max
    - 'ok': normal valid record
    """
    min_p = record.min_price
    max_p = record.max_price
    modal_p = record.modal_price

    flag = "ok"

    if modal_p is None or modal_p <= 0:
        flag = "missing_price"
    elif (min_p is not None and min_p <= 0) or (max_p is not None and max_p <= 0):
        flag = "nonpositive"
    elif min_p is not None and max_p is not None and min_p > max_p:
        flag = "order_violation"
    elif min_p is not None and modal_p < min_p:
        flag = "order_violation"
    elif max_p is not None and modal_p > max_p:
        flag = "order_violation"

    if flag != record.quality_flag:
        return MandiRecord(
            state=record.state,
            district=record.district,
            market=record.market,
            commodity=record.commodity,
            variety=record.variety,
            grade=record.grade,
            arrival_date=record.arrival_date,
            min_price=record.min_price,
            max_price=record.max_price,
            modal_price=record.modal_price,
            arrivals_tonnes=record.arrivals_tonnes,
            unit=record.unit,
            source=record.source,
            source_priority=record.source_priority,
            quality_flag=flag,
        )

    return record
