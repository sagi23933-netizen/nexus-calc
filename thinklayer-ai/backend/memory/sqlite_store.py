"""SQLite-backed conversation + message history (short-term memory)."""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path


class SqliteStore:
    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at REAL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                role TEXT,
                content TEXT,
                metadata TEXT,
                created_at REAL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            );
            """
        )
        self.conn.commit()

    def create_conversation(self, title: str = "New chat") -> str:
        cid = str(uuid.uuid4())
        self.conn.execute(
            "INSERT INTO conversations (id, title, created_at) VALUES (?, ?, ?)",
            (cid, title, time.time()),
        )
        self.conn.commit()
        return cid

    def add_message(self, conversation_id: str, role: str, content: str, metadata: dict | None = None) -> str:
        mid = str(uuid.uuid4())
        self.conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (mid, conversation_id, role, content, json.dumps(metadata or {}), time.time()),
        )
        self.conn.commit()
        return mid

    def list_conversations(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT id, title, created_at FROM conversations ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def get_messages(self, conversation_id: str) -> list[dict]:
        rows = self.conn.execute(
            "SELECT role, content, metadata, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
            (conversation_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["metadata"] = json.loads(d["metadata"] or "{}")
            out.append(d)
        return out
