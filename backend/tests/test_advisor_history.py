"""Advisor chat memory: earlier turns reach the prompt (trimmed) and short follow-ups are searched in context."""

from app.api.routes.advisory import _retrieval_query
from app.domain.advisory.generator import HISTORY_CHARS, HISTORY_TURNS, _history_block
from app.schemas.advisory import AdvisoryAskRequest, ChatTurn


def test_history_block_keeps_last_turns_and_trims():
    turns = [ChatTurn(role="user" if i % 2 == 0 else "assistant", text=f"turn {i} " + "x" * 1000) for i in range(10)]
    block = _history_block(turns)
    assert block.startswith("EARLIER_CONVERSATION")
    assert "turn 3 " not in block and f"turn {10 - HISTORY_TURNS} " in block
    assert all(len(line) <= HISTORY_CHARS + 20 for line in block.splitlines()[1:] if line)
    assert "NOT verified" in block


def test_history_block_empty():
    assert _history_block([]) == ""
    assert _history_block(None) == ""


def test_short_follow_up_uses_previous_question_for_retrieval():
    req = AdvisoryAskRequest(query="and for the next stage?", history=[
        ChatTurn(role="user", text="Which fertilizer for wheat at tillering?"),
        ChatTurn(role="assistant", text="Apply the second urea dose..."),
    ])
    q = _retrieval_query(req)
    assert "wheat at tillering" in q and q.endswith("and for the next stage?")


def test_long_question_is_searched_as_is():
    req = AdvisoryAskRequest(query="How much water does my cotton need this week given the heat?",
                             history=[ChatTurn(role="user", text="hello")])
    assert _retrieval_query(req) == req.query
