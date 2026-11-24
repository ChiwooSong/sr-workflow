"""Check the invoking shell's Git checkout before running project tests."""

import argparse
import json
from pathlib import Path
import subprocess
import sys


def git(*args):
    return subprocess.check_output(
        ["git", *args], encoding="utf-8", errors="replace"
    ).rstrip("\r\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="Expected worktree root")
    parser.add_argument("branch", help="Expected SR branch")
    args = parser.parse_args()
    try:
        root = Path(git("rev-parse", "--show-toplevel")).resolve(strict=True)
        branch = git("branch", "--show-current")
        matches = root.samefile(args.root) and branch == args.branch
        result = {
            "root": str(root),
            "branch": branch,
            "commit": git("rev-parse", "HEAD"),
            "dirty": bool(git("status", "--porcelain")),
            "matches": matches,
        }
    except (OSError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        return 2
    print(json.dumps(result))
    return 0 if matches else 1


if __name__ == "__main__":
    sys.exit(main())
