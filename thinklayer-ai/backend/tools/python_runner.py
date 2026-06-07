"""Minimal Python runner.

Executes a snippet in a subprocess with a timeout and captures stdout/stderr.
This is a starting point — for production, run inside a real sandbox
(container, nsjail, or a WASM runtime). It is intentionally conservative:
no network is assumed and the call is time-boxed.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


def run_python(code: str, timeout_s: float = 10.0) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "snippet.py"
        script.write_text(code, encoding="utf-8")
        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(script)],
                capture_output=True,
                text=True,
                timeout=timeout_s,
                cwd=tmp,
            )
            return {
                "ok": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout[-8000:],
                "stderr": proc.stderr[-8000:],
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "returncode": None, "stdout": "", "stderr": f"timeout after {timeout_s}s"}
