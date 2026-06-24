#!/usr/bin/env python3
"""校验由 prebuild-docs skill 生成的文档集合。

用法：
    python scripts/validate_doc_set.py /path/to/repo
"""

from __future__ import annotations

import argparse
from pathlib import Path


REQUIRED_FILES = [
    "AGENTS.md",
    "docs/CURRENT_STATE.md",
    "docs/FRONTEND_DESIGN.md",
    "docs/plans/README.md",
]


def count_lines(path: Path) -> int:
    return len(path.read_text(encoding="utf-8").splitlines())


def main() -> int:
    parser = argparse.ArgumentParser(description="校验目标仓库的分层上下文文档是否完整。")
    parser.add_argument("repo", type=Path, help="需要校验的仓库根目录")
    args = parser.parse_args()

    repo = args.repo.resolve()
    errors: list[str] = []
    warnings: list[str] = []

    if not repo.exists():
        errors.append(f"仓库路径不存在：{repo}")
    else:
        for relative in REQUIRED_FILES:
            path = repo / relative
            if not path.exists():
                errors.append(f"缺少必需文件：{relative}")
            elif path.stat().st_size == 0:
                errors.append(f"必需文件为空：{relative}")

        current_state = repo / "docs/CURRENT_STATE.md"
        if current_state.exists():
            lines = count_lines(current_state)
            if lines > 250:
                warnings.append(
                    f"docs/CURRENT_STATE.md 当前为 {lines} 行；建议不超过 250 行。"
                )

    if errors:
        print("校验失败：")
        for item in errors:
            print(f"- {item}")
    else:
        print("必需文档文件均已存在。")

    if warnings:
        print("\n警告：")
        for item in warnings:
            print(f"- {item}")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
