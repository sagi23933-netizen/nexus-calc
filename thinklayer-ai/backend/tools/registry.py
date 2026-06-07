"""Controlled tool router.

The model does not freely decide to run tools in the MVP. The orchestrator
routes to a small, vetted set based on task type, and tools are invoked
explicitly. New tools register here.
"""
from __future__ import annotations

from typing import Callable

from .calculator import calculate
from .file_reader import read_file_text
from .python_runner import run_python

TOOLS: dict[str, Callable[..., dict]] = {
    "calculator": calculate,
    "python_runner": run_python,
    "file_reader": read_file_text,
}


def available_tools() -> list[str]:
    return sorted(TOOLS.keys())


def call_tool(name: str, **kwargs) -> dict:
    if name not in TOOLS:
        return {"ok": False, "error": f"unknown tool: {name}"}
    return TOOLS[name](**kwargs)
